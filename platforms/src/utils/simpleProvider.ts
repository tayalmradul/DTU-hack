// ----- Types
import type { Provider, ProviderOptions } from "../types";
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";

// Export a simple Provider as an example
export class SimpleProvider implements Provider {
  // Give the provider a type so that we can select it with a payload
  type = "Simple";
  // Options can be set here and/or via the constructor
  _options = {
    valid: "true",
  };

  // construct the provider instance with supplied options
  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  // verify that the proof object contains valid === "true"
  verify(payload: RequestPayload): Promise<VerifiedPayload> {
    return Promise.resolve(verifySimpleProvider(payload));
  }
}

// This is pulled out to allow easier mocking in tests
export const verifySimpleProvider = (payload: RequestPayload): VerifiedPayload => {
  const valid = payload?.proofs?.valid === "true";
  const errors = valid ? [] : ["Proof is not valid"];
  return {
    valid,
    errors,
    record: {
      username: payload?.proofs?.username || "",
    },
  };
};
