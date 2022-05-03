import React from "react";
import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";

export const StabilityPoolPage: React.FC = () => {
  return (
    <Container variant="pageRow">
      <Container variant="firstHalf" />
      <Container variant="secondHalf">
        <SystemStats />
      </Container>
    </Container>
  );
};
