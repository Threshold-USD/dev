import { Decimal } from "./Decimal";
import { Trove, TroveWithPendingRedistribution } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { CollateralContract } from "./TransactableLiquity";

/** @alpha */
export interface ObservableLiquity {
  watchTotalRedistributed(
    contract: CollateralContract,
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void;

  watchTroveWithoutRewards(
    contract: CollateralContract, 
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address?: string
  ): () => void;

  watchNumberOfTroves(contract: CollateralContract, onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void;

  watchPrice(onPriceChanged: (price: Decimal) => void): () => void;

  watchTotal(contract: CollateralContract, onTotalChanged: (total: Trove) => void): () => void;

  watchStabilityDeposit(
    contract: CollateralContract, 
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void;

  watchTHUSDInStabilityPool(
    contract: CollateralContract, 
    onTHUSDInStabilityPoolChanged: (thusdInStabilityPool: Decimal) => void
  ): () => void;

  watchTHUSDBalance(onTHUSDBalanceChanged: (balance: Decimal) => void, address?: string): () => void;
}
