import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployLiquity } from "hardhat";
import erc20Abi from "../abi/ERC20Test.json";

import {
  Decimal,
  Decimalish,
  Trove,
  StabilityDeposit,
  LiquityReceipt,
  SuccessfulReceipt,
  SentLiquityTransaction,
  TroveCreationParams,
  Fees,
  LUSD_LIQUIDATION_RESERVE,
  MAXIMUM_BORROWING_RATE,
  MINIMUM_BORROWING_RATE,
  LUSD_MINIMUM_DEBT,
  LUSD_MINIMUM_NET_DEBT
} from "@liquity/lib-base";

import { HintHelpers } from "../types";

import {
  PopulatableEthersLiquity,
  PopulatedEthersLiquityTransaction,
  _redeemMaxIterations
} from "../src/PopulatableEthersLiquity";

import { EthersTransactionReceipt } from "../src/types";
import { _LiquityDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersLiquityConnection";
import { EthersLiquity } from "../src/EthersLiquity";
import { ReadableEthersLiquity } from "../src/ReadableEthersLiquity";

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

const STARTING_BALANCE = Decimal.from(100);

// Extra ETH sent to users to be spent on gas
const GAS_BUDGET = Decimal.from(0.1); // ETH

const getGasCost = (tx: EthersTransactionReceipt) => tx.gasUsed.mul(tx.effectiveGasPrice);

const connectToDeployment = async (
  deployment: _LiquityDeploymentJSON,
  signer: Signer
) =>
  EthersLiquity._from(
    _connectToDeployment(deployment, signer, {
      userAddress: await signer.getAddress()
    })
  );


function assertStrictEqual<T, U extends T>(
  actual: T,
  expected: U,
  message?: string
): asserts actual is U {
  assert.strictEqual(actual, expected, message);
}

function assertDefined<T>(actual: T | undefined): asserts actual is T {
  assert(actual !== undefined);
}

const waitForSuccess = async <T extends LiquityReceipt>(
  tx: Promise<SentLiquityTransaction<unknown, T>>
) => {
  const receipt = await (await tx).waitForReceipt();
  assertStrictEqual(receipt.status, "succeeded" as const);

  return receipt as Extract<T, SuccessfulReceipt>;
};


// TODO make the testcases isolated

describe("EthersLiquity", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _LiquityDeploymentJSON;

  let deployerLiquity: EthersLiquity;
  let liquity: EthersLiquity;
  let otherLiquities: EthersLiquity[];

  let erc20: Contract;


  const topUpAccountETH = async (
    account: Signer,
  ) => {
    const targetBalance = BigNumber.from(STARTING_BALANCE.hex);
    const gasLimit = BigNumber.from(21000);
    const gasPrice = BigNumber.from(100e9); // 100 Gwei

    const balance = await account.getBalance();
    const txCost = gasLimit.mul(gasPrice);

    if (balance.eq(targetBalance)) {
      return;
    }

    if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
      await funder.sendTransaction({
        to: account.getAddress(),
        value: targetBalance.add(txCost).sub(balance).add(1),
        gasLimit,
        gasPrice
      });

      await account.sendTransaction({
        to: funder.getAddress(),
        value: 1,
        gasLimit,
        gasPrice
      });
    } else {
      if (balance.lt(targetBalance)) {
        await funder.sendTransaction({
          to: account.getAddress(),
          value: targetBalance.sub(balance),
          gasLimit,
          gasPrice
        });
      } else {
        await account.sendTransaction({
          to: funder.getAddress(),
          value: balance.sub(targetBalance).sub(txCost),
          gasLimit,
          gasPrice
        });
      }
    }
  }

  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map(user => connectToDeployment(deployment, user)));

  const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[]) =>
    params
      .map((params, i) => () =>
        Promise.all([
          connectToDeployment(deployment, users[i]),
          sendTo(users[i], params.depositCollateral).then(tx => tx.wait())
        ]).then(async ([liquity]) => {
          await liquity.openTrove(params);
        })
      )
      .reduce((a, b) => a.then(b), Promise.resolve());

  const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
    funder.sendTransaction({
      to: user.getAddress(),
      value: Decimal.from(value).add(GAS_BUDGET).hex,
      nonce
    });

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());
    const txs = await Promise.all(users.map((user, i) => sendTo(user, value, txCount + i)));

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
  };

  // Always setup same initial balance for user
  beforeEach(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    deployment = await deployLiquity(deployer);

    liquity = await connectToDeployment(deployment, user);

    const contractAddress = liquity.connection.addresses.erc20
    erc20 = new ethers.Contract(contractAddress, erc20Abi, deployer);

    await topUpAccountETH(user);

    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    await erc20.mint(await funder.getAddress(), startingBalance);

    expect(`${await user.getBalance()}`).to.equal(`${BigNumber.from(STARTING_BALANCE.hex)}`);
  });

  it("should get the price", async () => {
    const price = await liquity.getPrice();
    expect(price).to.be.an.instanceOf(Decimal);
  });

  describe("SendableEthersLiquity", () => {
    it("should parse failed transactions without throwing", async () => {
      // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
      const tx = await liquity.send.openTrove(
        { depositCollateral: 0.01, borrowLUSD: 0.01 },
        undefined,
        { gasLimit: 1e6 }
      );
      const { status } = await tx.waitForReceipt();

      expect(status).to.equal("failed");
    });
  });

});
