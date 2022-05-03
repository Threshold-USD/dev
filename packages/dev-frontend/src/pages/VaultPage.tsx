import React from "react";
import { Box, Card, Container, Heading, Link, Paragraph } from "theme-ui";
import { SystemStatsCard } from "../components/SystemStatsCard";
import { InfoMessage } from "../components/InfoMessage";
import { Vault } from "../components/Trove/Vault";

export const VaultPage: React.FC = () => {
  return (
    <Container variant="singlePage">
      <Heading as="h2" sx={{ ml: "1em", mt: "2.5em", fontWeight: "semibold" }}>
        Open a Vault
      </Heading>
      <Card sx={{ mr: "2em" }}>
        <Box sx={{ px: "2.5em", py: "1.5em" }}>
          <InfoMessage title="About this functionality">
            <Paragraph sx={{ mb: "0.5em" }}>
              To borrow you must open a Vault and deposit a certain amount of collateral (tBTC) to it. Then you can draw thUSD up to a collateral ratio of 120%. A minimum debt of 2,000 thUSD is required.
            </Paragraph>
            <Link variant="infoLink" href="https://github.com/Threshold-USD/dev" target="_blank">
              Read more
            </Link>
          </InfoMessage>
        </Box>
      </Card>
      <Container variant="pageRow">
        <Container variant="firstHalf">
          <Vault />
        </Container>
        <Container variant="secondHalf">
          <SystemStatsCard />
        </Container>
      </Container>
    </Container>
  );
};
