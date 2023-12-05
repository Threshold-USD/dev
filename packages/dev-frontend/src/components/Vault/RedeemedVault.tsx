import { useCallback } from "react";
import { Card, Button, Flex, Link } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { LiquityStoreState as ThresholdStoreState} from "@threshold-usd/lib-base";
import { useThresholdSelector} from "@threshold-usd/lib-react";
import { useVaultView } from "./context/VaultViewContext";
import { COIN } from "../../utils/constants";
import { InfoMessage } from "../InfoMessage";

const select = ({ collateralSurplusBalance, symbol }: ThresholdStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero,
  symbol
});

type RedeemedVaultProps = {
  version: string;
  collateral: string;
  isMintList: boolean;
}

export const RedeemedVault = (props: RedeemedVaultProps): JSX.Element => {
  const { version, collateral } = props;
  const thresholdSelectorStores = useThresholdSelector(select);
  const thresholdStore = thresholdSelectorStores.find((store) => {
    return store.version === version && store.collateral === collateral;
  });
  const store = thresholdStore?.store!;
  const hasSurplusCollateral = store.hasSurplusCollateral;
  const symbol = store.symbol;
  const { dispatchEvent } = useVaultView();

  const handleOpenVault = useCallback(() => {
    dispatchEvent("OPEN_VAULT_PRESSED", version, collateral);
  }, [dispatchEvent, version, collateral]);

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
            Redeemed
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
            <InfoMessage title="Your Vault has been redeemed.">
              {hasSurplusCollateral
                ? "Please reclaim your remaining collateral before opening a new Vault."
                : `You can borrow ${ COIN } by opening a Vault.`}
            </InfoMessage>
            <Flex variant="layout.actions">
              {hasSurplusCollateral && <CollateralSurplusAction version={version} collateral={collateral} />}
              {!hasSurplusCollateral && <Button onClick={handleOpenVault} sx={{ width: "100%" }}>Open Vault</Button>}
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
                <Link variant="cardLinks" href="https://docs.threshold.network/fundamentals/threshold-usd" target="_blank">Read about</Link>
                in the documentation
              </Flex>
              <Flex>Deployment version: {version}</Flex>
            </Flex>
        </Flex>
      </Card>
    </Card>
  );
};
