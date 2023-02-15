import { useCallback, useEffect, useState, useRef } from "react";
import { Flex, Button, Card, Link } from "theme-ui";
import {
  LiquityStoreState as ThresholdStoreState,
  Decimal,
  Trove as Vault,
  THUSD_LIQUIDATION_RESERVE,
  Percent,
  Difference
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
  const { trove, fees, price, collateralAddress, erc20TokenBalance, symbol } = state;
  return {
    trove,
    fees,
    price,
    collateralAddress,
    erc20TokenBalance,
    validationContext: selectForVaultChangeValidation(state),
    symbol,
  };
};

const TRANSACTION_ID = "vault-adjustment";
const APPROVE_TRANSACTION_ID = "vault-approve";

const feeFrom = (original: Vault, edited: Vault, borrowingRate: Decimal): Decimal => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowTHUSD) {
    return change.params.borrowTHUSD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

const applyUnsavedCollateralChanges = (unsavedChanges: Difference, vault: Vault) => {
  if (unsavedChanges.absoluteValue) {
    if (unsavedChanges.positive) {
      return vault.collateral.add(unsavedChanges.absoluteValue);
    }
    if (unsavedChanges.negative) {
      if (unsavedChanges.absoluteValue.lt(vault.collateral)) {
        return vault.collateral.sub(unsavedChanges.absoluteValue);
      }
    }
    return vault.collateral;
  }
  return vault.collateral;
};

const applyUnsavedNetDebtChanges = (unsavedChanges: Difference, vault: Vault) => {
  if (unsavedChanges.absoluteValue) {
    if (unsavedChanges.positive) {
      return vault.netDebt.add(unsavedChanges.absoluteValue);
    }
    if (unsavedChanges.negative) {
      if (unsavedChanges.absoluteValue.lt(vault.netDebt)) {
        return vault.netDebt.sub(unsavedChanges.absoluteValue);
      }
    }
    return vault.netDebt;
  }
  return vault.netDebt;
};

type AdjustingProps = {
  version: string
}

export const Adjusting = ({ version }: AdjustingProps): JSX.Element => {
  const {
    threshold: { [version]: { send: threshold } }
  } = useThreshold();
  const { dispatchEvent } = useVaultView();
  const { [version]: { trove, fees, price, collateralAddress, erc20TokenBalance, symbol, validationContext } } = useThresholdSelector(selector);
  const editingState = useState<string>();
  const previousVault = useRef<Vault>(trove);
  const [collateral, setCollateral] = useState<Decimal>(trove.collateral);
  const [netDebt, setNetDebt] = useState<Decimal>(trove.netDebt);
  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const borrowingRate = fees.borrowingRate();

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("VAULT_ADJUSTED", version);
    }
  }, [transactionState.type, dispatchEvent, version]);

  useEffect(() => {
    if (!previousVault.current.collateral.eq(trove.collateral)) {
      const unsavedChanges = Difference.between(collateral, previousVault.current.collateral);
      const nextCollateral = applyUnsavedCollateralChanges(unsavedChanges, trove);
      setCollateral(nextCollateral);
    }
    if (!previousVault.current.netDebt.eq(trove.netDebt)) {
      const unsavedChanges = Difference.between(netDebt, previousVault.current.netDebt);
      const nextNetDebt = applyUnsavedNetDebtChanges(unsavedChanges, trove);
      setNetDebt(nextNetDebt);
    }
    previousVault.current = trove;
  }, [trove, collateral, netDebt]);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);

  const isDirty = !collateral.eq(trove.collateral) || !netDebt.eq(trove.netDebt);
  const isDebtIncrease = netDebt.gt(trove.netDebt);
  const debtIncreaseAmount = isDebtIncrease ? netDebt.sub(trove.netDebt) : Decimal.ZERO;

  const fee = isDebtIncrease
    ? feeFrom(trove, new Vault(trove.collateral, trove.debt.add(debtIncreaseAmount)), borrowingRate)
    : Decimal.ZERO;
  const totalDebt = netDebt.add(THUSD_LIQUIDATION_RESERVE).add(fee);
  const maxBorrowingRate = borrowingRate.add(0.005);
  const updatedVault = isDirty ? new Vault(collateral, totalDebt) : trove;
  const feePct = new Percent(borrowingRate);
  const availableErc20 = erc20TokenBalance;
  const maxCollateral = trove.collateral.add(availableErc20);
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !netDebt.isZero ? updatedVault.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, trove.collateralRatio(price));

  const [troveChange, description] = validateVaultChange(
    trove,
    updatedVault,
    borrowingRate,
    validationContext
  );

  const stableVaultChange = useStableVaultChange(troveChange);
  const { hasApproved, amountToApprove } = useValidationState(version, stableVaultChange);

  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  if (trove.status !== "open") {
    return <></>;
  }

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
            Adjusting Vault
            <InfoIcon size="sm" tooltip={<Card variant="tooltip">To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral ({ symbol }) to it.</Card>} />
          </Flex>
          { symbol } Collateral
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
            label="Net debt"
            inputId="vault-net-debt-amount"
            amount={netDebt.prettify()}
            unit={COIN}
            editingState={editingState}
            editedAmount={netDebt.toString(2)}
            setEditedAmount={(amount: string) => setNetDebt(Decimal.from(amount))}
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

          <CollateralRatio value={collateralRatio} change={collateralRatioChange} />

          {description ?? (
            <ActionDescription>
              Adjust your Vault by modifying its collateral, debt, or both.
            </ActionDescription>
          )}

          {(hasApproved || !collateralAddress) &&
          (<ExpensiveVaultChangeWarning
            version={version}
            vaultChange={stableVaultChange}
            maxBorrowingRate={maxBorrowingRate}
            borrowingFeeDecayToleranceMinutes={60}
            gasEstimationState={gasEstimationState}
            setGasEstimationState={setGasEstimationState}
          />)}

          <Flex variant="layout.actions" sx={{ flexDirection: "column" }}>
            {collateralAddress && !hasApproved && amountToApprove ?
              <Transaction
                id={APPROVE_TRANSACTION_ID}
                send={threshold.approveErc20.bind(threshold, amountToApprove)}
                showFailure="asTooltip"
                tooltipPlacement="bottom"
                version={version}
              >
                <Button>Approve { symbol }</Button>
              </Transaction>
            : stableVaultChange ? (
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
        </Flex>
        {isTransactionPending && <LoadingOverlay />}
      </Card>
    </Card>
  );
};
