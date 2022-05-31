// credits: https://github.com/0xScar/whale-watcher

const config = require('./config.js');
const { ethers } = require('ethers');
const Bot = require('./bot.js');
const csv = require('csv-parser');
const fs = require('fs');

class TransactionChecker {
    customWsProvider;
    infura_http;
    eth_wallets;
    sol_wallets;
    topicSets;
    log_hash;

    constructor() {
        this.customWsProvider = new ethers.providers.WebSocketProvider(config.infura_mainnet_ws);
        this.infura_http = new ethers.providers.JsonRpcProvider(config.infura_mainnet_http);
        this.topicSets = [
            ethers.utils.id("Transfer(address,address,uint256)"),
            null,
            null
        ];
        this.bot = new Bot(config.bot_token);
        this.log_hash = '';
    };

    // TODO: update wallets without reading it all over again
    async undateWalletsList() {

        this.eth_wallets = [];
        this.sol_wallets = [];
        if (fs.existsSync('trackedAddresses.csv')) {
            return new Promise((resolve, reject) => {
                fs.createReadStream('trackedAddresses.csv')
                    .pipe(csv())
                    .on('data', (row) => {
                        if (row['Chain'] == '2') {
                            this.eth_wallets.push(row);
                        } else if (row['Chain'] == '1') {
                            this.sol_wallets.push(row);
                        }
                    })
                    .on('end', () => {
                        resolve([this.eth_wallets, this.sol_wallets])
                    });
            });
        };
    }

    getTxAddresses(log) {

        var addrFrom = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][1]);
        var addrTo = ethers.utils.defaultAbiCoder.decode(['address'], log['topics'][2]);

        return [addrFrom, addrTo];
    };

    async checkValidTx(log) {
        let tx_receipt = await this.infura_http.getTransactionReceipt(log['transactionHash']);
        return (tx_receipt['status'] != 0);
    };

    // TODO: add filtering for ERC-20 and ERC-721 tokens 
    filterNftTransfers(log) {
        if (log['topics'] > 3) {
            return true
        } else { return false }
    }

    notifyTrackedAddress(row, log) {

        var [addrFrom, addrTo] = this.getTxAddresses(log);
        // check if _from or _to matches any of the tracked wallets
        if (row['Wallet'] == addrFrom[0] || row['Wallet'] == addrTo[0]) {
            // if matches, then check of tx was valid
            if (this.checkValidTx(log)) {
                // if valid, then send tx link to etherscan to chat id
                const notification_msg = `TX spotted for address ${row['Wallet']} on Ethereum: ` + "https://etherscan.io/tx/" + log['transactionHash']
                this.bot.client.sendMessage(row['ChatId'], notification_msg);
            }
        }
    };

    async trackWallets() {

        console.log(`Tracking wallets...`);
        await this.undateWalletsList();
        this.customWsProvider.on(this.topicSets, (log, event) => {

            var log_hash_new = log['transactionHash'];
            // console.log('new hash - ', log_hash_new, 'old hash - ', this.log_hash);

            if (this.log_hash != log_hash_new) {

                try {
                    for (const row of this.eth_wallets) {
                        this.notifyTrackedAddress(row, log);
                    }
                } catch (e) {
                    console.log(`An error occured - ${e}`);
                }
            }

            this.log_hash = log_hash_new;
        });
    }
}

let txChecker = new TransactionChecker();
txChecker.bot.start();
setInterval(() => {
    txChecker.trackWallets();
}, 10 * 1000);