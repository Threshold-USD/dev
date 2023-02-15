import { useCallback } from "react";
import { Card, Button, Flex, Link } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { LiquityStoreState as ThresholdStoreState} from "@liquity/lib-base";
import { useThresholdSelector} from "@liquity/lib-react";
import { useVaultView } from "./context/VaultViewContext";
import { COIN } from "../../utils/constants";
import { InfoMessage } from "../InfoMessage";

const select = ({ collateralSurplusBalance, symbol }: ThresholdStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero,
  symbol
});

type LiquidatedVaultProps = {
  version: string
  isMintList: boolean
}

export const LiquidatedVault = ({ version, isMintList }: LiquidatedVaultProps): JSX.Element => {
  const { [version]: { hasSurplusCollateral, symbol } } = useThresholdSelector(select);
  const { dispatchEvent } = useVaultView();

  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);

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
            Liquidated Vault
          </Flex>
          {symbol} Collateral
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          px: ["1em", 0, "1.7em"],
          pb: "1em",
          mt: 4
        }}>
          <InfoMessage title="Your Vault has been liquidated.">
            {hasSurplusCollateral
              ? "Please reclaim your remaining collateral before opening a new Vault."
              : isMintList === true && (
                `You can borrow ${ COIN } by opening a vault.`
              )}
          </InfoMessage>
          <Flex variant="layout.actions">
            {hasSurplusCollateral && <CollateralSurplusAction version={version} />}
            {!hasSurplusCollateral && 
            isMintList === false 
            ? <Button sx={{ mt: 2, width: "100%" }} disabled={ true }>Open a Vault</Button>
            : <Button onClick={handleOpenVault} sx={{ width: "100%" }}>Open Vault</Button>}
          </Flex>
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
      </Card>
    </Card>
  );
};
