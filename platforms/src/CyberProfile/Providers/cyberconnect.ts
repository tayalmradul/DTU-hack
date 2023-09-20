// ----- Types
import type { Provider, ProviderOptions } from "../../types";
import type { ProviderContext, RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";

// ----- Ethers library
import { Contract, BigNumber } from "ethers";
import { StaticJsonRpcProvider } from "@ethersproject/providers";

// CyberProfile Proxy Contract Address
const CYBERPROFILE_PROXY_CONTRACT_ADDRESS = "0x2723522702093601e6360CAe665518C4f63e9dA6";

// CyberProfile Proxy ABI functions needed to get the length of primary profile handle
const CYBERPROFILE_PROXY_ABI = [
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getPrimaryProfile",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "profileId", type: "uint256" }],
    name: "getHandleByProfileId",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

export type GithubContext = ProviderContext & {
  cyberConnect?: {
    handle?: string;
  };
};

export type CyberConnectHandleResponse = {
  handle?: string;
  errors?: string[];
};

interface CyberProfileContract extends Contract {
  getPrimaryProfile?(address: string): Promise<BigNumber>;
  getHandleByProfileId?(id: number): Promise<string>;
  // add other methods as needed
}

// return 0 if no primary handle is found, otherwise return the length of the primary handle
export async function getPrimaryHandle(
  userAddress: string,
  context: GithubContext
): Promise<CyberConnectHandleResponse> {
  if (!context.cyberConnect?.handle) {
    const provider: StaticJsonRpcProvider = new StaticJsonRpcProvider(
      process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/"
    );

    const contract: CyberProfileContract = new Contract(
      CYBERPROFILE_PROXY_CONTRACT_ADDRESS,
      CYBERPROFILE_PROXY_ABI,
      provider
    );
    if (!context.cyberConnect) context.cyberConnect = {};
    // get primary profile id
    const profileId: BigNumber = await contract.getPrimaryProfile(userAddress);
    // if no primary profile id is found (profileId == 0), return 0
    if (profileId.isZero()) {
      context.cyberConnect.handle = "";
      return context.cyberConnect;
    }
    // get primary profile handle
    const handle: string = await contract.getHandleByProfileId(profileId.toNumber());

    context.cyberConnect.handle = handle;
    // return the length of the primary handle
    return context.cyberConnect;
  }
  return context.cyberConnect;
}

// Export a CyberProfilePremiumProvider
export class CyberProfilePremiumProvider implements Provider {
  // Give the provider a type so that we can select it with a payload
  type = "CyberProfilePremium";

  // Options can be set here and/or via the constructor
  _options = {};

  // construct the provider instance with supplied options
  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  // Verify that address defined in the payload has a handle length <= 6 and > 0
  async verify(payload: RequestPayload, context: ProviderContext): Promise<VerifiedPayload> {
    // if a signer is provider we will use that address to verify against
    const address = payload.address.toString().toLowerCase();
    let valid = false;
    let userHandle: string;
    try {
      const { handle } = await getPrimaryHandle(address, context);
      userHandle = handle;
    } catch (e) {
      return {
        valid: false,
        error: ["CyberProfile provider get user primary handle error"],
      };
    }
    const lengthOfPrimaryHandle = userHandle.length;
    valid = lengthOfPrimaryHandle <= 6 && lengthOfPrimaryHandle > 0;
    return Promise.resolve({
      valid: valid,
      record: valid
        ? {
            userHandle,
          }
        : {},
    });
  }
}

// Export a CyberProfilePaidProvider
export class CyberProfilePaidProvider implements Provider {
  // Give the provider a type so that we can select it with a payload
  type = "CyberProfilePaid";

  // Options can be set here and/or via the constructor
  _options = {};

  // construct the provider instance with supplied options
  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  // Verify that address defined in the payload has a handle length <= 12 and > 6
  async verify(payload: RequestPayload, context: ProviderContext): Promise<VerifiedPayload> {
    // if a signer is provider we will use that address to verify against
    const address = payload.address.toString().toLowerCase();
    let valid = false;
    let userHandle: string;
    try {
      const { handle } = await getPrimaryHandle(address, context);
      userHandle = handle;
    } catch (e) {
      return {
        valid: false,
        error: ["CyberProfile provider get user primary handle error"],
      };
    }
    const lengthOfPrimaryHandle = userHandle.length;
    valid = lengthOfPrimaryHandle <= 12 && lengthOfPrimaryHandle > 6;
    return Promise.resolve({
      valid: valid,
      record: valid
        ? {
            userHandle,
          }
        : {},
    });
  }
}
