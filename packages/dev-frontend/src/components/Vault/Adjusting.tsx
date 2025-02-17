import { useCallback, useEffect, useState, useRef } from "react";
import { Flex, Button, Card, Link } from "theme-ui";
import {
  LiquityStoreState as ThresholdStoreState,
  Decimal,
  Trove as Vault,
  THUSD_LIQUIDATION_RESERVE,
  Percent,
  Difference,
  UserTrove
} from "@threshold-usd/lib-base";
import { useThresholdSelector } from "@threshold-usd/lib-react";

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
import { checkTransactionCollateral } from "../../utils/checkTransactionCollateral";

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
  version: string;
  collateral: string;
  isMintList: boolean;
}

export const Adjusting = (props: AdjustingProps): JSX.Element => {
  const { version, collateral } = props;
  const thresholdSelectorStores = useThresholdSelector(selector);
  const thresholdStore = thresholdSelectorStores.find((store) => {
    return store.version === version && store.collateral === collateral;
  });
  const store = thresholdStore?.store!;
  const trove: UserTrove = store.trove;
  const fees = store.fees;
  const price = store.price;
  const collateralAddress = store.collateralAddress;
  const erc20TokenBalance = store.erc20TokenBalance;
  const symbol = store.symbol;
  const validationContext = store.validationContext;
  
  const { threshold } = useThreshold()
  const collateralThreshold = threshold.find((versionedThreshold) => {
    return versionedThreshold.version === version && versionedThreshold.collateral === collateral;
  })!;
  
  const send = collateralThreshold.store.send

  const { dispatchEvent } = useVaultView();
  const editingState = useState<string>();
  const previousVault = useRef<Vault>(trove);
  const [collateralAmount, setCollateralAmount] = useState<Decimal>(trove.collateral);
  const [netDebt, setNetDebt] = useState<Decimal>(trove.netDebt);
  const transactionState = useMyTransactionState(TRANSACTION_ID, version, collateral);
  const borrowingRate = fees.borrowingRate();

  const isCollateralChecked = checkTransactionCollateral(
    transactionState,
    version,
    collateral
  );

  useEffect(() => {
    if (isCollateralChecked && transactionState.type === "confirmedOneShot") {
      dispatchEvent("VAULT_ADJUSTED", version, collateral);
    }
  }, [isCollateralChecked, transactionState.type, dispatchEvent, version, collateral]);

  useEffect(() => {
    if (!previousVault.current.collateral.eq(trove.collateral)) {
      const unsavedChanges = Difference.between(collateralAmount, previousVault.current.collateral);
      const nextCollateral = applyUnsavedCollateralChanges(unsavedChanges, trove);
      setCollateralAmount(nextCollateral);
    }
    if (!previousVault.current.netDebt.eq(trove.netDebt)) {
      const unsavedChanges = Difference.between(netDebt, previousVault.current.netDebt);
      const nextNetDebt = applyUnsavedNetDebtChanges(unsavedChanges, trove);
      setNetDebt(nextNetDebt);
    }
    previousVault.current = trove;
  }, [trove, collateralAmount, netDebt]);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_VAULT_PRESSED", version, collateral);
  }, [dispatchEvent, version, collateral]);

  const isDirty = !collateralAmount.eq(trove.collateral) || !netDebt.eq(trove.netDebt);
  const isDebtIncrease = netDebt.gt(trove.netDebt);
  const debtIncreaseAmount = isDebtIncrease ? netDebt.sub(trove.netDebt) : Decimal.ZERO;

  const fee = isDebtIncrease
    ? feeFrom(trove, new Vault(trove.collateral, trove.debt.add(debtIncreaseAmount)), borrowingRate)
    : Decimal.ZERO;
  const totalDebt = netDebt.add(THUSD_LIQUIDATION_RESERVE).add(fee);
  const maxBorrowingRate = borrowingRate.add(0.005);
  const updatedVault = isDirty ? new Vault(collateralAmount, totalDebt) : trove;
  const feePct = new Percent(borrowingRate);
  const availableErc20 = erc20TokenBalance;
  const maxCollateral = trove.collateral.add(availableErc20);
  const collateralMaxedOut = collateralAmount.eq(maxCollateral);
  const collateralRatio =
    !collateralAmount.isZero && !netDebt.isZero ? updatedVault.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, trove.collateralRatio(price));

  const [vaultChange, description] = validateVaultChange(
    trove,
    updatedVault,
    borrowingRate,
    validationContext
  );

  const stableVaultChange = useStableVaultChange(vaultChange);
  const { hasApproved, amountToApprove } = useValidationState(version, collateral, stableVaultChange);

  const [gasEstimationState, setGasEstimationState] = useState<GasEstimationState>({ type: "idle" });

  const isTransactionPending = isCollateralChecked &&
    (transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation");

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
            amount={collateralAmount.prettify(4)}
            maxAmount={maxCollateral.toString()}
            maxedOut={collateralMaxedOut}
            editingState={editingState}
            unit={ symbol }
            editedAmount={collateralAmount.toString(4)}
            setEditedAmount={(amount: string) => setCollateralAmount(Decimal.from(amount))}
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
                    <Link variant="cardLinks" href="https://docs.threshold.network/applications/threshold-usd/borrowing#how-is-the-borrowing-fee-calculated" target="_blank">Read more</Link>
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
            collateral={collateral}
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
                send={send.approveErc20.bind(send, amountToApprove)}
                showFailure="asTooltip"
                tooltipPlacement="bottom"
                version={version}
                collateral={collateral}
              >
                <Button sx={{ width: "100%" }}>Approve { symbol }</Button>
              </Transaction>
            : stableVaultChange ? (
              <VaultAction
                version={version}
                collateral={collateral}
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
                <Link variant="cardLinks" href="https://docs.threshold.network/fundamentals/threshold-usd" target="_blank">Read about</Link>
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
