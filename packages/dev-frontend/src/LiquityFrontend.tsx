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

import { PageSwitcher } from "./pages/PageSwitcher";
import { RedemptionPage } from "./pages/RedemptionPage";
import { RiskyVaultsPage } from "./pages/RiskyVaultsPage";

import { VaultPage } from "./pages/VaultPage";

import { LiquityProvider } from "./hooks/LiquityContext";

type LiquityFrontendProps = {
  loader?: React.ReactNode;
};

const UnsupportedMainnetFallback: React.FC = () => (
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

export const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
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
              <LiquityProvider
                loader={loader}
                unsupportedNetworkFallback={unsupportedNetworkFallback}
                unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
              >
                <ChartProvider loader={loader}>
                  <TransactionProvider>
                    <FunctionalPanel loader={loader}>
                      <Switch>
                        <Route path="/" exact>
                          <PageSwitcher />
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
                    </FunctionalPanel>
                  </TransactionProvider>
                </ChartProvider>
              </LiquityProvider>
            </WalletConnector>
          </Container>
        </Flex>
      </Router>
    </>            
  );
};
