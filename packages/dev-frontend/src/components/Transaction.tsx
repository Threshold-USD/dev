import React, { useState, useContext, useEffect, useCallback } from "react";
import { Provider, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { hexDataSlice, hexDataLength } from "@ethersproject/bytes";
import { defaultAbiCoder } from "@ethersproject/abi";

import "react-circular-progressbar/dist/styles.css";

import { EthersTransactionOverrides, EthersTransactionCancelledError } from "@threshold-usd/lib-ethers";
import { SentLiquityTransaction as SentThresholdTransaction, LiquityReceipt as ThresholdReceipt } from "@threshold-usd/lib-base";

import { useThreshold } from "../hooks/ThresholdContext";

import { Tooltip } from "./Tooltip";
import type { TooltipProps } from "./Tooltip";
import { checkTransactionCollateral } from "../utils/checkTransactionCollateral";

import { TransactionStatus } from "./TransactionStatus";

type TransactionIdle = {
  type: "idle";
  version: string;
  collateral: string;
};

type TransactionFailed = {
  type: "failed";
  id: string;
  error: Error;
  version: string;
  collateral: string;
};

type TransactionWaitingForApproval = {
  type: "waitingForApproval";
  id: string;
  version: string;
  collateral: string;
};

type TransactionCancelled = {
  type: "cancelled";
  id: string;
  version: string;
  collateral: string;
};

type TransactionWaitingForConfirmations = {
  type: "waitingForConfirmation";
  id: string;
  tx: SentTransaction;
  version: string;
  collateral: string;
};

type TransactionConfirmed = {
  type: "confirmed";
  id: string;
  version: string;
  collateral: string;
};

type TransactionConfirmedOneShot = {
  type: "confirmedOneShot";
  id: string;
  version: string;
  collateral: string;
};

export type TransactionState =
  | TransactionIdle
  | TransactionFailed
  | TransactionWaitingForApproval
  | TransactionCancelled
  | TransactionWaitingForConfirmations
  | TransactionConfirmed
  | TransactionConfirmedOneShot;

const TransactionContext = React.createContext<
  [TransactionState, (state: TransactionState) => void] | undefined
>(undefined);

type TransactionProviderProps = {
  children: React.ReactNode
}

export const TransactionProvider = ({ children }: TransactionProviderProps): JSX.Element => {
  const transactionState = useState<TransactionState>({ type: "idle", version: "", collateral: "" });
  return (
    <TransactionContext.Provider value={transactionState}>{children}</TransactionContext.Provider>
  );
};

const useTransactionState = () => {
  const transactionState = useContext(TransactionContext);

  if (!transactionState) {
    throw new Error("You must provide a TransactionContext via TransactionProvider");
  }

  return transactionState;
};

export const useMyTransactionState = (myId: string | RegExp, version: string, collateral: string): TransactionState => {
  const [transactionState] = useTransactionState();
  const isCollateralChecked = checkTransactionCollateral(
    transactionState,
    version,
    collateral
  );

  return isCollateralChecked && transactionState.type !== "idle" &&
    (typeof myId === "string" ? transactionState.id === myId : transactionState.id.match(myId))
    ? { ...transactionState, version: transactionState.version, collateral: transactionState.collateral }
    : { type: "idle", version: transactionState.version, collateral: transactionState.collateral };
};

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof (error as { message: unknown }).message === "string";

type ButtonlikeProps = {
  disabled?: boolean;
  variant?: string;
  onClick?: () => void;
};

type SentTransaction = SentThresholdTransaction<
  TransactionResponse,
  ThresholdReceipt<TransactionReceipt>
>;

export type TransactionFunction = (
  overrides?: EthersTransactionOverrides
) => Promise<SentTransaction>;

type TransactionProps<C> = {
  id: string;
  tooltip?: string;
  tooltipPlacement?: TooltipProps["placement"];
  showFailure?: "asTooltip" | "asChildText";
  requires?: readonly (readonly [boolean, string])[];
  send: TransactionFunction;
    version: string;
  collateral: string;
  children: C;
};

export const useTransactionFunction = (
  id: string,
  send: TransactionFunction,
  version: string,
  collateral: string,
): [sendTransaction: () => Promise<void>, transactionState: TransactionState] => {
  const [transactionState, setTransactionState] = useTransactionState();

  const sendTransaction = useCallback(async () => {
    setTransactionState({ type: "waitingForApproval", id, version, collateral });

    try {
      const tx = await send();

      setTransactionState({
        type: "waitingForConfirmation",
        id,
        tx, 
        version,
        collateral,
      });
    } catch (error) {
      if (hasMessage(error) && error.message.includes("User denied transaction signature")) {
        setTransactionState({ type: "cancelled", id, version, collateral, });
      } else {
        console.error(error);

        setTransactionState({
          type: "failed",
          id,
          error: new Error("Failed to send transaction (try again)"),
          version,
          collateral,
        });
      }
    }
  }, [send, id, version, collateral, setTransactionState]);

  return [sendTransaction, transactionState];
};

export function Transaction<C extends React.ReactElement<ButtonlikeProps>>({
  id,
  tooltip,
  tooltipPlacement,
  showFailure,
  requires,
  send,
  version,
  collateral,
  children
}: TransactionProps<C>) {
  const [sendTransaction, transactionState] = useTransactionFunction(id, send, version, collateral);
  const trigger = React.Children.only<C>(children);

  const failureReasons = (requires || [])
    .filter(([requirement]) => !requirement)
    .map(([, reason]) => reason);

    const isCollateralChecked = checkTransactionCollateral(
      transactionState,
      version,
      collateral
    );

  if (
    isCollateralChecked &&
    (transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation")
  ) {
    failureReasons.push("You must wait for confirmation");
  }

  showFailure =
    failureReasons.length > 0 ? showFailure ?? (tooltip ? "asTooltip" : "asChildText") : undefined;

  const clonedTrigger =
    showFailure === "asChildText"
      ? React.cloneElement(
          trigger,
          {
            disabled: true,
            variant: "danger"
          },
          failureReasons[0]
        )
      : showFailure === "asTooltip"
      ? React.cloneElement(trigger, { disabled: true })
      : React.cloneElement(trigger, { onClick: sendTransaction });

  if (showFailure === "asTooltip") {
    tooltip = failureReasons[0];
  }

  return tooltip ? (
    <>
      <Tooltip message={tooltip} placement={tooltipPlacement || "right"}>
        {clonedTrigger}
      </Tooltip>
    </>
  ) : (
    clonedTrigger
  );
}

// https://github.com/MetaMask/metamask-extension/issues/5579
const tryToGetRevertReason = async (provider: Provider, tx: TransactionReceipt) => {
  try {
    const result = await provider.call(tx, tx.blockNumber);

    if (hexDataLength(result) % 32 === 4 && hexDataSlice(result, 0, 4) === "0x08c379a0") {
      return (defaultAbiCoder.decode(["string"], hexDataSlice(result, 4)) as [string])[0];
    }
  } catch {
    return undefined;
  }
};

export const TransactionMonitor = (): JSX.Element => {
  const { provider } = useThreshold();
  const [transactionState, setTransactionState] = useTransactionState();

  const id = transactionState.type !== "idle" ? transactionState.id : undefined;
  const tx = transactionState.type === "waitingForConfirmation" ? transactionState.tx : undefined;
  const version = transactionState.version !== "" ? transactionState.version : undefined
  const collateral = transactionState.collateral !== "" ? transactionState.collateral : undefined

  useEffect(() => {
    if (!id || !tx || !version || !collateral) {
      return
    }
    let cancelled = false;
    let finished = false;

    const txHash = tx.rawSentTransaction.hash;
    const waitForConfirmation = async () => {
      try {
        const receipt = await tx.waitForReceipt();
        if (cancelled) {
          return;
        }
        
        const { confirmations } = receipt.rawReceipt;
        const blockNumber = receipt.rawReceipt.blockNumber + confirmations - 1;
        console.log(`Block #${blockNumber} ${confirmations}-confirms tx ${txHash}`);
        console.log(`Finish monitoring tx ${txHash}`);
        finished = true;

        if (receipt.status === "succeeded") {
          console.log(`${receipt}`);

          setTransactionState({
            type: "confirmedOneShot",
            id,
            version,
            collateral
          });
        } else {
          const reason = await tryToGetRevertReason(provider as Provider, receipt.rawReceipt);

          if (cancelled) {
            return;
          }

          console.error(`Tx ${txHash} failed`);
          if (reason) {
            console.error(`Revert reason: ${reason}`);
          }

          setTransactionState({
            type: "failed",
            id,
            error: new Error(reason ? `Reverted: ${reason}` : "Failed"),
            version,
            collateral
          });
        }
      } catch (rawError) {
        if (cancelled) {
          return;
        }

        finished = true;

        if (rawError instanceof EthersTransactionCancelledError) {
          console.log(`Cancelled tx ${txHash}`);
          setTransactionState({ type: "cancelled", id, version, collateral });
        } else {
          console.error(`Failed to get receipt for tx ${txHash}`);
          console.error(rawError);

          setTransactionState({
            type: "failed",
            id,
            error: new Error("Failed"),
            version,
            collateral
          });
        }
      }
    }
   
      console.log(`Start monitoring tx ${txHash}`);
      waitForConfirmation();

      return () => {
        if (!finished) {
          setTransactionState({ type: "idle", version, collateral });
          console.log(`Cancel monitoring tx ${txHash}`);
          cancelled = true;
        }
      };
  }, [provider, id, tx, setTransactionState, version, collateral]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot" && id && version && collateral) {
      // hack: the txn confirmed state lasts 5 seconds which blocks other states, review with Dani
      setTransactionState({ type: "confirmed", id, version, collateral  });
    } else if (
      (transactionState.type === "confirmed" ||
      transactionState.type === "failed" ||
      transactionState.type === "cancelled") &&
      (transactionState.version === version &&
      transactionState.collateral === collateral)
    ) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setTransactionState({ type: "idle", version, collateral  });
        }
      }, 5000);

      return () => {
        cancelled = true;
      };
    }
  }, [
    transactionState.type, 
    transactionState.collateral, 
    transactionState.version, 
    setTransactionState, 
    id, 
    version, 
    collateral
  ]);

  if (transactionState.type === "idle" || transactionState.type === "waitingForApproval") {
    return <></>;
  }

  return (
    <TransactionStatus
      state={transactionState.type}
      message={transactionState.type === "failed" ? transactionState.error.message : undefined}
    />
  );
};
