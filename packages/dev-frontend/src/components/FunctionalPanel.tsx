import React, { useMemo } from "react";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove as Vault } from "@liquity/lib-base";
import { ThresholdStoreProvider } from "@liquity/lib-react";

import { useThreshold } from "../hooks/ThresholdContext";
import { VaultViewProvider } from "./Vault/context/VaultViewProvider";
import { TransactionMonitor } from "./Transaction";

type FunctionalPanelProps = {
  loader?: React.ReactNode;
  children: React.ReactNode;
};

export const FunctionalPanel = ({ children, loader }: FunctionalPanelProps): JSX.Element => {
  const { account, provider, threshold } = useThreshold();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    threshold,
    Vault,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <>
      <ThresholdStoreProvider {...{ loader }} threshold={threshold}>
        <VaultViewProvider {...{ loader}}>
          {children}
        </VaultViewProvider>
      </ThresholdStoreProvider>
      <TransactionMonitor />
    </>            
  );
};
