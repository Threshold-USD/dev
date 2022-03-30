import React from "react";
import { Text, Flex, Box, Image } from "theme-ui";

import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";

export const UserAccount: React.FC = () => {
  const { account } = useLiquity();

  return (
    <Box>
      <Flex variant="layout.userAccount">
        <Image src="./icons/metamask.png" sx={{ height: "16px" }} />
        <Flex variant="layout.account">
          <Text as="span" sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>
            {shortenAddress(account)}
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
};
