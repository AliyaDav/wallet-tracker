
const StateMachine = require('javascript-state-machine');
const TelegramBotClient = require('node-telegram-bot-api');
const walletsFile = 'trackedAddresses.csv';
const config = require('./config.js');
const fs = require('fs');
const csvWriter = require('csv-write-stream')

function createFsm() {
    return new StateMachine({
        init: 'waitingstart',
        transitions: [
            { name: 'gotstart', from: 'waitingstart', to: 'waitingchain' },
            { name: 'gotchain', from: 'waitingchain', to: 'waitingwallet' },
            { name: 'gotwallet', from: 'waitingwallet', to: 'final' },
            // { name: 'remove wallet', from: 'echoing', to: 'confirm' },
            // { name: 'confirmed', from: 'confirm', to: 'final' },
            // { name: 'cancelled', from: 'confirm', to: 'echoing' },
            // { name: 'invalid', from: 'confirm', to: 'confirm' }
        ],
        methods: {
            isFinished: function () { return this.state === 'done' },
            saveRecord: function () {

                if (!fs.existsSync(walletsFile))
                    writer = csvWriter({ headers: ["ChatId", "Chain", "Wallet", "Tracked"] });
                else
                    writer = csvWriter({ sendHeaders: false });

                writer.pipe(fs.createWriteStream(walletsFile, { flags: 'a' }));
                writer.write({
                    ChatId: this.chatId,
                    Chain: this.chain,
                    Wallet: this.wallet,
                    Tracked: true
                });
                writer.end();
            }

        }
    })
}

function eventFromStateAndMessageText(state, text) {
    switch (state) {
        case 'waitingstart':
            return text === '/start' && 'gotstart'
            break
        case 'waitingchain':
            console.log(`Text is ${text}`);
            return (text === '1' || text === '2') && 'gotchain'
            break
        case 'waitingwallet':
            return 'gotwallet' // TODO: check regex of wallet address
            break
        // case 'confirm':
        //     if (text === 'yes') {
        //         return 'confirmed'
        //     } else if (text === 'no') {
        //         return 'cancelled'
        //     } else {
        //         return 'invalid'
        //     }
    }
}

class Bot {
    constructor(token) {
        this.client = new TelegramBotClient(token,
            // { polling: true }
        );
        this.client.setWebHook(config.heroku_app + ':443/bot' + token);
    }

    start() {
        this.client.on('message', message => {
            if (!message.reply_to_message) {
                this.respondTo(message)
            }
        })
    }

    async respondTo(message) {
        let fsm = createFsm()
        let lastReply = message
        let lastMessage

        fsm.onEnterWaitingchain = () => {
            fsm.chatId = message.chat.id;
            lastMessage = this.client.sendMessage(message.chat.id,
                'Let\'s begin! Which chain do you want to track? Type 1 for Solana, 2 for Ethereum',
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterWaitingwallet = () => {
            fsm.chain = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `Got it ${message.chat.first_name}, now type the wallet address`,
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterFinal = () => {
            fsm.wallet = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `The address ${lastReply.text} is now being tracked for transactions.`);
            fsm.saveRecord();
        }

        fsm.onEnterInvalid = () => {
            lastMessage = this.client.sendMessage(message.chat.id,
                'Sorry, I didn\'t catch that, do you want to cancel? (yes/no)',
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        while (!fsm.isFinished()) {
            let text = lastReply.text
            // console.log(`last reply text - ${text}, state is ${fsm.state}`)
            let event = eventFromStateAndMessageText(fsm.state, text)

            // console.log(`Event is ${event}`)

            if (!event || !fsm.can(event)) {
                this.client.sendMessage(message.chat.id, 'I wasn\'t expecting that, try /start')
                break
            }

            fsm[event](lastReply)

            let sentMessage = await lastMessage
            // console.log("Last sent message - ", sentMessage);
            lastReply = await new Promise(resolve => this.client.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, resolve))
            // console.log("Last reply - ", lastReply)
        }
    }
}

// const bot = new Bot('5378223287:AAHEbIsWPvnS1utcSFN2KrEZxh6a7gu0Y7U');
// bot.start();
// export default Bot;
module.exports = Bot;