import React from "react";
import { Box, Card, Container, Heading, Link, Paragraph } from "theme-ui";
//import { SystemStatsCard } from "../components/SystemStatsCard";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoMessage } from "../components/InfoMessage";
import { Vault } from "../components/Trove/Vault";
import { COIN, FIRST_ERC20_COLLATERAL } from "../strings";

const select = ({
  mintList
}: LiquityStoreState) => ({
  mintList
});

export const VaultPage: React.FC = () => {
  const {
    mintList
  } = useLiquitySelector(select);

  const mintListContracts = [];
  for (const contract in mintList) {
    mintListContracts.push(<Vault key={contract} contract={mintList[contract]} contractName={contract} />)
  }

  return (
    <Container variant="singlePage">
      <Heading as="h2" sx={{ ml: "1em", mt: "2.5em", fontWeight: "semibold" }}>
        Open a Vault
      </Heading>
      <Card sx={{ mr: [0, "2em"] }}>
        <Box sx={{ px: "2.5em", py: "1.5em" }}>
          <InfoMessage title="About this functionality">
            <Paragraph sx={{ mb: "0.5em" }}>
              To borrow you must open a Vault and deposit a certain amount of collateral ({ FIRST_ERC20_COLLATERAL }) to it. Then you can draw { COIN } up to a collateral ratio of 120%. A minimum debt of 2,000 { COIN } is required.
            </Paragraph>
            <Link variant="infoLink" href="https://github.com/Threshold-USD/dev" target="_blank">
              Read more
            </Link>
          </InfoMessage>
        </Box>
      </Card>
      <Container variant="vaultCard">
        {mintListContracts}
      </Container>
    </Container>
  );
};
