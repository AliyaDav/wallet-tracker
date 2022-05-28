// import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";

// import { PublicKey } from "@solana/web3.js";

const web3 = require('@solana/web3.js');
const spl = require('@solana/spl-token');
const metaplex = require("@metaplex/js");
const mt = require("@metaplex-foundation/mpl-token-metadata");
const web3 = require('@solana/web3.js');
const spl = require('@solana/spl-token');


(async () => {
    let tokens = [];
    text = 'Balances: \n'
    const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

    const tokenAccounts = await connection.getTokenAccountsByOwner(
        
        new web3.PublicKey('E8PXoFg4cg7w6jJUursxwq2UHLiLt3pff4AQvFzGaUai'),
        //VKvJBDUj2Hi55rpAxLe1QaABt6oDEhBPyxZs1pC6L75
        {
            programId: spl.TOKEN_PROGRAM_ID,
        }
    );

    console.log("Token                                         Balance");
    console.log("------------------------------------------------------------");
    tokenAccounts.value.forEach((e) => {
        const accountInfo = spl.AccountLayout.decode(e.account.data);
        console.log(`${new web3.PublicKey(accountInfo.mint)}   ${accountInfo.amount}`);
        if (accountInfo.amount != '0') {
            tokens.push(accountInfo.mint);
            text += `${accountInfo.mint}    ${accountInfo.amount}\n`
        };
        
    })

    console.log(`total tokens ${tokens.length}`);
    console.log(text);

})();

function checkAllBalances() {
    var i = 0; eth.accounts.forEach(function (e)
    { console.log("  eth.accounts[" + i + "]: " + e + " \tbalance: " + web3.fromWei(eth.getBalance(e), "ether") + " ether"); i++; }
    )
};
checkAllBalances();


/*
Token                                         Balance
------------------------------------------------------------
7e2X5oeAAJyUTi4PfSGXFLGhyPw2H8oELm1mx87ZCgwF  84
AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM  100
AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM  0
AQoKYV7tYpTrFZN6P5oUufbQKAUr9mNYGe1TTJC9wajM  1
*/

// (async () => {
//     const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"));
//     const ownerPublickey = "VKvJBDUj2Hi55rpAxLe1QaABt6oDEhBPyxZs1pC6L75";
//     const nftsmetadata = await mt.Metadata.findDataByOwner(
//         connection,
//         ownerPublickey
//     );

//     console.log(nftsmetadata);
//     /*
//     {
//       0: MetadataData {
//         collection: undefined
//         data: MetadataDataData {
//           creators: Array(1)
//             0: Creator
//             address: "6FVxrqH9FFtEFo643pYx8w5GqfYRS8uWA5hZMUn1VNFr"
//             share: 100
//             verified: 1
//             length: 1
//           name: "Crimson Matt"
//           sellerFeeBasisPoints: 1000
//           symbol: ""
//           uri: "https://arweave.net/DCGABWBYFHctLR5iWVEFhCaR3EW_AHyvk-WJV0DZ78Q"
//         } 
//         editionNonce: 255
//         isMutable: 0
//         key: 4
//         mint: "HV91gRBArNUcR7fMUUuHJXbM4MaKcq3kJB89woHXyz6T"
//         primarySaleHappened: 0
//         tokenStandard: 3
//         updateAuthority: "6FVxrqH9FFtEFo643pYx8w5GqfYRS8uWA5hZMUn1VNFr"
//         uses: undefined
//       },
  
//       1: MetadataData {
//         collection: undefined
//         data: MetadataDataData {
//           creators: Array(1)
//             0: Creator
//             address: "6FVxrqH9FFtEFo643pYx8w5GqfYRS8uWA5hZMUn1VNFr"
//             share: 100
//             verified: 1
//             length: 1
//           name: "Crimson Matt"
//           sellerFeeBasisPoints: 1000
//           symbol: ""
//           uri: "https://arweave.net/DCGABWBYFHctLR5iWVEFhCaR3EW_AHyvk-WJV0DZ78Q"
//         } 
//         editionNonce: 255
//         isMutable: 0
//         key: 4
//         mint: "4EK5YJRuqxiQEtrTQQZBZfnsFFza8atDxUViw6KSWA8L"
//         primarySaleHappened: 0
//         tokenStandard: 3
//         updateAuthority: "6FVxrqH9FFtEFo643pYx8w5GqfYRS8uWA5hZMUn1VNFr"
//         uses: undefined
//       }
//     }
//     */
// })();

/* to retrieve NFT images

const images = (
await Promise.all(ownedMetadata.map(({ data }) => axios.get(data.uri))
)).map(({ data }) => data.image);
console.log(images);

*/