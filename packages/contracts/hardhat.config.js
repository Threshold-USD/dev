require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("solidity-coverage");
require("hardhat-gas-reporter");

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList

const fs = require('fs')
const getSecret = (secretKey, defaultValue='') => {
    const SECRETS_FILE = "./secrets.js"
    let secret = defaultValue
    if (fs.existsSync(SECRETS_FILE)) {
        const { secrets } = require(SECRETS_FILE)
        if (secrets[secretKey]) { secret = secrets[secretKey] }
    }

    return secret
}
const alchemyUrl = () => {
    return `https://eth-mainnet.alchemyapi.io/v2/${getSecret('alchemyAPIKey')}`
}


module.exports = {
    paths: {
        // contracts: "./contracts",
        // artifacts: "./artifacts"
    },
    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            }
        ]
    },
    sourcify: {
        enabled: true
      },
    networks: {
        hardhat: {
            accounts: accountsList,
            gas: 120000000,  // tx gas limit
            blockGasLimit: 0x1fffffffffffff,
            gasPrice: 200000000000,
            allowUnlimitedContractSize :true,
            initialBaseFeePerGas: 0,
        },
        mainnet: {
            url: alchemyUrl(),
            gasPrice: 15000000000,
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
        },
        bob_testnet: {
            url: "https://testnet.rpc.gobob.xyz/",
            chainId: 111,
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
        },
        bob_mainnet: {
            url: "https://rpc.gobob.xyz/",
            chainId: 60808,
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
        },
    },
    etherscan: {
        apiKey: {
            hardhat: getSecret("ETHERSCAN_API_KEY"),
            mainnet: getSecret("ETHERSCAN_API_KEY"),
            bob_testnet: getSecret("ETHERSCAN_API_KEY"),
            bob_mainnet: getSecret("ETHERSCAN_API_KEY"),
        },
        customChains: [
            {
              network: "bob_testnet",
              chainId: 111,
              urls: {
                apiURL: "https://testnet-explorer.gobob.xyz/api?",
                browserURL: "https://testnet.rpc.gobob.xyz"
              }
            },
            {
                network: "bob_mainnet",
                chainId: 60808,
                urls: {
                  apiURL: "https://explorer.gobob.xyz/api?",
                  browserURL: "https://rpc.gobob.xyz"
                }
              },
        ],
    },
    mocha: {
        timeout: 12000000,
        parallel: true
    },
    rpc: {
        host: "localhost",
        port: 8545
    },
    gasReporter: {
        enabled: (process.env.REPORT_GAS) ? true : false
    }
};
