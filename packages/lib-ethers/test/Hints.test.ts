import chai, { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployLiquity } from "hardhat";
import { HintHelpers } from "../types";
import erc20Abi from "../abi/ERC20Test.json";
import * as th from "../utils/testHelpers";

import {
  Decimal,
  Fees,
  Trove,
  MINIMUM_BORROWING_RATE,
  LUSD_MINIMUM_DEBT,
  LUSD_MINIMUM_NET_DEBT
} from "@liquity/lib-base";

import { _LiquityDeploymentJSON } from "../src/contracts";
import { EthersLiquity } from "../src/EthersLiquity";
import {
  PopulatableEthersLiquity,
  PopulatedEthersLiquityTransaction,
  _redeemMaxIterations
} from "../src/PopulatableEthersLiquity";
import { ReadableEthersLiquity } from "../src/ReadableEthersLiquity";

const STARTING_BALANCE = Decimal.from(100); // amount of tokens and ETH to initialise

let deployer: Signer;
let funder: Signer;
let user: Signer;
let otherUsers: Signer[];
let otherUsersSubset: Signer[];
let deployment: _LiquityDeploymentJSON;
let deployerLiquity: EthersLiquity;
let liquity: EthersLiquity;
let erc20: Contract;
let userAddress: string;

describe("findHintForCollateralRatio", () => {
  // Always setup same initial conditions for the user wallets
  beforeEach(async () => {
    // get wallets
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    otherUsersSubset = otherUsers.slice(0, 12);

    // deploy the smart contracts
    deployment = await deployLiquity(deployer);

    // create account / connection to liquity for the user wallet
    liquity = await th.connectToDeployment(deployment, user);

    const erc20Address = liquity.connection.addresses.erc20;
    erc20 = new ethers.Contract(erc20Address, erc20Abi, deployer);
    userAddress = await user.getAddress();

    // send accounts ETH for transactions
    await th.sendAccountETH(user, funder);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await funder.sendTransaction({
        to: otherUsers[i].getAddress(),
        value: LUSD_MINIMUM_DEBT.div(170).hex
      });
    }

    // mint tokens for transactions
    const startingBalance = BigNumber.from(STARTING_BALANCE.hex);
    await erc20.mint(await user.getAddress(), startingBalance);
    for (var i=0;i<otherUsersSubset.length;i++) {
      await erc20.mint(await otherUsers[i].getAddress(), startingBalance);
    }

    const tokenBalance = await erc20.balanceOf(userAddress);
    expect(`${tokenBalance}`).to.equal(`${BigNumber.from(STARTING_BALANCE.hex)}`);
  });

  it("should pick the closest approx hint", async () => {
    type Resolved<T> = T extends Promise<infer U> ? U : never;
    type ApproxHint = Resolved<ReturnType<HintHelpers["getApproxHint"]>>;

    const fakeHints: ApproxHint[] = [
      { diff: BigNumber.from(3), hintAddress: "alice", latestRandomSeed: BigNumber.from(1111) },
      { diff: BigNumber.from(4), hintAddress: "bob", latestRandomSeed: BigNumber.from(2222) },
      { diff: BigNumber.from(1), hintAddress: "carol", latestRandomSeed: BigNumber.from(3333) },
      { diff: BigNumber.from(2), hintAddress: "dennis", latestRandomSeed: BigNumber.from(4444) }
    ];

    const borrowerOperations = {
      estimateGas: {
        openTrove: () => Promise.resolve(BigNumber.from(1))
      },
      populateTransaction: {
        openTrove: () => Promise.resolve({})
      }
    };

    const hintHelpers = chai.spy.interface({
      getApproxHint: () => Promise.resolve(fakeHints.shift())
    });

    const sortedTroves = chai.spy.interface({
      findInsertPosition: () => Promise.resolve(["fake insert position"])
    });

    const fakeLiquity = new PopulatableEthersLiquity(({
      getNumberOfTroves: () => Promise.resolve(1000000),
      getTotal: () => Promise.resolve(new Trove(Decimal.from(10), Decimal.ONE)),
      getPrice: () => Promise.resolve(Decimal.ONE),
      _getBlockTimestamp: () => Promise.resolve(0),
      _getFeesFactory: () =>
        Promise.resolve(() => new Fees(0, 0.99, 1, new Date(), new Date(), false)),

      connection: {
        signerOrProvider: user,
        _contracts: {
          borrowerOperations,
          hintHelpers,
          sortedTroves
        }
      }
    } as unknown) as ReadableEthersLiquity);

    const nominalCollateralRatio = Decimal.from(0.05);

    const params = Trove.recreate(new Trove(Decimal.from(1), LUSD_MINIMUM_DEBT));
    const trove = Trove.create(params);
    expect(`${trove._nominalCollateralRatio}`).to.equal(`${nominalCollateralRatio}`);

    await fakeLiquity.openTrove(params);

    expect(hintHelpers.getApproxHint).to.have.been.called.exactly(4);
    expect(hintHelpers.getApproxHint).to.have.been.called.with(nominalCollateralRatio.hex);

    // returned latestRandomSeed should be passed back on the next call
    expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(1111));
    expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(2222));
    expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(3333));

    expect(sortedTroves.findInsertPosition).to.have.been.called.once;
    expect(sortedTroves.findInsertPosition).to.have.been.called.with(
      nominalCollateralRatio.hex,
      "carol"
    );
  });

  // Test workarounds related to https://github.com/liquity/dev/issues/600
// describe("Hints (adjustTrove)", () => {

  // Test 1
  it("Hints (adjustTrove): should not use extra gas when a Trove's position doesn't change", async () => {
    await th.openTroves(deployment, liquity, otherUsersSubset, funder, [
      { depositCollateral: 30, borrowLUSD: 2000 }, // 0
      { depositCollateral: 30, borrowLUSD: 2100 }, // 1
      { depositCollateral: 30, borrowLUSD: 2200 }, // 2
      { depositCollateral: 30, borrowLUSD: 2300 }, // 3
      // Test 1:           30,             2400
      { depositCollateral: 30, borrowLUSD: 2500 }, // 4
      { depositCollateral: 30, borrowLUSD: 2600 }, // 5
      { depositCollateral: 30, borrowLUSD: 2700 }, // 6
      { depositCollateral: 30, borrowLUSD: 2800 } //  7
    ]);

    const { newTrove: initialTrove } = await liquity.openTrove({
      depositCollateral: 30,
      borrowLUSD: 2400
    });

    // Maintain the same ICR / position in the list
    const targetTrove = initialTrove.multiply(1.1);

    const { rawReceipt } = await th.waitForSuccess(
      liquity.send.adjustTrove(initialTrove.adjustTo(targetTrove))
    );

    const gasUsed = rawReceipt.gasUsed.toNumber();
    expect(gasUsed).to.be.at.most(260000);
  });

  // Test 2
  it("Hints (adjustTrove): should not traverse the whole list when bottom Trove moves", async () => {
    // setup
    await th.openTroves(deployment, liquity, otherUsersSubset, funder, [
      { depositCollateral: 30, borrowLUSD: 2000 }, // 0
      { depositCollateral: 30, borrowLUSD: 2100 }, // 1
      { depositCollateral: 30, borrowLUSD: 2200 }, // 2
      { depositCollateral: 30, borrowLUSD: 2300 }, // 3
      // { depositCollateral: 30, borrowLUSD: 2400 }, // Test 1
      { depositCollateral: 30, borrowLUSD: 2500 }, // 4
      { depositCollateral: 30, borrowLUSD: 2600 }, // 5
      { depositCollateral: 30, borrowLUSD: 2700 }, // 6
      { depositCollateral: 30, borrowLUSD: 2800 } //  7
      // Test 2:           30,             2900
      // Test 2 (other):   30,             3000
    ]);

    const { newTrove: initialTrove } = await liquity.openTrove({
      depositCollateral: 30,
      borrowLUSD: 2400
    });

    // test
    const bottomLiquity = await th.connectToDeployment(deployment, otherUsersSubset[7]);
    const bottomTrove = await bottomLiquity.getTrove();
    const targetTrove = Trove.create({ depositCollateral: 30, borrowLUSD: 2900 });
    const interferingTrove = Trove.create({ depositCollateral: 30, borrowLUSD: 3000 });
    const tx = await liquity.populate.adjustTrove(initialTrove.adjustTo(targetTrove));

    // Suddenly: interference!
    await bottomLiquity.adjustTrove(bottomTrove.adjustTo(interferingTrove));
    const { rawReceipt } = await th.waitForSuccess(tx.send());
    const gasUsed = rawReceipt.gasUsed.toNumber();
    expect(gasUsed).to.be.at.most(310000);
  });

  // Test 3
  it("Hints (adjustTrove): should not traverse the whole list when lowering ICR of bottom Trove", async () => {
    // setup
    await th.openTroves(deployment, liquity, otherUsersSubset, funder, [
      { depositCollateral: 30, borrowLUSD: 2000 }, // 0
      { depositCollateral: 30, borrowLUSD: 2100 }, // 1
      { depositCollateral: 30, borrowLUSD: 2200 }, // 2
      { depositCollateral: 30, borrowLUSD: 2300 }, // 3
      // { depositCollateral: 30, borrowLUSD: 2400 }, // Test 1
      { depositCollateral: 30, borrowLUSD: 2500 }, // 4
      { depositCollateral: 30, borrowLUSD: 2600 }, // 5
      { depositCollateral: 30, borrowLUSD: 2700 }, // 6
      { depositCollateral: 30, borrowLUSD: 2800 }, //  7
      { depositCollateral: 30, borrowLUSD: 2900 }, // Test 2:
      { depositCollateral: 30, borrowLUSD: 3000 }  // Test 2 (other):
      // Test 3:           30,             3100 -> 3200
    ]);

    const { newTrove: initialTrove } = await liquity.openTrove({
      depositCollateral: 30,
      borrowLUSD: 2400
    });

    // test
    const targetTrove = [
      Trove.create({ depositCollateral: 30, borrowLUSD: 3100 }),
      Trove.create({ depositCollateral: 30, borrowLUSD: 3200 })
    ];

    await liquity.adjustTrove(initialTrove.adjustTo(targetTrove[0]));
    // Now we are the bottom Trove

    // Lower our ICR even more
    const { rawReceipt } = await th.waitForSuccess(
      liquity.send.adjustTrove(targetTrove[0].adjustTo(targetTrove[1]))
    );

    const gasUsed = rawReceipt.gasUsed.toNumber();
    expect(gasUsed).to.be.at.most(250000);
  });
});
