// library imports
import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployLiquity } from "hardhat";

// project library imports
import {
  Decimal,
  Trove,
  StabilityDeposit,
  THUSD_LIQUIDATION_RESERVE,
  THUSD_MINIMUM_DEBT,
  THUSD_MINIMUM_NET_DEBT
} from "@liquity/lib-base";

// project imports
import erc20Abi from "../abi/ERC20Test.json";
import { EthersLiquity } from "../src/EthersLiquity";
import { _LiquityDeploymentJSON } from "../src/contracts";
import * as th from "../utils/testHelpers";
import * as dh from "../utils/debugHelpers";
import { oracleAddresses } from "../hardhat.config";

const STARTING_BALANCE = Decimal.from(100);

describe("EthersLiquity - StabilityPool", () => {
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

  // test troves
  const initialTroveOfDepositor = Trove.create({
    depositCollateral: THUSD_MINIMUM_DEBT.div(100),
    borrowTHUSD: THUSD_MINIMUM_NET_DEBT
  });
  const troveWithVeryLowICR = Trove.create({
    depositCollateral: THUSD_MINIMUM_DEBT.div(180),
    borrowTHUSD: THUSD_MINIMUM_NET_DEBT
  });
  // test params
  const smallStabilityDeposit = Decimal.from(10);
  const dippedPrice = Decimal.from(190);

  // Always setup same initial conditions for the user wallets
  beforeEach(async () => {
    // get wallets
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();

    // deploy smart contracts
    deployment = await deployLiquity(deployer, oracleAddresses, "tbtc");

    // create different accounts / liquity connections for the users
    const otherUsersSubset = otherUsers.slice(0, 5);
    [deployerLiquity, liquity, ...otherLiquities] = await th.connectUsers(deployment, [
      deployer,
      user,
      ...otherUsersSubset
    ]);

    const erc20Address = liquity.connection.addresses.erc20
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

  it("should make a small stability deposit", async () => {
    // setup
    const { newTrove } = await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    expect(newTrove).to.deep.equal(initialTroveOfDepositor);

    // test
    const details = await liquity.depositTHUSDInStabilityPool(smallStabilityDeposit);
    expect(details).to.deep.equal({
      thusdLoss: Decimal.from(0),
      newTHUSDDeposit: smallStabilityDeposit,
      collateralGain: Decimal.from(0),

      change: {
        depositTHUSD: smallStabilityDeposit
      }
    });
  });

  it("other user should make a Trove with very low ICR", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));

    // test
    const { newTrove } = await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    const price = await liquity.getPrice();

    expect(Number(`${newTrove.collateralRatio(price)}`)).to.be.below(1.15);
  });

  it("the price should take a dip", async () => {
    await deployerLiquity.setPrice(dippedPrice);

    const price = await liquity.getPrice();
    expect(`${price}`).to.equal(`${dippedPrice}`);
  });

  it("should liquidate otherUsers[0]'s Trove", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    await deployerLiquity.setPrice(dippedPrice);

    // test
    const details = await liquity.liquidateUpTo(1);
    expect(details).to.deep.equal({
      liquidatedAddresses: [await otherUsers[0].getAddress()],

      collateralGasCompensation: troveWithVeryLowICR.collateral.mul(0.005), // 0.5%
      thusdGasCompensation: THUSD_LIQUIDATION_RESERVE,

      totalLiquidated: new Trove(
        troveWithVeryLowICR.collateral
          .mul(0.995) // -0.5% gas compensation
          .add("0.000000000000000001"), // tiny imprecision
        troveWithVeryLowICR.debt
      )
    });
    const otherTrove = await otherLiquities[0].getTrove();
    expect(otherTrove.isEmpty).to.be.true;
  });

  it("should have a depleted stability deposit and some collateral gain", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    await liquity.depositTHUSDInStabilityPool(smallStabilityDeposit);
    await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    await deployerLiquity.setPrice(dippedPrice);
    const stabilityDepositTest = await liquity.getStabilityDeposit();
    await liquity.liquidateUpTo(1);

    // test
    const stabilityDeposit = await liquity.getStabilityDeposit();

    // await dh.printBalances(deployment, deployer, [user, otherUsers[0]]);

    expect(stabilityDeposit).to.deep.equal(
      new StabilityDeposit(
        smallStabilityDeposit,
        Decimal.ZERO,
        troveWithVeryLowICR.collateral
          .mul(0.995) // -0.5% gas compensation
          .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
          .sub("0.000000000000000005") // tiny imprecision
      )
    );
  });

  it("the Trove should have received some liquidation shares", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    await liquity.depositTHUSDInStabilityPool(smallStabilityDeposit);
    await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    await deployerLiquity.setPrice(dippedPrice);
    const stabilityDepositTest = await liquity.getStabilityDeposit();
    await liquity.liquidateUpTo(1);

    // test
    const trove = await liquity.getTrove();

    expect(trove).to.deep.equal({
      ownerAddress: await user.getAddress(),
      status: "open",

      ...initialTroveOfDepositor
        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
        .addCollateral(
          troveWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .mulDiv(troveWithVeryLowICR.debt.sub(smallStabilityDeposit), troveWithVeryLowICR.debt)
            .add("0.000000000000000001") // tiny imprecision
        )
    });
  });

  it("total should equal the Trove", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    await liquity.depositTHUSDInStabilityPool(smallStabilityDeposit);
    await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    await deployerLiquity.setPrice(dippedPrice);
    const stabilityDepositTest = await liquity.getStabilityDeposit();
    await liquity.liquidateUpTo(1);

    //test
    const trove = await liquity.getTrove();

    const numberOfTroves = await liquity.getNumberOfTroves();
    expect(numberOfTroves).to.equal(1);

    const total = await liquity.getTotal();
    expect(total).to.deep.equal(
      trove.addCollateral("0.000000000000000001") // tiny imprecision
    );
  });

  it("should transfer the gains to the Trove", async () => {
    // setup
    await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
    await liquity.depositTHUSDInStabilityPool(smallStabilityDeposit);
    await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));
    await deployerLiquity.setPrice(dippedPrice);
    const stabilityDepositTest = await liquity.getStabilityDeposit();
    await liquity.liquidateUpTo(1);

    // test
    const details = await liquity.transferCollateralGainToTrove();

    expect(details).to.deep.equal({
      thusdLoss: smallStabilityDeposit,
      newTHUSDDeposit: Decimal.ZERO,

      collateralGain: troveWithVeryLowICR.collateral
        .mul(0.995) // -0.5% gas compensation
        .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
        .sub("0.000000000000000005"), // tiny imprecision

      newTrove: initialTroveOfDepositor
        .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
        .addCollateral(
          troveWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .sub("0.000000000000000005") // tiny imprecision
        )
    });

    const stabilityDeposit = await liquity.getStabilityDeposit();
    expect(stabilityDeposit.isEmpty).to.be.true;
  });

  it("when people overstay, should still be able to withdraw remaining deposit", async () => {
    let price = Decimal.from(200);
    await deployerLiquity.setPrice(price);

    // Use this account to print THUSD
    await liquity.openTrove({ depositCollateral: 50, borrowTHUSD: 5000 });

    // otherLiquities[0-2] will be independent stability depositors
    await liquity.sendTHUSD(await otherUsers[0].getAddress(), 3000);
    await liquity.sendTHUSD(await otherUsers[1].getAddress(), 1000);
    await liquity.sendTHUSD(await otherUsers[2].getAddress(), 1000);

    // otherLiquities[3-4] will be Trove owners whose Troves get liquidated
    await otherLiquities[3].openTrove({ depositCollateral: 21, borrowTHUSD: 2900 });
    await otherLiquities[4].openTrove({ depositCollateral: 21, borrowTHUSD: 2900 });

    await otherLiquities[0].depositTHUSDInStabilityPool(3000);
    await otherLiquities[1].depositTHUSDInStabilityPool(1000);
    // otherLiquities[2] doesn't deposit yet

    // Tank the price so we can liquidate
    price = Decimal.from(150);
    await deployerLiquity.setPrice(price);

    // Liquidate first victim
    await liquity.liquidate(await otherUsers[3].getAddress());
    expect((await otherLiquities[3].getTrove()).isEmpty).to.be.true;

    // Now otherLiquities[2] makes their deposit too
    await otherLiquities[2].depositTHUSDInStabilityPool(1000);

    // Liquidate second victim
    await liquity.liquidate(await otherUsers[4].getAddress());
    expect((await otherLiquities[4].getTrove()).isEmpty).to.be.true;

    // Stability Pool is now empty
    expect(`${await liquity.getTHUSDInStabilityPool()}`).to.equal("0");

    for (const l of [otherLiquities[0], otherLiquities[1], otherLiquities[2]]) {
      const stabilityDeposit = await l.getStabilityDeposit();
      await l.withdrawTHUSDFromStabilityPool(stabilityDeposit.currentTHUSD);
    }
  });

});
