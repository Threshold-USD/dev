import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Flex, Link, Spinner } from "theme-ui";
import {
  LiquityStoreState,
  Decimal,
  Trove,
  THUSD_LIQUIDATION_RESERVE,
  THUSD_MINIMUM_NET_DEBT,
  Percent
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useStableTroveChange } from "../../hooks/useStableTroveChange";
import { useValidationState } from "./validation/useValidationState";
import { ActionDescription } from "../ActionDescription";
import { Transaction, useMyTransactionState } from "../Transaction";
import { useLiquity } from "../../hooks/LiquityContext";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";
import { COIN, FIRST_ERC20_COLLATERAL } from "../../strings";
import { InfoIcon } from "../InfoIcon";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { EditableRow, StaticRow } from "./Editor";
import { ExpensiveTroveChangeWarning, GasEstimationState } from "./ExpensiveTroveChangeWarning";
import {
  selectForTroveChangeValidation,
  validateTroveChange
} from "./validation/validateTroveChange";
import { VaultProps } from "./Vault";

const selector = (state: LiquityStoreState) => {
  const { fees, price, erc20TokenBalance } = state;
  return {
    fees,
    price,
    erc20TokenBalance,
    validationContext: selectForTroveChangeValidation(state)
  };
};

const TRANSACTION_ID = "trove-creation";
const APPROVE_TRANSACTION_ID = "trove-approve";

export const Opening: React.FC<VaultProps> = props => {
  const { contract } = props;

  const EMPTY_TROVE = new Trove(contract.name, Decimal.ZERO, Decimal.ZERO);
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const { dispatchEvent } = useTroveView();
  const { fees, price, erc20TokenBalance, validationContext } = useLiquitySelector(selector);
  const borrowingRate = fees.borrowingRate();
  const editingState = useState<string>();

  const [collateral, setCollateral] = useState<Decimal>(Decimal.ZERO);
  const [borrowAmount, setBorrowAmount] = useState<Decimal>(Decimal.ZERO);

  const maxBorrowingRate = borrowingRate.add(0.005);

  const fee = borrowAmount.mul(borrowingRate);
  const feePct = new Percent(borrowingRate);
  const totalDebt = borrowAmount.add(THUSD_LIQUIDATION_RESERVE).add(fee);
  const isDirty = !collateral.isZero || !borrowAmount.isZero;
  const trove = isDirty ? new Trove(contract.name, collateral, totalDebt) : EMPTY_TROVE;
  const maxCollateral = erc20TokenBalance;
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !borrowAmount.isZero ? trove.collateralRatio(price) : undefined;

  const [troveChange, description] = validateTroveChange(
    contract,
    EMPTY_TROVE,
    trove,
    borrowingRate,
    validationContext
  );
    
  const stableTroveChange = useStableTroveChange(troveChange);
  const { hasApproved, amountToApprove } = useValidationState(stableTroveChange);
  
  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED", contract);
  }, [dispatchEvent, contract]);

  useEffect(() => {
    if (!collateral.isZero && borrowAmount.isZero) {
      setBorrowAmount(THUSD_MINIMUM_NET_DEBT);
    }
  }, [collateral, borrowAmount]);

  return (
    <Card variant="mainCards">
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: "1em",
          borderBottom: 1, 
          borderColor: "border",
        }}>
          Open a Vault
          <InfoIcon size="sm" tooltip={<Card variant="tooltip">To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral ({ FIRST_ERC20_COLLATERAL }) to it.</Card>} />
        </Flex>

        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.7em"],
          mt: 2
        }}>
          <EditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={collateral.prettify(4)}
            maxAmount={maxCollateral.toString()}
            maxedOut={collateralMaxedOut}
            editingState={editingState}
            unit={contract.collateralSymbol}
            editedAmount={collateral.toString(4)}
            setEditedAmount={(amount: string) => setCollateral(Decimal.from(amount))}
          />

          <EditableRow
            label="Borrow"
            inputId="trove-borrow-amount"
            amount={borrowAmount.prettify()}
            unit={COIN}
            editingState={editingState}
            editedAmount={borrowAmount.toString(2)}
            setEditedAmount={(amount: string) => setBorrowAmount(Decimal.from(amount))}
          />

          <StaticRow
            label="Liquidation Reserve"
            inputId="trove-liquidation-reserve"
            amount={`${THUSD_LIQUIDATION_RESERVE}`}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "200px" }}>
                    An amount set aside to cover the liquidator’s gas costs if your Trove needs to be
                    liquidated. The amount increases your debt and is refunded if you close your Trove
                    by fully paying off its net debt.
                  </Card>
                }
              />
            }
          />

          <StaticRow
            label="Borrowing Fee"
            inputId="trove-borrowing-fee"
            amount={fee.prettify(2)}
            pendingAmount={feePct.toString(2)}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "240px" }}>
                    This amount is deducted from the borrowed amount as a one-time fee. There are no
                    recurring fees for borrowing, which is thus interest-free.
                  </Card>
                }
              />
            }
          />

          <StaticRow
            label="Total debt"
            inputId="trove-total-debt"
            amount={totalDebt.prettify(2)}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "240px" }}>
                    The total amount of { COIN } your Trove will hold.{" "}
                    {isDirty && (
                      <>
                        You will need to repay {totalDebt.sub(THUSD_LIQUIDATION_RESERVE).prettify(2)}{" "}
                        { COIN } to reclaim your collateral ({THUSD_LIQUIDATION_RESERVE.toString()} { COIN }
                        Liquidation Reserve excluded).
                      </>
                    )}
                  </Card>
                }
              />
            }
          />

          <CollateralRatio value={collateralRatio} />

          {description ?? (
            <ActionDescription title={`You haven't borrowed ${COIN} any yet`}>
              You can borrow {COIN} by opening a Vault
            </ActionDescription>
          )}
      
          {hasApproved && (
            <ExpensiveTroveChangeWarning
              contract={contract}
              troveChange={stableTroveChange}
              maxBorrowingRate={maxBorrowingRate}
              borrowingFeeDecayToleranceMinutes={60}
              gasEstimationState={gasEstimationState}
              setGasEstimationState={setGasEstimationState}
            />
          )}

          <Flex variant="layout.actions" sx={{ flexDirection: "column" }}>
            {!hasApproved && amountToApprove ? (
              <Transaction
                id={APPROVE_TRANSACTION_ID}
                send={liquity.approveErc20.bind(liquity, amountToApprove)}
                showFailure="asTooltip"
                tooltipPlacement="bottom"
              >
                <Button>Approve { FIRST_ERC20_COLLATERAL }</Button>
              </Transaction>
              ) : gasEstimationState.type === "inProgress" ? (
                <Button disabled>
                  <Spinner size="24px" sx={{ color: "background" }} />
                </Button>
              ) : stableTroveChange ? (
              <TroveAction
                contract={contract}
                transactionId={TRANSACTION_ID}
                change={stableTroveChange}
                maxBorrowingRate={maxBorrowingRate}
                borrowingFeeDecayToleranceMinutes={60}
              >
                Confirm
              </TroveAction>
            ) : (
              <Button disabled>Confirm</Button>
            )}
            <Button variant="cancel" onClick={handleCancelPressed} sx={{ borderRadius: "12px", mt: 3 }}>
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
        </Flex>
        {isTransactionPending && <LoadingOverlay />}
      </Card>
    </Card>
  );
};
