import { Web3OnboardProvider, init } from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'
import walletConnectModule from '@web3-onboard/walletconnect'
import coinbaseModule from '@web3-onboard/coinbase'
import tahoModule from '@web3-onboard/taho'
import safeModule  from '@web3-onboard/gnosis'
import { Flex, Spinner, Heading, ThemeProvider} from "theme-ui";

import { getConfig } from "./config";
import theme from "./theme";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";
import { ThresholdFrontend } from "./ThresholdFrontend";

const wcV2InitOptions = {
  /**
   * Project ID associated with [WalletConnect account](https://cloud.walletconnect.com)
   */
  projectId: process.env.REACT_APP_WALLETCONNECT_ID as string,
  /**
   * Chains required to be supported by all wallets connecting to your DApp
   */
  requiredChains: [1, 60808],
  /**
   * Defaults to `appMetadata.explore` that is supplied to the web3-onboard init
   * Strongly recommended to provide atleast one URL as it is required by some wallets (i.e. MetaMask)
   * To connect with WalletConnect
   */
  dappUrl: 'https://app.thresholdusd.org'
}

const injected = injectedModule();
const coinbase = coinbaseModule();
const walletConnect = walletConnectModule(wcV2InitOptions)
const taho = tahoModule();
const safe = safeModule()

const wallets = [
  injected,
  taho,
  coinbase,
  walletConnect,
  safe,
]

const publicRpcUrls = {
  '0x1': 'https://cloudflare-eth.com/',
  '0xaa36a7': 'https://sepolia.eth.aragon.network/',
  '0x6f': "https://testnet.rpc.gobob.xyz/",
  '0xed88': "https://rpc.gobob.xyz/",
};

const chains = [
  {
    id: '0x1',
    token: 'ETH',
    label: 'Ethereum Mainnet',
    rpcUrl: getRpcUrl('0x1')
  },
  {
    id: '0xaa36a7',
    token: 'ETH',
    label: 'Ethereum Sepolia',
    rpcUrl: getRpcUrl('0xaa36a7')
  },
  {
    id: '0x6f',
    token: 'ETH',
    label: 'BOB Testnet',
    rpcUrl: getRpcUrl('0x6f')
  },
  {
    id: '0xed88',
    token: 'ETH',
    label: 'BOB Mainnet',
    rpcUrl: getRpcUrl('0xed88')
  },
]

const appMetadata = {
  name: 'Connect Wallet Example',
  icon: '<svg>My App Icon</svg>',
  description: 'Example showcasing how to connect a wallet.',
  recommendedInjectedWallets: [
    { name: 'MetaMask', url: 'https://metamask.io' },
    { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
  ]
}

const accountCenter = {
  enabled: false
}

const accountCenterOptions = {
  desktop: accountCenter,
  mobile: accountCenter
}

const web3Onboard = init({
  wallets,
  chains,
  appMetadata,
  accountCenter: accountCenterOptions
})

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
}

function getRpcUrl(chainIdHex: keyof typeof publicRpcUrls) {
  if (process.env.REACT_APP_ALCHEMY_ID && (chainIdHex === "0x1" || chainIdHex === "0xaa36a7")) {
    return `https://eth-${chainIdHex === '0x1' ? 'mainnet' : 'sepolia'}.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_ID}`;
  } else {
    return publicRpcUrls[chainIdHex];
  }
}

try {
  if (process.env.REACT_APP_DEMO_MODE === "true") {
    const ethereum = new DisposableWalletProvider(
      `http://${window.location.hostname}:8545`,
      "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
    );

    Object.assign(window, { ethereum });
  }
} catch (e) {}

// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

type EthersWeb3ReactProviderProps = {
  children: JSX.Element;
}

const OnboardProvider= ({ children }: EthersWeb3ReactProviderProps): JSX.Element => {
  return (
    <Web3OnboardProvider web3Onboard={web3Onboard}>
      {children}
    </Web3OnboardProvider>
  );
};

const App = () => {
  const loader = (
    <Flex sx={{ alignItems: "center", justifyContent: "center", height: "75vh",  }}>
      <Spinner sx={{ m: 2, color: "text" }} size="32px" />
      <Heading>Loading...</Heading>
    </Flex>
  );
  return (
    <OnboardProvider>
      <ThemeProvider theme={theme}>
        <ThresholdFrontend loader={loader} />
      </ThemeProvider>
    </OnboardProvider>
  );
};

export default App;
