import React from "react";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@liquity/lib-base";
import { LiquityStoreProvider } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { TroveViewProvider } from "./Trove/context/TroveViewProvider";
import { TransactionMonitor } from "./Transaction";

type FunctionalPanelProps = {
  loader?: React.ReactNode;
};

export const FunctionalPanel: React.FC<FunctionalPanelProps> = ({ children, loader }) => {

  const { account, provider, liquity } = useLiquity();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    liquity,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <>
      <LiquityStoreProvider {...{ loader }} store={liquity.store}>
        <TroveViewProvider>
          {children}
        </TroveViewProvider>
      </LiquityStoreProvider>
      <TransactionMonitor />
    </>            
  );
};
