import React from "react";
import { Container, Card, Box, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskyVaults } from "../components/RiskyVaults";
import { InfoMessage } from "../components/InfoMessage";

export const RiskyVaultsPage: React.FC = () => (
  <Container variant="pageRow">
    <Container variant="firstHalf">
      <Card>
        <Box sx={{ p: [2, 3] }}>
          <InfoMessage title="Bot functionality">
            <Paragraph>Liquidation is expected to be carried out by bots.</Paragraph>
            <Paragraph>
              Early on you may be able to manually liquidate Troves, but as the system matures this
              will become less likely.
            </Paragraph>
          </InfoMessage>
        </Box>
      </Card>
      <LiquidationManager />
    </Container>
    <Container variant="secondHalf">
      <SystemStats />
    </Container>
    <RiskyVaults pageSize={10} />
  </Container>
);
