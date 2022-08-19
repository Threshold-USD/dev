import { createContext, useContext } from "react";

type ChartContextType = {
  tvl: number[];
  timestamps: Array<number|string>;
};

export const ChartContext = createContext<ChartContextType | null>(null);

export const useTvl = (): ChartContextType => {
  const context: ChartContextType | null = useContext(ChartContext);

  if (context === null) {
    throw new Error("You must add a <ChartProvider> into the React tree");
  }

  return context;
};
