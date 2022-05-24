
const StateMachine = require('javascript-state-machine');
const TelegramBotClient = require('node-telegram-bot-api');
const walletsFile = 'trackedAddresses.csv';
const fs = require('fs');
const csv = require('csvtojson');
const { Parser } = require('json2csv');
const json2csv = require('json2csv').parse;

function createFsm() {
    return new StateMachine({
        init: 'waitingstart',
        transitions: [
            { name: 'gotstart', from: 'waitingstart', to: 'waitingchain' },
            { name: 'gotchain', from: 'waitingchain', to: 'waitingwallet' },
            { name: 'gotwallet', from: 'waitingwallet', to: 'tracking' },
            { name: 'gotaddorder', from: '*', to: 'waitingchain' },
            { name: 'gotremoveorder', from: '*', to: 'removingwallet' },
            { name: 'gotremovedwallet', from: 'removingwallet', to: 'removedwallet' },
            { name: 'reset', from: '*', to: 'invalid' }
        ],
        methods: {
            isFinished: function () { return this.state === 'done' },
            saveRecord: function () {

                let rows;

                const walletToAdd = {
                    ChatId: this.chatId,
                    Chain: this.chain,
                    Wallet: this.wallet,
                    Tracked: true
                }

                if (!fs.existsSync(walletsFile)) {
                    rows = json2csv(walletToAdd, { header: true });
                } else {
                    rows = json2csv(walletToAdd, { header: false });
                }

                fs.appendFileSync(walletsFile, rows);
                fs.appendFileSync(walletsFile, "\r\n");
            },
            removeRecord: async (wallet) => {

                var filteredWallets = [];
                var walletFound = '';
                const wallets = await csv().fromFile(walletsFile);

                for (let w of wallets) {
                    if (w.Wallet != wallet) {
                        filteredWallets.push(w)
                    } else {
                        walletFound = wallet
                    }
                }

                const newTrackedWallets = new Parser({ fields: ["ChatId", "Chain", "Wallet", "Tracked"] }).parse(filteredWallets);
                fs.writeFileSync(walletsFile, newTrackedWallets);
                fs.appendFileSync(walletsFile, "\r\n");

                if (walletFound != '') {
                    return walletFound
                }
            }
        }
    });
}

function eventFromStateAndMessageText(state, text) {
    switch (state) {
        case 'waitingstart':
            return text === '/start' && 'gotstart'
            break
        case 'waitingchain':
            if (text == '1' || text == '2') {
                return 'gotchain'
            } else { return 'waitingchain' }
            break
        case 'waitingwallet':
            return 'gotwallet' // TODO: check sintax of wallet address
            break
        case 'tracking':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else { return 'reset' }
            break
        case 'removingwallet':
            return 'gotremovedwallet'
            break
        case 'removedwallet':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else { return 'reset' }
            break
        case 'invalid':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else { return 'reset' }
            break
    }
}

const commands = ['Remove wallet', 'Add wallet', 'Add chain']

class Bot {
    constructor(token) {
        this.client = new TelegramBotClient(token,
            { polling: true }
        );
        // this.client.setWebHook(config.heroku_app + ':443/bot' + token);
    }

    start() {
        this.client.on('message', message => {
            if ((!message.reply_to_message) && (!commands.includes(message.text))) {
                this.respondTo(message)
            }
        })
    }

    // TODO: add 'balances' , 'list of tracked wallets'
    async respondTo(message) {
        // console.log('New fsm created')
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

        fsm.onEnterTracking = () => {
            fsm.wallet = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `The address ${lastReply.text} is now being tracked for transactions. You can add/remove tracked wallets.`,
                {
                    reply_markup: { keyboard: [["Add wallet", "Add chain"], ["Remove wallet"]], resize_keyboard: true }
                });
            fsm.saveRecord();
        }

        fsm.onEnterRemovingwallet = () => {
            lastMessage = this.client.sendMessage(message.chat.id,
                "Type wallet address that you want to remove from tracking list",
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterRemovedwallet = () => {
            var wallet_to_remove = lastReply.text;
            const removed_wallet = fsm.removeRecord(wallet_to_remove);
            if (removed_wallet) {
                lastMessage = this.client.sendMessage(message.chat.id,
                    `The address ${lastReply.text} is removed from tracking list.`,
                    {
                        reply_markup: { keyboard: [["Add wallet", "Add chain"], ["Remove wallet"]], resize_keyboard: true }
                    });
            } else {
                lastMessage = this.client.sendMessage(message.chat.id,
                    `The address ${wallet_to_remove} is not found in the tracking list.`,
                    {
                        reply_markup: { keyboard: [["Add wallet", "Add chain"], ["Remove wallet"]], resize_keyboard: true }
                    });
            }
        }

        fsm.onEnterInvalid = () => {
            lastMessage = this.client.sendMessage(message.chat.id,
                'Sorry, I didn\'t catch that. Please choose one of the commands.',
                {
                    reply_markup: { keyboard: [["Add wallet", "Add chain"], ["Remove wallet"]], resize_keyboard: true }
                });
        }

        while (fsm.state != 'done') {
            let text = lastReply.text
            let event = eventFromStateAndMessageText(fsm.state, text)

            if (!event || !fsm.can(event)) {
                this.client.sendMessage(message.chat.id, 'I wasn\'t expecting that, try /start')
                break
            }

            fsm[event](lastReply)

            let sentMessage = await lastMessage
            lastReply = await new Promise(resolve => {
                if (!sentMessage.reply_to_message) {
                    this.client.on('message', resolve)
                } else {
                    this.client.onReplyToMessage(sentMessage.chat.id, sentMessage.message_id, resolve)
                }
            })
            // console.log('In the end: state - ', fsm.state);
        }
    }
}

module.exports = Bot;