import React, { useCallback } from "react";
import { Box, Button, Card, Flex, Link, useColorMode } from "theme-ui";
import { useTroveView } from "./context/TroveViewContext";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, FIRST_ERC20_COLLATERAL } from "../../strings";
import { ActionDescription } from "../ActionDescription";
import { GenericIcon } from "../GenericIcon";
import { InfoIcon } from "../InfoIcon";

const select = ({ erc20TokenBalance }: LiquityStoreState) => ({
  erc20TokenBalance
});

export const NoTrove: React.FC = props => {
  const [colorMode] = useColorMode();
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  const { erc20TokenBalance } = useLiquitySelector(select);

  return (
    <Card variant="mainCards">
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: "1em",
          borderBottom: 1, 
          borderColor: "border"
        }}>
          Open a Vault
          <InfoIcon size="sm" tooltip={<Card variant="tooltip">To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral { FIRST_ERC20_COLLATERAL } to it.</Card>} />
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.6em"],
          gap: "1em"
        }}>
          <ActionDescription title={`You haven't borrowed ${COIN} any yet`}>
            You can borrow { COIN } by opening a vault.
          </ActionDescription>
          { FIRST_ERC20_COLLATERAL } available 
          <Flex variant="layout.balanceRow">
            <GenericIcon imgSrc={colorMode === "darkGrey" ? "./icons/darkgrey-threshold-icon.svg" : "./icons/threshold-icon.svg"} height={"18px"} />
            <Box sx={{ fontSize: 3 }}>
              {!erc20TokenBalance.eq(0) ? erc20TokenBalance.prettify() : '--'}
            </Box>
            <Box sx={{ fontSize: 14, pt: 1 }}>
              { FIRST_ERC20_COLLATERAL }
            </Box>
          </Flex>
          <Button onClick={handleOpenTrove} sx={{ mt: 2, width: "100%" }}>Open a Vault</Button>
          <Flex sx={{ 
            alignSelf: "center",
            fontSize: 11,
            fontWeight: "body",
          }}>
            <Link variant="cardLinks" href="https://github.com/Threshold-USD/dev#readme" target="_blank">Read about</Link>
            in the documentation
          </Flex>
        </Flex>
      </Card>
    </Card>
  );
};
