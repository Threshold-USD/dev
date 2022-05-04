import React, { useCallback } from "react";
import { Card, Button, Flex, Link } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useTroveView } from "./context/TroveViewContext";
import { InfoMessage } from "../InfoMessage";

const select = ({ collateralSurplusBalance }: LiquityStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

export const RedeemedTrove: React.FC = () => {
  const { hasSurplusCollateral } = useLiquitySelector(select);
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

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
            Redeemed Vault
          </Flex>
          <Flex sx={{
            width: "100%",
            flexDirection: "column",
            px: ["1em", 0, "1.7em"],
            mt: 4
          }}>
          <InfoMessage title="Your Trove has been redeemed.">
            {hasSurplusCollateral
              ? "Please reclaim your remaining collateral before opening a new Trove."
              : "You can borrow LUSD by opening a Trove."}
          </InfoMessage>

          <Flex variant="layout.actions">
            {hasSurplusCollateral && <CollateralSurplusAction />}
            {!hasSurplusCollateral && <Button onClick={handleOpenTrove} sx={{ width: "100%" }}>Open Trove</Button>}
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
      </Card>
    </Card>
  );
};
