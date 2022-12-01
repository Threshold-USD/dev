import { Decimal, Decimalish } from "./Decimal";
import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";
import { FailedReceipt } from "./SendableLiquity";

/**
 * Thrown by {@link TransactableLiquity} functions in case of transaction failure.
 *
 * @public
 */
export class TransactionFailedError<T extends FailedReceipt = FailedReceipt> extends Error {
  readonly failedReceipt: T;

  /** @internal */
  constructor(name: string, message: string, failedReceipt: T) {
    super(message);
    this.name = name;
    this.failedReceipt = failedReceipt;
  }
}

/**
 * Borrower Operations name strings.
 *
 * @public
 */
export type _LiquityContractsKeys = 'testCollateral' | 'borrowerOperations'

/**
 * Optional parameters taken by transaction functions.
 *
 * @public
 */
 export interface CollateralContract {
  name: _LiquityContractsKeys,
  collateralAddress: string;
  collateralSymbol: string;
  usersBalance: Decimal;
}

/**
 * State variables read from the blockchain.
 *
 * @public
 */
export type MintList = Record<string, CollateralContract>

/**
 * Details of an {@link TransactableLiquity.openTrove | openTrove()} transaction.
 *
 * @public
 */
export interface TroveCreationDetails {
  /** How much was deposited and borrowed. */
  params: TroveCreationParams<Decimal>;

  /** The Trove that was created by the transaction. */
  newTrove: Trove;

  /** Amount of thUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of an {@link TransactableLiquity.adjustTrove | adjustTrove()} transaction.
 *
 * @public
 */
export interface TroveAdjustmentDetails {
  /** Parameters of the adjustment. */
  params: TroveAdjustmentParams<Decimal>;

  /** New state of the adjusted Trove directly after the transaction. */
  newTrove: Trove;

  /** Amount of thUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of a {@link TransactableLiquity.closeTrove | closeTrove()} transaction.
 *
 * @public
 */
export interface TroveClosureDetails {
  /** How much was withdrawn and repaid. */
  params: TroveClosureParams<Decimal>;
}

/**
 * Details of a {@link TransactableLiquity.liquidate | liquidate()} or
 * {@link TransactableLiquity.liquidateUpTo | liquidateUpTo()} transaction.
 *
 * @public
 */
export interface LiquidationDetails {
  /** Addresses whose Troves were liquidated by the transaction. */
  liquidatedAddresses: string[];

  /** Total collateral liquidated and debt cleared by the transaction. */
  totalLiquidated: Trove;

  /** Amount of thUSD paid to the liquidator as gas compensation. */
  thusdGasCompensation: Decimal;

  /** Amount of native currency (e.g. Ether) paid to the liquidator as gas compensation. */
  collateralGasCompensation: Decimal;
}

/**
 * Details of a {@link TransactableLiquity.redeemTHUSD | redeemTHUSD()} transaction.
 *
 * @public
 */
export interface RedemptionDetails {
  /** Amount of thUSD the redeemer tried to redeem. */
  attemptedTHUSDAmount: Decimal;

  /**
   * Amount of thUSD that was actually redeemed by the transaction.
   *
   * @remarks
   * This can end up being lower than `attemptedTHUSDAmount` due to interference from another
   * transaction that modifies the list of Troves.
   *
   * @public
   */
  actualTHUSDAmount: Decimal;

  /** Amount of collateral (e.g. Ether) taken from Troves by the transaction. */
  collateralTaken: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee from collateral taken. */
  fee: Decimal;
}

/**
 * Details of a
 * {@link TransactableLiquity.withdrawGainsFromStabilityPool | withdrawGainsFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityPoolGainsWithdrawalDetails {
  /** Amount of thUSD burned from the deposit by liquidations since the last modification. */
  thusdLoss: Decimal;

  /** Amount of thUSD in the deposit directly after this transaction. */
  newTHUSDDeposit: Decimal;

  /** Amount of native currency (e.g. Ether) paid out to the depositor in this transaction. */
  collateralGain: Decimal;
}

/**
 * Details of a
 * {@link TransactableLiquity.depositTHUSDInStabilityPool | depositTHUSDInStabilityPool()} or
 * {@link TransactableLiquity.withdrawTHUSDFromStabilityPool | withdrawTHUSDFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  /** Change that was made to the deposit by this transaction. */
  change: StabilityDepositChange<Decimal>;
}

/**
 * Details of a
 * {@link TransactableLiquity.transferCollateralGainToTrove | transferCollateralGainToTrove()}
 * transaction.
 *
 * @public
 */
export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  /** New state of the depositor's Trove directly after the transaction. */
  newTrove: Trove;
}

/**
 * Send Liquity transactions and wait for them to succeed.
 *
 * @remarks
 * The functions return the details of the transaction (if any), or throw an implementation-specific
 * subclass of {@link TransactionFailedError} in case of transaction failure.
 *
 * Implemented by {@link @liquity/lib-ethers#EthersLiquity}.
 *
 * @public
 */
export interface TransactableLiquity {
  /**
   * Open a new Trove by depositing collateral and borrowing thUSD. 
   *
   * @param params - How much to deposit and borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  openTrove(
    contract: CollateralContract,
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveCreationDetails>;

  /**
   * Close existing Trove by repaying all debt and withdrawing all collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  closeTrove(contract: CollateralContract): Promise<TroveClosureDetails>;

  /**
   * Adjust existing Trove by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate} if
   *                           `params` includes `borrowTHUSD`.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The transaction will fail if the Trove's debt would fall below
   * {@link @liquity/lib-base#THUSD_MINIMUM_DEBT}.
   *
   * If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum
   * acceptable rate.
   */
  adjustTrove(
    contract: CollateralContract,
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Trove's existing collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ depositCollateral: amount })
   * ```
   */
  depositCollateral(contract: CollateralContract, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by withdrawing some of its collateral.
   *
   * @param amount - The amount of collateral to withdraw from the Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ withdrawCollateral: amount })
   * ```
   */
  withdrawCollateral(contract: CollateralContract, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by borrowing more thUSD. 
   *
   * @param amount - The amount of thUSD to borrow.
   * @param maxBorrowingRate - Maximum acceptable
   *                           {@link @liquity/lib-base#Fees.borrowingRate | borrowing rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ borrowTHUSD: amount }, maxBorrowingRate)
   * ```
   */
  borrowTHUSD(contract: CollateralContract, amount: Decimalish, maxBorrowingRate?: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by repaying some of its debt.
   *
   * @param amount - The amount of thUSD to repay.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ repayTHUSD: amount })
   * ```
   */
  repayTHUSD(contract: CollateralContract, amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /** @internal */
  setPrice(contract: CollateralContract, price: Decimalish): Promise<void>;

  /**
   * Liquidate one or more undercollateralized Troves.
   *
   * @param address - Address or array of addresses whose Troves to liquidate.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidate(contract: CollateralContract, address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Troves up to a maximum number.
   *
   * @param maximumNumberOfTrovesToLiquidate - Stop after liquidating this many Troves.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(contract: CollateralContract, maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of thUSD to add to new or existing deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain}
   */
  depositTHUSDInStabilityPool(
    contract: CollateralContract, 
    amount: Decimalish
  ): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw thUSD from Stability Deposit.
   *
   * @param amount - Amount of thUSD to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain}.
   */
  withdrawTHUSDFromStabilityPool(contract: CollateralContract, amount: Decimalish): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} from Stability Deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(contract: CollateralContract): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} from
   * Stability Deposit to Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The collateral gain is transfered to the Trove as additional collateral.
   */
  transferCollateralGainToTrove(contract: CollateralContract): Promise<CollateralGainTransferDetails>;

  /**
   * Send thUSD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of thUSD to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendTHUSD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem thUSD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of thUSD to be redeemed.
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @liquity/lib-base#Fees.redemptionRate | redemption rate}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the current redemption rate (based on `amount`) plus 0.1%
   * is used as maximum acceptable rate.
   */
  redeemTHUSD(contract: CollateralContract, amount: Decimalish, maxRedemptionRate?: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance | getCollateralSurplusBalance()}
   * to check the amount of collateral available for withdrawal.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(contract: CollateralContract): Promise<void>;

    /**
   * Allow the borrower operations contract to use user's erc20 tokens for
   * {@link @liquity/lib-base#TransactableLiquity.openTrove | adjustTrove}.
   *
   * @param allowance - Maximum amount of LP tokens that will be transferrable to liquidity mining
   *                    (`2^256 - 1` by default).
   *
   * @remarks
   * Must be performed before calling
   * {@link @liquity/lib-base#TransactableLiquity.openTrove | adjustTrove()}.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
     approveErc20(contract: CollateralContract, allowance?: Decimalish): Promise<void>;
}
