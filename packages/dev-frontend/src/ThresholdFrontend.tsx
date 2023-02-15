import React from "react";
import { Flex, Container, Heading, Paragraph } from "theme-ui";
import { HashRouter as Router, Switch, Route } from "react-router-dom";

import { Nav } from "./components/Nav";
import { SideBar } from "./components/SideBar";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { Icon } from "./components/Icon";
import { Header } from "./components/Header";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider } from "./components/Transaction";
import { ChartProvider } from "./components/Dashboard/Chart/context/ChartProvider";
import { FunctionalPanel } from "./components/FunctionalPanel";

import { Dashboard } from "./pages/Dashboard";
import { RedemptionPage } from "./pages/RedemptionPage";
import { RiskyVaultsPage } from "./pages/RiskyVaultsPage";

import { VaultPage } from "./pages/VaultPage";

import { ThresholdProvider } from "./hooks/ThresholdContext";

type ThresholdFrontendProps = {
  loader?: React.ReactNode;
};

const UnsupportedMainnetFallback = (): JSX.Element => (
  <Flex
    sx={{
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "80vh",
      textAlign: "center"
    }}
  >
    <Heading sx={{ mb: 3 }}>
      <Icon name="exclamation-triangle" /> This app is for testing purposes only.
    </Heading>

    <Paragraph sx={{ mb: 3 }}>
      Please change your network to Goerli.
    </Paragraph>
  </Flex>
);

export const ThresholdFrontend = ({ loader }: ThresholdFrontendProps): JSX.Element => {
  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "80vh",
        textAlign: "center"
      }}
    >
      <Heading sx={{ mb: 3 }}>
        <Icon name="exclamation-triangle" /> Threshold USD is not yet deployed to{" "}
        {chainId === 1 ? "mainnet" : "this network"}.
      </Heading>
      Please switch to Goerli.
    </Flex>
  );

  return (
    <>
      <Router>
        <Flex variant="layout.wrapper">
          <Header>
            <HamburgerMenu />
          </Header>
          <SideBar>
            <Nav />
          </SideBar>
          <Container
            variant="main"
            sx={{
              flexGrow: 1,
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <WalletConnector loader={loader}>
              <ThresholdProvider
                loader={loader}
                unsupportedNetworkFallback={unsupportedNetworkFallback}
                unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
              >
                <TransactionProvider>
                  <FunctionalPanel loader={loader}>
                    <ChartProvider>
                      <Switch>
                        <Route path="/" exact>
                          <Dashboard />
                        </Route>
                        <Route path="/borrow" exact>
                          <VaultPage />
                        </Route>
                        {/*<Route path="/earn" exact>
                          <StabilityPoolPage />
                        </Route>*/}
                        <Route path="/redemption">
                          <RedemptionPage />
                        </Route>
                        <Route path="/risky-vaults">
                          <RiskyVaultsPage />
                        </Route>
                      </Switch>
                    </ChartProvider>
                  </FunctionalPanel>
                </TransactionProvider>
              </ThresholdProvider>
            </WalletConnector>
          </Container>
        </Flex>
      </Router>
    </>            
  );
};
