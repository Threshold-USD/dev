// library imports
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { ethers, network, deployLiquity } from "hardhat";
import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";

// monorepo imports
import {
  Decimal,
  Fees,
  Trove,
  THUSD_LIQUIDATION_RESERVE,
  THUSD_MINIMUM_DEBT,
  THUSD_MINIMUM_NET_DEBT,
  MAXIMUM_BORROWING_RATE,
  MINIMUM_BORROWING_RATE
} from "@liquity/lib-base";

// project imports
import erc20Abi from "../abi/ERC20Test.json";
import { EthersLiquity } from "../src/EthersLiquity";
import { _LiquityDeploymentJSON } from "../src/contracts";
import { _redeemMaxIterations } from "../src/PopulatableEthersLiquity";
import * as th from "../utils/testHelpers";
import * as dh from "../utils/debugHelpers";
import { oracleAddresses } from "../hardhat.config";

const STARTING_BALANCE = Decimal.from(100); // amount of tokens and ETH to initialise

describe("EthersLiquity - Redemptions", () => {
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

  // data for tests
  const troveCreations = [
    { depositCollateral: 99, borrowTHUSD: 4600 },
    { depositCollateral: 20, borrowTHUSD: 2000 }, // net debt: 2010
    { depositCollateral: 20, borrowTHUSD: 2100 }, // net debt: 2110.5
    { depositCollateral: 20, borrowTHUSD: 2200 } //  net debt: 2211
  ];
  const someTHUSD = Decimal.from(4326.5);
  const massivePrice = Decimal.from(1000000);
  const amountToBorrowPerTrove = Decimal.from(2000);

  // Always setup same initial conditions for the user wallets
  beforeEach(async () => {
    // get wallets
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();

    // deploy the smart contracts
    deployment = await deployLiquity(deployer, oracleAddresses, "tbtc");

    // create account / connection to liquity for the user wallet
    const otherUsersSubset = otherUsers.slice(0, 3);
    [deployerLiquity, liquity, ...otherLiquities] = await th.connectUsers(deployment, [
      deployer,
      user,
      ...otherUsersSubset
    ]);

    const erc20Address = liquity.connection.addresses.erc20;
    erc20 = new ethers.Contract(erc20Address, erc20Abi, deployer);
    userAddress = await user.getAddress();

    // send accounts ETH for transactions
    await th.sendAccountETH(user, funder);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await funder.sendTransaction({
        to: otherUsers[i].getAddress(),
        value: THUSD_MINIMUM_DEBT.div(170).hex
      });
    }

    // mint tokens for transactions
    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    await erc20.mint(await funder.getAddress(), startingBalance);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await erc20.mint(await otherUsers[i].getAddress(), startingBalance);
    }

    const tokenBalance = await erc20.balanceOf(userAddress);
    expect(`${tokenBalance}`).to.equal(`${BigNumber.from(STARTING_BALANCE.hex)}`);
  });

  it("should redeem some THUSD", async () => {
    await liquity.openTrove(troveCreations[0]);

    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[2]);
    await otherLiquities[2].openTrove(troveCreations[3]);

    expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");
    expect(`${await otherLiquities[1].getCollateralSurplusBalance()}`).to.equal("0");
    expect(`${await otherLiquities[2].getCollateralSurplusBalance()}`).to.equal("0");

    const expectedTotal = troveCreations
      .map(params => Trove.create(params))
      .reduce((a, b) => a.add(b));

    const total = await liquity.getTotal();
    expect(total).to.deep.equal(expectedTotal);

    const expectedDetails = {
      attemptedTHUSDAmount: someTHUSD,
      actualTHUSDAmount: someTHUSD,
      collateralTaken: someTHUSD.div(200),
      fee: new Fees(0, 0.99, 2, new Date(), new Date(), false)
        .redemptionRate(someTHUSD.div(total.debt))
        .mul(someTHUSD.div(200))
    };

    const { rawReceipt, details } = await th.waitForSuccess(liquity.send.redeemTHUSD(someTHUSD));

    expect(details).to.deep.equal(expectedDetails);

    const balance = Decimal.fromBigNumberString(`${await erc20.balanceOf(userAddress)}`);
    expect(`${balance}`).to.equal(
      `${STARTING_BALANCE.sub(troveCreations[0].depositCollateral).add(expectedDetails.collateralTaken)
        .sub(expectedDetails.fee)}`
    );

    expect(`${await liquity.getTHUSDBalance()}`).to.equal("273.5");

    expect(`${(await otherLiquities[0].getTrove()).debt}`).to.equal(
      `${Trove.create(troveCreations[1]).debt.sub(
        someTHUSD
          .sub(Trove.create(troveCreations[2]).netDebt)
          .sub(Trove.create(troveCreations[3]).netDebt)
      )}`
    );

    expect((await otherLiquities[1].getTrove()).isEmpty).to.be.true;
    expect((await otherLiquities[2].getTrove()).isEmpty).to.be.true;
  });

  it("should claim the collateral surplus after redemption", async () => {
    // setup
    await liquity.openTrove(troveCreations[0]);
    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[2]);
    await otherLiquities[2].openTrove(troveCreations[3]);
    await th.waitForSuccess(liquity.send.redeemTHUSD(someTHUSD));

    // test
    const balanceBefore1 = await erc20.balanceOf(otherUsers[1].getAddress());
    const balanceBefore2 = await erc20.balanceOf(otherUsers[2].getAddress());

    expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");

    const surplus1 = await otherLiquities[1].getCollateralSurplusBalance();
    const trove1 = Trove.create(troveCreations[2]);
    expect(`${surplus1}`).to.equal(`${trove1.collateral.sub(trove1.netDebt.div(200))}`);

    const surplus2 = await otherLiquities[2].getCollateralSurplusBalance();
    const trove2 = Trove.create(troveCreations[3]);
    expect(`${surplus2}`).to.equal(`${trove2.collateral.sub(trove2.netDebt.div(200))}`);

    await th.waitForSuccess(otherLiquities[1].send.claimCollateralSurplus());
    await th.waitForSuccess(otherLiquities[2].send.claimCollateralSurplus());

    expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");
    expect(`${await otherLiquities[1].getCollateralSurplusBalance()}`).to.equal("0");
    expect(`${await otherLiquities[2].getCollateralSurplusBalance()}`).to.equal("0");

    const balanceAfter1 = await erc20.balanceOf(otherUsers[1].getAddress());
    const balanceAfter2 = await erc20.balanceOf(otherUsers[2].getAddress());

    expect(`${balanceAfter1}`).to.equal(`${balanceBefore1.add(surplus1.hex)}`);
    expect(`${balanceAfter2}`).to.equal(`${balanceBefore2.add(surplus2.hex)}`);
  });

  it("borrowing rate should be maxed out now", async () => {
    // setup
    await liquity.openTrove(troveCreations[0]);
    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[2]);
    await otherLiquities[2].openTrove(troveCreations[3]);
    await th.waitForSuccess(liquity.send.redeemTHUSD(someTHUSD));
    await th.waitForSuccess(otherLiquities[1].send.claimCollateralSurplus());
    await th.waitForSuccess(otherLiquities[2].send.claimCollateralSurplus());

    // test
    const borrowTHUSD = Decimal.from(10);

    const { fee, newTrove } = await liquity.borrowTHUSD(borrowTHUSD);
    expect(`${fee}`).to.equal(`${borrowTHUSD.mul(MAXIMUM_BORROWING_RATE)}`);

    expect(newTrove).to.deep.equal(
      Trove.create(troveCreations[0]).adjust({ borrowTHUSD }, MAXIMUM_BORROWING_RATE)
    );
  });

  it("should truncate the amount if it would put the last Trove below the min debt", async () => {
    // setup
    const netDebtPerTrove = Trove.create(troveCreations[1]).netDebt;
    const expectedRedeemable = netDebtPerTrove.mul(2).sub(THUSD_MINIMUM_NET_DEBT);

    await liquity.openTrove({ depositCollateral: 99, borrowTHUSD: 5000 });
    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[1]);
    await otherLiquities[2].openTrove(troveCreations[1]);

    // test
    const redemption = await liquity.populate.redeemTHUSD(Decimal.from(3000));
    expect(`${redemption.attemptedTHUSDAmount}`).to.equal(`${Decimal.from(3000)}`);
    expect(`${redemption.redeemableTHUSDAmount}`).to.equal(`${expectedRedeemable}`);
    expect(redemption.isTruncated).to.be.true;

    const { details } = await th.waitForSuccess(redemption.send());
    expect(`${details.attemptedTHUSDAmount}`).to.equal(`${expectedRedeemable}`);
    expect(`${details.actualTHUSDAmount}`).to.equal(`${expectedRedeemable}`);
  });

  it("should increase the amount to the next lowest redeemable value", async () => {
    const netDebtPerTrove = Trove.create(troveCreations[1]).netDebt;
    const expectedRedeemable = netDebtPerTrove.mul(2).sub(THUSD_MINIMUM_NET_DEBT);

    // setup
    await liquity.openTrove({ depositCollateral: 99, borrowTHUSD: 5000 });
    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[1]);
    await otherLiquities[2].openTrove(troveCreations[1]);

    // test
    const increasedRedeemable = expectedRedeemable.add(THUSD_MINIMUM_NET_DEBT);
    const initialRedemption = await liquity.populate.redeemTHUSD(Decimal.from(3000));
    const increasedRedemption = await initialRedemption.increaseAmountByMinimumNetDebt();
    expect(`${increasedRedemption.attemptedTHUSDAmount}`).to.equal(`${increasedRedeemable}`);
    expect(`${increasedRedemption.redeemableTHUSDAmount}`).to.equal(`${increasedRedeemable}`);
    expect(increasedRedemption.isTruncated).to.be.false;

    const { details } = await th.waitForSuccess(increasedRedemption.send());
    expect(`${details.attemptedTHUSDAmount}`).to.equal(`${increasedRedeemable}`);
    expect(`${details.actualTHUSDAmount}`).to.equal(`${increasedRedeemable}`);
  });

  it("should fail to increase the amount if it's not truncated", async () => {
    const netDebtPerTrove = Trove.create(troveCreations[1]).netDebt;

    // setup
    await liquity.openTrove({ depositCollateral: 99, borrowTHUSD: 5000 });
    await otherLiquities[0].openTrove(troveCreations[1]);
    await otherLiquities[1].openTrove(troveCreations[1]);
    await otherLiquities[2].openTrove(troveCreations[1]);

    // test
    const redemption = await liquity.populate.redeemTHUSD(netDebtPerTrove);
    expect(redemption.isTruncated).to.be.false;

    expect(() => redemption.increaseAmountByMinimumNetDebt()).to.throw(
      "can only be called when amount is truncated"
    );
  });

  it("should redeem using the maximum iterations and almost all gas", async () => {
    // variables
    const netDebtPerTrove = MINIMUM_BORROWING_RATE.add(1).mul(amountToBorrowPerTrove);
    const collateralPerTrove = netDebtPerTrove
      .add(THUSD_LIQUIDATION_RESERVE)
      .mulDiv(1.5, massivePrice);
    const amountToRedeem = netDebtPerTrove.mul(_redeemMaxIterations);
    const amountToDeposit = MINIMUM_BORROWING_RATE.add(1)
      .mul(amountToRedeem)
      .add(THUSD_LIQUIDATION_RESERVE)
      .mulDiv(2, massivePrice);

    // redo the setup for 70 connections
    const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
    expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

    [deployerLiquity, liquity, ...otherLiquities] = await th.connectUsers(deployment, [
      deployer,
      user,
      ...otherUsersSubset
    ]);

    // send accounts ETH for transactions
    await th.sendAccountETH(user, funder);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await funder.sendTransaction({
        to: otherUsers[i].getAddress(),
        value: THUSD_MINIMUM_DEBT.div(170).hex
      });
    }

    // mint tokens for transactions
    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    await erc20.mint(await funder.getAddress(), startingBalance);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await erc20.mint(await otherUsers[i].getAddress(), startingBalance);
    }

    await deployerLiquity.setPrice(massivePrice);

    for (const otherLiquity of otherLiquities) {
      await otherLiquity.openTrove({
        depositCollateral: collateralPerTrove,
        borrowTHUSD: amountToBorrowPerTrove
      });
    }

    await liquity.openTrove({
      depositCollateral: amountToDeposit,
      borrowTHUSD: amountToRedeem
    });

    const { rawReceipt } = await th.waitForSuccess(liquity.send.redeemTHUSD(amountToRedeem));

    const gasUsed = rawReceipt.gasUsed.toNumber();
    // gasUsed is ~half the real used amount because of how refunds work, see:
    // https://ethereum.stackexchange.com/a/859/9205
    expect(gasUsed).to.be.at.least(4900000, "should use close to 10M gas");
  }).timeout(300000);

});
