import React from "react";
import { Flex, Container } from "theme-ui";
import { HashRouter as Router, Switch, Route } from "react-router-dom";

import { Nav } from "./components/Nav";
import { SideBar } from "./components/SideBar";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { Header } from "./components/Header";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider } from "./components/Transaction";
import { FunctionalPanel } from "./components/FunctionalPanel";

import { PageSwitcher } from "./pages/PageSwitcher";
import { RedemptionPage } from "./pages/RedemptionPage";
import { RiskyVaultsPage } from "./pages/RiskyVaultsPage";
import { StabilityPoolPage } from "./pages/StabilityPoolPage";
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
      height: "100vh",
      textAlign: "center"
    }}
  >
    
      This app is for testing purposes only.
  


      Please change your network to Ropsten.
  
  </Flex>
);

export const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center"
      }}
    >
      
        hreshold USD is not yet deployed to{" "}
        {chainId === 1 ? "mainnet" : "this network"}.

      Please switch to Ropsten.
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
                <TransactionProvider>
                  <FunctionalPanel loader={loader}>
                    <Switch>
                      <Route path="/" exact>
                        <PageSwitcher />
                      </Route>
                      <Route path="/borrow" exact>
                        <VaultPage />
                      </Route>
                      <Route path="/earn" exact>
                        <StabilityPoolPage />
                      </Route>
                      <Route path="/redemption">
                        <RedemptionPage />
                      </Route>
                      <Route path="/risky-vaults">
                        <RiskyVaultsPage />
                      </Route>
                    </Switch>
                  </FunctionalPanel>
                </TransactionProvider>
              </LiquityProvider>
            </WalletConnector>
          </Container>
        </Flex>
      </Router>
    </>            
  );
};
