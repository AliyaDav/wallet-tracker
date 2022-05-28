
const Ethplorer = require('ethplorer-js').Ethplorer;

// let msg = 'Token                                              Balance\n------------------------------------------------\n'

// const info = (async (wallet) => {
//     let api = new Ethplorer();
//     let address_info = await api.getAddressInfo(wallet);
//     // console.log(address_info);
//     return address_info;
// })('0xEC143CA01E3D305BDB20D49907AECD9F1DED1863');

// info.then(data => {
//     for (let i of data['tokens']) {
//         msg += `${i['tokenInfo']['address']} (${i['tokenInfo']['symbol']})   ${i['balance'] / (10 ** (parseInt(i['tokenInfo']['decimals']) | 0))}\n`
//     };
//     console.log(msg);
// });

async function checkEthereumTokensBalance(wallet) {
    let api = new Ethplorer();
    var msg = 'Token                        Balance\n------------------------------------------------\n';

    let address_info = await api.getAddressInfo(wallet)
    console.log(address_info);

    for (let i of address_info['tokens']) {
        msg += `${i['tokenInfo']['address']} (${i['tokenInfo']['symbol']})   ${i['balance'] / (10 ** (parseInt(i['tokenInfo']['decimals']) | 0))}\n`
    };
    return msg;
};

const res = checkEthereumTokensBalance('0xEC143CA01E3D305BDB20D49907AECD9F1DED1863')

console.log(res);