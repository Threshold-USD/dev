import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Stability Pool
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no LUSD in the Stability Pool.">
          You can earn ETH by depositing LUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
