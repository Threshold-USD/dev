const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const Dummy = artifacts.require("Dummy")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: Liquity functions with the caller restricted to Liquity contract(s)', async accounts => {

  const [owner, alice, bob, carol] = accounts;

  let contracts

  let priceFeed
  let thusdToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let dummy

  let pcv

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore(accounts)
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployTHUSDTokenTester(contracts)

    priceFeed = contracts.priceFeed
    thusdToken = contracts.thusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    pcv = contracts.pcv
    dummy = await Dummy.new()

    await deploymentHelper.connectCoreContracts(contracts)

    for (account of accounts.slice(0, 10)) {
      await th.openTrove(contracts, { extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
    }

  })

  describe('BorrowerOperations', async accounts => {
    it("moveCollateralGainToTrove(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const tx1= await borrowerOperations.moveCollateralGainToTrove(bob, toBN(dec(2, 18)), bob, bob, { from: bob })
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "BorrowerOps: Caller is not Stability Pool")
      }
    })

    it("mintBootstrapLoanFromPCV(): reverts when called by an account that is not PCV", async () => {
      try {
        await borrowerOperations.mintBootstrapLoanFromPCV(toBN(dec(2, 18)), { from: alice })
      } catch (err) {
         assert.include(err.message, "revert")
        assert.include(err.message, "BorrowerOperations: caller must be PCV")
      }
    })

    it("burnDebtFromPCV(): reverts when called by an account that is not PCV", async () => {
      try {
        await borrowerOperations.burnDebtFromPCV(toBN(dec(2, 18)), { from: alice })
      } catch (err) {
         assert.include(err.message, "revert")
        assert.include(err.message, "BorrowerOperations: caller must be PCV")
      }
    })
  })

  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.applyPendingRewards(bob, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveRewardSnapshots(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert" )
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.removeStake(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateStakeAndTotalStakes(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.closeTrove(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.addTroveOwnerToArray(bob, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.setTroveStatus(bob, 1, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveColl
    it("increaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveColl(bob, 100, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveColl
    it("decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveColl(bob, 100, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveDebt(bob, 100, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveDebt(bob, 100, { from: alice })

      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendCollateral
    it("sendCollateral(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendCollateral(alice, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // increaseTHUSD
    it("increaseTHUSDDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseTHUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager")
      }
    })

    // decreaseTHUSD
    it("decreaseTHUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseTHUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // fallback (payment)
    it("fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendCollateralToActivePool
    it("sendCollateralToActivePool(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendCollateralToActivePool(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // increaseTHUSD
    it("increaseTHUSDDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseTHUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // decreaseTHUSD
    it("decreaseTHUSD(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseTHUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // fallback (payment)
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager ---

    // offset
    it("offset(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not TroveManager")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "StabilityPool: Caller is not ActivePool")
      }
    })
  })

  describe('THUSDToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = thusdToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "THUSDToken: Caller not allowed to mint")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await thusdToken.burn(bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await thusdToken.sendToPool(bob, activePool.address, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await thusdToken.returnFromPool(activePool.address, bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
      }
    })
  })

  describe('SortedTroves', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.insert(bob, '150000000000000000000', bob, bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is neither BO nor TroveM")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the TroveManager")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor TroveM")
      }
    })
  })

  describe('PCV', async accounts => {
    
    before(async () => {
      await pcv.initialize({ from: owner })
      const debtToPay = await pcv.debtToPay()
      await pcv.payDebt(debtToPay, { from: owner })
    })

    it.skip("receive(): reverts when caller is not ActivePool", async () => {
      try {
        await web3.eth.sendTransaction({ from: alice, to: pcv.address, value: 100 })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller is not ActivePool")
      }
    })

    it("depositToBAMM(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.depositToBAMM(1, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("withdrawFromBAMM(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.withdrawFromBAMM(1, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("withdrawTHUSD(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.withdrawTHUSD(alice, 1, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("withdrawCollateral(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.withdrawCollateral(alice, 1, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("payDebt(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.payDebt(1, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("initialize(): reverts when caller is not owner, council or treasury", async () => {
      try {
        await pcv.initialize({ from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "PCV: caller must be owner or council or treasury")
      }
    })

    it("addRecipientToWhitelist(): reverts when caller is not owner", async () => {
      try {
        await pcv.addRecipientToWhitelist(bob, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("addRecipientsToWhitelist(): reverts when caller is not owner", async () => {
      try {
        await pcv.addRecipientsToWhitelist([bob], { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("removeRecipientFromWhitelist(): reverts when caller is not owner", async () => {
      try {
        await pcv.removeRecipientFromWhitelist(alice, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("removeRecipientsFromWhitelist(): reverts when caller is not owner", async () => {
      try {
        await pcv.removeRecipientsFromWhitelist([alice], { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("startChangingRoles(): reverts when caller is not owner", async () => {
      try {
        await pcv.startChangingRoles(alice, alice, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("cancelChangingRoles(): reverts when caller is not owner", async () => {
      try {
        await pcv.cancelChangingRoles({ from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })

    it("finalizeChangingRoles(): reverts when caller is not owner", async () => {
      try {
        await pcv.finalizeChangingRoles({ from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Ownable: caller is not the owner")
      }
    })
  })

})
