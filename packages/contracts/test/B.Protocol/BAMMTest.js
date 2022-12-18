const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const BAMM = artifacts.require("BAMM.sol")
const BLens = artifacts.require("BLens.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

contract('BAMM', async accounts => {
  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    u1, u2, u3, u4, u5,
    v1, v2, v3, v4, v5,
    bammOwner
  ] = accounts;

  const feePool = "0x1000000000000000000000000000000000000001"

  describe("BAMM", async () => {

    const contextTestBAMM = (isCollateralERC20) => {
      let contracts
      let priceFeed
      let thusdToken
      let troveManager
      let stabilityPool
      let bamm
      let lens
      let chainlink
      let thusdChainlink
      let erc20
      
      const openTrove = async (params) => th.openTrove(contracts, params)
      const sendCollateral = async (recipient, valueToSend) => th.sendCollateral(erc20, whale, recipient, valueToSend)
      const getCollateralBalance = async (address) => th.getCollateralBalance(erc20, address)

      beforeEach(async () => {
        contracts = await deploymentHelper.deployLiquityCore(accounts)
        contracts.troveManager = await TroveManagerTester.new()
        contracts.thusdToken = (await deploymentHelper.deployTHUSDToken(contracts)).thusdToken
        if (!isCollateralERC20) {
          contracts.erc20.address = ZERO_ADDRESS
        }
        
        await deploymentHelper.connectCoreContracts(contracts)

        priceFeed = contracts.priceFeedTestnet
        thusdToken = contracts.thusdToken
        sortedTroves = contracts.sortedTroves
        troveManager = contracts.troveManager
        activePool = contracts.activePool
        stabilityPool = contracts.stabilityPool
        defaultPool = contracts.defaultPool
        borrowerOperations = contracts.borrowerOperations
        hintHelpers = contracts.hintHelpers
        erc20 = contracts.erc20

        // deploy BAMM
        chainlink = await ChainlinkTestnet.new(priceFeed.address)
        thusdChainlink = await ChainlinkTestnet.new(ZERO_ADDRESS)

        bamm = await BAMM.new(
          chainlink.address, 
          thusdChainlink.address, 
          stabilityPool.address, 
          thusdToken.address, 
          400, 
          feePool, 
          erc20.address,
          {from: bammOwner})
        lens = await BLens.new()

        await thusdChainlink.setPrice(dec(1,18)) // 1 THUSD = 1 USD
      })

      // --- provideToSP() ---
      // increases recorded THUSD at Stability Pool
      it("deposit(): increases the Stability Pool THUSD balance", async () => {
        // --- SETUP --- Give Alice a least 200
        await openTrove({ extraTHUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        // --- TEST ---
        await thusdToken.approve(bamm.address, toBN(200), { from: alice })
        await bamm.deposit(toBN(200), { from: alice })

        // check THUSD balances after
        const stabilityPool_THUSD_After = await stabilityPool.getTotalTHUSDDeposits()
        assert.equal(stabilityPool_THUSD_After, 200)
      })

      // --- provideToSP() ---
      // increases recorded THUSD at Stability Pool
      it("deposit(): two users deposit, check their share", async () => {
        // --- SETUP --- Give Alice a least 200
        await openTrove({ extraTHUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        await openTrove({ extraTHUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })      

        // --- TEST ---
        await thusdToken.approve(bamm.address, toBN(200), { from: alice })
        await thusdToken.approve(bamm.address, toBN(200), { from: whale })      
        await bamm.deposit(toBN(200), { from: alice })
        await bamm.deposit(toBN(200), { from: whale })      

        // check THUSD balances after1
        const whaleShare = await bamm.stake(whale)
        const aliceShare = await bamm.stake(alice)

        assert.equal(whaleShare.toString(), aliceShare.toString())
      })

      // --- provideToSP() ---
      // increases recorded THUSD at Stability Pool
      it("deposit(): two users deposit, one withdraw. check their share", async () => {
        // --- SETUP --- Give Alice a least 200
        await openTrove({ extraTHUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        await openTrove({ extraTHUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })      

        // --- TEST ---
        await thusdToken.approve(bamm.address, toBN(200), { from: alice })
        await thusdToken.approve(bamm.address, toBN(100), { from: whale })      
        await bamm.deposit(toBN(200), { from: alice })
        await bamm.deposit(toBN(100), { from: whale })      

        // check THUSD balances after1
        const whaleShare = await bamm.stake(whale)
        const aliceShare = await bamm.stake(alice)

        assert.equal(whaleShare.mul(toBN(2)).toString(), aliceShare.toString())

        const whaleBalanceBefore = await thusdToken.balanceOf(whale)
        const shareToWithdraw = whaleShare.div(toBN(2));
        await bamm.withdraw(shareToWithdraw, { from: whale });

        const newWhaleShare = await bamm.stake(whale)
        assert.equal(newWhaleShare.mul(toBN(2)).toString(), whaleShare.toString())

        const whaleBalanceAfter = await thusdToken.balanceOf(whale)
        assert.equal(whaleBalanceAfter.sub(whaleBalanceBefore).toString(), 50)      
      })

      it('rebalance scenario', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        bamm.deposit(whaleTHUSD, { from: whale } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })

        // Alice makes Trove and withdraws 100 THUSD
        await openTrove({ extraTHUSDAmount: toBN(dec(100, 18)), ICR: toBN(dec(5, 18)), extraParams: { from: alice } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));
        console.log("rebalance", (await bamm.fetchPrice()).toString())

        const SPTHUSD_Before = await stabilityPool.getTotalTHUSDDeposits()

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // Confirm SP has decreased
        const SPTHUSD_After = await stabilityPool.getTotalTHUSDDeposits()
        assert.isTrue(SPTHUSD_After.lt(SPTHUSD_Before))

        console.log((await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        console.log((await stabilityPool.getDepositorCollateralGain(bamm.address)).toString())
        const price = await priceFeed.fetchPrice.call()
        console.log(price.toString())

        const ammExpectedCollateral = await bamm.getSwapCollateralAmount.call(toBN(dec(1, 18)))

        console.log("expected collateral amount", ammExpectedCollateral.collateralAmount.toString())

        const rate = await bamm.getConversionRate(thusdToken.address, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", toBN(dec(1, 18)), 0)
        assert.equal(rate.toString(), ammExpectedCollateral.collateralAmount.toString())

        await thusdToken.approve(bamm.address, toBN(dec(1, 18)), { from: alice })

        const dest = "0xe1A587Ac322da1611DF55b11A6bC8c6052D896cE" // dummy address
        //await bamm.swap(toBN(dec(1, 18)), dest, { from: alice })
        await bamm.trade(thusdToken.address, toBN(dec(1, 18)), "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", dest, rate, true, { from: alice });

        const swapBalance = await getCollateralBalance(dest)

        assert.isTrue(swapBalance.eq(ammExpectedCollateral.collateralAmount))
      })

      it("test basic shares allocation", async () => {
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

        // A, B, C, open troves 
        await openTrove({ extraTHUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraTHUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraTHUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        await openTrove({ extraTHUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
        await openTrove({ extraTHUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
        
        // D, E provide to bamm, F provide to SP
        await thusdToken.approve(bamm.address, dec(1000, 18), { from: D })
        await thusdToken.approve(bamm.address, dec(2000, 18), { from: E })
        await bamm.deposit(dec(1000, 18), { from: D })
        await bamm.deposit(dec(2000, 18), { from: E })
        await stabilityPool.provideToSP(dec(3000, 18), { from: F })

        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

        // test get user info
        await sendCollateral(bamm.address, toBN(dec(3, 18)))
        const userInfo = await lens.getUserInfo.call(D, bamm.address)
        //console.log({userInfo})
        assert.equal(userInfo.bammUserBalance.toString(), (await bamm.balanceOf(D)).toString())
        assert.equal(userInfo.thusdUserBalance.toString(), dec(1000, 18).toString())
        assert.equal(userInfo.collateralUserBalance.toString(), dec(1, 18).toString())
        assert.equal(userInfo.thusdTotal.toString(), dec(3000, 18).toString())
        assert.equal(userInfo.collateralTotal.toString(), dec(3, 18).toString())      

        await stabilityPool.withdrawFromSP(0, { from: F })
        await bamm.withdraw(0, { from: D })
        await bamm.withdraw(0, { from: E })      
      })

      it("test share", async () => {
        const ammUsers = [u1, u2, u3, u4, u5]
        const userBalance = [0, 0, 0, 0, 0]
        const nonAmmUsers = [v1, v2, v3, v4, v5]

        let totalDeposits = 0

        // test almost equal
        assert(almostTheSame(web3.utils.toWei("9999"), web3.utils.toWei("9999")))
        assert(! almostTheSame(web3.utils.toWei("9989"), web3.utils.toWei("9999")))      

        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        for(let i = 0 ; i < ammUsers.length ; i++) {
          await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: ammUsers[i] } })
          await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: nonAmmUsers[i] } })

          await thusdToken.approve(bamm.address, dec(1000000, 18), { from: ammUsers[i] })

          const qty = toBN(20000)
          totalDeposits += Number(qty.toString())
          userBalance[i] += Number(qty.toString())
          await bamm.deposit(qty, { from: ammUsers[i] })
          await stabilityPool.provideToSP(qty, { from: nonAmmUsers[i] })
        }

        for(n = 0 ; n < 10 ; n++) {
          for(let i = 0 ; i < ammUsers.length ; i++) {
            await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR * (i + n + 1), web3.currentProvider)
            assert.equal((await thusdToken.balanceOf(ammUsers[i])).toString(), (await thusdToken.balanceOf(nonAmmUsers[i])).toString())

            const qty = (i+1) * 1000 + (n+1)*1000 // small number as 0 decimals
            if((n*7 + i*3) % 2 === 0) {
              const share = (await bamm.total()).mul(toBN(qty)).div(toBN(totalDeposits))
              console.log("withdraw", i, {qty}, {totalDeposits}, share.toString())
              await bamm.withdraw(share.toString(), { from: ammUsers[i] })
              await stabilityPool.withdrawFromSP(qty, { from: nonAmmUsers[i] })
              
              totalDeposits -= qty
              userBalance[i] -= qty
            }
            else {
              console.log("deposit", i)
              await bamm.deposit(qty, { from: ammUsers[i]} )
              await stabilityPool.provideToSP(qty, { from: nonAmmUsers[i] })

              totalDeposits += qty
              userBalance[i] += qty            
            }

            const totalSupply = await bamm.totalSupply()
            const userSupply = await bamm.balanceOf(ammUsers[i])
            // userSup / totalSupply = userBalance / totalDeposits
            assert.equal(userSupply.mul(toBN(totalDeposits)).toString(), toBN(userBalance[i]).mul(totalSupply).toString())

            await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR * (i + n + 1), web3.currentProvider)

            await bamm.withdraw(0, { from: ammUsers[i] })
            await stabilityPool.withdrawFromSP(0, { from: nonAmmUsers[i] })            

            await bamm.withdraw(0, { from: ammUsers[0] })
            await stabilityPool.withdrawFromSP(0, { from: nonAmmUsers[0] })                      

            assert.equal((await thusdToken.balanceOf(ammUsers[i])).toString(), (await thusdToken.balanceOf(nonAmmUsers[i])).toString())        
          }
        }
      })
      
      it("test complex shares allocation", async () => {
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

        // A, B, C, open troves 
        await openTrove({ extraTHUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraTHUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraTHUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        await openTrove({ extraTHUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
        await openTrove({ extraTHUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })

        // D, E provide to bamm, F provide to SP
        await thusdToken.approve(bamm.address, dec(1000, 18), { from: D })
        await thusdToken.approve(bamm.address, dec(2000, 18), { from: E })
        await thusdToken.approve(bamm.address, dec(3000, 18), { from: F })      
        
        await bamm.deposit(dec(1000, 18), { from: D })
        await bamm.deposit(dec(2000, 18), { from: E })
        //await bamm.deposit(dec(3000, 18), { from: F }) 

        await bamm.withdraw(0, { from: D })

        console.log("share:", (await bamm.share.call()).toString())
        console.log("stake D:", (await bamm.stake(D)).toString())
        console.log("stake E:", (await bamm.stake(E)).toString())

        await stabilityPool.provideToSP(dec(1000, 18), { from: A })

        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

        await bamm.deposit(dec(3000, 18), { from: F })
        await stabilityPool.provideToSP(dec(3000, 18), { from: B })

        await stabilityPool.withdrawFromSP(0, { from: A })   

        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)      

        console.log("share:", (await bamm.share()).toString())
        console.log("stake D:", (await bamm.stake(D)).toString())
        console.log("stake E:", (await bamm.stake(E)).toString())
        console.log("stake F:", (await bamm.stake(F)).toString())

        await stabilityPool.withdrawFromSP(0, { from: A })    

        await stabilityPool.withdrawFromSP(0, { from: A })
        await stabilityPool.withdrawFromSP(0, { from: B })      
        await bamm.withdraw(0, { from: D })
        await bamm.withdraw(0, { from: E })
        await bamm.withdraw(0, { from: F })               
        
        console.log("share:", (await bamm.share()).toString())
        console.log("stake D:", (await bamm.stake(D)).toString())
        console.log("stake E:", (await bamm.stake(E)).toString())
        console.log("stake F:", (await bamm.stake(F)).toString())
      })

      it('test share with collateral', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
        
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        await thusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
        await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // 4k liquidations
        assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        const collateralGains = web3.utils.toBN("39799999999999999975")
        //console.log(collateralGains.toString(), (await stabilityPool.getDepositorCollateralGain(bamm.address)).toString())

        // send some ETH/ERC20 to simulate partial rebalance
        await sendCollateral(bamm.address, toBN(dec(1, 18)))
        const balance = await getCollateralBalance(bamm.address)
        assert.isTrue(balance.eq(toBN(dec(1, 18))))

        const totalCollateral = collateralGains.add(toBN(dec(1, 18)))
        const totaTHUsd = toBN(dec(6000, 18)).add(totalCollateral.mul(toBN(105)))

        await thusdToken.approve(bamm.address, totaTHUsd, { from: B })            
        await bamm.deposit(totaTHUsd, { from: B } )      

        assert.equal((await bamm.balanceOf(A)).toString(), (await bamm.balanceOf(B)).toString())

        const collateralBalanceBefore = await getCollateralBalance(A)
        const THUSDBefore = await thusdToken.balanceOf(A)
        const tx = await bamm.withdraw(await bamm.balanceOf(A), {from: A})
        let gasFee = toBN(0)
        if (!isCollateralERC20) {
          gasFee = toBN(tx.receipt.gasUsed).mul(toBN(tx.receipt.effectiveGasPrice))
        }
        const collateralBalanceAfter = await getCollateralBalance(A)
        const THUSDAfter = await thusdToken.balanceOf(A)

        const withdrawUsdValue = THUSDAfter.sub(THUSDBefore).add((collateralBalanceAfter.add(gasFee).sub(collateralBalanceBefore)).mul(toBN(105)))
        assert(in100WeiRadius(withdrawUsdValue.toString(), totaTHUsd.toString()))

        assert(in100WeiRadius("10283999999999999997375", "10283999999999999997322"))
        assert(! in100WeiRadius("10283999999999999996375", "10283999999999999997322"))      
      })

      it('price exceed max dicount and/or collateral balance', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
        
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        await thusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
        await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // 4k liquidations
        assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        const collateralGains = web3.utils.toBN("39799999999999999975")

        // without fee
        await bamm.setParams(20, 0, {from: bammOwner})
        const price = await bamm.getSwapCollateralAmount(dec(105, 18))
        assert.equal(price.collateralAmount.toString(), dec(104, 18-2).toString())
        assert.equal(price.feeTHusdAmount.toString(), "0")

        // with fee
        await bamm.setParams(20, 100, {from: bammOwner})
        const priceWithFee = await bamm.getSwapCollateralAmount(dec(105, 18))
        assert.equal(priceWithFee.collateralAmount.toString(),price.collateralAmount.toString())
        assert.equal(priceWithFee.feeTHusdAmount.toString(), dec(105, 16))

        // without fee
        await bamm.setParams(20, 0, {from: bammOwner})
        const priceDepleted = await bamm.getSwapCollateralAmount(dec(1050000000000000, 18))
        assert.equal(priceDepleted.collateralAmount.toString(), collateralGains.toString())      
        assert.equal(priceDepleted.feeTHusdAmount.toString(), "0")

        // with fee
        await bamm.setParams(20, 100, {from: bammOwner})
        const priceDepletedWithFee = await bamm.getSwapCollateralAmount(dec(1050000000000000, 18))
        assert.equal(priceDepletedWithFee.collateralAmount.toString(), priceDepleted.collateralAmount.toString())
        assert.equal(priceDepletedWithFee.feeTHusdAmount.toString(), dec(1050000000000000, 16))      
      })

      it('test getSwapCollateralAmount', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
        
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        await thusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
        await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // 4k liquidations
        assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        const collateralGains = web3.utils.toBN("39799999999999999975")

        const thusdQty = dec(105, 18)
        const expectedReturn = await bamm.getReturn(thusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(collateralGains.mul(toBN(2 * 105))), 200)

        // without fee
        await bamm.setParams(200, 0, {from: bammOwner})
        const priceWithoutFee = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithoutFee.collateralAmount.toString(), expectedReturn.mul(toBN(100)).div(toBN(100 * 105)).toString())
        assert.equal(priceWithoutFee.feeTHusdAmount.toString(), "0")

        // with fee
        await bamm.setParams(200, 100, {from: bammOwner})
        const priceWithFee = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithoutFee.collateralAmount.toString(), priceWithFee.collateralAmount.toString())      
        assert.equal(priceWithFee.feeTHusdAmount.toString(), toBN(thusdQty).div(toBN("100")).toString())
        
        // with thusd price > 1
        await thusdChainlink.setPrice(dec(102,16)) // 1 thusd = 1.02 usd
        const priceWithTHusdOver1 = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithTHusdOver1.collateralAmount.toString(), toBN(priceWithoutFee.collateralAmount).mul(toBN(102)).div(toBN(100)).toString())

        // with thusd price < 1
        await thusdChainlink.setPrice(dec(99,16)) // 1 thusd = 0.99 usd
        const priceWithTHusdUnder1 = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithTHusdUnder1.collateralAmount.toString(), priceWithoutFee.collateralAmount.toString())

        // with thusd price >> 1
        await thusdChainlink.setPrice(dec(112,16)) // 1 thusd = 1.12 usd
        const priceWithTHusdTooHigh = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithTHusdTooHigh.collateralAmount.toString(), dec(104,16)) // get max discount, namely 1.04 units instead of 1 unit

      })    

      it('test fetch price', async () => {
        await priceFeed.setPrice(dec(666, 18));
        assert.equal(await bamm.fetchPrice(), dec(666, 18))

        await chainlink.setTimestamp(888)
        assert.equal((await bamm.fetchPrice()).toString(), "0")      
      })

      it('test swap', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
        
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        await thusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
        await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // 4k liquidations
        assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        const collateralGains = web3.utils.toBN("39799999999999999975")

        // with fee
        await bamm.setParams(20, 100, {from: bammOwner})
        const priceWithFee = await bamm.getSwapCollateralAmount(dec(105, 18))
        assert.equal(priceWithFee.collateralAmount.toString(), dec(104, 18-2).toString())
        assert.equal(priceWithFee.feeTHusdAmount.toString(), dec(105, 16).toString())      

        await thusdToken.approve(bamm.address, dec(105,18), {from: whale})
        const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

        await assertRevert(bamm.swap(dec(105,18), priceWithFee.collateralAmount.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
        await bamm.swap(dec(105,18), priceWithFee.collateralAmount, dest, {from: whale}) // TODO - check once with higher value so it will revert

        // check thusd balance
        const expectedPoolBalance = toBN(dec(6105, 18)).sub(priceWithFee.feeTHusdAmount)
        assert.equal(expectedPoolBalance.toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())

        // check eth balance
        const balance = await getCollateralBalance(dest)
        assert.isTrue(balance.eq(priceWithFee.collateralAmount))

        // check fees
        assert.equal((await thusdToken.balanceOf(feePool)).toString(), priceWithFee.feeTHusdAmount.toString())
      })    

      it('test set params happy path', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
        await openTrove({ extraTHUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
        await openTrove({ extraTHUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
        
        const whaleTHUSD = await thusdToken.balanceOf(whale)
        await thusdToken.approve(bamm.address, whaleTHUSD, { from: whale })
        await thusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
        await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
        await openTrove({ extraTHUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await priceFeed.setPrice(dec(105, 18));

        // Troves are closed
        await troveManager.liquidate(defaulter_1, { from: owner })
        await troveManager.liquidate(defaulter_2, { from: owner })

        // 4k liquidations
        assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedTHUSDDeposit(bamm.address)).toString())
        const collateralGains = web3.utils.toBN("39799999999999999975")

        const thusdQty = dec(105, 18)
        const expectedReturn200 = await bamm.getReturn(thusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(collateralGains.mul(toBN(2 * 105))), 200)
        const expectedReturn190 = await bamm.getReturn(thusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(collateralGains.mul(toBN(2 * 105))), 190)      

        assert(expectedReturn200.toString() !== expectedReturn190.toString())

        // without fee
        await bamm.setParams(200, 0, {from: bammOwner})
        const priceWithoutFee = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithoutFee.collateralAmount.toString(), expectedReturn200.mul(toBN(100)).div(toBN(100 * 105)).toString())
        assert.equal(priceWithoutFee.feeTHusdAmount.toString(), "0")

        // with fee
        await bamm.setParams(190, 100, {from: bammOwner})
        const priceWithFee = await bamm.getSwapCollateralAmount(thusdQty)
        assert.equal(priceWithFee.collateralAmount.toString(), expectedReturn190.mul(toBN(100)).div(toBN(100 * 105)).toString())
        assert.equal(priceWithFee.feeTHusdAmount.toString(), toBN(thusdQty).div(toBN("100")).toString())            
      })    
      
      it('test set params sad path', async () => {
        await assertRevert(bamm.setParams(210, 100, {from: bammOwner}), 'setParams: A too big')
        await assertRevert(bamm.setParams(9, 100, {from: bammOwner}), 'setParams: A too small')
        await assertRevert(bamm.setParams(10, 101, {from: bammOwner}), 'setParams: fee is too big')             
        await assertRevert(bamm.setParams(20, 100, {from: B}), 'Ownable: caller is not the owner')      
      })
    }

    context("when collateral is ERC20 token", () => {
      contextTestBAMM( true )
    })

    context("when collateral is eth", () => {
      contextTestBAMM( false )
    })
  })
})


function almostTheSame(n1, n2) {
  n1 = Number(web3.utils.fromWei(n1))
  n2 = Number(web3.utils.fromWei(n2))
  //console.log(n1,n2)

  if(n1 * 1000 > n2 * 1001) return false
  if(n2 * 1000 > n1 * 1001) return false  
  return true
}

function in100WeiRadius(n1, n2) {
  const x = toBN(n1)
  const y = toBN(n2)

  if(x.add(toBN(100)).lt(y)) return false
  if(y.add(toBN(100)).lt(x)) return false  
 
  return true
}

async function assertRevert(txPromise, message = undefined) {
  try {
    const tx = await txPromise
    // console.log("tx succeeded")
    assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
  } catch (err) {
    // console.log("tx failed")
    assert.include(err.message, "revert")
    
    if (message) {
       assert.include(err.message, message)
    }
  }
}