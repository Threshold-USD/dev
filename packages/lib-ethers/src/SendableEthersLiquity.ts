import {
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableLiquity,
  StabilityDepositChangeDetails,
  BammDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams
} from "@threshold-usd/lib-base";

import {
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersLiquity,
  PopulatedEthersLiquityTransaction,
  SentEthersLiquityTransaction
} from "./PopulatableEthersLiquity";

const sendTransaction = <T>(tx: PopulatedEthersLiquityTransaction<T>) => tx.send();

/**
 * Ethers-based implementation of {@link @threshold-usd/lib-base#SendableLiquity}.
 *
 * @public
 */
export class SendableEthersLiquity
  implements SendableLiquity<EthersTransactionReceipt, EthersTransactionResponse> {
  private _populate: PopulatableEthersLiquity;

  constructor(populatable: PopulatableEthersLiquity) {
    this._populate = populatable;
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.closeTrove} */
  closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.borrowTHUSD} */
  borrowTHUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowTHUSD(amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.repayTHUSD} */
  repayTHUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayTHUSD(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** @internal */
  mint(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.mint(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.depositTHUSDInBammPool} */
  depositTHUSDInBammPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<BammDepositChangeDetails>> {
    return this._populate
      .depositTHUSDInBammPool(amount, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.withdrawTHUSDFromBammPool} */
  withdrawTHUSDFromBammPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<BammDepositChangeDetails>> {
    return this._populate
      .withdrawTHUSDFromBammPool(amount, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.withdrawGainsFromBammPool} */
  withdrawGainsFromBammPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromBammPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.depositTHUSDInStabilityPool} */
  depositTHUSDInStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositTHUSDInStabilityPool(amount, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.withdrawTHUSDFromStabilityPool} */
  withdrawTHUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawTHUSDFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.bammUnlock} */
  bammUnlock(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.bammUnlock(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.transferBammCollateralGainToTrove} */
  transferBammCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferBammCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.sendTHUSD} */
  sendTHUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.sendTHUSD(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.redeemTHUSD} */
  redeemTHUSD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<RedemptionDetails>> {
    return this._populate.redeemTHUSD(amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.approveErc20} */
  approveErc20(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.approveErc20(allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @threshold-usd/lib-base#SendableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
  }
}
