import React from "react";
import { Box, Card, Flex } from "theme-ui";
import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLocation } from 'react-router-dom';

import { SystemStat } from "./SystemStat";

type SystemStatsCardProps = {
  variant?: string;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate
});

export const SystemStatsCard: React.FC<SystemStatsCardProps> = ({ variant = "info" }) => {
  
  const location = useLocation();

  const {
    numberOfTroves,
    price,
    total,
    borrowingRate,
    lusdInStabilityPool
  } = useLiquitySelector(select);

  const borrowingFeePct = new Percent(borrowingRate);

  return (
    <Card {...{ variant }}>
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: 3,
          borderBottom: 1, 
          borderColor: "border"
        }}>
          Network Stats
        </Flex>
        <Flex sx={{
          width: "100%",
          fontSize: "0.9em",
          flexDirection: "column",
          color: "text",
          pt: "2em",
          gap: "1em"
        }}>
          {location.pathname !== '/' && (
            <>
              <SystemStat 
                info="Borrowing Fee" 
                tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount, and is part of a Vault's debt." 
              >
                {borrowingFeePct.toString(2)}
              </SystemStat>
              <SystemStat 
                info="Vaults" 
                tooltip="The total number of active Vaults in the system." 
              >
                 {Decimal.from(numberOfTroves).prettify(0)}
              </SystemStat>
            </>
          )}
          <SystemStat 
            info="TVL" 
            tooltip="The Total Value Locked (TVL) is the total value of Ether locked as collateral in the system, given in ETH and USD." 
          >
            {total.collateral.shorten()} ETH
          </SystemStat>
          <SystemStat 
            info="LUSD in Stability Pool" 
            tooltip="The total LUSD currently held in the Stability Pool, expressed as an amount and a fraction of the LUSD supply." 
          >
            {lusdInStabilityPool.shorten()}
          </SystemStat>
          <SystemStat 
            info="LUSD Supply" 
            tooltip="The total LUSD minted by the Liquity Protocol." 
          >
            {total.debt.shorten()}
          </SystemStat>
          <SystemStat 
            info="Recovery Mode" 
            tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Trove can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Trove's debt. Operations are also restricted that would negatively impact the TCR." 
          >
            {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
          </SystemStat>
        </Flex>
        <Flex sx={{
          width: "100%",
          gap: 1,
          pt: 4,
          pb: 2,
          borderBottom: 1, 
          borderColor: "border"
        }}>
          ETH Price
        </Flex>
        <Flex sx={{
          width: "100%",
          fontSize: "0.9em",
          pt: 14,
          pb: 3
        }}>
          <SystemStat>
            ${price.toString(2)}
          </SystemStat>
        </Flex>
      </Card>
    </Card>
  );
};
