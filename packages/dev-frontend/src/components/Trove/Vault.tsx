import React from "react";
import { Flex } from "theme-ui";
import { TroveManager } from "./TroveManager";
import { ReadOnlyTrove } from "./ReadOnlyTrove";
import { NoTrove } from "./NoTrove";
import { Opening } from "./Opening";
import { Adjusting } from "./Adjusting";
import { RedeemedTrove } from "./RedeemedTrove";
import { useTroveView } from "./context/TroveViewContext";
import { LiquidatedTrove } from "./LiquidatedTrove";
import { Decimal, CollateralContract } from "@liquity/lib-base";

export type VaultProps = {
  key: any;
  contract: CollateralContract;
  contractName: string;
}

export const Vault: React.FC<VaultProps> = (props) => {
  const { view, contract } = useTroveView();

  const getTroveView = () => {
    // loading state not needed, as main app has a loading spinner that blocks render until the liquity backend data is available
    if (view === "ACTIVE" && contract === props.contract) {
      return <ReadOnlyTrove {...props} />;
    }
    else if (view === "ADJUSTING" && contract === props.contract) {
      return <Adjusting {...props} />;
    }
    else if  (view === "CLOSING" && contract === props.contract) {
      return <TroveManager {...props} contract={props.contract} collateral={Decimal.ZERO} debt={Decimal.ZERO} />;
    }
    else if  (view === "OPENING" && contract === props.contract) {
      return <Opening {...props} />;
    }
    else if  (view === "LIQUIDATED" && contract === props.contract) {
      return <LiquidatedTrove {...props} />;
    }
    else if  (view === "REDEEMED" && contract === props.contract) {
      return <RedeemedTrove {...props} />;
    }

    return <NoTrove {...props} />;

  }

  return <Flex sx={{ width: "50%", pr: "2em" }}>{getTroveView()}</Flex>
};
