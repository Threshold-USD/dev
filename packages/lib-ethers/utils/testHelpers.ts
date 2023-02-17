import { assert } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import { Signer } from "@ethersproject/abstract-signer";

import {
  Decimal,
  Decimalish,
  LiquityReceipt,
  SuccessfulReceipt,
  SentLiquityTransaction,
  TroveCreationParams,
} from "@liquity/lib-base";

import { DEPLOYMENT_COLLATERAL_FOR_TESTING, DEPLOYMENT_VERSION_FOR_TESTING } from "../src/_utils"
import { _connectToDeployment } from "../src/EthersLiquityConnection";
import { _LiquityDeploymentJSON } from "../src/contracts";
import { EthersLiquity } from "../src/EthersLiquity";
import { EthersTransactionReceipt } from "../src/types";

const STARTING_BALANCE = Decimal.from(100); // amount of tokens and ETH to initialise
const GAS_BUDGET = Decimal.from(0.1); // Extra ETH sent to users to be spent on gas

export const connectUsers = (deployment: _LiquityDeploymentJSON, users: Signer[]) =>
    Promise.all(users.map(user => connectToDeployment(deployment, user)));

export const connectToDeployment = async (
  deployment: _LiquityDeploymentJSON,
  signer: Signer
) =>
  EthersLiquity._from(
    _connectToDeployment(DEPLOYMENT_COLLATERAL_FOR_TESTING, DEPLOYMENT_VERSION_FOR_TESTING, deployment, signer, {
      userAddress: await signer.getAddress()
    })
  );

export const increaseTime = async (timeJumpSeconds: number) => {
  await ethers.provider.send("evm_increaseTime", [timeJumpSeconds]);
};

export function assertDefined<T>(actual: T | undefined): asserts actual is T {
  assert(actual !== undefined);
}

export function assertStrictEqual<T, U extends T>(
  actual: T,
  expected: U,
  message?: string
): asserts actual is U {
  assert.strictEqual(actual, expected, message);
}

export const waitForSuccess = async <T extends LiquityReceipt>(
  tx: Promise<SentLiquityTransaction<unknown, T>>
) => {
  const receipt = await (await tx).waitForReceipt();
  assertStrictEqual(receipt.status, "succeeded" as const);

  return receipt as Extract<T, SuccessfulReceipt>;
};

export const getGasCost = (tx: EthersTransactionReceipt) => tx.gasUsed.mul(tx.effectiveGasPrice);

export const sendAccountETH = async (
  account: Signer,
  funder: Signer,
) => {
  const gasLimit = BigNumber.from(21000);
  const gasPrice = BigNumber.from(100e9); // 100 Gwei

  const txCost = gasLimit.mul(gasPrice);
  await funder.sendTransaction({
    to: account.getAddress(),
    value: BigNumber.from(STARTING_BALANCE.hex),
    gasLimit,
    gasPrice
  });
}

export const sendToEach = async (users: Signer[], funder: Signer, value: Decimalish) => {
  const txCount = await ethers.provider.getTransactionCount(funder.getAddress());
  const txs = await Promise.all(users.map((user, i) => sendTo(user, funder, value, txCount + i)));

  // Wait for the last tx to be mined.
  await txs[txs.length - 1].wait();
};


const sendTo = (user: Signer, funder: Signer, value: Decimalish, nonce?: number) =>
  funder.sendTransaction({
    to: user.getAddress(),
    value: Decimal.from(value).add(GAS_BUDGET).hex,
    nonce
  });

export const openTroves = (deployment: _LiquityDeploymentJSON, liquity: EthersLiquity, users: Signer[], funder: Signer, params: TroveCreationParams<Decimalish>[]) =>
  params
    .map((params, i) => () =>
      Promise.all([
        connectToDeployment(deployment, users[i]),
        sendTo(users[i], funder, params.depositCollateral).then(tx => tx.wait())
      ]).then(async ([liquity]) => {
        await liquity.openTrove(params);
      })
    )
    .reduce((a, b) => a.then(b), Promise.resolve());
