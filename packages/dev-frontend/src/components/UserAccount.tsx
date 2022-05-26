import React from "react";
import { useWeb3React } from "@web3-react/core";
import { Text, Flex, Box, Image } from "theme-ui";

import { shortenAddress } from "../utils/shortenAddress";
import { injectedConnector } from "../connectors/injectedConnector";

export const UserAccount: React.FC = () => {
  const { activate, deactivate,  active, account } = useWeb3React<unknown>();

  if (active) {
    return (
      <Box
        sx={{ cursor: "pointer" }}
        onClick={() => {
          deactivate();
        }}
      >
        <Flex variant="layout.userAccount">
          <Image src="./icons/metamask.png" sx={{ height: "16px" }} />
          <Flex variant="layout.account">
            <Text as="span" sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>
              {account ?  shortenAddress(account) : 'Connect Wallet'}
            </Text>
          </Flex>
        </Flex>
      </Box>
    );
  } else {
    return (
      <Box
        sx={{ cursor: "pointer" }}
        onClick={() => {
          activate(injectedConnector);
        }}
      >
        <Flex variant="layout.userAccount">
          <Image src="./icons/metamask.png" sx={{ height: "16px" }} />
          <Flex variant="layout.account">
            <Text as="span" sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>
              Connect Wallet
            </Text>
          </Flex>
        </Flex>
      </Box>
    )}
};
