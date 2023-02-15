import { useCallback } from "react";
import { Box, Button, Card, Flex, Link } from "theme-ui";
import { useVaultView } from "./context/VaultViewContext";

import { LiquityStoreState as ThresholdStoreState} from "@liquity/lib-base";
import { useThresholdSelector} from "@liquity/lib-react";

import { COIN } from "../../utils/constants";
import { ActionDescription } from "../ActionDescription";
import { GenericIcon } from "../GenericIcon";
import { InfoIcon } from "../InfoIcon";

const select = ({ erc20TokenBalance, symbol }: ThresholdStoreState) => ({
  erc20TokenBalance, symbol
});

type NoVaultProps = {
  version: string
  isMintList: boolean
}

export const NoVault = ({ version, isMintList }: NoVaultProps): JSX.Element => {
  const { dispatchEvent } = useVaultView();
  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);
  const { [version]: { erc20TokenBalance, symbol } } = useThresholdSelector(select);

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
            <InfoIcon size="sm" tooltip={<Card variant="tooltip">
              To mint and borrow { COIN } you must open a vault and deposit a certain amount of collateral { symbol } to it.
              </Card>} />
          </Flex>
            {symbol} Collateral
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.6em"],
          pb: "1em",
          gap: "1em"
        }}>
          <ActionDescription title={`You haven't borrowed any ${ COIN } yet`}>
            {isMintList === true && (
              `You can borrow ${ COIN } by opening a vault.`
            )}
          </ActionDescription>
          { symbol } available
          <Flex variant="layout.balanceRow">
            <GenericIcon imgSrc="./icons/threshold-icon.svg" height={"18px"} />
            <Box sx={{ fontSize: 3 }}>
              {!erc20TokenBalance.eq(0) ? erc20TokenBalance.prettify() : '--'}
            </Box>
            <Box sx={{ fontSize: 14, pt: 1 }}>
              { symbol }
            </Box>
          </Flex>
          {
            isMintList === false
            ? <Button sx={{ mt: 2, width: "100%" }} disabled={ true }>Open a Vault</Button>
            : <Button onClick={handleOpenVault} sx={{ mt: 2, width: "100%" }}>Open a Vault</Button>
          }
          <Flex sx={{ 
            alignSelf: "center",
            fontSize: 11,
            fontWeight: "body",
            justifyContent: "space-between",
            width: "100%",
            px: "1em",
            pt: "1em",
          }}>
            <Flex>
              <Link variant="cardLinks" href="https://github.com/Threshold-USD/dev#readme" target="_blank">Read about</Link>
              in the documentation
            </Flex>
            <Flex>Deployment version: {version}</Flex>
          </Flex>
        </Flex>
      </Card>
    </Card>
  );
};
