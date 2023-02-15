import React from "react";
import { Card, Flex } from "theme-ui";

import {
  Percent,
  Difference,
  Decimalish,
  Decimal,
  Trove as Vault,
  LiquityStoreState,
  THUSD_LIQUIDATION_RESERVE
} from "@liquity/lib-base";
import { useThresholdSelector } from "@liquity/lib-react";

import { COIN } from "../../utils/constants";

import { StaticRow } from "./Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { InfoIcon } from "../InfoIcon";

type VaultEditorProps = {
  children: React.ReactNode;
  version: string,
  original: Vault;
  edited: Vault;
  fee: Decimal;
  borrowingRate: Decimal;
  changePending: boolean;
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

const select = ({ price, symbol }: LiquityStoreState) => ({ price, symbol });

export const VaultEditor = ({
  children,
  version,
  original,
  edited,
  fee,
  borrowingRate,
  changePending,
}: VaultEditorProps): JSX.Element => {
  const { [ version ]: { price, symbol } } = useThresholdSelector(select);

  const feePct = new Percent(borrowingRate);
  const originalCollateralRatio = !original.isEmpty ? original.collateralRatio(price) : undefined;
  const collateralRatio = !edited.isEmpty ? edited.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, originalCollateralRatio);

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
          Opened Vault
          <InfoIcon size="sm" tooltip={<Card variant="tooltip">To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral ({ symbol }) to it.</Card>} />
        </Flex>

        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.7em"],
          mt: 2
        }}>
          <StaticRow
            label="Collateral"
            inputId="vault-collateral"
            amount={edited.collateral.prettify(4)}
            unit={ symbol }
          />
          <StaticRow label="Debt" inputId="vault-debt" amount={edited.debt.prettify()} unit={COIN} />
          {original.isEmpty && (
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
                      liquidated. The amount increases your debt and is refunded if you close your
                      Vault by fully paying off its net debt.
                    </Card>
                  }
                />
              }
            />
          )}
          <StaticRow
            label="Borrowing Fee"
            inputId="vault-borrowing-fee"
            amount={fee.toString(2)}
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
          <CollateralRatio value={collateralRatio} change={collateralRatioChange} />
          {children}
        </Flex>
        {changePending && <LoadingOverlay />}
      </Card>
    </Card>
  );
};
