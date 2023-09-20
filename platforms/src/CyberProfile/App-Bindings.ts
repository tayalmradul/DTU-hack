import { AppContext, ProviderPayload } from "../types";
import { Platform } from "../utils/platform";

export class CyberConnectPlatform extends Platform {
  platformId = "CyberConnect";
  path = "CyberConnect";
  clientId: string = null;
  redirectUri: string = null;
  isEVM = true;

  async getProviderPayload(appContext: AppContext): Promise<ProviderPayload> {
    const result = await Promise.resolve({});
    return result;
  }
}
