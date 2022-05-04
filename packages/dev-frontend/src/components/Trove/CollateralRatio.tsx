import React from "react";
import { Flex, Card, SxProp } from "theme-ui";

import { CRITICAL_COLLATERAL_RATIO, Decimal, Difference, Percent } from "@liquity/lib-base";

import { StaticRow } from "./Editor";
import { InfoIcon } from "../InfoIcon";
import { ActionDescription } from "../ActionDescription";

type CollateralRatioProps = SxProp & {
  value?: Decimal;
  change?: Difference;
};

export const CollateralRatio: React.FC<CollateralRatioProps> = ({ value, change, sx }) => {
  const collateralRatioPct = new Percent(value ?? { toString: () => "N/A" });
  const changePct = change && new Percent(change);
  return (
    <>
      <Flex sx={{ ...sx }}>
        <StaticRow
          label="Collateral ratio"
          inputId="trove-collateral-ratio"
          amount={collateralRatioPct.prettify()}
          color={
            value?.gt(CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : value?.gt(1.2)
              ? "warning"
              : value?.lte(1.2)
              ? "danger"
              : "muted"
          }
          pendingAmount={
            change?.positive?.absoluteValue?.gt(10)
              ? "++"
              : change?.negative?.absoluteValue?.gt(10)
              ? "--"
              : changePct?.nonZeroish(2)?.prettify()
          }
          pendingColor={change?.positive ? "success" : "danger"}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "220px" }}>
                  The ratio between the dollar value of the collateral and the debt (in LUSD) you are
                  depositing. While the Minimum Collateral Ratio is 110% during normal operation, it
                  is recommended to keep the Collateral Ratio always above 150% to avoid liquidation
                  under Recovery Mode. A Collateral Ratio above 200% or 250% is recommended for
                  additional safety.
                </Card>
              }
            />
          }
        />
      </Flex>
      {value?.lt(1.5) && (
        <Flex sx={{ my: "2.5em", mb: "1em" }}>
          <ActionDescription>
            Keeping your CR above 150% can help avoid liquidation under Recovery Mode.
          </ActionDescription>
        </Flex>
      )}
    </>
  );
};
