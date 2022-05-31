
const StateMachine = require('javascript-state-machine');
const TelegramBotClient = require('node-telegram-bot-api');
const walletsFile = 'trackedAddresses.csv';
const fs = require('fs');
const csv = require('csvtojson');
const { Parser } = require('json2csv');
const json2csv = require('json2csv').parse;
const web3 = require('@solana/web3.js');
const spl = require('@solana/spl-token');
const Ethplorer = require('ethplorer-js').Ethplorer
const config = require('./config.js');

function createFsm() {
    return new StateMachine({
        init: 'waitingstart',
        transitions: [
            { name: 'gotstart', from: '*', to: 'choosingaction' },
            { name: 'gotbalancerequest', from: '*', to: 'waitingchain2' },
            { name: 'gotchain1', from: 'waitingchain1', to: 'waitingwallet1' },
            { name: 'gotchain2', from: 'waitingchain2', to: 'waitingwallet2' },
            { name: 'gotwallet1', from: 'waitingwallet1', to: 'tracking' },
            { name: 'gotwallet2', from: 'waitingwallet2', to: 'checkingbalance' },
            { name: 'gotaddorder', from: '*', to: 'waitingchain1' },
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
        case 'choosingaction':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else if (text == 'Check balance') {
                return 'gotbalancerequest'
            } else { return 'reset' }
            break
        case 'waitingchain1':
            if (text == '1' || text == '2') {
                return 'gotchain1'
            } else { return 'waitingchain1' }
            break
        case 'waitingchain2':
            if (text == '1' || text == '2') {
                return 'gotchain2'
            } else { return 'waitingchain1' }
            break
        case 'waitingwallet1':
            return 'gotwallet1' // TODO: check sintax of wallet address
            break
        case 'waitingwallet2':
            return 'gotwallet2' // TODO: check sintax of wallet address
            break
        case 'tracking':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else if (text == 'Check balance') {
                return 'gotbalancerequest'
            } else { return 'reset' }
            break
        case 'checkingbalance':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else if (text == 'Check balance') {
                return 'gotbalancerequest'
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
            } else if (text == 'Check balance') {
                return 'gotbalancerequest'
            } else { return 'reset' }
            break
        case 'invalid':
            if (text == 'Add wallet') {
                return 'gotaddorder'
            } else if (text == 'Remove wallet') {
                return 'gotremoveorder'
            } else if (text == 'Check balance') {
                return 'gotbalancerequest'
            } else { return 'reset' }
            break
    }
}

const commands = ["Add wallet", "Remove wallet", "Check balance"]

class Bot {
    constructor(token) {
        this.client = new TelegramBotClient(token,
            // { polling: true }
        );
        this.client.setWebHook(config.heroku_app + token, {
            port: process.env.PORT || 3000
        });
        // console.log(config.heroku_app + token);
    }

    start() {
        this.client.on('message', message => {
            if ((!message.reply_to_message) && (!commands.includes(message.text))) {
                this.respondTo(message)
            }
        })
    }

    async checkEthereumTokensBalance(wallet) {
        let api = new Ethplorer();

        try {
            var msg = 'Token                  Balance\n------------------------------------------------\n';
            let address_info = await api.getAddressInfo(wallet)
            msg += `ETH:                    ${address_info["ETH"]["balance"]}\n`

            for (let i of address_info['tokens']) {
                msg += `${i['tokenInfo']['address']} (${i['tokenInfo']['symbol']})   ${i['balance'] / (10 ** (parseInt(i['tokenInfo']['decimals']) | 0))}\n`
            };
            return msg;
        } catch (e) {
            return `❗ Invalid address format`;
        }

    };

    async checkSolanaTokensBalance(wallet) {
        const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

        try {
            const tokenAccounts = await connection.getTokenAccountsByOwner(
                new web3.PublicKey(wallet),
                {
                    programId: spl.TOKEN_PROGRAM_ID,
                });

            var msg_text = 'Token                    Balance\n------------------------------------------------\n'

            tokenAccounts.value.forEach((e) => {
                const accountInfo = spl.AccountLayout.decode(e.account.data);
                if (accountInfo.amount != '0') {
                    msg_text += `${accountInfo.mint}    ${accountInfo.amount}\n`
                };
            });
            return msg_text;

        } catch (e) {
            return `❗ Invalid address format`;
        }

    };

    // TODO: add 'list of tracked wallets', solana tracking
    async respondTo(message) {
        let fsm = createFsm()
        let lastReply = message
        let lastMessage

        fsm.onLeaveWaitingstart = () => {
            fsm.chatId = message.chat.id;
            lastMessage = this.client.sendMessage(message.chat.id,
                'Hey there! I am a Wallet tracker. I can check any wallet balance on Ethereum or Solana and notify you upon token transfers.',
            );
        }

        fsm.onEnterChoosingaction = () => {
            fsm.chatId = message.chat.id;
            lastMessage = this.client.sendMessage(message.chat.id,
                `Please choose what you would like to do.`,
                {
                    reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
                });
        }

        fsm.onEnterWaitingchain1 = () => {
            fsm.chatId = message.chat.id;
            lastMessage = this.client.sendMessage(message.chat.id,
                'Which chain do you want to track? Type 1 for Solana, 2 for Ethereum',
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterWaitingchain2 = () => {
            fsm.chatId = message.chat.id;
            lastMessage = this.client.sendMessage(message.chat.id,
                'Which chain does the wallet belong to? Type 1 for Solana, 2 for Ethereum',
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterWaitingwallet1 = () => {
            fsm.chain = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `Got it, ${message.chat.first_name}, now type the wallet address`,
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterWaitingwallet2 = () => {
            fsm.chain = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `Alright, now type the wallet address`,
                { reply_markup: JSON.stringify({ force_reply: true }) });
        }

        fsm.onEnterTracking = () => {
            fsm.wallet = lastReply.text;
            lastMessage = this.client.sendMessage(message.chat.id,
                `The address ${lastReply.text} is now being tracked for transactions. You can add/remove tracked wallets.`,
                {
                    reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
                });
            fsm.saveRecord();
        }

        fsm.onEnterCheckingbalance = async () => {
            fsm.wallet = lastReply.text;

            if (fsm.chain == '2') {
                var msg_text = await this.checkEthereumTokensBalance(fsm.wallet)
            } else if (fsm.chain == '1') {
                var msg_text = await this.checkSolanaTokensBalance(fsm.wallet)
            };

            lastMessage = this.client.sendMessage(message.chat.id,
                `The balance of ${fsm.wallet} is:\n${msg_text}`,
                {
                    reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
                });
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
                        reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
                    });
            } else {
                lastMessage = this.client.sendMessage(message.chat.id,
                    `The address ${wallet_to_remove} is not found in the tracking list.`,
                    {
                        reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
                    });
            }
        }

        fsm.onEnterInvalid = () => {
            lastMessage = this.client.sendMessage(message.chat.id,
                'Sorry, I didn\'t catch that. Please choose one of the commands.',
                {
                    reply_markup: { keyboard: [["Add wallet", "Remove wallet"], ["Check balance"]], resize_keyboard: true }
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
        }
    }
}

module.exports = Bot;