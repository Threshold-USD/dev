import React, { useEffect, useReducer } from "react";
import { useWeb3React } from "@web3-react/core";
import { AbstractConnector } from "@web3-react/abstract-connector";
import { Button, Card, Flex, Spinner, Box, Heading, Paragraph } from "theme-ui";

import { injectedConnector } from "../connectors/injectedConnector";
import { useAuthorizedConnection } from "../hooks/useAuthorizedConnection";

import { MetaMaskIcon } from "./MetaMaskIcon";
import { GenericIcon } from "./GenericIcon";

type ConnectionState =
  | { type: "inactive" }
  | {
      type: "activating" | "active" | "rejectedByUser" | "alreadyPending" | "failed";
      connector: AbstractConnector;
    };

type ConnectionAction =
  | { type: "startActivating"; connector: AbstractConnector }
  | { type: "fail"; error: Error }
  | { type: "finishActivating" | "retry" | "cancel" | "deactivate" };

const connectionReducer: React.Reducer<ConnectionState, ConnectionAction> = (state, action) => {
  switch (action.type) {
    case "startActivating":
      return {
        type: "activating",
        connector: action.connector
      };
    case "finishActivating":
      return {
        type: "active",
        connector: state.type === "inactive" ? injectedConnector : state.connector
      };
    case "fail":
      if (state.type !== "inactive") {
        return {
          type: action.error.message.match(/user rejected/i)
            ? "rejectedByUser"
            : action.error.message.match(/already pending/i)
            ? "alreadyPending"
            : "failed",
          connector: state.connector
        };
      }
      break;
    case "retry":
      if (state.type !== "inactive") {
        return {
          type: "activating",
          connector: state.connector
        };
      }
      break;
    case "cancel":
      return {
        type: "inactive"
      };
    case "deactivate":
      return {
        type: "inactive"
      };
  }

  console.warn("Ignoring connectionReducer action:");
  console.log(action);
  console.log("  in state:");
  console.log(state);

  return state;
};

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({ children, loader }) => {
  const { activate, deactivate, active, error } = useWeb3React<unknown>();
  const triedAuthorizedConnection = useAuthorizedConnection();
  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });

  useEffect(() => {
    if (error) {
      dispatch({ type: "fail", error });
      deactivate();
    }
  }, [error, deactivate]);

  useEffect(() => {
    if (active) {
      dispatch({ type: "finishActivating" });
    } else {
      dispatch({ type: "deactivate" });
    }
  }, [active]);

  if (!triedAuthorizedConnection) {
    return <>{loader}</>;
  }

  if (connectionState.type === "active") {
    return <>{children}</>;
  }

  return (
    <Flex sx={{
      height: "80vh", 
      justifyContent: "center",
      alignItems: "center"
    }}>
      <Flex sx={{
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: 1,
        borderRadius: "16px",
        bg: "white",
        py: ["3rem", "4.5rem", "5rem"],
        px: ["2.2rem","4rem", "6.5rem"],
        height: "fit-content"
      }}>
        <Flex sx={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          mb: "2.5rem"
        }}>
          <GenericIcon imgSrc="./threshold-usd-icon.svg" height={"32px"} />
          <Heading sx={{ ml:"0.5em", letterSpacing: -0.7, fontSize: ["1.2rem", "1.6rem"] }}>
            Threshold USD
          </Heading>
        </Flex>
        <Paragraph sx={{
          fontWeight: "bold",
          fontSize: ["1.1rem", "1.2rem"],
          textAlign: "center",
          letterSpacing: -0.6,
          mb: "0.5rem"
        }}>
          No wallet connected.
        </Paragraph>
        <Paragraph sx={{
          color: "grey",
          fontWeight: "bold",
          fontSize: ["0.8rem", "0.9rem"],
          textAlign: "center",
          letterSpacing: -0.6,
          mb: ["1.7rem", "2.2rem"]
        }}>
          Get started by connecting your wallet
        </Paragraph>
        <Box>
          <Button
            sx={{ maxWidth: "16.5rem" }}
            onClick={() => {
              dispatch({ type: "startActivating", connector: injectedConnector });
              activate(injectedConnector);
            }}
          >
            <>
              {(connectionState.type === "activating" || connectionState.type === "alreadyPending")
                ? <Spinner size="1em" sx={{ mr: [0, 2], color: "white" }} />
                : (<Box sx={{ display: ["none", "flex"] }}><MetaMaskIcon /></Box>)
              }
              <Flex sx={{ ml: [0, 2], fontSize: ["0.6rem", "0.9rem", "1rem"], justifyContent: "center" }}>Connect to MetaMask</Flex>
            </>
          </Button>
        </Box>
      </Flex>
    </Flex>
  );
};
