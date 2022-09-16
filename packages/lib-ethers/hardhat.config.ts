import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import "colors";

import { JsonFragment } from "@ethersproject/abi";
import { Wallet } from "@ethersproject/wallet";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory, Overrides } from "@ethersproject/contracts";

import { task, HardhatUserConfig, types, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";

import { Decimal } from "@liquity/lib-base";

import { deployAndSetupContracts, deployTellorCaller, setSilent } from "./utils/deploy";
import { _connectToContracts, _LiquityDeploymentJSON, _priceFeedIsTestnet } from "./src/contracts";

import accounts from "./accounts.json";

interface IOracles {
  chainlink: string,
  tellor: string,
}

interface ICollaterals {
  eth: IOracles,
  btc: IOracles,
}

interface INetworkOracles {
  mainnet: ICollaterals,
  goerli: ICollaterals,
}

dotenv.config();

const numAccounts = 100;

const useLiveVersionEnv = (process.env.USE_LIVE_VERSION ?? "false").toLowerCase();
const useLiveVersion = !["false", "no", "0"].includes(useLiveVersionEnv);

const contractsDir = path.join("..", "contracts");
const artifacts = path.join(contractsDir, "artifacts");
const cache = path.join(contractsDir, "cache");

const contractsVersion = fs
  .readFileSync(path.join(useLiveVersion ? "live" : artifacts, "version"))
  .toString()
  .trim();

if (useLiveVersion) {
  console.log(`Using live version of contracts (${contractsVersion}).`.cyan);
}

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const deployerAccount = process.env.DEPLOYER_PRIVATE_KEY || Wallet.createRandom().privateKey;
const devChainRichAccount = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";
const infuraNetwork = (name: string): { [name: string]: NetworkUserConfig } => ({
  [name]: {
    url: `https://${name}.infura.io/v3/${infuraApiKey}`,
    accounts: [deployerAccount]
  }
});

// https://docs.chain.link/docs/ethereum-addresses
// https://docs.tellor.io/tellor/the-basics/contracts-reference

const oracleAddresses: INetworkOracles = {
  mainnet: {
    btc: {
      chainlink: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
      tellor: "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    },
    eth: {
      chainlink: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      tellor: "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    }
  },
  goerli: {
    btc: {
      chainlink: "0xA39434A63A52E749F02807ae27335515BA4b07F7",
      tellor: "0x20374E579832859f180536A69093A126Db1c8aE9"
    },
    eth: {
      chainlink: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
      tellor: "0x20374E579832859f180536A69093A126Db1c8aE9" // Playground
    }
  }
};

const hasOracles = (network: string): network is keyof typeof oracleAddresses =>
  network in oracleAddresses;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: accounts.slice(0, numAccounts),

      gas: 12e6, // tx gas limit
      blockGasLimit: 12e6,

      // Let Ethers throw instead of Buidler EVM
      // This is closer to what will happen in production
      throwOnCallFailures: false,
      throwOnTransactionFailures: false
    },

    dev: {
      url: "http://localhost:8545",
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(numAccounts - 2)]
    },

    ...infuraNetwork("goerli"),
    ...infuraNetwork("mainnet")
  },

  paths: {
    artifacts,
    cache
  }
};

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    deployLiquity: (
      deployer: Signer,
      stablecoinAddress: string,
      useRealPriceFeed?: boolean,
      overrides?: Overrides
    ) => Promise<_LiquityDeploymentJSON>;
  }
}

const getLiveArtifact = (name: string): { abi: JsonFragment[]; bytecode: string } =>
  require(`./live/${name}.json`);

const getContractFactory: (
  env: HardhatRuntimeEnvironment
) => (name: string, signer: Signer) => Promise<ContractFactory> = useLiveVersion
  ? env => (name, signer) => {
      const { abi, bytecode } = getLiveArtifact(name);
      return env.ethers.getContractFactory(abi, bytecode, signer);
    }
  : env => env.ethers.getContractFactory;

extendEnvironment(env => {
  env.deployLiquity = async (
    deployer,
    stablecoinAddress: string,
    useRealPriceFeed = false,
    overrides?: Overrides
  ) => {
    const deployment = await deployAndSetupContracts(
      deployer,
      getContractFactory(env),
      !useRealPriceFeed,
      env.network.name === "dev",
      stablecoinAddress,
      overrides
    );

    return { ...deployment, version: contractsVersion };
  };
});

type DeployParams = {
  channel: string;
  collateral: string;
  gasPrice?: number;
  useRealPriceFeed?: boolean;
  collateralVersion: string;
  stablecoinAddress: string;
};

const defaultChannel = process.env.CHANNEL || "default";
const defaultCollateral = process.env.COLLATERAL || "eth";
const defaultStablecoinAddress = process.env.STABLECOIN_ADDRESS || "";
const defaultVersion = process.env.COLLATERAL_VERSION || "v1";

task("deploy", "Deploys the contracts to the network")
  .addOptionalParam("channel", "Deployment channel to deploy into", defaultChannel, types.string)
  .addOptionalParam("collateral", "Collateral for contracts being deployed", defaultCollateral, types.string)
  .addOptionalParam("stablecoinAddress", "Stablecoin token address to add new collateral type for", defaultStablecoinAddress, types.string)
  .addOptionalParam("collateralVersion", "Version of contracts for collateral type", defaultVersion, types.string)
  .addOptionalParam("gasPrice", "Price to pay for 1 gas [Gwei]", undefined, types.float)
  .addOptionalParam(
    "useRealPriceFeed",
    "Deploy the production version of PriceFeed and connect it to Chainlink",
    true,
    types.boolean
  )
  .setAction(
    async ({ channel, collateral, collateralVersion, stablecoinAddress, gasPrice, useRealPriceFeed }: DeployParams, env) => {
      const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).hex };
      const [deployer] = await env.ethers.getSigners();

      useRealPriceFeed ??= env.network.name === "mainnet";

      if (useRealPriceFeed && !hasOracles(env.network.name)) {
        throw new Error(`PriceFeed not supported on ${env.network.name}`);
      }

      setSilent(false);
console.log("verison", collateralVersion);
console.log("collateral", collateral);
console.log("stablecoin address", stablecoinAddress)

console.log("useRealPriceFeed", useRealPriceFeed)
console.log("env.network.name", env.network.name)
throw("fuck it");
      const deployment = await env.deployLiquity(deployer, stablecoinAddress, useRealPriceFeed, overrides);

      if (useRealPriceFeed) {
        const contracts = _connectToContracts(deployer, deployment);

        assert(!_priceFeedIsTestnet(contracts.priceFeed));

        if (hasOracles(env.network.name)) {
          const tellorCallerAddress = await deployTellorCaller(
            deployer,
            getContractFactory(env),
            oracleAddresses[env.network.name as keyof INetworkOracles][collateral as keyof ICollaterals].tellor,
            overrides
          );

          console.log(`Hooking up PriceFeed with oracles for ${collateral}...`);
          
          const tx = await contracts.priceFeed.setAddresses(
            oracleAddresses[env.network.name as keyof INetworkOracles][collateral as keyof ICollaterals].chainlink,
            tellorCallerAddress,
            overrides
          );

          await tx.wait();
        }
      }

      fs.mkdirSync(path.join("deployments", channel, collateral, collateralVersion), { recursive: true });

      fs.writeFileSync(
        path.join("deployments", channel, collateral, collateralVersion, `${env.network.name}.json`),
        JSON.stringify(deployment, undefined, 2)
      );

      console.log();
      console.log(deployment);
      console.log();
    }
  );

export default config;
