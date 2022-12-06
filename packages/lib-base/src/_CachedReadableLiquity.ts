import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { ReadableLiquity, TroveListingParams } from "./ReadableLiquity";
import { CollateralContract } from "./TransactableLiquity";
import { IteratedCollateralContractStore } from "./LiquityStore";

/** @internal */
export type _ReadableLiquityWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _LiquityReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableLiquityWithExtraParams<T extends unknown[]>
  extends _ReadableLiquityWithExtraParamsBase<T> {
  getTroves(
    contract: CollateralContract, 
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(contract: CollateralContract, params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;
}

/** @internal */
export interface _LiquityReadCache<T extends unknown[]> extends _LiquityReadCacheBase<T> {
  getTroves(
    contract: CollateralContract, 
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): TroveWithPendingRedistribution[] | undefined;

  getTroves(contract: CollateralContract, params: TroveListingParams, ...extraParams: T): UserTrove[] | undefined;
}

/** @internal */
export class _CachedReadableLiquity<T extends unknown[]>
  implements _ReadableLiquityWithExtraParams<T> {
  private _readable: _ReadableLiquityWithExtraParams<T>;
  private _cache: _LiquityReadCache<T>;

  constructor(readable: _ReadableLiquityWithExtraParams<T>, cache: _LiquityReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(contract: CollateralContract, ...extraParams: T): Promise<Trove | IteratedCollateralContractStore[]> {
    return (
      this._cache.getTotalRedistributed(contract, ...extraParams) ??
      this._readable.getTotalRedistributed(contract, ...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    contract: CollateralContract, 
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution | IteratedCollateralContractStore[]> {
    return (
      this._cache.getTroveBeforeRedistribution(contract, address, ...extraParams) ??
      this._readable.getTroveBeforeRedistribution(contract, address, ...extraParams)
    );
  }

  async getTrove(contract: CollateralContract, address?: string, ...extraParams: T): Promise<UserTrove> {
    const [troveBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(contract, address, ...extraParams) as Promise<TroveWithPendingRedistribution>,
      this.getTotalRedistributed(contract, ...extraParams) as Promise<Trove>
    ]);

    return troveBeforeRedistribution.applyRedistribution(totalRedistributed as Trove);
  }

  async getNumberOfTroves(contract: CollateralContract, ...extraParams: T): Promise<number | IteratedCollateralContractStore[]> {
    return (
      this._cache.getNumberOfTroves(contract, ...extraParams) ??
      this._readable.getNumberOfTroves(contract, ...extraParams)
    );
  }

  async getPrice(contract: CollateralContract, ...extraParams: T): Promise<Decimal | IteratedCollateralContractStore[]> {
    return this._cache.getPrice(contract, ...extraParams) ?? this._readable.getPrice(contract, ...extraParams);
  }

  async getTotal(contract: CollateralContract, ...extraParams: T): Promise<Trove | IteratedCollateralContractStore[]> {
    return this._cache.getTotal(contract, ...extraParams) ?? this._readable.getTotal(contract, ...extraParams);
  }

  async getStabilityDeposit(contract: CollateralContract, address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(contract, address, ...extraParams) ??
      this._readable.getStabilityDeposit(contract, address, ...extraParams)
    );
  }

  async getTHUSDInStabilityPool(contract: CollateralContract, ...extraParams: T): Promise<Decimal | IteratedCollateralContractStore[]> {
    return (
      this._cache.getTHUSDInStabilityPool(contract, ...extraParams) ??
      this._readable.getTHUSDInStabilityPool(contract, ...extraParams)
    );
  }

  async checkMintList(address: string, ...extraParams: T): Promise<boolean> {
    return (
      this._cache.checkMintList(address, ...extraParams) ??
      this._readable.checkMintList(address, ...extraParams)
    );
  }

  //async getSymbol(...extraParams: T): Promise<string> {
  //  return (
  //    this._cache.getSymbol(...extraParams) ??
  //    this._readable.getSymbol(...extraParams)
  //  );
  //}

  async getPCVBalance(contract: CollateralContract, ...extraParams: T): Promise<Decimal | IteratedCollateralContractStore[]> {
    return (
      this._cache.getPCVBalance(contract, ...extraParams) ??
      this._readable.getPCVBalance(contract, ...extraParams)
    );
  }

  async getTHUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTHUSDBalance(address, ...extraParams) ??
      this._readable.getTHUSDBalance(address, ...extraParams)
    );
  }

  async getErc20TokenBalance(contract: CollateralContract, address?: string, ...extraParams: T): Promise<Decimal | IteratedCollateralContractStore[]> {
    return (
      this._cache.getErc20TokenBalance(contract, address, ...extraParams) ??
      this._readable.getErc20TokenBalance(contract, address, ...extraParams)
    );
  }

  async getErc20TokenAllowance(contract: CollateralContract, address?: string, ...extraParams: T): Promise<Decimal | IteratedCollateralContractStore[]> {
    return (
      this._cache.getErc20TokenAllowance(contract, address, ...extraParams) ??
      this._readable.getErc20TokenAllowance(contract, address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(contract: CollateralContract, address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(contract, address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(contract, address, ...extraParams)
    );
  }

  getTroves(
    contract: CollateralContract, 
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(contract: CollateralContract, params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;

  async getTroves(contract: CollateralContract, params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(contract, ...extraParams),
      this._cache.getTroves(contract, { beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getTroves(contract, { beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed as Trove));
    } else {
      return troves;
    }
  }

  async getFees(contract: CollateralContract, ...extraParams: T): Promise<Fees> {
    return this._cache.getFees(contract, ...extraParams) ?? this._readable.getFees(contract, ...extraParams);
  }

}
