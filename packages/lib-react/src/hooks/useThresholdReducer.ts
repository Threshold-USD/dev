import { useCallback, useEffect, useReducer, useRef } from "react";

import { LiquityStoreState as ThresholdStoreState, LiquityStore as ThresholdBaseStore } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useThresholdStore } from "./useThresholdStore";
import { ThresholdLoadedStore } from "../components/ThresholdStoreProvider";

// Exporting a type to represent an update to the threshold store
export type ThresholdStoreUpdate<T = unknown> = {
  type: "updateStore";
  newState: ThresholdStoreState<T>;
  oldState: ThresholdStoreState<T>;
  stateChange: Partial<ThresholdStoreState<T>>;
};

// Exporting a custom hook to use the reducer pattern with the threshold store
export const useThresholdReducer = <S, A, T>(
  collateral: string, // the collateral of the threshold store to use
  version: string, // The version of the threshold store to use
  reduce: (state: S, action: A | ThresholdStoreUpdate) => S, // A reducer function to update the state
  init: (storeState: ThresholdStoreState) => S // An initialization function to create the initial state
): [S, (action: A | ThresholdStoreUpdate) => void] => {
  const stores = useThresholdStore();

  const thresholdStore = stores.find((store) => {
    return store.version === version && store.collateral === collateral;
  });

  // Using refs to store the old store and the current state, and useReducer to trigger a re-render when the state changes
  const oldStore = useRef<ThresholdBaseStore<T>>((thresholdStore as ThresholdLoadedStore<T>).store as ThresholdBaseStore<T>);
  const state = useRef(init((thresholdStore as ThresholdLoadedStore<T>).store.state as ThresholdStoreState<T>));
  const [, rerender] = useReducer(() => ({}), {});

  // Defining the dispatch function using useCallback, and updating the state if necessary
  const dispatch = useCallback(
    (action: A | ThresholdStoreUpdate) => {
      const newState = reduce(state.current, action);

      if (!equals(newState, state.current)) {
        state.current = newState;
        rerender();
      }
    },
    [reduce]
  );

  // Subscribing to updates from the threshold store, and calling the dispatch function when an update is received
  useEffect(() => 
  (thresholdStore as ThresholdLoadedStore<T>).store.subscribe(params => 
    dispatch({ type: "updateStore", ...params })), 
    [thresholdStore, dispatch]
  );

  // Updating the current state and old store if the threshold store has changed
  if (oldStore.current !== (thresholdStore as ThresholdLoadedStore<T>).store) {
    state.current = init((thresholdStore as ThresholdLoadedStore<T>).store.state);
    oldStore.current = (thresholdStore as ThresholdLoadedStore<T>).store;
  }

  // Returning the current state and dispatch function as a tuple
  return [state.current, dispatch];
};
