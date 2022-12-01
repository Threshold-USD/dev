import {
  CollateralContract,
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableLiquity,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams
} from "@liquity/lib-base";

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
 * Ethers-based implementation of {@link @liquity/lib-base#SendableLiquity}.
 *
 * @public
 */
export class SendableEthersLiquity
  implements SendableLiquity<EthersTransactionReceipt, EthersTransactionResponse> {
  private _populate: PopulatableEthersLiquity;

  constructor(populatable: PopulatableEthersLiquity) {
    this._populate = populatable;
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.openTrove} */
  async openTrove(
    contract: CollateralContract,
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(contract, params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.closeTrove} */
  closeTrove(
    contract: CollateralContract,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(contract, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.adjustTrove} */
  adjustTrove(
    contract: CollateralContract,
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(contract, params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.depositCollateral} */
  depositCollateral(
    contract: CollateralContract,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(contract, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawCollateral} */
  withdrawCollateral(
    contract: CollateralContract,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(contract, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.borrowTHUSD} */
  borrowTHUSD(
    contract: CollateralContract,
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowTHUSD(contract, amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.repayTHUSD} */
  repayTHUSD(
    contract: CollateralContract,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayTHUSD(contract, amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    contract: CollateralContract,
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.setPrice(contract, price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.liquidate} */
  liquidate(
    contract: CollateralContract,
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate.liquidate(contract, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.liquidateUpTo} */
  liquidateUpTo(
    contract: CollateralContract,
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(contract, maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.depositTHUSDInStabilityPool} */
  depositTHUSDInStabilityPool(
    contract: CollateralContract,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositTHUSDInStabilityPool(contract, amount, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawTHUSDFromStabilityPool} */
  withdrawTHUSDFromStabilityPool(
    contract: CollateralContract,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawTHUSDFromStabilityPool(contract, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    contract: CollateralContract,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(contract, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    contract: CollateralContract,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(contract, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.sendTHUSD} */
  sendTHUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.sendTHUSD(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.redeemTHUSD} */
  redeemTHUSD(
    contract: CollateralContract,
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<RedemptionDetails>> {
    return this._populate.redeemTHUSD(contract, amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.approveErc20} */
  approveErc20(
    contract: CollateralContract,
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.approveErc20(contract, allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(
    contract: CollateralContract,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.claimCollateralSurplus(contract, overrides).then(sendTransaction);
  }
}
