// library imports
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { ethers, network, deployLiquity } from "hardhat";
import { expect, assert } from "chai";
import { Signer } from "@ethersproject/abstract-signer";

// monorepo imports
import {
  Decimal,
  Decimalish,
  LiquityReceipt,
  SentLiquityTransaction,
  SuccessfulReceipt,
  Trove,
  TroveCreationParams,
  THUSD_LIQUIDATION_RESERVE,
  THUSD_MINIMUM_DEBT,
  THUSD_MINIMUM_NET_DEBT,
  MINIMUM_BORROWING_RATE
} from "@liquity/lib-base";

// project imports
import { _LiquityDeploymentJSON } from "../src/contracts";
import { EthersLiquity } from "../src/EthersLiquity";
import erc20Abi from "../abi/ERC20Test.json";
import * as th from "../utils/testHelpers";
import { oracleAddresses } from "../hardhat.config";

const provider = ethers.provider;

const STARTING_BALANCE = Decimal.from(100); // amount of tokens and ETH to initialise
const GAS_BUDGET = Decimal.from(0.1); // Extra ETH sent to users to be spent on gas
let deployer: Signer;
let funder: Signer;
let user: Signer;
let otherUsers: Signer[];
let deployment: _LiquityDeploymentJSON;
let deployerLiquity: EthersLiquity;
let liquity: EthersLiquity;
let otherLiquities: EthersLiquity[];
let erc20: Contract;
let userAddress: string;

// TODO refactor to isolate these tests.
describe("Gas estimation", () => {

  const troveWithICRBetween = (a: Trove, b: Trove) => a.add(b).multiply(0.5);

  let rudeUser: Signer;
  let fiveOtherUsers: Signer[];
  let rudeLiquity: EthersLiquity;

  before(async () => {
    // get wallets
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

    // deploy smart contracts
    deployment = await deployLiquity(deployer, oracleAddresses, "tbtc");

    // create account / connection to liquity for the wallets
    [deployerLiquity, liquity, rudeLiquity, ...otherLiquities] = await th.connectUsers(deployment, [
      deployer,
      user,
      rudeUser,
      ...fiveOtherUsers
    ]);

    const erc20Address = liquity.connection.addresses.erc20;
    erc20 = new ethers.Contract(erc20Address, erc20Abi, deployer);
    userAddress = await user.getAddress();

    // send accounts ETH for transactions
    await th.sendAccountETH(user, funder);
    await th.sendAccountETH(rudeUser, funder);

    for (var i=0;i<fiveOtherUsers.length;i++) {
      await funder.sendTransaction({
        to: fiveOtherUsers[i].getAddress(),
        value: THUSD_MINIMUM_DEBT.div(170).hex
      });
    }

    // mint tokens for transactions
    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    await erc20.mint(await funder.getAddress(), startingBalance);
    await erc20.mint(await rudeUser.getAddress(), startingBalance);
    for (var i=0;i<fiveOtherUsers.length;i++) {
      await erc20.mint(await fiveOtherUsers[i].getAddress(), startingBalance);
    }

    await th.openTroves(deployment, liquity, fiveOtherUsers, funder, [
      { depositCollateral: 20, borrowTHUSD: 2040 },
      { depositCollateral: 20, borrowTHUSD: 2050 },
      { depositCollateral: 20, borrowTHUSD: 2060 },
      { depositCollateral: 20, borrowTHUSD: 2070 },
      { depositCollateral: 20, borrowTHUSD: 2080 }
    ]);

    // await th.increaseTime(60 * 60 * 24 * 15);
  });

  it("should include enough gas for updating lastFeeOperationTime", async () => {
    await liquity.openTrove({ depositCollateral: 20, borrowTHUSD: 2090 });

    // We just updated lastFeeOperationTime, so this won't anticipate having to update that
    // during estimateGas
    const tx = await liquity.populate.redeemTHUSD(1);
    const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

    // Fast-forward 2 minutes.
    await th.increaseTime(120);

    // Required gas has just went up.
    const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
    const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
    expect(gasIncrease).to.be.within(4500, 10000);

    // This will now have to update lastFeeOperationTime
    await th.waitForSuccess(tx.send());

    // Decay base-rate back to 0
    await th.increaseTime(100000000);
  });

  it("should include enough gas for one extra traversal", async () => {
    const troves = await liquity.getTroves({ first: 10, sortedBy: "ascendingCollateralRatio" });

    const trove = await liquity.getTrove();
    const newTrove = troveWithICRBetween(troves[3], troves[4]);

    // First, we want to test a non-borrowing case, to make sure we're not passing due to any
    // extra gas we add to cover a potential lastFeeOperationTime update
    const adjustment = trove.adjustTo(newTrove);
    expect(adjustment.borrowTHUSD).to.be.undefined;

    const tx = await liquity.populate.adjustTrove(adjustment);
    const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

    // A terribly rude user interferes
    const rudeTrove = newTrove.addDebt(1);
    const rudeCreation = Trove.recreate(rudeTrove);
    await th.openTroves(deployment, liquity, [rudeUser], funder, [rudeCreation]);

    const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
    const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

    await th.waitForSuccess(tx.send());
    expect(gasIncrease).to.be.within(10000, 25000);

    th.assertDefined(rudeCreation.borrowTHUSD);
    const thusdShortage = rudeTrove.debt.sub(rudeCreation.borrowTHUSD);

    await liquity.sendTHUSD(await rudeUser.getAddress(), thusdShortage);
    await rudeLiquity.closeTrove();
  });

  it("should include enough gas for both when borrowing", async () => {
    const troves = await liquity.getTroves({ first: 10, sortedBy: "ascendingCollateralRatio" });

    const trove = await liquity.getTrove();
    const newTrove = troveWithICRBetween(troves[1], troves[2]);

    // Make sure we're borrowing
    const adjustment = trove.adjustTo(newTrove);
    expect(adjustment.borrowTHUSD).to.not.be.undefined;

    const tx = await liquity.populate.adjustTrove(adjustment);
    const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

    // A terribly rude user interferes again
    await th.openTroves(deployment, liquity, [rudeUser], funder, [Trove.recreate(newTrove.addDebt(1))]);

    // On top of that, we'll need to update lastFeeOperationTime
    await th.increaseTime(120);

    const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
    const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

    await th.waitForSuccess(tx.send());
    expect(gasIncrease).to.be.within(15000, 30000);
  });
});

describe("Gas estimation (fee decay)", () => {
  before(async function () {
    // get wallets
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();

    this.timeout("1m");

    deployment = await deployLiquity(deployer, oracleAddresses, "tbtc");
    const [redeemedUser, ...someMoreUsers] = otherUsers.slice(0, 21);
    [liquity, ...otherLiquities] = await th.connectUsers(deployment, [user, ...someMoreUsers]);

    const erc20Address = liquity.connection.addresses.erc20;
    erc20 = new ethers.Contract(erc20Address, erc20Abi, deployer);
    userAddress = await user.getAddress();

    // send accounts ETH for transactions
    await th.sendAccountETH(user, funder);
    await th.sendAccountETH(redeemedUser, funder);

    for (var i=0;i<someMoreUsers.length;i++) {
      await funder.sendTransaction({
        to: someMoreUsers[i].getAddress(),
        value: THUSD_MINIMUM_DEBT.div(170).hex
      });
    }

    // mint tokens for transactions
    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    await erc20.mint(await redeemedUser.getAddress(), startingBalance);
    for (var i=0;i<someMoreUsers.length;i++) {
      await erc20.mint(await someMoreUsers[i].getAddress(), startingBalance);
    }

    // Create a "slope" of Troves with similar, but slightly decreasing ICRs
    await th.openTroves(deployment, liquity,
      someMoreUsers,
      funder,
      someMoreUsers.map((_, i) => ({
        depositCollateral: 20,
        borrowTHUSD: THUSD_MINIMUM_NET_DEBT.add(i / 10)
      }))
    );

    // Sweep THUSD
    await Promise.all(
      otherLiquities.map(async otherLiquity =>
        otherLiquity.sendTHUSD(await user.getAddress(), await otherLiquity.getTHUSDBalance())
      )
    );

    const price = await liquity.getPrice();

    // Create a "designated victim" Trove that'll be redeemed
    const redeemedTroveDebt = await liquity
      .getTHUSDBalance()
      .then(x => x.div(10).add(THUSD_LIQUIDATION_RESERVE));
    const redeemedTroveCollateral = redeemedTroveDebt.mulDiv(1.1, price);
    const redeemedTrove = new Trove(redeemedTroveCollateral, redeemedTroveDebt);

    await th.openTroves(deployment, liquity, [redeemedUser], funder, [Trove.recreate(redeemedTrove)]);

    // Increase the borrowing rate by redeeming
    const { actualTHUSDAmount } = await liquity.redeemTHUSD(redeemedTrove.netDebt);

    expect(`${actualTHUSDAmount}`).to.equal(`${redeemedTrove.netDebt}`);

    const borrowingRate = await liquity.getFees().then(fees => Number(fees.borrowingRate()));
    expect(borrowingRate).to.be.within(0.04, 0.049); // make sure it's high, but not clamped to 5%
  });

  it("should predict the gas increase due to fee decay", async function () {
    this.timeout("1m");

    const [bottomTrove] = await liquity.getTroves({
      first: 1,
      sortedBy: "ascendingCollateralRatio"
    });

    const borrowingRate = await liquity.getFees().then(fees => fees.borrowingRate());

    for (const [borrowingFeeDecayToleranceMinutes, roughGasHeadroom] of [
      [10, 128000],
      [20, 242000],
      [30, 322000]
    ]) {
      const tx = await liquity.populate.openTrove(Trove.recreate(bottomTrove, borrowingRate), {
        borrowingFeeDecayToleranceMinutes
      });

      expect(tx.gasHeadroom).to.be.within(roughGasHeadroom - 11000, roughGasHeadroom + 11000);
    }
  });

  it("should include enough gas for the TX to succeed after pending", async function () {
    this.timeout("1m");

    const [bottomTrove] = await liquity.getTroves({
      first: 1,
      sortedBy: "ascendingCollateralRatio"
    });

    const borrowingRate = await liquity.getFees().then(fees => fees.borrowingRate());

    const tx = await liquity.populate.openTrove(
      Trove.recreate(bottomTrove.multiply(2), borrowingRate),
      { borrowingFeeDecayToleranceMinutes: 60 }
    );

    await th.increaseTime(60 * 60);
    await th.waitForSuccess(tx.send());
  });
});
