import { useState } from "react";
import { Card, Flex, Button, Link, Input, ThemeUICSSProperties } from "theme-ui";
import { StaticAmounts, Row } from "./Vault/Editor";
import { useThreshold } from "../hooks/ThresholdContext";
import { Transaction } from "./Transaction";
import { InfoIcon } from "./InfoIcon";
import { LiquityStoreState as ThresholdStoreState} from "@liquity/lib-base";
import { useThresholdSelector } from "@liquity/lib-react";

const editableStyle: ThemeUICSSProperties = {
  backgroundColor: "terciary",
  px: "1.1em",
  py: "0.45em",
  border: 1,
  borderColor: "border",
  borderRadius: 12,
  width: "100%",
  flexGrow: 1,
  mb: [2, 3],
  pl: 3,
  fontSize: 3,
};

type LiquidationManagerProps = {
  version: string
  isMintList: boolean
}

const selector = ({ symbol }: ThresholdStoreState) => ({
  symbol
});

export const LiquidationManager = ({ version, isMintList }: LiquidationManagerProps): JSX.Element => {
  const inputId: string = "liquidate-vaults";
  const { threshold } = useThreshold();
  const { [version]: { symbol } } = useThresholdSelector(selector);
  const [numberOfTrovesToLiquidate, setNumberOfVaultsToLiquidate] = useState("90");
  const [editing, setEditing] = useState<string>();

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
            Liquidate
            <InfoIcon size="sm" tooltip={<Card variant="tooltip">Vaults that fall under the minimum collateral ratio of 110% will be closed (liquidated). The debt of the Vault is canceled and absorbed by the Stability Pool and its collateral distributed among Stability Providers.</Card>} />
          </Flex>
          {symbol} Collateral
        </Flex>
        <Flex sx={{
          width: "100%",
          flexDirection: "column",
          flexWrap: "wrap",
          px: ["1em", 0, "1.6em"],
          gap: "0.5em"
        }}>
          {editing === inputId ? (
            <>
              <Row labelId={`${inputId}-label`} {...{ label: "Up to", unit: "Vaults" }} />
              <Input
                type="number"
                min="1"
                step="1"
                value={numberOfTrovesToLiquidate}
                onChange={e => setNumberOfVaultsToLiquidate(e.target.value)}
                onBlur={() => {
                  setEditing(undefined);
                }}
                variant="layout.balanceRow"
                sx={{
                  ...editableStyle,
                  fontWeight: "medium"
                }} 
              />
            </>) 
          : (
            <>
              <Row labelId={`${inputId}-label`} {...{ label: "Up to", unit: "Vaults" }} />
              <StaticAmounts
                sx={{
                  ...editableStyle,
                }}
                labelledBy={`${inputId}-label`}
                onClick={() => setEditing(inputId)}
                {...{ inputId, amount: numberOfTrovesToLiquidate, unit: "Vaults" }}
              />
            </>
          )}
          <Flex sx={{ ml: 2, alignItems: "center" }}>
            <Transaction
              id="batch-liquidate"
              send={overrides => {
                if (!numberOfTrovesToLiquidate) {
                  throw new Error("Invalid number");
                }
                return threshold[version].send.liquidateUpTo(parseInt(numberOfTrovesToLiquidate, 10), overrides);
              }}
              version={version}
            >
              <Button sx={{ width: "100%" }}>Liquidate</Button>
            </Transaction>
          </Flex>
          <Flex sx={{ 
            alignSelf: "center",
            fontSize: 11,
            fontWeight: "body",
            justifyContent: "space-between",
            width: "100%",
            px: "1em",
            mt: 2
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
