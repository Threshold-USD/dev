import { Container, Heading } from "theme-ui";

import { BorrowingFee } from "../components/Dashboard/BorrowingFee";
import { OpenedVaults } from "../components/Dashboard/OpenedVaults";
import { ColRatio } from "../components/Dashboard/ColRatio";
import { OpenVaultCard } from "../components/Dashboard/OpenVaultCard";
import { StabilityPoolCard } from "../components/Dashboard/StabilityPoolCard";
import { SystemStatsCard } from "../components/SystemStatsCard";

export const Dashboard: React.FC = () => (
  <Container>
    <Heading as="h2" sx={{ mt: "2.5em", fontWeight: "semibold" }}>
      Dashboard
    </Heading>
    <Container variant="mainRow">
      <Container variant="left">
        <BorrowingFee />
        <OpenVaultCard />
      </Container>
      <Container variant="middle">
        <OpenedVaults />
        <StabilityPoolCard />
      </Container>
      <Container variant="right">
        <ColRatio />
        <SystemStatsCard />
      </Container>
    </Container>
  </Container>
);
