
const BN = require('bn.js')
const Destructible = artifacts.require("./TestContracts/Destructible.sol")

const MoneyValues = {
  negative_5e17: "-" + web3.utils.toWei('500', 'finney'),
  negative_1e18: "-" + web3.utils.toWei('1', 'ether'),
  negative_10e18: "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18: "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18: "-" + web3.utils.toWei('100', 'ether'),
  negative_101e18: "-" + web3.utils.toWei('101', 'ether'),
  negative_eth: (amount) => "-" + web3.utils.toWei(amount, 'ether'),

  _zeroBN: web3.utils.toBN('0'),
  _1e18BN: web3.utils.toBN('1000000000000000000'),
  _10e18BN: web3.utils.toBN('10000000000000000000'),
  _100e18BN: web3.utils.toBN('100000000000000000000'),
  _100BN: web3.utils.toBN('100'),
  _110BN: web3.utils.toBN('110'),
  _150BN: web3.utils.toBN('150'),

  _MCR: web3.utils.toBN('1100000000000000000'),
  _ICR100: web3.utils.toBN('1000000000000000000'),
  _CCR: web3.utils.toBN('1500000000000000000'),
}

const TimeValues = {
  SECONDS_IN_ONE_MINUTE:  60,
  SECONDS_IN_ONE_HOUR:    60 * 60,
  SECONDS_IN_ONE_DAY:     60 * 60 * 24,
  SECONDS_IN_ONE_WEEK:    60 * 60 * 24 * 7,
  SECONDS_IN_SIX_WEEKS:   60 * 60 * 24 * 7 * 6,
  SECONDS_IN_ONE_MONTH:   60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR:    60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK:    60 * 24 * 7,
  MINUTES_IN_ONE_MONTH:   60 * 24 * 30,
  MINUTES_IN_ONE_YEAR:    60 * 24 * 365
}

class TestHelper {

  static dec(val, scale) {
    let zerosCount

    if (scale == 'ether') {
      zerosCount = 18
    } else if (scale == 'finney')
      zerosCount = 15
    else {
      zerosCount = scale
    }

    const strVal = val.toString()
    const strZeros = ('0').repeat(zerosCount)

    return strVal.concat(strZeros)
  }

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0, 6).concat("...").concat(address.slice(len - 4, len))
  }

  static getDifference(x, y) {
    const x_BN = web3.utils.toBN(x)
    const y_BN = web3.utils.toBN(y)

    return Number(x_BN.sub(y_BN).abs())
  }

  static assertIsApproximatelyEqual(x, y, error = 1000) {
    assert.isAtMost(this.getDifference(x, y), error)
  }

  static zipToObject(array1, array2) {
    let obj = {}
    array1.forEach((element, idx) => obj[element] = array2[idx])
    return obj
  }

  static getGasMetrics(gasCostList) {
    const minGas = Math.min(...gasCostList)
    const maxGas = Math.max(...gasCostList)

    let sum = 0;
    for (const gas of gasCostList) {
      sum += gas
    }

    if (sum === 0) {
      return {
        gasCostList: gasCostList,
        minGas: undefined,
        maxGas: undefined,
        meanGas: undefined,
        medianGas: undefined
      }
    }
    const meanGas = sum / gasCostList.length

    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    const sortedGasCostList = [...gasCostList].sort()
    const medianGas = (sortedGasCostList[Math.floor(sortedGasCostList.length / 2)])
    return { gasCostList, minGas, maxGas, meanGas, medianGas }
  }

  static getGasMinMaxAvg(gasCostList) {
    const metrics = th.getGasMetrics(gasCostList)

    const minGas = metrics.minGas
    const maxGas = metrics.maxGas
    const meanGas = metrics.meanGas
    const medianGas = metrics.medianGas

    return { minGas, maxGas, meanGas, medianGas }
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }

  static randDecayFactor(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toFixed(18), 'ether')
    return amountInWei
  }

  static randAmountInWei(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
    return amountInWei
  }

  static randAmountInGWei(min, max) {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
    return amountInWei
  }

  static makeWei(num) {
    return web3.utils.toWei(num.toString(), 'ether')
  }

  static appendData(results, message, data) {
    data.push(message + `\n`)
    for (const key in results) {
      data.push(key + "," + results[key] + '\n')
    }
  }

  static getRandICR(min, max) {
    const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

    // Convert ICR to a duint
    const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')
    return ICR
  }

  static computeICR(coll, debt, price) {
    const collBN = web3.utils.toBN(coll)
    const debtBN = web3.utils.toBN(debt)
    const priceBN = web3.utils.toBN(price)

    const ICR = debtBN.eq(this.toBN('0')) ?
      this.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      : collBN.mul(priceBN).div(debtBN)

    return ICR
  }

  static async ICRbetween100and110(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price)
    return (ICR.gt(MoneyValues._ICR100)) && (ICR.lt(MoneyValues._MCR))
  }

  static async isUndercollateralized(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price)
    return ICR.lt(MoneyValues._MCR)
  }

  static toBN(num) {
    return web3.utils.toBN(num)
  }

  static gasUsed(tx) {
    const gas = tx.receipt.gasUsed
    return gas
  }

  static applyLiquidationFee(collateralAmount) {
    return collateralAmount.mul(this.toBN(this.dec(995, 15))).div(MoneyValues._1e18BN)
  }
  // --- Logging functions ---

  static logGasMetrics(gasResults, message) {
    console.log(
      `\n ${message} \n
      min gas: ${gasResults.minGas} \n
      max gas: ${gasResults.maxGas} \n
      mean gas: ${gasResults.meanGas} \n
      median gas: ${gasResults.medianGas} \n`
    )
  }

  static logAllGasCosts(gasResults) {
    console.log(
      `all gas costs: ${gasResults.gasCostList} \n`
    )
  }

  static logGas(gas, message) {
    console.log(
      `\n ${message} \n
      gas used: ${gas} \n`
    )
  }

  static async logActiveAccounts(contracts, n) {
    const count = await contracts.sortedTroves.getSize()
    const price = await contracts.priceFeedTestnet.getPrice()

    n = (typeof n == 'undefined') ? count : n

    let account = await contracts.sortedTroves.getLast()
    const head = await contracts.sortedTroves.getFirst()

    console.log(`Total active accounts: ${count}`)
    console.log(`First ${n} accounts, in ascending ICR order:`)

    let i = 0
    while (i < n) {
      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await contracts.troveManager.Troves(account))[1]
      const debt = (await contracts.troveManager.Troves(account))[0]
      const ICR = await contracts.troveManager.getCurrentICR(account, price)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)

      if (account == head) { break; }

      account = await contracts.sortedTroves.getPrev(account)

      i++
    }
  }

  static async logAccountsArray(accounts, troveManager, price, n) {
    const length = accounts.length

    n = (typeof n == 'undefined') ? length : n

    console.log(`Number of accounts in array: ${length}`)
    console.log(`First ${n} accounts of array:`)

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await troveManager.Troves(account))[1]
      const debt = (await troveManager.Troves(account))[0]
      const ICR = await troveManager.getCurrentICR(account, price)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)
    }
  }

  static logBN(label, x) {
    x = x.toString().padStart(18, '0')
    // TODO: thousand separators
    const integerPart = x.slice(0, x.length-18) ? x.slice(0, x.length-18) : '0'
    console.log(`${label}:`, integerPart + '.' + x.slice(-18))
  }

  // --- TCR and Recovery Mode functions ---

  // These functions use the PriceFeedTestNet view price function getPrice() which is sufficient for testing.
  // the mainnet contract PriceFeed uses fetchPrice, which is non-view and writes to storage.

  // To checkRecoveryMode / getTCR from the Liquity mainnet contracts, pass a price value - this can be the lastGoodPrice
  // stored in Liquity, or the current Chainlink Collateral:USD price, etc.


  static async checkRecoveryMode(contracts) {
    const price = await contracts.priceFeedTestnet.getPrice()
    return contracts.troveManager.checkRecoveryMode(price)
  }

  static async getTCR(contracts) {
    const price = await contracts.priceFeedTestnet.getPrice()
    return contracts.troveManager.getTCR(price)
  }

  // --- Gas compensation calculation functions ---

  // Given a composite debt, returns the actual debt  - i.e. subtracts the virtual debt.
  // Virtual debt = 50 THUSD.
  static async getActualDebtFromComposite(compositeDebt, contracts) {
    const issuedDebt = await contracts.troveManager.getActualDebtFromComposite(compositeDebt)
    return issuedDebt
  }

  // Adds the gas compensation (50 THUSD)
  static async getCompositeDebt(contracts, debt) {
    const compositeDebt = contracts.borrowerOperations.getCompositeDebt(debt)
    return compositeDebt
  }

  static async getTroveEntireColl(contracts, trove) {
    return this.toBN((await contracts.troveManager.getEntireDebtAndColl(trove))[1])
  }

  static async getTroveEntireDebt(contracts, trove) {
    return this.toBN((await contracts.troveManager.getEntireDebtAndColl(trove))[0])
  }

  static async getTroveStake(contracts, trove) {
    return (contracts.troveManager.getTroveStake(trove))
  }

  /*
   * given the requested THUSD amomunt in openTrove, returns the total debt
   * So, it adds the gas compensation and the borrowing fee
   */
  static async getOpenTroveTotalDebt(contracts, thusdAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(thusdAmount)
    const compositeDebt = await this.getCompositeDebt(contracts, thusdAmount)
    return compositeDebt.add(fee)
  }

  /*
   * given the desired total debt, returns the THUSD amount that needs to be requested in openTrove
   * So, it subtracts the gas compensation and then the borrowing fee
   */
  static async getOpenTroveTHUSDAmount(contracts, totalDebt) {
    const actualDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    return this.getNetBorrowingAmount(contracts, actualDebt)
  }

  // Subtracts the borrowing fee
  static async getNetBorrowingAmount(contracts, debtWithFee) {
    const borrowingRate = await contracts.troveManager.getBorrowingRateWithDecay()
    return this.toBN(debtWithFee).mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(borrowingRate))
  }

  // Adds the borrowing fee
  static async getAmountWithBorrowingFee(contracts, thusdAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(thusdAmount)
    return thusdAmount.add(fee)
  }

  // Adds the redemption fee
  static async getRedemptionGrossAmount(contracts, expected) {
    const redemptionRate = await contracts.troveManager.getRedemptionRate()
    return expected.mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(redemptionRate))
  }

  // Get's total collateral minus total gas comp, for a series of troves.
  static async getExpectedTotalCollMinusTotalGasComp(troveList, contracts) {
    let totalCollRemainder = web3.utils.toBN('0')

    for (const trove of troveList) {
      const remainingColl = this.getCollMinusGasComp(trove, contracts)
      totalCollRemainder = totalCollRemainder.add(remainingColl)
    }
    return totalCollRemainder
  }

  static getEmittedRedemptionValues(redemptionTx) {
    for (let i = 0; i < redemptionTx.logs.length; i++) {
      if (redemptionTx.logs[i].event === "Redemption") {

        const THUSDAmount = redemptionTx.logs[i].args[0]
        const totalTHUSDRedeemed = redemptionTx.logs[i].args[1]
        const totalCollateralDrawn = redemptionTx.logs[i].args[2]
        const CollateralFee = redemptionTx.logs[i].args[3]

        return [THUSDAmount, totalTHUSDRedeemed, totalCollateralDrawn, CollateralFee]
      }
    }
    throw ("The transaction logs do not contain a redemption event")
  }

  static getEmittedLiquidationValues(liquidationTx) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.logs[i].args[0]
        const liquidatedColl = liquidationTx.logs[i].args[1]
        const collGasComp = liquidationTx.logs[i].args[2]
        const thusdGasComp = liquidationTx.logs[i].args[3]

        return [liquidatedDebt, liquidatedColl, collGasComp, thusdGasComp]
      }
    }
    throw ("The transaction logs do not contain a liquidation event")
  }

  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0)  // LiquidatedDebt is position 0 in the Liquidation event
  }

  static getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1) // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2) // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        return liquidationTx.logs[i].args[arg]
      }
    }

    throw ("The transaction logs do not contain a liquidation event")
  }

  static getTHUSDFeeFromTHUSDBorrowingEvent(tx) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === "THUSDBorrowingFeePaid") {
        return (tx.logs[i].args[1]).toString()
      }
    }
    throw ("The transaction logs do not contain an THUSDBorrowingFeePaid event")
  }

  static getEventArgByIndex(tx, eventName, argIndex) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        return tx.logs[i].args[argIndex]
      }
    }
    throw (`The transaction logs do not contain event ${eventName}`)
  }

  static getEventArgByName(tx, eventName, argName) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        const keys = Object.keys(tx.logs[i].args)
        for (let j = 0; j < keys.length; j++) {
          if (keys[j] === argName) {
            return tx.logs[i].args[keys[j]]
          }
        }
      }
    }

    throw (`The transaction logs do not contain event ${eventName} and arg ${argName}`)
  }

  static getAllEventsByName(tx, eventName) {
    const events = []
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        events.push(tx.logs[i])
      }
    }
    return events
  }

  static getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, address) {
    const event = troveUpdatedEvents.filter(event => event.args[0] === address)[0]
    return [event.args[1], event.args[2]]
  }

  static async getBorrowerOpsListHint(contracts, newColl, newDebt) {
    const newNICR = await contracts.hintHelpers.computeNominalCR(newColl, newDebt)
    const {
      hintAddress: approxfullListHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(newNICR, 5, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const {0: upperHint, 1: lowerHint} = await contracts.sortedTroves.findInsertPosition(newNICR, approxfullListHint, approxfullListHint)
    return {upperHint, lowerHint}
  }

  static async getEntireCollAndDebt(contracts, account) {
    // console.log(`account: ${account}`)
    const rawColl = (await contracts.troveManager.Troves(account))[1]
    const rawDebt = (await contracts.troveManager.Troves(account))[0]
    const pendingCollateralReward = await contracts.troveManager.getPendingCollateralReward(account)
    const pendingTHUSDDebtReward = await contracts.troveManager.getPendingTHUSDDebtReward(account)
    const entireColl = rawColl.add(pendingCollateralReward)
    const entireDebt = rawDebt.add(pendingTHUSDDebtReward)

    return { entireColl, entireDebt }
  }

  static async getCollAndDebtFromAddColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl.add(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
    // console.log(`entireColl  ${entireColl}`)
    // console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawTHUSD(contracts, account, amount) {
    const fee = await contracts.troveManager.getBorrowingFee(amount)
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.add(this.toBN(amount)).add(fee)

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromRepayTHUSD(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.sub(this.toBN(amount))

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromAdjustment(contracts, account, CollateralChange, THUSDChange) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    // const coll = (await contracts.troveManager.Troves(account))[1]
    // const debt = (await contracts.troveManager.Troves(account))[0]

    const fee = THUSDChange.gt(this.toBN('0')) ? await contracts.troveManager.getBorrowingFee(THUSDChange) : this.toBN('0')
    const newColl = entireColl.add(CollateralChange)
    const newDebt = entireDebt.add(THUSDChange).add(fee)

    return { newColl, newDebt }
  }


  // --- BorrowerOperations gas functions ---

  static async openTrove_allAccounts(accounts, contracts, CollateralAmount, THUSDAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, THUSDAmount)

    for (const account of accounts) {
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, CollateralAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, THUSDAmount, upperHint, lowerHint, { from: account, value: CollateralAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomCollateral(minCollateral, maxCollateral, accounts, contracts, THUSDAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, THUSDAmount)

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minCollateral, maxCollateral)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, THUSDAmount, upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomCollateral_ProportionalTHUSD(minCollateral, maxCollateral, accounts, contracts, proportion) {
    const gasCostList = []

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minCollateral, maxCollateral)
      const proportionalTHUSD = (web3.utils.toBN(proportion)).mul(web3.utils.toBN(randCollAmount))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalTHUSD)

      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, proportionalTHUSD, upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomCollateral_randomTHUSD(minCollateral, maxCollateral, accounts, contracts, minTHUSDProportion, maxTHUSDProportion, logging = false) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()
    const _1e18 = web3.utils.toBN('1000000000000000000')

    let i = 0
    for (const account of accounts) {

      const randCollAmount = this.randAmountInWei(minCollateral, maxCollateral)
      // console.log(`randCollAmount ${randCollAmount }`)
      const randTHUSDProportion = this.randAmountInWei(minTHUSDProportion, maxTHUSDProportion)
      const proportionalTHUSD = (web3.utils.toBN(randTHUSDProportion)).mul(web3.utils.toBN(randCollAmount).div(_1e18))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalTHUSD)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const feeFloor = this.dec(5, 16)
      const tx = await contracts.borrowerOperations.openTrove(this._100pct, proportionalTHUSD, upperHint, lowerHint, { from: account, value: randCollAmount })

      if (logging && tx.receipt.status) {
        i++
        const ICR = await contracts.troveManager.getCurrentICR(account, price)
        // console.log(`${i}. Trove opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalTHUSD} ICR: ${ICR}`)
      }
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomTHUSD(minTHUSD, maxTHUSD, accounts, contracts, CollateralAmount) {
    const gasCostList = []

    for (const account of accounts) {
      const randTHUSDAmount = this.randAmountInWei(minTHUSD, maxTHUSD)
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, randTHUSDAmount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, CollateralAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, randTHUSDAmount, upperHint, lowerHint, { from: account, value: CollateralAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async closeTrove_allAccounts(accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const tx = await contracts.borrowerOperations.closeTrove({ from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_decreasingTHUSDAmounts(accounts, contracts, CollateralAmount, maxTHUSDAmount) {
    const gasCostList = []

    let i = 0
    for (const account of accounts) {
      const THUSDAmount = (maxTHUSDAmount - i).toString()
      const THUSDAmountWei = web3.utils.toWei(THUSDAmount, 'ether')
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, THUSDAmountWei)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, CollateralAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, THUSDAmountWei, upperHint, lowerHint, { from: account, value: CollateralAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      i += 1
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove(contracts, {
    maxFeePercentage,
    extraTHUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraTHUSDAmount) extraTHUSDAmount = this.toBN(0)
    else if (typeof extraTHUSDAmount == 'string') extraTHUSDAmount = this.toBN(extraTHUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

     // minimum trove size
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues
    const thusdAmount = MIN_DEBT.add(extraTHUSDAmount)
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, thusdAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

    const price = await contracts.priceFeedTestnet.getPrice()
    if (ICR === undefined) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)
    const assetAmount = ('value' in extraParams) ? extraParams.value : ICR.mul(totalDebt).div(price);
    if (contracts.erc20.address === this.ZERO_ADDRESS) {
      extraParams.value = assetAmount
    } else {
      extraParams.value = 0
    }

    const tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, thusdAmount, assetAmount, upperHint, lowerHint, extraParams)

    return {
      thusdAmount,
      netDebt,
      totalDebt,
      ICR,
      collateral: assetAmount,
      tx
    }
  }

  static async withdrawTHUSD(contracts, {
    maxFeePercentage,
    thusdAmount,
    ICR,
    upperHint,
    lowerHint,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    assert(!(thusdAmount && ICR) && (thusdAmount || ICR), "Specify either thusd amount or target ICR, but not both")

    let increasedTotalDebt
    if (ICR) {
      assert(extraParams.from, "A from account is needed")
      const { debt, coll } = await contracts.troveManager.getEntireDebtAndColl(extraParams.from)
      const price = await contracts.priceFeedTestnet.getPrice()
      const targetDebt = coll.mul(price).div(ICR)
      assert(targetDebt > debt, "ICR is already greater than or equal to target")
      increasedTotalDebt = targetDebt.sub(debt)
      thusdAmount = await this.getNetBorrowingAmount(contracts, increasedTotalDebt)
    } else {
      increasedTotalDebt = await this.getAmountWithBorrowingFee(contracts, thusdAmount)
    }

    await contracts.borrowerOperations.withdrawTHUSD(maxFeePercentage, thusdAmount, upperHint, lowerHint, extraParams)

    return {
      thusdAmount,
      increasedTotalDebt
    }
  }

  static async adjustTrove_allAccounts(accounts, contracts, CollateralAmount, THUSDAmount) {
    const gasCostList = []

    for (const account of accounts) {
      let tx;

      let CollateralChangeBN = this.toBN(CollateralAmount)
      let THUSDChangeBN = this.toBN(THUSDAmount)

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, CollateralChangeBN, THUSDChangeBN)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = THUSDChangeBN.gt(zero)
      THUSDChangeBN = THUSDChangeBN.abs()

      // Add collateral to trove
      if (CollateralChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, 0, THUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account, value: CollateralChangeBN })
      // Withdraw collateral from trove
      } else if (CollateralChangeBN.lt(zero)) {
        CollateralChangeBN = CollateralChangeBN.neg()
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, CollateralChangeBN, THUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account })
      }

      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async adjustTrove_allAccounts_randomAmount(accounts, contracts, minCollateral, maxCollateral, THUSDMin, THUSDMax) {
    const gasCostList = []

    for (const account of accounts) {
      let tx;

      let CollateralChangeBN = this.toBN(this.randAmountInWei(minCollateral, maxCollateral))
      let THUSDChangeBN = this.toBN(this.randAmountInWei(THUSDMin, THUSDMax))

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, CollateralChangeBN, THUSDChangeBN)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = THUSDChangeBN.gt(zero)
      THUSDChangeBN = THUSDChangeBN.abs()

      // Add collateral to trove
      if (CollateralChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, 0, THUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account, value: CollateralChangeBN })
      // Withdraw collateral from trove
      } else if (CollateralChangeBN.lt(zero)) {
        CollateralChangeBN = CollateralChangeBN.neg()
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, CollateralChangeBN, THUSDChangeBN, isDebtIncrease, lowerHint,  upperHint,{ from: account })
      }

      const gas = this.gasUsed(tx)
      // console.log(`collateral change: ${CollateralChangeBN},  THUSDChange: ${THUSDChangeBN}, gas: ${gas} `)

      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, amount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: amount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, randCollAmount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, randCollAmount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(randCollAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawTHUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawTHUSD(contracts, account, amount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawTHUSD(this._100pct, amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawTHUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randTHUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawTHUSD(contracts, account, randTHUSDAmount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawTHUSD(this._100pct, randTHUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayTHUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromRepayTHUSD(contracts, account, amount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayTHUSD(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayTHUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randTHUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromRepayTHUSD(contracts, account, randTHUSDAmount)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayTHUSD(randTHUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.troveManager_getCurrentICR(account, price)
      const gas = this.gasUsed(tx) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, THUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedTestnet.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, THUSDAmount, maxFee)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateralAndGetTxObject(redeemer, contracts, THUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedTestnet.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, THUSDAmount, maxFee)
    return tx
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const redeemer of accounts) {
      const randTHUSDAmount = this.randAmountInWei(min, max)

      await this.performRedemptionTx(redeemer, price, contracts, randTHUSDAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionTx(redeemer, price, contracts, THUSDAmount, maxFee = 0) {
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(THUSDAmount, price, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    const tx = await contracts.troveManager.redeemCollateral(THUSDAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      0, maxFee,
      { from: redeemer, gasPrice: 0 },
    )

    return tx
  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openTrove(this._100pct, '200000000000000000000', account, account, { from: account, value: coll })

      amountFinney += 10
    }
  }

  // --- StabilityPool gas functions ---

  static async provideToSP(contracts, amount, params) {
    await contracts.thusdToken.approve(contracts.stabilityPool.address, amount, params)
    await contracts.stabilityPool.provideToSP(amount, params)
  }

  static async provideToSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.provideToSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomTHUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.provideToSP(randomTHUSDAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.withdrawFromSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomTHUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.withdrawFromSP(randomTHUSDAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawCollateralGainToTrove_allAccounts(accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {

      let {entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
      console.log(`entireColl: ${entireColl}`)
      console.log(`entireDebt: ${entireDebt}`)
      const collateralGain = await contracts.stabilityPool.getDepositorCollateralGain(account)
      const newColl = entireColl.add(collateralGain)
      const {upperHint, lowerHint} = await this.getBorrowerOpsListHint(contracts, newColl, entireDebt)

      const tx = await contracts.stabilityPool.withdrawCollateralGainToTrove(upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Time functions ---

  static async fastForwardTime(seconds, currentWeb3Provider) {
    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds]
    },
      (err) => { if (err) console.log(err) })

    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_mine'
    },
      (err) => { if (err) console.log(err) })
  }

  static async getLatestBlockTimestamp(web3Instance) {
    const blockNumber = await web3Instance.eth.getBlockNumber()
    const block = await web3Instance.eth.getBlock(blockNumber)

    return block.timestamp
  }

  static async getTimestampFromTx(tx, web3Instance) {
    return this.getTimestampFromTxReceipt(tx.receipt, web3Instance)
  }

  static async getTimestampFromTxReceipt(txReceipt, web3Instance) {
    const block = await web3Instance.eth.getBlock(txReceipt.blockNumber)
    return block.timestamp
  }

  static secondsToDays(seconds) {
    return Number(seconds) / (60 * 60 * 24)
  }

  static daysToSeconds(days) {
    return Number(days) * (60 * 60 * 24)
  }

  static async checkLiquidation(contracts, stabilityPool, troveManager, wallet, liquidator) {
    const stabilityPoolTHUSD = await stabilityPool.getTotalTHUSDDeposits()
    const balance = await stabilityPool.getCollateralBalance()
    const troveCollateral = (await troveManager.Troves(wallet))[1]
    assert.isFalse(await this.checkRecoveryMode(contracts))
    let collateral = {}

    // Liquidate wallet (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    collateral.before = await this.getCollateralBalance(contracts.erc20, liquidator)
    await troveManager.liquidate(wallet, { from: liquidator, gasPrice: 0 })
    collateral.after = await this.getCollateralBalance(contracts.erc20, liquidator)

    // Check liquidator's balance increases by 0.5% of A's coll (1 ETH/token)
    let compensation = (collateral.after.sub(collateral.before)).toString()
    let expectedFees = troveCollateral.div(web3.utils.toBN('200'))
    assert.equal(compensation, expectedFees)

    // Check SP THUSD has decreased due to the liquidation
    const THUSDinSP = await stabilityPool.getTotalTHUSDDeposits()
    assert.isTrue(THUSDinSP.lte(stabilityPoolTHUSD))

    // Check SP has received the troves liquidated collateral
    const newBalance = await stabilityPool.getCollateralBalance()
    assert.equal(newBalance.toString(), balance.add(troveCollateral).sub(expectedFees).toString()) // 1 ETH/token - 0.5%

    return expectedFees;
  }
  // --- Assert functions ---

  static async assertRevert(txPromise, message = undefined) {
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

  static async assertAssert(txPromise) {
    try {
      const tx = await txPromise
      assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      assert.include(err.message, "invalid opcode")
    }
  }

  // --- Misc. functions  ---

  static async forceSendEth(from, receiver, value) {
    const destructible = await Destructible.new()
    await web3.eth.sendTransaction({ to: destructible.address, from, value })
    await destructible.destruct(receiver)
  }

  static hexToParam(hexValue) {
    return ('0'.repeat(64) + hexValue.slice(2)).slice(-64)
  }

  static formatParam(param) {
    let formattedParam = param
    if (typeof param == 'number' || typeof param == 'object' ||
        (typeof param == 'string' && (new RegExp('[0-9]*')).test(param))) {
      formattedParam = web3.utils.toHex(formattedParam)
    } else if (typeof param == 'boolean') {
      formattedParam = param ? '0x01' : '0x00'
    } else if (param.slice(0, 2) != '0x') {
      formattedParam = web3.utils.asciiToHex(formattedParam)
    }

    return this.hexToParam(formattedParam)
  }
  static getTransactionData(signatureString, params) {
    /*
     console.log('signatureString: ', signatureString)
     console.log('params: ', params)
     console.log('params: ', params.map(p => typeof p))
     */
    return web3.utils.sha3(signatureString).slice(0,10) +
      params.reduce((acc, p) => acc + this.formatParam(p), '')
  }

  static async removeMintlist(contracts, owner, delay) {
    await contracts.thusdToken.startRevokeMintList(contracts.borrowerOperations.address, { from: owner })
    await this.fastForwardTime(delay, web3.currentProvider)
    await contracts.thusdToken.finalizeRevokeMintList({ from: owner })
  }

  static async sendCollateral(erc20, sender, recipient, valueToSend) {
    // send eth or erc20
    if (erc20.address === this.ZERO_ADDRESS) {
      await web3.eth.sendTransaction({from: sender, to: recipient, value: valueToSend})
    } else {
      await erc20.transfer(recipient, valueToSend)
    }
  }

  static async getCollateralBalance(erc20, address) {
    if (erc20.address === this.ZERO_ADDRESS) {
      return web3.utils.toBN(await web3.eth.getBalance(address))
    } else {
      return await erc20.balanceOf(address)
    }
  }
}

TestHelper.ZERO_ADDRESS = '0x' + '0'.repeat(40)
TestHelper.maxBytes32 = '0x' + 'f'.repeat(64)
TestHelper._100pct = '1000000000000000000'
TestHelper.latestRandomSeed = 31337

module.exports = {
  TestHelper,
  MoneyValues,
  TimeValues
}
