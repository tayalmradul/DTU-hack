import { FeatureFlags } from "../config/feature_flags";
import {
  AttestationProvider,
  AttestationProviderConfig,
  EASAttestationProvider,
  VeraxAttestationProvider,
} from "./AttestationProvider";

// RPC urls
const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_PASSPORT_MAINNET_RPC_URL as string;

const sepoliaChainId = "0xaa36a7";
const hardhatChainId = "0x7a69";
const baseGoerliChainId = "0x14a33";
const pgnChainId = "0x1a8";
const lineaChainId = "0xe708";
const lineaGoerliChainId = "0xe704";
const optimismChainId = "0xa";

type ChainConfig = {
  id: string;
  token: string;
  label: string;
  rpcUrl: string;
  icon: string;
  attestationProviderConfig?: AttestationProviderConfig;
};

export class Chain {
  id: string;
  token: string;
  label: string;
  rpcUrl: string;
  icon: string;
  attestationProvider?: AttestationProvider;

  constructor({ id, token, label, rpcUrl, icon, attestationProviderConfig }: ChainConfig) {
    this.id = id;
    this.token = token;
    this.label = label;
    this.rpcUrl = rpcUrl;
    this.icon = icon;

    if (attestationProviderConfig) {
      const attestationConfig = { ...attestationProviderConfig, chainId: this.id };
      switch (attestationConfig.name) {
        case "Ethereum Attestation Service":
          this.attestationProvider = new EASAttestationProvider(attestationConfig);
          break;
        case "Verax":
          this.attestationProvider = new VeraxAttestationProvider(attestationConfig);
          break;
        default:
          break;
      }
    }
  }
}

const chainConfigs: ChainConfig[] = [
  {
    id: "0x1",
    token: "ETH",
    label: "Ethereum Mainnet",
    rpcUrl: MAINNET_RPC_URL,
    icon: "./assets/eth-network-logo.svg",
  },
];

const usingTestEnvironment = process.env.NEXT_PUBLIC_ENABLE_TESTNET === "on";

if (usingTestEnvironment) {
  chainConfigs.push({
    id: sepoliaChainId,
    token: "ETH",
    label: "Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_PASSPORT_SEPOLIA_RPC_URL as string,
    icon: "./assets/eth-network-logo.svg",
  });
  chainConfigs.push({
    id: hardhatChainId,
    token: "ETH",
    label: "Hardhat",
    rpcUrl: "http://127.0.0.1:8545/",
    icon: "./assets/eth-network-logo.svg",
  });
  chainConfigs.push({
    id: baseGoerliChainId,
    token: "ETH",
    label: "Base Goerli",
    rpcUrl: "https://goerli.base.org/",
    icon: "./assets/goerli-base-logo.svg",
    attestationProviderConfig: {
      name: "Ethereum Attestation Service",
      status: "enabled",
      easScanUrl: "https://base-goerli.easscan.org",
    },
  });
}

if (FeatureFlags.FF_LINEA_ATTESTATIONS || usingTestEnvironment) {
  chainConfigs.push({
    id: lineaGoerliChainId,
    token: "ETH",
    label: "Linea Goerli",
    rpcUrl: "https://rpc.goerli.linea.build",
    icon: "./assets/linea-logo.png",
    attestationProviderConfig: {
      name: "Verax",
      status: FeatureFlags.FF_LINEA_ATTESTATIONS ? "enabled" : "disabled",
      overrideVerifierAddress: process.env.NEXT_PUBLIC_LINEA_VERIFIER_ADDRESS_OVERRIDE,
    },
  });
}

if (process.env.NEXT_PUBLIC_FF_MULTICHAIN_SIGNATURE === "on") {
  chainConfigs.push({
    id: "0x89",
    token: "MATIC",
    label: "Polygon Mainnet",
    rpcUrl: "https://matic-mainnet.chainstacklabs.com",
    icon: "./assets/eth-network-logo.svg",
  });
  chainConfigs.push({
    id: "0xfa",
    token: "FTM",
    label: "Fantom Mainnet",
    rpcUrl: "https://rpc.ftm.tools/",
    icon: "./assets/eth-network-logo.svg",
  });
}

chainConfigs.push({
  id: optimismChainId,
  token: "ETH",
  label: "Optimism",
  rpcUrl: process.env.NEXT_PUBLIC_PASSPORT_OP_RPC_URL as string,
  icon: "./assets/op-logo.svg",
  attestationProviderConfig: {
    name: "Ethereum Attestation Service",
    status: usingTestEnvironment ? "disabled" : "enabled",
    easScanUrl: "https://optimism.easscan.org",
  },
});

chainConfigs.push({
  id: lineaChainId,
  token: "ETH",
  label: "Linea",
  rpcUrl: "https://rpc.linea.build",
  icon: "./assets/linea-logo.png",
  attestationProviderConfig: {
    name: "Verax",
    status: "comingSoon",
  },
});

chainConfigs.push({
  id: pgnChainId,
  token: "ETH",
  label: "PGN",
  rpcUrl: "https://rpc.publicgoods.network	",
  icon: "./assets/pgn-logo.png",
  attestationProviderConfig: {
    name: "Ethereum Attestation Service",
    status: "comingSoon",
    easScanUrl: "",
  },
});

export const chains: Chain[] = chainConfigs.map((config) => new Chain(config));
