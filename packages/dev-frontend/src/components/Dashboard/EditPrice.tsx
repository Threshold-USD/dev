import { Decimal, LiquityStoreState as ThresholdStoreState } from "@liquity/lib-base";
import { useThresholdSelector } from "@liquity/lib-react";
import { useState } from "react";
import { Button, Flex, Input, ThemeUICSSProperties } from "theme-ui";
import { useThreshold } from "../../hooks/ThresholdContext";
import { SystemStat } from "../SystemStat";
import { Transaction } from "../Transaction";

const editableStyle: ThemeUICSSProperties = {
  bg: "white",
  px: "1.1em",
  py: "0.3em",
  border: 1,
  borderColor: "border",
  borderRadius: 8,
  flexGrow: 1,
  pl: 2,
  boxShadow: 0
};

type EditPriceProps = {
  version: string
}

const selector = ({
  price,
  symbol,
}: ThresholdStoreState) => ({
  price,
  symbol,
});

export const EditPrice = ({ version }: EditPriceProps): JSX.Element => {
  const thresholdSelector = useThresholdSelector(selector)
  const { price, symbol } = thresholdSelector[version]
  const { threshold } = useThreshold();
  const canSetPrice = threshold.v1.connection._priceFeedIsTestnet
  const [editedPrice, setEditedPrice] = useState(price.toString(2))

  return (
    <Flex sx={{ flexDirection: "column", gap: "1rem"}}>
      <Flex sx={{
        width: "100%",
        gap: 1,
        pt: "1.5rem",
        pb: 2,
        borderBottom: 1,
        borderColor: "border"
      }}>
        { symbol } Price
      </Flex>
      <SystemStat>
        {canSetPrice ? (
          <Flex sx={{ mb:1, alignItems: "center", height: "1.2em", }}>
            <Input
              variant="layout.balanceRow"
              sx={{
              ...editableStyle,
              color: "inputText"
              }}
              type="number"
              step="any"
              value={editedPrice}
              onChange={e => setEditedPrice(e.target.value)}
            />
            <Transaction
              id="set-price"
              tooltip="Set the collateral price in the testnet"
              tooltipPlacement="bottom"
              send={overrides => {
                if (!editedPrice) {
                  throw new Error("Invalid price");
                }
                return threshold[version].send.setPrice(Decimal.from(editedPrice), overrides);
              }}
              version={version}
            >
              <Button sx={{
                ml: 1,
                mr: 2,
                width: "0.5rem",
                height: "1rem",
                borderRadius: 6,
                top: 0
              }}>
                Set
              </Button>
            </Transaction>
          </Flex>
        ) : (
          thresholdSelector[version].price.toString(2)
        )}
      </SystemStat>
    </Flex>
  );
};
