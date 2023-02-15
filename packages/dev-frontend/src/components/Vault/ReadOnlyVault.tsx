import { useCallback } from "react";
import { Card, Box, Flex, Button, Link } from "theme-ui";
import { useThresholdSelector} from "@liquity/lib-react";
import { LiquityStoreState as ThresholdStoreState} from "@liquity/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useVaultView } from "./context/VaultViewContext";
import { Icon } from "../Icon";
import { InfoIcon } from "../InfoIcon";
import { COIN } from "../../utils/constants";
import { CollateralRatio } from "./CollateralRatio";

const select = ({ trove, price, symbol }: ThresholdStoreState) => ({ trove, price, symbol });

type ReadOnlyVaultProps = {
version: string
}

export const ReadOnlyVault = ({ version }: ReadOnlyVaultProps): JSX.Element => {
  const { dispatchEvent } = useVaultView();
  const handleAdjustVault = useCallback(() => {
    dispatchEvent("ADJUST_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);
  const handleCloseVault = useCallback(() => {
    dispatchEvent("CLOSE_VAULT_PRESSED", version);
  }, [dispatchEvent, version]);

  const { [version]: { trove, price, symbol } } = useThresholdSelector(select);

  return (
    <Card variant="mainCards">
      <Card variant="layout.columns">
        <Flex sx={{
          width: "100%",
          gap: 1,
          pb: "1em",
          px: ["2em", 0],
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
          pb: "1em",
          mt: 2
        }}>
          <Box>
            <DisabledEditableRow
              label="Collateral"
              inputId="vault-collateral"
              amount={trove.collateral.prettify(4)}
              unit={ symbol }
            />

            <DisabledEditableRow
              label="Debt"
              inputId="vault-debt"
              amount={trove.debt.prettify()}
              unit={ COIN }
            />

            <CollateralRatio value={trove.collateralRatio(price)} sx={{ mt: -3 }} />
          </Box>
          <Flex variant="layout.actions" sx={{ flexDirection: "column" }}>
            <Button onClick={handleAdjustVault}>
              <Icon name="pen" size="sm" />
              &nbsp;Adjust
            </Button>
            <Button variant="outline" onClick={handleCloseVault} sx={{ borderRadius: "12px", mt: 3 }}>
              Close Vault
            </Button>
          </Flex>
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
