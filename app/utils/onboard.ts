import { init } from "@web3-onboard/react";
import injectedModule from "@web3-onboard/injected-wallets";
import ledgerModule from "@web3-onboard/ledger";
import walletConnectModule, { WalletConnectOptions } from "@web3-onboard/walletconnect";
import { chains } from "./chains";

// Injected wallet - shows all available injected wallets

const injected = injectedModule();

// web3Onboard modules
const walletConnectProjectId = (process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string) || "default-project-id";

const walletConnectOptions: WalletConnectOptions = {
  projectId: walletConnectProjectId,
};

const onBoardExploreUrl =
  (process.env.NEXT_PUBLIC_WEB3_ONBOARD_EXPLORE_URL as string) || "https://passport.gitcoin.co/";

const walletConnect = walletConnectModule(walletConnectOptions);
// Include ledger capabilities
const ledger = ledgerModule({
  walletConnectVersion: 2,
  enableDebugLogs: false,
  projectId: walletConnectProjectId,
});

// Exports onboard-core instance (https://github.com/blocknative/web3-onboard)
export const initWeb3Onboard = init({
  wallets: [injected, ledger, walletConnect],
  chains: chains.map(({ id, token, label, rpcUrl, icon }) => ({ id, token, label, rpcUrl, icon })),
  appMetadata: {
    name: "Passport",
    icon: "/assets/gitcoinLogo.svg",
    logo: "/assets/gitcoinLogo.svg",
    description: "Decentralized Identity Verification",
    explore: onBoardExploreUrl,
    recommendedInjectedWallets: [
      { name: "Coinbase", url: "https://wallet.coinbase.com/" },
      { name: "MetaMask", url: "https://metamask.io" },
    ],
  },
});
