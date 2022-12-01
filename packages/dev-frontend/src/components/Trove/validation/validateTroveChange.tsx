import {
  CollateralContract,
  Decimal,
  THUSD_MINIMUM_DEBT,
  THUSD_MINIMUM_NET_DEBT,
  Trove,
  TroveAdjustmentParams,
  TroveChange,
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  LiquityStoreState,
  TroveClosureParams,
  TroveCreationParams
} from "@liquity/lib-base";

import { COIN, FIRST_ERC20_COLLATERAL } from "../../../strings";

import { ActionDescription, Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

type TroveAdjustmentDescriptionParams = {
  contract: CollateralContract;
  params: TroveAdjustmentParams<Decimal>;
};

const TroveChangeDescription: React.FC<TroveAdjustmentDescriptionParams> = ({ contract, params }) => (
  <ActionDescription>
    {params.depositCollateral && params.borrowTHUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount> and receive{" "}
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
        and receive <Amount>{params.withdrawCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount>
      </>
    ) : params.depositCollateral && params.repayTHUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount> and pay{" "}
        <Amount>
          {params.repayTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.borrowTHUSD && params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount> and{" "}
        <Amount>
          {params.borrowTHUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.depositCollateral ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount>
      </>
    ) : params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} { FIRST_ERC20_COLLATERAL }</Amount>
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

export const selectForTroveChangeValidation = ({
  price,
  total,
  erc20TokenBalance,
  thusdBalance,
  numberOfTroves
}: LiquityStoreState) => ({ price, total, erc20TokenBalance, thusdBalance, numberOfTroves });

type TroveChangeValidationSelectedState = ReturnType<typeof selectForTroveChangeValidation>;

interface TroveChangeValidationContext extends TroveChangeValidationSelectedState {
  originalTrove: Trove;
  resultingTrove: Trove;
  recoveryMode: boolean;
  wouldTriggerRecoveryMode: boolean;
}

export const validateTroveChange = (
  contract: CollateralContract,
  originalTrove: Trove,
  adjustedTrove: Trove,
  borrowingRate: Decimal,
  selectedState: TroveChangeValidationSelectedState
): [
  validChange: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }> | undefined,
  description: JSX.Element | undefined
] => {
  const { total, price } = selectedState;
  const change = originalTrove.whatChanged(adjustedTrove, borrowingRate);
  if (!change) {
    return [undefined, undefined];
  }

  // Reapply change to get the exact state the Trove will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const resultingTrove = originalTrove.apply(contract.name, change, borrowingRate);
  const recoveryMode = total.collateralRatioIsBelowCritical(price);
  const wouldTriggerRecoveryMode = total
    .subtract(originalTrove)
    .add(resultingTrove)
    .collateralRatioIsBelowCritical(price);

  const context: TroveChangeValidationContext = {
    ...selectedState,
    originalTrove,
    resultingTrove,
    recoveryMode,
    wouldTriggerRecoveryMode
  };

  if (change.type === "invalidCreation") {
    // Trying to create a Trove with negative net debt
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
      ? validateTroveCreation(change.params, context)
      : change.type === "closure"
      ? validateTroveClosure(change.params, context)
      : validateTroveAdjustment(change.params, context);

  if (errorDescription) {
    return [undefined, errorDescription];
  }

  return [change, <TroveChangeDescription contract={contract} params={change.params} />];
};

const validateTroveCreation = (
  { depositCollateral, borrowTHUSD }: TroveCreationParams<Decimal>,
  {
    resultingTrove,
    recoveryMode,
    wouldTriggerRecoveryMode,
    erc20TokenBalance,
    price
  }: TroveChangeValidationContext
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
    if (!resultingTrove.isOpenableInRecoveryMode(price)) {
      return (
        <ErrorDescription>
          You're not allowed to open a Trove with less than <Amount>{ccrPercent}</Amount> Collateral
          Ratio during recovery mode. Please increase your Trove's Collateral Ratio.
        </ErrorDescription>
      );
    }
  } else {
    if (resultingTrove.collateralRatioIsBelowMinimum(price)) {
      return (
        <ErrorDescription>
          Collateral ratio must be at least <Amount>{mcrPercent}</Amount>.
        </ErrorDescription>
      );
    }

    if (wouldTriggerRecoveryMode) {
      return (
        <ErrorDescription>
          You're not allowed to open a Trove that would cause the Total Collateral Ratio to fall
          below <Amount>{ccrPercent}</Amount>. Please increase your Trove's Collateral Ratio.
        </ErrorDescription>
      );
    }
  }

  if (depositCollateral.gt(erc20TokenBalance)) {
    return (
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>{depositCollateral.sub(erc20TokenBalance).prettify()} { FIRST_ERC20_COLLATERAL }</Amount>.
      </ErrorDescription>
    );
  }

  return null;
};

const validateTroveAdjustment = (
  { depositCollateral, withdrawCollateral, borrowTHUSD, repayTHUSD }: TroveAdjustmentParams<Decimal>,
  {
    originalTrove,
    resultingTrove,
    recoveryMode,
    wouldTriggerRecoveryMode,
    price,
    erc20TokenBalance,
    thusdBalance
  }: TroveChangeValidationContext
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
      if (resultingTrove.collateralRatioIsBelowCritical(price)) {
        return (
          <ErrorDescription>
            Your collateral ratio must be at least <Amount>{ccrPercent}</Amount> to borrow during
            recovery mode. Please improve your collateral ratio.
          </ErrorDescription>
        );
      }

      if (resultingTrove.collateralRatio(price).lt(originalTrove.collateralRatio(price))) {
        return (
          <ErrorDescription>
            You're not allowed to decrease your collateral ratio during recovery mode.
          </ErrorDescription>
        );
      }
    }
  } else {
    if (resultingTrove.collateralRatioIsBelowMinimum(price)) {
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
          <Amount>{ccrPercent}</Amount>. Please increase your Trove's Collateral Ratio.
        </ErrorDescription>
      );
    }
  }

  if (repayTHUSD) {
    if (resultingTrove.debt.lt(THUSD_MINIMUM_DEBT)) {
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

const validateTroveClosure = (
  { repayTHUSD }: TroveClosureParams<Decimal>,
  {
    recoveryMode,
    wouldTriggerRecoveryMode,
    numberOfTroves,
    thusdBalance
  }: TroveChangeValidationContext
): JSX.Element | null => {
  if (numberOfTroves === 1) {
    return (
      <ErrorDescription>
        You're not allowed to close your Trove when there are no other Troves in the system.
      </ErrorDescription>
    );
  }

  if (recoveryMode) {
    return (
      <ErrorDescription>
        You're not allowed to close your Trove during recovery mode.
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
        more to close your Trove.
      </ErrorDescription>
    );
  }

  if (wouldTriggerRecoveryMode) {
    return (
      <ErrorDescription>
        You're not allowed to close a Trove if it would cause the Total Collateralization Ratio to
        fall below <Amount>{ccrPercent}</Amount>. Please wait until the Total Collateral Ratio
        increases.
      </ErrorDescription>
    );
  }

  return null;
};
