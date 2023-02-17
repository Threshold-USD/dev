import { useContext } from "react";

import { ThresholdLoadedStore, ThresholdStoreContext } from "../components/ThresholdStoreProvider";

export const useThresholdStore = <T>(): ThresholdLoadedStore<T>[] => {
  const stores = useContext(ThresholdStoreContext);

  if (!stores) {
    throw new Error("You must provide a ThresholdStore via ThresholdStoreProvider");
  }

  return stores as ThresholdLoadedStore<T>[];
};
