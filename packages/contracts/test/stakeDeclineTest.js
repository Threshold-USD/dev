const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const THUSDTokenTester = artifacts.require("./THUSDTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 *
 */
contract('TroveManager', async accounts => {

  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const [owner, A, B, C, D, E, F] = accounts.slice(0, 7);

  let priceFeed
  let thusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers

  let contracts

  const getOpenTroveTHUSDAmount = async (totalDebt) => th.getOpenTroveTHUSDAmount(contracts, totalDebt)

  const getSnapshotsRatio = async () => {
    const ratio = (await troveManager.totalStakesSnapshot())
      .mul(toBN(dec(1, 18)))
      .div((await troveManager.totalCollateralSnapshot()))

    return ratio
  }

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore(accounts)
    contracts.troveManager = await TroveManagerTester.new()
    contracts.thusdToken = (await deploymentHelper.deployTHUSDTokenTester(contracts)).thusdToken

    priceFeed = contracts.priceFeedTestnet
    thusdToken = contracts.thusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    pcv = contracts.pcv

    await deploymentHelper.connectCoreContracts(contracts)
  })

  it("A given trove's stake decline is negligible with adjustments and tiny liquidations", async () => {
    await priceFeed.setPrice(dec(100, 18))

    // Make 1 mega troves A at ~50% total collateral
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(1, 31)), dec(2, 29), ZERO_ADDRESS, ZERO_ADDRESS, { from: A })

    // Make 5 large troves B, C, D, E, F at ~10% total collateral
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(2, 30)), dec(4, 28), ZERO_ADDRESS, ZERO_ADDRESS, { from: B })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(2, 30)), dec(4, 28), ZERO_ADDRESS, ZERO_ADDRESS, { from: C })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(2, 30)), dec(4, 28), ZERO_ADDRESS, ZERO_ADDRESS, { from: D })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(2, 30)), dec(4, 28), ZERO_ADDRESS, ZERO_ADDRESS, { from: E })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(2, 30)), dec(4, 28), ZERO_ADDRESS, ZERO_ADDRESS, { from: F })

    // Make 10 tiny troves at relatively negligible collateral (~1e-9 of total)
    const tinyTroves = accounts.slice(10, 20)
    for (account of tinyTroves) {
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveTHUSDAmount(dec(1, 22)), dec(2, 20), ZERO_ADDRESS, ZERO_ADDRESS, { from: account })
    }

    // liquidate 1 trove at ~50% total system collateral
    await priceFeed.setPrice(dec(50, 18))
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))
    await troveManager.liquidate(A)

    // adjust trove B 1 wei: apply rewards
    await borrowerOperations.adjustTrove(th._100pct, 0, 1, false, 0, ZERO_ADDRESS, ZERO_ADDRESS, {from: B})  // B repays 1 wei

    // Loop over tiny troves, and alternately:
    // - Liquidate a tiny trove
    // - Adjust B's collateral by 1 wei
    for (let [idx, trove] of tinyTroves.entries()) {
      await troveManager.liquidate(trove)
      await borrowerOperations.adjustTrove(th._100pct, 0, 1, false, 0, ZERO_ADDRESS, ZERO_ADDRESS, {from: B})  // A repays 1 wei
    }
  })

  // TODO: stake decline for adjustments with sizable liquidations, for comparison
})
