import { Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  BammDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableLiquity,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableLiquity";

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @threshold-usd/lib-ethers#SentEthersLiquityTransaction}.
 *
 * @public
 */
export interface SentLiquityTransaction<S = unknown, T extends LiquityReceipt = LiquityReceipt> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @threshold-usd/lib-base#SentLiquityTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @threshold-usd/lib-base#FailedReceipt} or a
   *          {@link @threshold-usd/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentLiquityTransaction.getReceipt}.
 *
 * @public
 */
export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

/**
 * Indicates that the transaction has been mined, but it failed.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * Returned by {@link SentLiquityTransaction.getReceipt} and
 * {@link SentLiquityTransaction.waitForReceipt}.
 *
 * @public
 */
export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

/**
 * Indicates that the transaction has succeeded.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * The `details` property may contain more information about the transaction.
 * See the return types of {@link TransactableLiquity} functions for the exact contents of `details`
 * for each type of Liquity transaction.
 *
 * Returned by {@link SentLiquityTransaction.getReceipt} and
 * {@link SentLiquityTransaction.waitForReceipt}.
 *
 * @public
 */
export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

/** @internal */
export const _successfulReceipt = <R, D>(
  rawReceipt: R,
  details: D,
  toString?: () => string
): SuccessfulReceipt<R, D> => ({
  status: "succeeded",
  rawReceipt,
  details,
  ...(toString ? { toString } : {})
});

/**
 * Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;

/**
 * One of either a {@link PendingReceipt}, a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type LiquityReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

/** @internal */
export type _SendableFrom<T, R, S> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? (...args: A) => Promise<SentLiquityTransaction<S, LiquityReceipt<R, D>>>
    : never;
};

/**
 * Send Liquity transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentLiquityTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @threshold-usd/lib-ethers#SendableEthersLiquity}.
 *
 * @public
 */
export interface SendableLiquity<R = unknown, S = unknown>
  extends _SendableFrom<TransactableLiquity, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableLiquity.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveCreationDetails>>>;

  /** {@inheritDoc TransactableLiquity.closeTrove} */
  closeTrove(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveClosureDetails>>>;

  /** {@inheritDoc TransactableLiquity.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.borrowTHUSD} */
  borrowTHUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.repayTHUSD} */
  repayTHUSD(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** @internal */
  setPrice(price: Decimalish): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** @internal */
  mint(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableLiquity.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableLiquity.depositTHUSDInBammPool} */
  depositTHUSDInBammPool(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, BammDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawTHUSDFromBammPool} */
  withdrawTHUSDFromBammPool(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, BammDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromBammPool} */
  withdrawGainsFromBammPool(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.depositTHUSDInStabilityPool} */
  depositTHUSDInStabilityPool(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawTHUSDFromStabilityPool} */
  withdrawTHUSDFromStabilityPool(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.bammUnlock} */
  bammUnlock(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.transferBammCollateralGainToTrove} */
  transferBammCollateralGainToTrove(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.sendTHUSD} */
  sendTHUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.redeemTHUSD} */
  redeemTHUSD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.approveErc20} */
  approveErc20(
    allowance?: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

}
