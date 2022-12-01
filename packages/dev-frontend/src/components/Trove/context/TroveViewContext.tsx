import { createContext, useContext } from "react";
import type { TroveView, TroveEvent } from "./types";
import { CollateralContract } from "@liquity/lib-base";

type TroveViewContextType = {
  contract: CollateralContract;
  view: TroveView;
  dispatchEvent: (event: TroveEvent, contract: CollateralContract) => void;
};

export const TroveViewContext = createContext<TroveViewContextType | null>(null);

export const useTroveView = (): TroveViewContextType => {
  const context: TroveViewContextType | null = useContext(TroveViewContext);

  if (context === null) {
    throw new Error("You must add a <TroveViewProvider> into the React tree");
  }

  return context;
};
