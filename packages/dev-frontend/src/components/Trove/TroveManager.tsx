import { useCallback, useEffect } from "react";
import { Button, Flex, Link } from "theme-ui";

import { LiquityStoreState, Decimal, Trove, Decimalish, THUSD_MINIMUM_DEBT, CollateralContract } from "@liquity/lib-base";

import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";
import { FIRST_ERC20_COLLATERAL } from "../../strings";

import {
  selectForTroveChangeValidation,
  validateTroveChange
} from "./validation/validateTroveChange";

const select = (state: LiquityStoreState) => ({
  fees: state.fees,
  validationContext: selectForTroveChangeValidation(state)
});

const transactionIdPrefix = "trove-";
const transactionIdMatcher = new RegExp(`^${transactionIdPrefix}`);

type TroveManagerProps = {
  contract: CollateralContract;
  collateral?: Decimalish;
  debt?: Decimalish;
};

export const TroveManager: React.FC<TroveManagerProps> = ({contract, collateral, debt }) => {
  const init = ({ trove }: LiquityStoreState) => ({
    original: trove,
    edited: new Trove(contract.name, trove.collateral, trove.debt),
    changePending: false,
    debtDirty: false,
    addedMinimumDebt: false
  });
  
  type TroveManagerState = ReturnType<typeof init>;
  type TroveManagerAction =
    | LiquityStoreUpdate
    | { type: "startChange" | "finishChange" | "revert" | "addMinimumDebt" | "removeMinimumDebt" }
    | { type: "setCollateral" | "setDebt"; newValue: Decimalish };
  
  const reduceWith = (action: TroveManagerAction) => (state: TroveManagerState): TroveManagerState =>
    reduce(state, action);
  
  const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
  const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
  const finishChange = reduceWith({ type: "finishChange" });
  const revert = reduceWith({ type: "revert" });
  
  const reduce = (state: TroveManagerState, action: TroveManagerAction): TroveManagerState => {
    // console.log(state);
    // console.log(action);
  
    const { original, edited, changePending, debtDirty, addedMinimumDebt } = state;
  
    switch (action.type) {
      case "startChange": {
        console.log("starting change");
        return { ...state, changePending: true };
      }
  
      case "finishChange":
        return { ...state, changePending: false };
  
      case "setCollateral": {
        const newCollateral = Decimal.from(action.newValue);
  
        const newState = {
          ...state,
          edited: edited.setCollateral(contract.name, newCollateral)
        };
  
        if (!debtDirty) {
          if (edited.isEmpty && newCollateral.nonZero) {
            return addMinimumDebt(newState);
          }
          if (addedMinimumDebt && newCollateral.isZero) {
            return removeMinimumDebt(newState);
          }
        }
  
        return newState;
      }
  
      case "setDebt":
        return {
          ...state,
          edited: edited.setDebt(contract.name, action.newValue),
          debtDirty: true
        };
  
      case "addMinimumDebt":
        return {
          ...state,
          edited: edited.setDebt(contract.name, THUSD_MINIMUM_DEBT),
          addedMinimumDebt: true
        };
  
      case "removeMinimumDebt":
        return {
          ...state,
          edited: edited.setDebt(contract.name, 0),
          addedMinimumDebt: false
        };
  
      case "revert":
        return {
          ...state,
          edited: new Trove(contract.name, original.collateral, original.debt),
          debtDirty: false,
          addedMinimumDebt: false
        };
  
      case "updateStore": {
        const {
          newState: { trove },
          stateChange: { troveBeforeRedistribution: changeCommitted }
        } = action;
  
        const newState = {
          ...state,
          original: trove
        };
  
        if (changePending && changeCommitted) {
          return finishChange(revert(newState));
        }
  
        const change = original.whatChanged(edited, 0);
  
        if (
          (change?.type === "creation" && !trove.isEmpty) ||
          (change?.type === "closure" && trove.isEmpty)
        ) {
          return revert(newState);
        }
  
        return { ...newState, edited: trove.apply(contract.name, change, 0) };
      }
    }
  };
  
  const feeFrom = (original: Trove, edited: Trove, borrowingRate: Decimal): Decimal => {
    const change = original.whatChanged(edited, borrowingRate);
  
    if (change && change.type !== "invalidCreation" && change.params.borrowTHUSD) {
      return change.params.borrowTHUSD.mul(borrowingRate);
    } else {
      return Decimal.ZERO;
    }
  };
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees, validationContext } = useLiquitySelector(select);

  useEffect(() => {
    if (collateral !== undefined) {
      dispatch({ type: "setCollateral", newValue: collateral });
    }
    if (debt !== undefined) {
      dispatch({ type: "setDebt", newValue: debt });
    }
  }, [collateral, debt, dispatch]);

  const borrowingRate = fees.borrowingRate();
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  const [validChange, description] = validateTroveChange(
    contract,
    original,
    edited,
    borrowingRate,
    validationContext
  );

  const { dispatchEvent } = useTroveView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED", contract);
  }, [dispatchEvent, contract]);

  const openingNewTrove = original.isEmpty;

  const myTransactionState = useMyTransactionState(transactionIdMatcher);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      if (myTransactionState.id === `${transactionIdPrefix}closure`) {
        dispatchEvent("TROVE_CLOSED", contract);
      } else {
        dispatchEvent("TROVE_ADJUSTED", contract);
      }
    }
  }, [myTransactionState, dispatch, dispatchEvent, contract]);

  return (
    <TroveEditor
      original={original}
      edited={edited}
      fee={feeFrom(original, edited, borrowingRate)}
      borrowingRate={borrowingRate}
      changePending={changePending}
      dispatch={dispatch}
    >
      {description ??
        (openingNewTrove ? (
          <ActionDescription>
            Start by entering the amount of { FIRST_ERC20_COLLATERAL } you'd like to deposit as collateral.
          </ActionDescription>
        ) : (
          <ActionDescription>
            Adjust your Trove by modifying its collateral, debt, or both.
          </ActionDescription>
        ))}

      <Flex variant="layout.actions" sx={{ flexDirection: "column" }}>
        {validChange ? (
          <TroveAction
            contract={contract}
            transactionId={`${transactionIdPrefix}${validChange.type}`}
            change={validChange}
            maxBorrowingRate={maxBorrowingRate}
            borrowingFeeDecayToleranceMinutes={60}
          >
            Confirm
          </TroveAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
        <Button variant="cancel" onClick={handleCancel} sx={{ borderRadius: "12px", mt: 3 }}>
          Cancel
        </Button>
      </Flex>
      <Flex sx={{ 
        justifyContent: "center",
        fontSize: 11,
        fontWeight: "body",
        mt: "1.5em"
      }}>
        <Link variant="cardLinks" href="https://github.com/Threshold-USD/dev#readme" target="_blank">Read about</Link>
        in the documentation
      </Flex>
    </TroveEditor>
  );
};
