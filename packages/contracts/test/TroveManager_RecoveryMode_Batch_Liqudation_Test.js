const deploymentHelper = require("../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js")
const { toBN, dec, ZERO_ADDRESS } = th

const TroveManagerTester = artifacts.require("./TroveManagerTester")
const THUSDToken = artifacts.require("./THUSDToken.sol")

contract('TroveManager - in Recovery Mode - back to normal mode in 1 tx', async accounts => {
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I
  ] = accounts;

  let contracts
  let troveManager
  let stabilityPool
  let priceFeed
  let sortedTroves

  const openTrove = async (params) => th.openTrove(contracts, params)
  const provideToSP = async (amount, params) => th.provideToSP(contracts, amount, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore(accounts)
    contracts.troveManager = await TroveManagerTester.new()
    contracts.thusdToken = (await deploymentHelper.deployTHUSDToken(contracts)).thusdToken

    troveManager = contracts.troveManager
    stabilityPool = contracts.stabilityPool
    priceFeed = contracts.priceFeedTestnet
    sortedTroves = contracts.sortedTroves

    await deploymentHelper.connectCoreContracts(contracts)
  })

  context('Batch liquidations', () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(296, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraParams: { from: bob } })
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

      await openTrove({ ICR: toBN(dec(340, 16)), extraTHUSDAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await provideToSP(totalLiquidatedDebt, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(alice, price)
      const ICR_B = await troveManager.getCurrentICR(bob, price)
      const ICR_C = await troveManager.getCurrentICR(carol, price)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      return {
        A_coll, A_totalDebt,
        B_coll, B_totalDebt,
        C_coll, C_totalDebt,
        totalLiquidatedDebt,
        price,
      }
    }

    it('First trove only doesn’t get out of Recovery Mode', async () => {
      await setup()
      const tx = await troveManager.batchLiquidateTroves([alice])

      const TCR = await th.getTCR(contracts)
      assert.isTrue(await th.checkRecoveryMode(contracts))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.batchLiquidateTroves([alice, bob, carol])

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 3, 'Not enough liquidations')

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice))[3], '3')
      assert.equal((await troveManager.Troves(bob))[3], '3')
      assert.equal((await troveManager.Troves(carol))[3], '3')
    })

    it('Stability Pool profit matches', async () => {
      const {
        A_coll, A_totalDebt,
        C_coll, C_totalDebt,
        totalLiquidatedDebt,
        price,
      } = await setup()

      const spCollateralBefore = await stabilityPool.getCollateralBalance()
      const spTHUSDBefore = await stabilityPool.getTotalTHUSDDeposits()

      const tx = await troveManager.batchLiquidateTroves([alice, carol])

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice))[3], '3')
      assert.equal((await troveManager.Troves(carol))[3], '3')

      const spCollateralAfter = await stabilityPool.getCollateralBalance()
      const spTHUSDAfter = await stabilityPool.getTotalTHUSDDeposits()

      // liquidate collaterals with the gas compensation fee subtracted
      const expectedCollateralLiquidatedA = th.applyLiquidationFee(A_totalDebt.mul(mv._MCR).div(price))
      const expectedCollateralLiquidatedC = th.applyLiquidationFee(C_coll)
      // Stability Pool gains
      const expectedGainInTHUSD = expectedCollateralLiquidatedA.mul(price).div(mv._1e18BN).sub(A_totalDebt)
      const realGainInTHUSD = spCollateralAfter.sub(spCollateralBefore).mul(price).div(mv._1e18BN).sub(spTHUSDBefore.sub(spTHUSDAfter))

      assert.equal(spCollateralAfter.sub(spCollateralBefore).toString(), expectedCollateralLiquidatedA.toString(), 'Stability Pool collateral doesn’t match')
      assert.equal(spTHUSDBefore.sub(spTHUSDAfter).toString(), A_totalDebt.toString(), 'Stability Pool THUSD doesn’t match')
      assert.equal(realGainInTHUSD.toString(), expectedGainInTHUSD.toString(), 'Stability Pool gains don’t match')
    })

    it('A trove over TCR is not liquidated', async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(276, 16)), extraParams: { from: bob } })
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: carol } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

      await openTrove({ ICR: toBN(dec(310, 16)), extraTHUSDAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await provideToSP(totalLiquidatedDebt, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(alice, price)
      const ICR_B = await troveManager.getCurrentICR(bob, price)
      const ICR_C = await troveManager.getCurrentICR(carol, price)

      assert.isTrue(ICR_A.gt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
      assert.isTrue(ICR_C.lt(mv._ICR100))

      const tx = await troveManager.batchLiquidateTroves([bob, alice])

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 1, 'Not enough liquidations')

      // Confirm only Bob’s trove removed
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(bob))[3], '3')
      // Confirm troves have status 'open' (Status enum element idx 1)
      assert.equal((await troveManager.Troves(alice))[3], '1')
      assert.equal((await troveManager.Troves(carol))[3], '1')
    })
  })

  context('Sequential liquidations', () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(299, 16)), extraParams: { from: alice } })
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(298, 16)), extraParams: { from: bob } })

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt)

      await openTrove({ ICR: toBN(dec(300, 16)), extraTHUSDAmount: totalLiquidatedDebt, extraParams: { from: whale } })
      await provideToSP(totalLiquidatedDebt, { from: whale })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      const TCR = await th.getTCR(contracts)

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(alice, price)
      const ICR_B = await troveManager.getCurrentICR(bob, price)

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))

      return {
        A_coll, A_totalDebt,
        B_coll, B_totalDebt,
        totalLiquidatedDebt,
        price,
      }
    }

    it('First trove only doesn’t get out of Recovery Mode', async () => {
      await setup()
      const tx = await troveManager.liquidateTroves(1)

      const TCR = await th.getTCR(contracts)
      assert.isTrue(await th.checkRecoveryMode(contracts))
    })

    it('Two troves over MCR are liquidated', async () => {
      await setup()
      const tx = await troveManager.liquidateTroves(10)

      const liquidationEvents = th.getAllEventsByName(tx, 'TroveLiquidated')
      assert.equal(liquidationEvents.length, 2, 'Not enough liquidations')

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(alice))[3], '3')
      assert.equal((await troveManager.Troves(bob))[3], '3')
    })
  })
})
