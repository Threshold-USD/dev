import { Decimal } from "./Decimal";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { CollateralContract } from "./TransactableLiquity";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";


/**
 * Parameters of the {@link ReadableLiquity.(getTroves:2) | getTroves()} function.
 *
 * @public
 */
export interface TroveListingParams {
  /** Number of Troves to retrieve. */
  readonly first: number;

  /** How the Troves should be sorted. */
  readonly sortedBy: "ascendingCollateralRatio" | "descendingCollateralRatio";

  /** Index of the first Trove to retrieve from the sorted list. */
  readonly startingAt?: number;

  /**
   * When set to `true`, the retrieved Troves won't include the liquidation shares received since
   * the last time they were directly modified.
   *
   * @remarks
   * Changes the type of returned Troves to {@link TroveWithPendingRedistribution}.
   */
  readonly beforeRedistribution?: boolean;
}

/**
 * Read the state of the Liquity protocol.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#EthersLiquity}.
 *
 * @public
 */
export interface ReadableLiquity {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link @liquity/lib-base#TroveWithPendingRedistribution}.
   */
  getTotalRedistributed(contract: CollateralContract): Promise<Trove>;

  /**
   * Get a Trove in its state after the last direct modification.
   *
   * @param address - Address that owns the Trove.
   *
   * @remarks
   * The current state of a Trove can be fetched using
   * {@link @liquity/lib-base#ReadableLiquity.getTrove | getTrove()}.
   */
  getTroveBeforeRedistribution(contract: CollateralContract, address?: string): Promise<TroveWithPendingRedistribution>;

  /**
   * Get the current state of a Trove.
   *
   * @param address - Address that owns the Trove.
   */
  getTrove(contract: CollateralContract, address?: string): Promise<UserTrove>;

  /**
   * Get number of Troves that are currently open.
   */
  getNumberOfTroves(contract: CollateralContract): Promise<number>;

  /**
   * Get the current price of the native currency (e.g. Ether) in USD.
   */
  getPrice(contract: CollateralContract): Promise<Decimal>;

  /**
   * Get the total amount of collateral and debt in the Liquity system.
   */
  getTotal(contract: CollateralContract): Promise<Trove>;

  /**
   * Get the current state of a Stability Deposit.
   *
   * @param address - Address that owns the Stability Deposit.
   */
  getStabilityDeposit(contract: CollateralContract, address?: string): Promise<StabilityDeposit>;

  /**
   * Get the total amount of thUSD currently deposited in the Stability Pool.
   */
  getTHUSDInStabilityPool(contract: CollateralContract): Promise<Decimal>;

  /**
   * Check if a specific BorrowersOperations contract is included in the thUSD mintList.
   */
  checkMintList(address: string): Promise<boolean>;

  /**
   * Get the total amount of thUSD currently deposited in the PCV Pool.
   */
  getPCVBalance(contract: CollateralContract): Promise<Decimal>;

  /**
   * Get the amount of thUSD held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getTHUSDBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Erc20 tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getErc20TokenBalance(contract: CollateralContract, address?: string): Promise<Decimal>;

  /**
   * Get the Borrowers Operations contract's allowance of a holder's Erc20 tokens.
   *
   * @param address - Address holding the Erc20 tokens.
   */
  getErc20TokenAllowance(contract: CollateralContract, address?: string): Promise<Decimal>;

  /**
   * Get the amount of leftover collateral available for withdrawal by an address.
   *
   * @remarks
   * When a Trove gets liquidated or redeemed, any collateral it has above 110% (in case of
   * liquidation) or 100% collateralization (in case of redemption) gets sent to a pool, where it
   * can be withdrawn from using
   * {@link @liquity/lib-base#TransactableLiquity.claimCollateralSurplus | claimCollateralSurplus()}.
   */
  getCollateralSurplusBalance(contract: CollateralContract, address?: string): Promise<Decimal>;

  /** @internal */
  getTroves(
    contract: CollateralContract, 
    params: TroveListingParams & { beforeRedistribution: true }
  ): Promise<TroveWithPendingRedistribution[]>;

  /**
   * Get a slice from the list of Troves.
   *
   * @param params - Controls how the list is sorted, and where the slice begins and ends.
   * @returns Pairs of owner addresses and their Troves.
   */
  getTroves(contract: CollateralContract, params: TroveListingParams): Promise<UserTrove[]>;

  /**
   * Get a calculator for current fees.
   */
  getFees(contract: CollateralContract): Promise<Fees>;
}
