const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific collateral and THUSD gain values. They only test that the
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake.
 *
 * Specific collateral/THUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 *
 */

contract('PCV receives fees tests', async accounts => {

  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let thusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let pcv
  let erc20

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)
  const getCollateralBalance = async (address) => th.getCollateralBalance(erc20, address)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore(accounts)
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployTHUSDTokenTester(contracts)

    await deploymentHelper.connectCoreContracts(contracts)

    nonPayable = await NonPayable.new()
    priceFeed = contracts.priceFeedTestnet
    thusdToken = contracts.thusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    pcv = contracts.pcv
    erc20 = contracts.erc20
  })

  it("PCV: PCV start at zero", async () => {
    // Check THUSD fees are initialised as zero
    const THUSD_Fees = await thusdToken.balanceOf(pcv.address)
    assert.equal(THUSD_Fees, '0')

    // Check collateral fees are initialised as zero
    const collateral_fees = await getCollateralBalance(pcv.address)
    assert.equal(collateral_fees, '0')

  })

  it("PCV: PCV THUSD increases when opening troves", async() => {
    let error = 100000000 // note values stored in wei

    let troveWhale = await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    let issuanceFeeWhale = troveWhale.netDebt - troveWhale.thusdAmount
    let pcvBalance = await thusdToken.balanceOf(pcv.address)
    let fees = issuanceFeeWhale
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveA = await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    let issuanceFeeA = troveA.netDebt - troveA.thusdAmount
    pcvBalance = await thusdToken.balanceOf(pcv.address)
    fees += issuanceFeeA
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveB = await openTrove({ extraTHUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    let issuanceFeeB = troveB.netDebt - troveB.thusdAmount
    pcvBalance = await thusdToken.balanceOf(pcv.address)
    fees += issuanceFeeB
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveC = await openTrove({ extraTHUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    let issuanceFeeC = troveC.netDebt - troveC.thusdAmount
    pcvBalance = await thusdToken.balanceOf(pcv.address)
    fees += issuanceFeeC
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveD = await openTrove({ extraTHUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    let issuanceFeeD = troveD.netDebt - troveD.thusdAmount
    pcvBalance = await thusdToken.balanceOf(pcv.address)
    fees += issuanceFeeD
    assert.isAtMost(Math.abs(fees - pcvBalance), error)
  })

  it("PCV: PCV collateral increase when a redemption fee occurs", async() => {
    await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraTHUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraTHUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year redemptions are allowed
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Check collateral fee per unit staked is zero
    const PCV_Collateral_Before = await getCollateralBalance(pcv.address)
    assert.equal(PCV_Collateral_Before, '0')

    const B_BalBeforeREdemption = await thusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))

    const B_BalAfterRedemption = await thusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check collateral fee emitted in event is non-zero
    const emittedCollateralFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedCollateralFee.gt(toBN('0')))

    // Check collateral fee per unit staked has increased by correct amount
    const PCV_Collateral_After = await getCollateralBalance(pcv.address)
    assert.isTrue(emittedCollateralFee.eq(PCV_Collateral_After))
  })

  it("PCV: PCV THUSD increase when drawing debt from a trove", async () => {
    // setup troves
    await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraTHUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraTHUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    let troveD = await openTrove({ extraTHUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    PCV_THUSD_Fees = await thusdToken.balanceOf(pcv.address)

    // Check collateral fees is initialised as zero
    const collateral_fees = await getCollateralBalance(pcv.address)
    assert.equal(collateral_fees, '0')

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawTHUSD(th._100pct, dec(100, 18), D, D, {from: D})

    // Check THUSD fee value in event is non-zero
    const emittedTHUSDFee_1 = toBN(th.getTHUSDFeeFromTHUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedTHUSDFee_1.gt(toBN('0')))

    // Check THUSD fee of $0.50 for the $100 debt draw is collected in PCV
    const THUSD_Fees_After = await thusdToken.balanceOf(pcv.address)
    assert.isTrue(THUSD_Fees_After.gt(PCV_THUSD_Fees))

  })

  it.skip("receive(): reverts when it receives ETH from an address that is not the Active Pool",  async () => {
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: pcv.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: pcv.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

})
