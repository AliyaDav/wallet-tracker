// credits: https://github.com/0xScar/whale-watcher

// const config = require('./config.js');
const { ethers } = require('ethers');
const Bot = require('./bot.js');

class TransactionChecker {
    customWsProvider;
    infura_http;
    wallets;
    topicSets;

    constructor() {
        this.customWsProvider = new ethers.providers.WebSocketProvider(config.infura_mainnet_ws);
        this.infura_http = new ethers.providers.JsonRpcProvider(config.infura_mainnet_http);
        this.topicSets = [
            ethers.utils.id("Transfer(address,address,uint256)"),
            null,
            null
        ];
        this.bot = new Bot(config.bot_token);
    };

    // TODO: update wallets without reading it all over again
    async undateWalletsList() {
        const csv = require('csv-parser');
        const fs = require('fs');
        this.wallets = [];
        if (fs.existsSync('trackedAddresses.csv')) {
            fs.createReadStream('trackedAddresses.csv')
                .pipe(csv())
                .on('data', (row) => {
                    this.wallets.push(row);
                });
        };
    }

    getTxAddresses(log) {

        if (log['topics'].length > 3) {
            var addrFrom = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][2]);
            var addrTo = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][3]);
        };
        if (log['topics'].length == 3) {
            var addrFrom = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][1]);
            var addrTo = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][2]);
        };
        return [addrFrom, addrTo];
    };

    async checkValidTx(log) {
        let tx_receipt = await this.infura_http.getTransactionReceipt(log['transactionHash']);
        return (tx_receipt['status'] != 0);
    };

    notifyTrackedAddress(row, log) {

        var [addrFrom, addrTo] = this.getTxAddresses(log);
        // check if _from or _to matches any of the tracked wallets
        if (row['Wallet'] == addrFrom || addrTo) {
            // if matches, then check of tx was valid
            if (this.checkValidTx(log)) {
                // if valid, then send tx link to etherscan to chat id
                const notification_msg = `TX spotted for address ${row['Wallet']}: ` + "https://etherscan.io/tx/" + log['transactionHash']
                this.bot.client.sendMessage(row['ChatId'], notification_msg);
            }
        }
    };

    async trackWallets() {

        console.log(`Tracking wallets...`);
        this.customWsProvider.on(this.topicSets, (log) => {
            try {
                for (let row of this.wallets) {
                    this.notifyTrackedAddress(row, log);
                }
            } catch (e) {
                console.log(`An error occured - ${e}`);
            }
        });
    }
}

let txChecker = new TransactionChecker();
txChecker.bot.start();
setInterval(() => {
    txChecker.undateWalletsList();
    txChecker.trackWallets();
}, 15 * 1000);