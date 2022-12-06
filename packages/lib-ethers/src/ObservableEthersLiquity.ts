import { BigNumber } from "@ethersproject/bignumber";
import { Event } from "@ethersproject/contracts";

import {
  Decimal,
  ObservableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution,
  CollateralContract
} from "@liquity/lib-base";

import { _getContracts, _requireAddress } from "./EthersLiquityConnection";
import { ReadableEthersLiquity } from "./ReadableEthersLiquity";

const debouncingDelayMs = 50;

const debounce = (listener: (latestBlock: number) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  let latestBlock = 0;

  return (...args: unknown[]) => {
    const event = args[args.length - 1] as Event;

    if (event.blockNumber !== undefined && event.blockNumber > latestBlock) {
      latestBlock = event.blockNumber;
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      listener(latestBlock);
      timeoutId = undefined;
    }, debouncingDelayMs);
  };
};

/** @alpha */
export class ObservableEthersLiquity implements ObservableLiquity {
  private readonly _readable: ReadableEthersLiquity;

  constructor(readable: ReadableEthersLiquity) {
    this._readable = readable;
  }
  
  watchTotalRedistributed(
    contract: CollateralContract,
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void {

    const { activePool, defaultPool } = _getContracts(this._readable.connection);
    const collateralSent = activePool.filters.CollateralSent();

    const redistributionListener = debounce((blockTag: number) => {
      this._readable.getTotalRedistributed(contract, { blockTag }).then((result) => {
        onTotalRedistributedChanged(result as Trove)
      });
    });

    const collateralSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === defaultPool.address) {
        redistributionListener(event);
      }
    };

    activePool.on(collateralSent, collateralSentListener);

    return () => {
      activePool.removeListener(collateralSent, collateralSentListener);
    };
  }

  watchTroveWithoutRewards(
    contract: CollateralContract,
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address?: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { troveManager, borrowerOperations } = _getContracts(this._readable.connection);
    const troveUpdatedByTroveManager = troveManager.filters.TroveUpdated(address);
    const troveUpdatedByBorrowerOperations = borrowerOperations.filters.TroveUpdated(address);

    const troveListener = debounce((blockTag: number) => {
      this._readable.getTroveBeforeRedistribution(contract, address, { blockTag }).then(onTroveChanged);
    });

    troveManager.on(troveUpdatedByTroveManager, troveListener);
    borrowerOperations.on(troveUpdatedByBorrowerOperations, troveListener);

    return () => {
      troveManager.removeListener(troveUpdatedByTroveManager, troveListener);
      borrowerOperations.removeListener(troveUpdatedByBorrowerOperations, troveListener);
    };
  }

  watchNumberOfTroves(contract: CollateralContract, onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    const { troveManager } = _getContracts(this._readable.connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const troveUpdatedListener = debounce((blockTag: number) => {
      this._readable.getNumberOfTroves(contract, { blockTag }).then(
        (result) => {onNumberOfTrovesChanged(result as number)}
      );
    });

    troveManager.on(troveUpdated, troveUpdatedListener);

    return () => {
      troveManager.removeListener(troveUpdated, troveUpdatedListener);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchPrice(onPriceChanged: (price: Decimal) => void): () => void {
    // TODO revisit
    // We no longer have our own PriceUpdated events. If we want to implement this in an event-based
    // manner, we'll need to listen to aggregator events directly. Or we could do polling.
    throw new Error("Method not implemented.");
  }

  watchTotal(contract: CollateralContract, onTotalChanged: (total: Trove) => void): () => void {
    const { troveManager } = _getContracts(this._readable.connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const totalListener = debounce((blockTag: number) => {
      this._readable.getTotal(contract, { blockTag }).then((result) =>onTotalChanged(result as Trove));
    });

    troveManager.on(troveUpdated, totalListener);

    return () => {
      troveManager.removeListener(troveUpdated, totalListener);
    };
  }

  watchStabilityDeposit(
    contract: CollateralContract, 
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { activePool, stabilityPool } = _getContracts(this._readable.connection);
    const { UserDepositChanged } = stabilityPool.filters;
    const { CollateralSent } = activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const collateralSent = CollateralSent();

    const depositListener = debounce((blockTag: number) => {
      this._readable.getStabilityDeposit(contract, address, { blockTag }).then(onStabilityDepositChanged);
    });

    const collateralSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    stabilityPool.on(userDepositChanged, depositListener);
    activePool.on(collateralSent, collateralSentListener);

    return () => {
      stabilityPool.removeListener(userDepositChanged, depositListener);
      activePool.removeListener(collateralSent, collateralSentListener);
    };
  }

  watchTHUSDInStabilityPool(
    contract: CollateralContract, 
    onTHUSDInStabilityPoolChanged: (thusdInStabilityPool: Decimal) => void
  ): () => void {
    const { thusdToken, stabilityPool } = _getContracts(this._readable.connection);
    const { Transfer } = thusdToken.filters;

    const transferTHUSDFromStabilityPool = Transfer(stabilityPool.address);
    const transferTHUSDToStabilityPool = Transfer(null, stabilityPool.address);

    const stabilityPoolTHUSDFilters = [transferTHUSDFromStabilityPool, transferTHUSDToStabilityPool];

    const stabilityPoolTHUSDListener = debounce((blockTag: number) => {
      this._readable.getTHUSDInStabilityPool(contract, { blockTag }).then((result) => {
        onTHUSDInStabilityPoolChanged(result as Decimal)
      });
    });

    stabilityPoolTHUSDFilters.forEach(filter => thusdToken.on(filter, stabilityPoolTHUSDListener));

    return () =>
      stabilityPoolTHUSDFilters.forEach(filter =>
        thusdToken.removeListener(filter, stabilityPoolTHUSDListener)
      );
  }

  watchTHUSDBalance(onTHUSDBalanceChanged: (balance: Decimal) => void, address?: string): () => void {
    address ??= _requireAddress(this._readable.connection);

    const { thusdToken } = _getContracts(this._readable.connection);
    const { Transfer } = thusdToken.filters;
    const transferTHUSDFromUser = Transfer(address);
    const transferTHUSDToUser = Transfer(null, address);

    const thusdTransferFilters = [transferTHUSDFromUser, transferTHUSDToUser];

    const thusdTransferListener = debounce((blockTag: number) => {
      this._readable.getTHUSDBalance(address, { blockTag }).then(onTHUSDBalanceChanged);
    });

    thusdTransferFilters.forEach(filter => thusdToken.on(filter, thusdTransferListener));

    return () =>
      thusdTransferFilters.forEach(filter => thusdToken.removeListener(filter, thusdTransferListener));
  }
}
