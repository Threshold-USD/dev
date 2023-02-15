import {
  Decimal,
  THUSD_MINIMUM_DEBT,
  THUSD_MINIMUM_NET_DEBT,
  Trove as Vault,
  TroveAdjustmentParams as VaultAdjustmentParams,
  TroveChange as VaultChange,
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  LiquityStoreState as ThresholdStoreState,
  TroveClosureParams as VaultClosureParams,
  TroveCreationParams as VaultCreationParams
} from "@liquity/lib-base";

import { COIN,  } from "../../../utils/constants";

import { ActionDescription, Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

type VaultAdjustmentDescriptionParams = {
  params: VaultAdjustmentParams<Decimal>;
  symbol: string;
};

const VaultChangeDescription = ({ params, symbol }: VaultAdjustmentDescriptionParams): JSX.Element => (
  <ActionDescription>
    {params.depositCollateral && params.borrowTHUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { symbol }</Amount> and receive{" "}
        <Amount>
          {params.borrowTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.repayTHUSD && params.withdrawCollateral ? (
      <>
        You will pay{" "}
        <Amount>
          {params.repayTHUSD.prettify()} {COIN}
        </Amount>{" "}
        and receive <Amount>{params.withdrawCollateral.prettify()} { symbol }</Amount>
      </>
    ) : params.depositCollateral && params.repayTHUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { symbol }</Amount> and pay{" "}
        <Amount>
          {params.repayTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.borrowTHUSD && params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} { symbol }</Amount> and{" "}
        <Amount>
          {params.borrowTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.depositCollateral ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { symbol }</Amount>
      </>
    ) : params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} { symbol }</Amount>
      </>
    ) : params.borrowTHUSD ? (
      <>
        You will receive{" "}
        <Amount>
          {params.borrowTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : (
      <>
        You will pay{" "}
        <Amount>
          {params.repayTHUSD.prettify()} {COIN}
        </Amount>
      </>
    )}
    .
  </ActionDescription>
);

export const selectForVaultChangeValidation = ({
  price,
  total,
  erc20TokenBalance,
  thusdBalance,
  numberOfTroves,
  symbol,
}: ThresholdStoreState) => ({ price, total, erc20TokenBalance, thusdBalance, numberOfTroves, symbol });

type VaultChangeValidationSelectedState = ReturnType<typeof selectForVaultChangeValidation>;

interface VaultChangeValidationContext extends VaultChangeValidationSelectedState {
  originalVault: Vault;
  resultingVault: Vault;
  recoveryMode: boolean;
  wouldTriggerRecoveryMode: boolean;
}

export const validateVaultChange = (
  originalVault: Vault,
  adjustedVault: Vault,
  borrowingRate: Decimal,
  selectedState: VaultChangeValidationSelectedState,
): [
  validChange: Exclude<VaultChange<Decimal>, { type: "invalidCreation" }> | undefined,
  description: JSX.Element | undefined
] => {
  const { total, price, symbol } = selectedState;
  const change = originalVault.whatChanged(adjustedVault, borrowingRate);
  if (!change) {
    return [undefined, undefined];
  }

  // Reapply change to get the exact state the Vault will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const resultingVault = originalVault.apply(change, borrowingRate);
  const recoveryMode = total.collateralRatioIsBelowCritical(price);
  const wouldTriggerRecoveryMode = total
    .subtract(originalVault)
    .add(resultingVault)
    .collateralRatioIsBelowCritical(price);

  const context: VaultChangeValidationContext = {
    ...selectedState,
    originalVault,
    resultingVault,
    recoveryMode,
    wouldTriggerRecoveryMode
  };

  if (change.type === "invalidCreation") {
    // Trying to create a Vault with negative net debt
    return [
      undefined,
      <ErrorDescription>
        Total debt must be at least{" "}
        <Amount>
          {THUSD_MINIMUM_DEBT.toString()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  const errorDescription =
    change.type === "creation"
      ? validateVaultCreation(change.params, context)
      : change.type === "closure"
      ? validateVaultClosure(change.params, context)
      : validateVaultAdjustment(change.params, context);

  if (errorDescription) {
    return [undefined, errorDescription];
  }

  return [change, <VaultChangeDescription params={change.params} symbol={symbol} />];
};

const validateVaultCreation = (
  { depositCollateral, borrowTHUSD }: VaultCreationParams<Decimal>,
  {
    resultingVault,
    recoveryMode,
    wouldTriggerRecoveryMode,
    erc20TokenBalance,
    price,
    symbol
  }: VaultChangeValidationContext
): JSX.Element | null => {
  if (borrowTHUSD.lt(THUSD_MINIMUM_NET_DEBT)) {
    return (
      <ErrorDescription>
        You must borrow at least{" "}
        <Amount>
          {THUSD_MINIMUM_NET_DEBT.toString()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    );
  }

  if (recoveryMode) {
    if (!resultingVault.isOpenableInRecoveryMode(price)) {
      return (
        <ErrorDescription>
          You're not allowed to open a Vault with less than <Amount>{ccrPercent}</Amount> Collateral
          Ratio during recovery mode. Please increase your Vault's Collateral Ratio.
        </ErrorDescription>
      );
    }
  } else {
    if (resultingVault.collateralRatioIsBelowMinimum(price)) {
      return (
        <ErrorDescription>
          Collateral ratio must be at least <Amount>{mcrPercent}</Amount>.
        </ErrorDescription>
      );
    }

    if (wouldTriggerRecoveryMode) {
      return (
        <ErrorDescription>
          You're not allowed to open a Vault that would cause the Total Collateral Ratio to fall
          below <Amount>{ccrPercent}</Amount>. Please increase your Vault's Collateral Ratio.
        </ErrorDescription>
      );
    }
  }

  if (depositCollateral.gt(erc20TokenBalance)) {
    return (
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>{depositCollateral.sub(erc20TokenBalance).prettify()} { symbol }</Amount>.
      </ErrorDescription>
    );
  }

  return null;
};

const validateVaultAdjustment = (
  { depositCollateral, withdrawCollateral, borrowTHUSD, repayTHUSD }: VaultAdjustmentParams<Decimal>,
  {
    originalVault,
    resultingVault,
    recoveryMode,
    wouldTriggerRecoveryMode,
    price,
    erc20TokenBalance,
    thusdBalance
  }: VaultChangeValidationContext
): JSX.Element | null => {
  if (recoveryMode) {
    if (withdrawCollateral) {
      return (
        <ErrorDescription>
          You're not allowed to withdraw collateral during recovery mode.
        </ErrorDescription>
      );
    }

    if (borrowTHUSD) {
      if (resultingVault.collateralRatioIsBelowCritical(price)) {
        return (
          <ErrorDescription>
            Your collateral ratio must be at least <Amount>{ccrPercent}</Amount> to borrow during
            recovery mode. Please improve your collateral ratio.
          </ErrorDescription>
        );
      }

      if (resultingVault.collateralRatio(price).lt(originalVault.collateralRatio(price))) {
        return (
          <ErrorDescription>
            You're not allowed to decrease your collateral ratio during recovery mode.
          </ErrorDescription>
        );
      }
    }
  } else {
    if (resultingVault.collateralRatioIsBelowMinimum(price)) {
      return (
        <ErrorDescription>
          Collateral ratio must be at least <Amount>{mcrPercent}</Amount>.
        </ErrorDescription>
      );
    }

    if (wouldTriggerRecoveryMode) {
      return (
        <ErrorDescription>
          The adjustment you're trying to make would cause the Total Collateral Ratio to fall below{" "}
          <Amount>{ccrPercent}</Amount>. Please increase your Vault's Collateral Ratio.
        </ErrorDescription>
      );
    }
  }

  if (repayTHUSD) {
    if (resultingVault.debt.lt(THUSD_MINIMUM_DEBT)) {
      return (
        <ErrorDescription>
          Total debt must be at least{" "}
          <Amount>
            {THUSD_MINIMUM_DEBT.toString()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      );
    }

    if (repayTHUSD.gt(thusdBalance)) {
      return (
        <ErrorDescription>
          The amount you're trying to repay exceeds your balance by{" "}
          <Amount>
            {repayTHUSD.sub(thusdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      );
    }
  }

  if (depositCollateral?.gt(erc20TokenBalance)) {
    return (
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>{depositCollateral.sub(erc20TokenBalance).prettify()} {}</Amount>.
      </ErrorDescription>
    );
  }

  return null;
};

const validateVaultClosure = (
  { repayTHUSD }: VaultClosureParams<Decimal>,
  {
    recoveryMode,
    wouldTriggerRecoveryMode,
    numberOfTroves,
    thusdBalance
  }: VaultChangeValidationContext
): JSX.Element | null => {
  if (numberOfTroves === 1) {
    return (
      <ErrorDescription>
        You're not allowed to close your Vault when there are no other Vaults in the system.
      </ErrorDescription>
    );
  }

  if (recoveryMode) {
    return (
      <ErrorDescription>
        You're not allowed to close your Vault during recovery mode.
      </ErrorDescription>
    );
  }

  if (repayTHUSD?.gt(thusdBalance)) {
    return (
      <ErrorDescription>
        You need{" "}
        <Amount>
          {repayTHUSD.sub(thusdBalance).prettify()} {COIN}
        </Amount>{" "}
        more to close your Vault.
      </ErrorDescription>
    );
  }

  if (wouldTriggerRecoveryMode) {
    return (
      <ErrorDescription>
        You're not allowed to close a Vault if it would cause the Total Collateralization Ratio to
        fall below <Amount>{ccrPercent}</Amount>. Please wait until the Total Collateral Ratio
        increases.
      </ErrorDescription>
    );
  }

  return null;
};
