const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const LQTYStakingTester = artifacts.require('LQTYStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific ETH and LUSD gain values. They only test that the
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake.
 *
 * Specific ETH/LUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 *
 */

contract('LQTYStaking receives fees tests', async accounts => {

  const [bountyAddress, multisig] = accounts.slice(998, 1000)

  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let lqtyStaking
  let lqtyToken

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployLUSDTokenTester(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, multisig)

    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    nonPayable = await NonPayable.new()
    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyToken = LQTYContracts.lqtyToken
    lqtyStaking = LQTYContracts.lqtyStaking
  })

  it("LQTY Staking: PCV start at zero", async () => {
    // Check LUSD fees are initialised as zero
    const LUSD_Fees = await lqtyStaking.F_LUSD()
    assert.equal(LUSD_Fees, '0')

    // Check ETH fees are initialised as zero
    const ETH_Fees = await lqtyStaking.F_ETH()
    assert.equal(ETH_Fees, '0')

  })

  it("LQTY Staking: PCV LUSD increases when opening troves", async() => {
    let error = 100000000 // note values stored in wei

    let troveWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    let issuanceFeeWhale = troveWhale.netDebt - troveWhale.lusdAmount
    let pcvBalance = await lusdToken.balanceOf(lqtyStaking.address)
    let fees = issuanceFeeWhale
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    let issuanceFeeA = troveA.netDebt - troveA.lusdAmount
    pcvBalance = await lusdToken.balanceOf(lqtyStaking.address)
    fees += issuanceFeeA
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    let issuanceFeeB = troveB.netDebt - troveB.lusdAmount
    pcvBalance = await lusdToken.balanceOf(lqtyStaking.address)
    fees += issuanceFeeB
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    let issuanceFeeC = troveC.netDebt - troveC.lusdAmount
    pcvBalance = await lusdToken.balanceOf(lqtyStaking.address)
    fees += issuanceFeeC
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    let troveD = await openTrove({ extraLUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    let issuanceFeeD = troveD.netDebt - troveD.lusdAmount
    pcvBalance = await lusdToken.balanceOf(lqtyStaking.address)
    fees += issuanceFeeD
    assert.isAtMost(Math.abs(fees - pcvBalance), error)

    // Check LUSD fees is initialised as zero
    const LUSD_Fees = await lqtyStaking.F_LUSD()
    th.assertIsApproximatelyEqual(LUSD_Fees, pcvBalance)
  })

  it("LQTY Staking: PCV ETH increase when a redemption fee occurs", async() => {
    await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year redemptions are allowed
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await lqtyStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await lusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))

    const B_BalAfterRedemption = await lusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await lqtyStaking.F_ETH()
    assert.isTrue(emittedETHFee.eq(F_ETH_After))
  })

  it("LQTY Staking: PCV LUSD increase when drawing debt from a trove", async () => {
    // setup troves
    await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    let troveD = await openTrove({ extraLUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    PCV_LUSD_Fees = await lusdToken.balanceOf(lqtyStaking.address)

    const LUSD_Fees = await lqtyStaking.F_LUSD()
    assert.isTrue(LUSD_Fees.eq(PCV_LUSD_Fees))

    // Check ETH fees is initialised as zero
    const ETH_Fees = await lqtyStaking.F_ETH()
    assert.equal(ETH_Fees, '0')

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(100, 18), D, D, {from: D})

    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_1 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

    // Check LUSD fee of $0.50 for the $100 debt draw is collected in PCV
    const LUSD_Fees_After = await lqtyStaking.F_LUSD()
    assert.isTrue(LUSD_Fees_After.gt(LUSD_Fees))

  })

  it("receive(): reverts when it receives ETH from an address that is not the Active Pool",  async () => {
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: lqtyStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: lqtyStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const lqtyStakingTester = await LQTYStakingTester.new()
    await assertRevert(lqtyStakingTester.requireCallerIsTroveManager(), 'LQTYStaking: caller is not TroveM')
  })
})
