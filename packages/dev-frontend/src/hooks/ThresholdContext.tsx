import React, { createContext, useContext, useEffect, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@liquity/providers";
import {
  EthersLiquity as EthersThreshold,
  _connectByChainId,
  getCollateralsDeployments,
  _LiquityDeploymentJSON
} from "@liquity/lib-ethers";
import { CollateralsVersionedDeployments } from "@liquity/lib-ethers/src/contracts";

import { ThresholdConfig, getConfig } from "../config";
import { Threshold } from "@liquity/lib-react";

type Version = {
  collateral: keyof CollateralsVersionedDeployments
  version: string
  deployment: _LiquityDeploymentJSON
}

type ThresholdContextValue = {
  config: ThresholdConfig;
  account: string;
  provider: Provider;
  threshold: Threshold[];
};

const ThresholdContext = createContext<ThresholdContextValue | undefined>(undefined);

type ThresholdProviderProps = {
  children: React.ReactNode;
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const supportedNetworks = ["homestead", "goerli"];

const getCollateralVersions = async (chainId: number): Promise<CollateralsVersionedDeployments> => {
  return await getCollateralsDeployments(chainId === 1 ? 'mainnet' : 'goerli');
}

const getConnections = async (
    versionsArray: Version[], 
    provider: Web3Provider, 
    account: string, 
    chainId: number,
    setConnections: Function
  ) => {

    const connectionsByChainId = versionsArray.map(version => 
      _connectByChainId(
        version.collateral,
        version.version, 
        version.deployment, 
        provider, 
        provider.getSigner(account), chainId, 
        { userAddress: account, useStore: "blockPolled" }
      )
    )
    return setConnections(connectionsByChainId)
};

function iterateVersions(collaterals: CollateralsVersionedDeployments) {
  const result = [];

  // Iterate over the top-level keys in the object (e.g. "btc", "eth")
  for (const collateral in collaterals) {
    if (collaterals.hasOwnProperty(collateral)) {
      const versions = collaterals[collateral];

      // Iterate over the version keys for the current cryptocurrency
      for (const version in versions) {
        if (versions.hasOwnProperty(version)) {
          // Add an object with the cryptocurrency identification and version to the result array
          const versionObj = {
            collateral: collateral,
            version: version,
            deployment: versions[version]
          };
          result.push(versionObj);
        }
      }
    }
  }

  // Return the array of version objects with the cryptocurrency identification
  return result;
}

export const ThresholdProvider = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}: ThresholdProviderProps): JSX.Element => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<ThresholdConfig>();
  const [connections, setConnections] = useState<any[]>();
  const [threshold, setThreshold] = useState<Threshold[]>([])

  useEffect(() => {
    if (!chainId || !provider || !account || !config) {
      return;
    }
    getCollateralVersions(chainId)
      .then((collaterals) => {
        const versionsArray = iterateVersions(collaterals);
        getConnections(versionsArray, provider, account, chainId, setConnections)
      })
  }, [chainId, provider, account, config])
  
  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (config && connections) {
      //Get the connection of the first collateral ("v1") for network identification
      if (connections.length > 0) {
        const { provider, chainId } = connections[0];

        let thresholdStores: Threshold[] = []

        for (const connection of connections) {
          const ethersThresholdFromConnection = EthersThreshold._from(connection);
          ethersThresholdFromConnection.store.logging = true;
          thresholdStores.push({
            collateral: connection.deploymentCollateral,
            version: connection.deploymentVersion,
            store: ethersThresholdFromConnection,
          })
        }

        setThreshold(thresholdStores)
        
        if (isBatchedProvider(provider) && provider.chainId !== chainId) {
          provider.chainId = chainId;
        }
        if (isWebSocketAugmentedProvider(provider)) {
          const network = getNetwork(chainId);
          if (network.name && supportedNetworks.includes(network.name) && config.infuraApiKey) {
            provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
          } else if (connections[0]._isDev) {
            provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
          }
          return () => {
            provider.closeWebSocket();
          };
        }
      }
    }
  }, [config, connections]);


  if (!config || !provider || !account || !chainId) {
    return <>{loader}</>;
  }

  //This conditional should be habilitated only in test-net version
  if (chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  //Forcing goerli connection
  if (!connections || chainId !== 5) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : <></>;
  }
  if (Object.keys(threshold).length !== connections.length) {
    return <>{loader}</>;
  }

  return (
    <ThresholdContext.Provider value={{ config, account, provider, threshold }}>
      {children}
    </ThresholdContext.Provider>
  );
};

export const useThreshold = () => {
  const thresholdContext = useContext(ThresholdContext);

  if (!thresholdContext) {
    throw new Error("You must provide a ThresholdContext via ThresholdProvider");
  }

  return thresholdContext;
};
