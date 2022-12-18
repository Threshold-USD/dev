const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const ERC20Test = artifacts.require("./ERC20Test.sol")

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable
  let mockActivePool
  let mockTroveManager

  let [owner] = accounts
  
  const amount = dec(1, 'ether')

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
  })

  context("when collateral is ERC20 token", () => {
    let erc20

    beforeEach(async () => {
      erc20 = await ERC20Test.new()
      await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address, erc20.address)
    })

    it('sendCollateralToActivePool(): fails if pool recieves ETH', async () => {  
      await th.assertRevert(mockActivePool.forward(defaultPool.address, '0x', { from: owner, value: amount }), 
                            'DefaultPool: collateral must be ERC20 token')
    })

    it('sendCollateralToActivePool(): fails if receiver cannot receive collateral', async () => {
      // start pool with `amount`
      await erc20.mint(defaultPool.address, amount)
      const updateCollateralBalance = th.getTransactionData('updateCollateralBalance(uint256)', [web3.utils.toHex(amount)])
      const tx = await mockActivePool.forward(defaultPool.address, updateCollateralBalance, { from: owner })
      assert.isTrue(tx.receipt.status)

      // try to send token from pool to contract without proper method
      const sendCollateralData = th.getTransactionData('sendCollateralToActivePool(uint256)', [web3.utils.toHex(amount)])
      await th.assertRevert(mockTroveManager.forward(defaultPool.address, sendCollateralData, { from: owner }))
    })
  })

  context("when collateral is eth", () => {
    
    beforeEach(async () => {
      await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address, th.ZERO_ADDRESS)
    })

    it('sendCollateralToActivePool(): fails if pool recieves token', async () => {
      const updateCollateralBalance = th.getTransactionData('updateCollateralBalance(uint256)', [web3.utils.toHex(amount)])
      await th.assertRevert(mockActivePool.forward(defaultPool.address, updateCollateralBalance, { from: owner }), 
                            'DefaultPool: collateral must be ETH')
    })

    it('sendCollateralToActivePool(): fails if receiver cannot receive collateral', async () => {
      const amount = dec(1, 'ether')

      // start pool with `amount`
      //await web3.eth.sendTransaction({ to: defaultPool.address, from: owner, value: amount })
      const tx = await mockActivePool.forward(defaultPool.address, '0x', { from: owner, value: amount })
      assert.isTrue(tx.receipt.status)

      // try to send ether from pool to non-payable
      //await th.assertRevert(defaultPool.sendCollateralToActivePool(amount, { from: owner }), 'DefaultPool: sending ETH failed')
      const sendCollateralData = th.getTransactionData('sendCollateralToActivePool(uint256)', [web3.utils.toHex(amount)])
      await th.assertRevert(mockTroveManager.forward(defaultPool.address, sendCollateralData, { from: owner }), 'DefaultPool: sending ETH failed')
    })
  })
})

contract('Reset chain state', async accounts => { })
