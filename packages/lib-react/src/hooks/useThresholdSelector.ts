import { useEffect, useReducer } from "react";
import { LiquityStoreState as ThresholdStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useThresholdStore } from "./useThresholdStore";
import { ThresholdLoadedStore } from "../components/ThresholdStoreProvider";

// Subscribes to store updates, and calls rerender() if the selected state changes
const subscribeStores = <S, T>(
  stores: ThresholdLoadedStore<T>[],
  select: (state: ThresholdStoreState<T>) => S,
  rerender: React.DispatchWithoutAction
) => {
  stores.forEach((store) => {
    store.store.subscribe(({ newState, oldState }) => {
      // Only rerender if the selected state has changed
      if (!equals(select(newState), select(oldState))) {
        rerender();
      }
    })
  })
}

// Returns an array of the selected store state for each threshold store
const getSelectedStoreStates = <S, T>(
  stores: ThresholdLoadedStore<T>[],
  select: (state: ThresholdStoreState<T>) => S
) => {
  const selectedStores = stores.map(({ collateral, version, store }) => {
    return {
      collateral,
      version,
      store: select(store.state)
    }
  })

  return selectedStores
}

// A custom hook to select a specific part of the state from each threshold store
export const useThresholdSelector = <S, T>(
  select: (state: ThresholdStoreState<T>) => S
): { collateral: string, version: string, store: S }[] => {
  const stores = useThresholdStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  // Subscribe to store updates, and rerender when the selected state changes
  useEffect(() =>
    subscribeStores(stores, select, rerender),
    [stores, select]
  );

  // Return the selected state for each threshold store
  return getSelectedStoreStates(stores, select);
};
