const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const TroveManagerTester = artifacts.require("TroveManagerTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues

const assertRevert = th.assertRevert
const GAS_PRICE = 10000000

contract('BorrowerWrappers', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    defaulter_1, defaulter_2] = accounts;

  let priceFeed
  let lusdToken
  let troveManagerOriginal
  let troveManager
  let stabilityPool
  let collSurplusPool
  let borrowerOperations
  let borrowerWrappers
  let pcv

  let contracts

  let LUSD_GAS_COMPENSATION

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore(accounts)
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployLUSDToken(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat()

    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    troveManagerOriginal = contracts.troveManager

    const users = [ alice, bob, carol, dennis, whale, A, B, C, D, E, defaulter_1, defaulter_2 ]
    await deploymentHelper.deployProxyScripts(contracts, LQTYContracts, owner, users)

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    troveManager = contracts.troveManager
    stabilityPool = contracts.stabilityPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    borrowerWrappers = contracts.borrowerWrappers
    pcv = LQTYContracts.pcv
    erc20 = contracts.erc20

    LUSD_GAS_COMPENSATION = await borrowerOperations.LUSD_GAS_COMPENSATION()
  })

  it('proxy owner can recover ETH and tokens', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

    assert.notEqual(alice, proxyAddress)

    await web3.eth.sendTransaction({ from: owner, to: proxyAddress, value: amount, gasPrice: GAS_PRICE })
    assert.equal(await web3.eth.getBalance(proxyAddress), amount.toString())

    let balanceBefore = toBN(await web3.eth.getBalance(alice))
    // recover ETH
    const gas_Used = th.gasUsed(await borrowerWrappers.transferETH(alice, amount, { from: alice, gasPrice: GAS_PRICE }))
    let balanceAfter = toBN(await web3.eth.getBalance(alice))
    const expectedBalance = toBN(balanceBefore.sub(toBN(gas_Used * GAS_PRICE)))
    assert.equal(balanceAfter.sub(expectedBalance), amount.toString())

    // mint tokens for the proxy
    await erc20.mint(proxyAddress, amount)
    assert.equal(await contracts.erc20.balanceOf(proxyAddress), amount.toString())

    balanceBefore = toBN(await contracts.erc20.balanceOf(alice))
    // recover tokens
    await borrowerWrappers.transferTokens(erc20.address, alice, amount, { from: alice, gasPrice: 0 })
    balanceAfter = toBN(await contracts.erc20.balanceOf(alice))
    assert.equal(balanceAfter.sub(balanceBefore), amount.toString())
  })

  it('non proxy owner cannot recover ETH', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

    // send some ETH to proxy
    await contracts.erc20.mint(proxyAddress, amount)
    //await web3.eth.sendTransaction({ from: owner, to: proxyAddress, value: amount })
    assert.equal(await contracts.erc20.balanceOf(proxyAddress), amount.toString())

    const balanceBefore = toBN(await contracts.erc20.balanceOf(alice))

    // try to recover tokens
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'transferTokens(address,address,uint256)'
    const calldata = th.getTransactionData(signature, [contracts.erc20.address, alice, amount])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')

    assert.equal(await contracts.erc20.balanceOf(proxyAddress), amount.toString())

    let balanceAfter = toBN(await contracts.erc20.balanceOf(alice))
    assert.equal(balanceAfter.toString(), balanceBefore.toString()) // account for gas
  })

  // // --- claimCollateralAndOpenTrove ---
  //
  // it('claimCollateralAndOpenTrove(): reverts if nothing to claim', async () => {
  //   // Whale opens Trove
  //   await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
  //
  //   // alice opens Trove
  //   const { lusdAmount, collateral } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
  //
  //   const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //
  //   // alice claims collateral and re-opens the trove
  //   await assertRevert(
  //     borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, lusdAmount, alice, alice, { from: alice }),
  //     'CollSurplusPool: No collateral available to claim'
  //   )
  //
  //   // check everything remain the same
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await lusdToken.balanceOf(proxyAddress), lusdAmount)
  //   assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
  //   th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), collateral)
  // })
  //
  // it('claimCollateralAndOpenTrove(): without sending any value', async () => {
  //   // alice opens Trove
  //   const { lusdAmount, netDebt: redeemAmount, collateral } = await openTrove({extraLUSDAmount: 0, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
  //   // Whale opens Trove
  //   await openTrove({ extraLUSDAmount: redeemAmount, ICR: toBN(dec(5, 18)), extraParams: { from: whale } })
  //
  //   const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //
  //   // whale redeems 150 LUSD
  //   await th.redeemCollateral(whale, contracts, redeemAmount)
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //
  //   // surplus: 5 - 150/200
  //   const price = await priceFeed.getPrice();
  //   const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
  //   th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
  //   assert.equal(await troveManager.getTroveStatus(proxyAddress), 4) // closed by redemption
  //
  //   // alice claims collateral and re-opens the trove
  //   await borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, lusdAmount, alice, alice, { from: alice })
  //
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await lusdToken.balanceOf(proxyAddress), lusdAmount.mul(toBN(2)))
  //   assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
  //   th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), expectedSurplus)
  // })
  //
  // it('claimCollateralAndOpenTrove(): sending value in the transaction', async () => {
  //   // alice opens Trove
  //   const { lusdAmount, netDebt: redeemAmount, collateral } = await openTrove({ extraParams: { from: alice } })
  //   // Whale opens Trove
  //   await openTrove({ extraLUSDAmount: redeemAmount, ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
  //
  //   const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //
  //   // whale redeems 150 LUSD
  //   await th.redeemCollateral(whale, contracts, redeemAmount)
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //
  //   // surplus: 5 - 150/200
  //   const price = await priceFeed.getPrice();
  //   const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
  //   th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
  //   assert.equal(await troveManager.getTroveStatus(proxyAddress), 4) // closed by redemption
  //
  //   // alice claims collateral and re-opens the trove
  //   await borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, lusdAmount, alice, alice, { from: alice, value: collateral })
  //
  //   assert.equal(await contracts.erc20.balanceOf(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
  //   th.assertIsApproximatelyEqual(await lusdToken.balanceOf(proxyAddress), lusdAmount.mul(toBN(2)))
  //   assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
  //   th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), expectedSurplus.add(collateral))
  // })
  //
  // // --- claimSPRewardsAndRecycle ---
  //
  // it('claimSPRewardsAndRecycle(): only owner can call it', async () => {
  //   // Whale opens Trove
  //   await openTrove({ extraLUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
  //   // Whale deposits 1850 LUSD in StabilityPool
  //   await stabilityPool.provideToSP(dec(1850, 18), { from: whale })
  //
  //   // alice opens trove and provides 150 LUSD to StabilityPool
  //   await openTrove({ extraLUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
  //   await stabilityPool.provideToSP(dec(150, 18), { from: alice })
  //
  //   // Defaulter Trove opened
  //   await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
  //
  //   // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
  //   const price = toBN(dec(100, 18))
  //   await priceFeed.setPrice(price);
  //
  //   // Defaulter trove closed
  //   const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })
  //   const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
  //
  //   // Bob tries to claims SP rewards in behalf of Alice
  //   const proxy = borrowerWrappers.getProxyFromUser(alice)
  //   const signature = 'claimSPRewardsAndRecycle(uint256,address,address)'
  //   const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
  //   await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  // })
  //
  // it('claimSPRewardsAndRecycle():', async () => {
  //   // Whale opens Trove
  //   const whaleDeposit = toBN(dec(2350, 18))
  //   await openTrove({ extraLUSDAmount: whaleDeposit, ICR: toBN(dec(4, 18)), extraParams: { from: whale } })
  //   // Whale deposits 1850 LUSD in StabilityPool
  //   await stabilityPool.provideToSP(whaleDeposit, { from: whale })
  //
  //   // alice opens trove and provides 150 LUSD to StabilityPool
  //   const aliceDeposit = toBN(dec(150, 18))
  //   await openTrove({ extraLUSDAmount: aliceDeposit, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
  //   await stabilityPool.provideToSP(aliceDeposit, { from: alice })
  //
  //   // Defaulter Trove opened
  //   const { lusdAmount, netDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
  //
  //   // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
  //   const price = toBN(dec(100, 18))
  //   await priceFeed.setPrice(price);
  //
  //   // Defaulter trove closed
  //   const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })
  //   const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
  //
  //   // Alice LUSDLoss is ((150/2500) * liquidatedDebt)
  //   const totalDeposits = whaleDeposit.add(aliceDeposit)
  //   const expectedLUSDLoss_A = liquidatedDebt_1.mul(aliceDeposit).div(totalDeposits)
  //
  //   const expectedCompoundedLUSDDeposit_A = toBN(dec(150, 18)).sub(expectedLUSDLoss_A)
  //   const compoundedLUSDDeposit_A = await stabilityPool.getCompoundedLUSDDeposit(alice)
  //   // collateral * 150 / 2500 * 0.995
  //   const expectedETHGain_A = collateral.mul(aliceDeposit).div(totalDeposits).mul(toBN(dec(995, 15))).div(mv._1e18BN)
  //
  //   assert.isAtMost(th.getDifference(expectedCompoundedLUSDDeposit_A, compoundedLUSDDeposit_A), 1000)
  //
  //   const ethBalanceBefore = await contracts.erc20.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
  //   const troveCollBefore = await troveManager.getTroveColl(alice)
  //   const lusdBalanceBefore = await lusdToken.balanceOf(alice)
  //   const troveDebtBefore = await troveManager.getTroveDebt(alice)
  //   const ICRBefore = await troveManager.getCurrentICR(alice, price)
  //   const depositBefore = (await stabilityPool.deposits(alice))
  //   const stakeBefore = await pcv.stakes(alice)
  //
  //   const proportionalLUSD = expectedETHGain_A.mul(price).div(ICRBefore)
  //   const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
  //   const netDebtChange = proportionalLUSD.mul(mv._1e18BN).div(mv._1e18BN.add(borrowingRate))
  //
  //   await priceFeed.setPrice(price.mul(toBN(2)));
  //
  //   // Alice claims SP rewards and puts them back in the system through the proxy
  //   const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
  //   await borrowerWrappers.claimSPRewardsAndRecycle(th._100pct, alice, alice, { from: alice })
  //
  //   const ethBalanceAfter = await contracts.erc20.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
  //   const troveCollAfter = await troveManager.getTroveColl(alice)
  //   const lusdBalanceAfter = await lusdToken.balanceOf(alice)
  //   const troveDebtAfter = await troveManager.getTroveDebt(alice)
  //   const ICRAfter = await troveManager.getCurrentICR(alice, price)
  //   const depositAfter = (await stabilityPool.deposits(alice))
  //
  //   // check proxy balances remain the same
  //   assert.equal(ethBalanceAfter.toString(), ethBalanceBefore.toString())
  //   assert.equal(lusdBalanceAfter.toString(), lusdBalanceBefore.toString())
  //   // check trove has increased debt by the ICR proportional amount to ETH gain
  //   th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalLUSD))
  //   // check trove has increased collateral by the ETH gain
  //   th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedETHGain_A))
  //   // check that ICR remains constant
  //   th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
  //   // check that Stability Pool deposit
  //   th.assertIsApproximatelyEqual(depositAfter, depositBefore.sub(expectedLUSDLoss_A).add(netDebtChange))
  //
  //   // Expect Alice has withdrawn all ETH gain
  //   const alice_pendingETHGain = await stabilityPool.getDepositorCollateralGain(alice)
  //   assert.equal(alice_pendingETHGain, 0)
  // })

})
