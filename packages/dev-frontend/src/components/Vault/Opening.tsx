import { useCallback, useEffect, useState } from "react";
import { Button, Card, Flex, Link, Spinner } from "theme-ui";
import {
  LiquityStoreState as ThresholdStoreState,
  Decimal,
  Trove as Vault,
  THUSD_LIQUIDATION_RESERVE,
  THUSD_MINIMUM_NET_DEBT,
  Percent
} from "@liquity/lib-base";
import { useThresholdSelector } from "@liquity/lib-react";

import { useStableVaultChange } from "../../hooks/useStableVaultChange";
import { useValidationState } from "./validation/useValidationState";
import { ActionDescription } from "../ActionDescription";
import { Transaction, useMyTransactionState } from "../Transaction";
import { useThreshold } from "../../hooks/ThresholdContext";
import { VaultAction } from "./VaultAction";
import { useVaultView } from "./context/VaultViewContext";
import { COIN } from "../../utils/constants";
import { InfoIcon } from "../InfoIcon";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { EditableRow, StaticRow } from "./Editor";
import { ExpensiveVaultChangeWarning, GasEstimationState } from "./ExpensiveVaultChangeWarning";
import {
  selectForVaultChangeValidation,
  validateVaultChange
} from "./validation/validateVaultChange";

const selector = (state: ThresholdStoreState) => {
  const { fees, price, erc20TokenBalance, symbol } = state;
  return {
    fees,
    price,
    erc20TokenBalance,
    validationContext: selectForVaultChangeValidation(state),
    symbol
  };
};

const EMPTY_VAULT = new Vault(Decimal.ZERO, Decimal.ZERO);
const TRANSACTION_ID = "vault-creation";
const APPROVE_TRANSACTION_ID = "vault-approve";

type OpeningProps = {
  version: string
}

export const Opening = ({ version }: OpeningProps): JSX.Element => {
  const {
    threshold: { [ version ]: { send: threshold } }
  } = useThreshold();
  const { dispatchEvent } = useVaultView();
  const { [version]: { fees, price, erc20TokenBalance, validationContext, symbol }} = useThresholdSelector(selector);
  const borrowingRate = fees.borrowingRate();
  const editingState = useState<string>();
  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [collateral, setCollateral] = useState<Decimal>(Decimal.ZERO);
  const [borrowAmount, setBorrowAmount] = useState<Decimal>(Decimal.ZERO);
  const maxBorrowingRate = borrowingRate.add(0.005);
  const fee = borrowAmount.mul(borrowingRate);
  const feePct = new Percent(borrowingRate);
  const totalDebt = borrowAmount.add(THUSD_LIQUIDATION_RESERVE).add(fee);
  const isDirty = !collateral.isZero || !borrowAmount.isZero;
  const trove = isDirty ? new Vault(collateral, totalDebt) : EMPTY_VAULT;
  const maxCollateral = erc20TokenBalance;
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !borrowAmount.isZero ? trove.collateralRatio(price) : undefined;

  const [vaultChange, description] = validateVaultChange(
    EMPTY_VAULT,
    trove,
    borrowingRate,
    validationContext
  );
    
  const stableVaultChange = useStableVaultChange(vaultChange);
  const { hasApproved, amountToApprove } = useValidationState(version, stableVaultChange);

  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);

  useEffect(() => {
    if (isMounted) {
      if (!collateral.isZero && borrowAmount.isZero) {
        setBorrowAmount(THUSD_MINIMUM_NET_DEBT);
      }
    }
    return () => {
      setIsMounted(false);
    }
  }, [collateral, borrowAmount, isMounted]);

  return (
    <Card variant="mainCards">
      <Card variant="layout.columns">
        <Flex sx={{
          justifyContent: "space-between",
          width: "100%",
          gap: 1,
          pb: "1em",
          px: ["2em", 0],
          borderBottom: 1, 
          borderColor: "border"
        }}>
          <Flex sx={{ gap: 1 }}>
            Open a Vault
            <InfoIcon size="sm" tooltip={<Card variant="tooltip">To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral ({ symbol }) to it.</Card>} />
          </Flex>
          {symbol} Collateral
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.7em"],
          pb: "1em",
          mt: 2
        }}>
          <EditableRow
            label="Collateral"
            inputId="vault-collateral"
            amount={collateral.prettify(4)}
            maxAmount={maxCollateral.toString()}
            maxedOut={collateralMaxedOut}
            editingState={editingState}
            unit={ symbol }
            editedAmount={collateral.toString(4)}
            setEditedAmount={(amount: string) => setCollateral(Decimal.from(amount))}
          />

          <EditableRow
            label="Borrow"
            inputId="vault-borrow-amount"
            amount={borrowAmount.prettify()}
            unit={COIN}
            editingState={editingState}
            editedAmount={borrowAmount.toString(2)}
            setEditedAmount={(amount: string) => setBorrowAmount(Decimal.from(amount))}
          />
          <StaticRow
            label="Liquidation Reserve"
            inputId="vault-liquidation-reserve"
            amount={`${THUSD_LIQUIDATION_RESERVE}`}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "200px" }}>
                    An amount set aside to cover the liquidator’s gas costs if your Vault needs to be
                    liquidated. The amount increases your debt and is refunded if you close your Vault
                    by fully paying off its net debt.
                  </Card>
                }
              />
            }
          />
          <StaticRow
            label="Borrowing Fee"
            inputId="vault-borrowing-fee"
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
            inputId="vault-total-debt"
            amount={totalDebt.prettify(2)}
            unit={COIN}
            infoIcon={
              <InfoIcon
                tooltip={
                  <Card variant="tooltip" sx={{ width: "240px" }}>
                    The total amount of { COIN } your Vault will hold.{" "}
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
            <ExpensiveVaultChangeWarning
              version={version}
              vaultChange={stableVaultChange}
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
                send={threshold.approveErc20.bind(threshold, amountToApprove)}
                showFailure="asTooltip"
                tooltipPlacement="bottom"
                version={version}
              >
                <Button>Approve { symbol }</Button>
              </Transaction>
              ) : gasEstimationState.type === "inProgress" ? (
                <Button disabled>
                  <Spinner size="24px" sx={{ color: "background" }} />
                </Button>
              ) : stableVaultChange ? (
              <VaultAction
                version={version}
                transactionId={TRANSACTION_ID}
                change={stableVaultChange}
                maxBorrowingRate={maxBorrowingRate}
                borrowingFeeDecayToleranceMinutes={60}
              >
                Confirm
              </VaultAction>
            ) : (
              <Button disabled>Confirm</Button>
            )}
            <Button variant="cancel" onClick={handleCancelPressed} sx={{ borderRadius: "12px", mt: 3 }}>
              Cancel
            </Button>
          </Flex>
          <Flex sx={{ 
            alignSelf: "center",
            fontSize: 11,
            fontWeight: "body",
            justifyContent: "space-between",
            width: "100%",
            px: "1em",
            pt: "1em"
          }}>
            <Flex>
              <Link variant="cardLinks" href="https://github.com/Threshold-USD/dev#readme" target="_blank">Read about</Link>
              in the documentation
            </Flex>
            <Flex>Deployment version: {version}</Flex>
          </Flex>
        </Flex>
        {isTransactionPending && <LoadingOverlay />}
      </Card>
    </Card>
  );
};
