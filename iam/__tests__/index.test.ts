// ---- Testing libraries
import request from "supertest";
import * as DIDKit from "@spruceid/didkit-wasm-node";

// --- Mocks - test configuration

process.env.IAM_JWK = DIDKit.generateEd25519Key();
process.env.IAM_JWK_EIP712 =
  '{"kty":"EC","crv":"secp256k1","x":"PdB2nS-knyAxc6KPuxBr65vRpW-duAXwpeXlwGJ03eU","y":"MwoGZ08hF5uv-_UEC9BKsYdJVSbJNHcFhR1BZWer5RQ","d":"z9VrSNNZXf9ywUx3v_8cLDhSw8-pvAT9qu_WZmqqfWM"}';
process.env.ATTESTATION_SIGNER_PRIVATE_KEY = "0x04d16281ff3bf268b29cdd684183f72542757d24ae9fdfb863e7c755e599163a";
process.env.ALLO_SCORER_ID = "1";
process.env.SCORER_ENDPOINT = "http://127.0.0.1:8002";
process.env.SCORER_API_KEY = "abcd";
process.env.MORALIS_API_KEY = "abcd";
process.env.EAS_GITCOIN_STAMP_SCHEMA = "0x";

// ---- Test subject
import { app, config, getAttestationDomainSeparator } from "../src/index";
import { providers } from "@gitcoin/passport-platforms";

// ---- Types
import {
  ErrorResponseBody,
  ProviderContext,
  RequestPayload,
  ValidResponseBody,
  VerifiableCredential,
  VerifiedPayload,
} from "@gitcoin/passport-types";

import { MultiAttestationRequest, ZERO_BYTES32, NO_EXPIRATION } from "@ethereum-attestation-service/eas-sdk";

import { utils } from "ethers";
import * as easFeesMock from "../src/utils/easFees";
import * as identityMock from "@gitcoin/passport-identity/dist/commonjs/src/credentials";
import * as easSchemaMock from "../src/utils/easStampSchema";
import * as easPassportSchemaMock from "../src/utils/easPassportSchema";
import { IAMError } from "../src/utils/scorerService";

jest.mock("ethers", () => {
  const originalModule = jest.requireActual("ethers");
  const ethers = originalModule.ethers;
  const utils = originalModule.utils;

  return {
    utils: {
      ...utils,
      getAddress: jest.fn().mockImplementation(() => {
        return "0x0";
      }),
      verifyMessage: jest.fn().mockImplementation(() => {
        return "string";
      }),
      splitSignature: jest.fn().mockImplementation(() => {
        return { v: 0, r: "r", s: "s" };
      }),
    },
    ethers,
  };
});

jest.mock("@ethereum-attestation-service/eas-sdk", () => {
  return {
    SchemaEncoder: jest.fn().mockImplementation(() => {
      return {
        encodeData: jest.fn().mockImplementation(() => {
          return "0x1234";
        }),
      };
    }),
    ZERO_BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000",
    NO_EXPIRATION: 0,
  };
});

jest.mock("moralis", () => ({
  EvmApi: {
    token: {
      getTokenPrice: jest.fn().mockResolvedValue({
        result: { usdPrice: 3000 },
      }),
    },
  },
}));

const chainIdHex = "0xa";

describe("POST /challenge", function () {
  it("handles valid challenge requests", async () => {
    // as each signature is unique, each request results in unique output
    const payload = {
      type: "Simple",
      address: "0x0",
    };

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/challenge")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // expect the mocked credential to be returned and contain the expectedId
    expect((response.body as ValidResponseBody)?.credential?.credentialSubject?.id).toEqual(expectedId);
  });

  it("handles valid challenge request with signatureType", async () => {
    // as each signature is unique, each request results in unique output
    const payload = {
      type: "Simple",
      address: "0x0",
      signatureType: "EIP712",
    };

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/challenge")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // expect the mocked credential to be returned and contain the expectedId
    expect((response.body as ValidResponseBody)?.credential?.credentialSubject?.id).toEqual(expectedId);
  });

  it("handles missing address from the challenge request body", async () => {
    // as each signature is unique, each request results in unique output
    const payload = {
      type: "Simple",
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/challenge")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    // expect the mocked credential to be returned and contain the expectedId
    expect((response.body as ErrorResponseBody).error).toEqual("Missing address from challenge request body");
  });

  it("handles missing type from the challenge request body", async () => {
    // as each signature is unique, each request results in unique output
    const payload = {
      address: "0x0",
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/challenge")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    // expect the mocked credential to be returned and contain the expectedId
    expect((response.body as ErrorResponseBody).error).toEqual("Missing type from challenge request body");
  });

  it("handles malformed payload from the challenge request body", async () => {
    // as each signature is unique, each request results in unique output
    const payload = "bad :(";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/challenge")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);
  });
});

describe("POST /verify", function () {
  it("handles valid challenge requests", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-Simple",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // check for an id match on the mocked credential
    expect((response.body as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
  });

  it("handles valid verify requests with EIP712 signature", async () => {
    // challenge received from the challenge endpoint
    const eip712Key = process.env.IAM_JWK_EIP712;
    const eip712Issuer = DIDKit.keyToDID("ethr", eip712Key);
    const challenge = {
      issuer: eip712Issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-Simple",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
      signatureType: "EIP712",
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // check for an id match on the mocked credential
    expect((response.body as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
  });

  it("handles valid challenge request returning PII", async () => {
    const provider = "ClearTextSimple";
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: `challenge-${provider}`,
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: provider,
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    const expectedProvider = `${provider}#Username`;

    // check that PII is returned with provider
    expect((response.body as ValidResponseBody).credential.credentialSubject.provider).toEqual(expectedProvider);
    // check for an id match on the mocked credential
    expect((response.body as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
  });

  it("handles valid challenge requests with multiple types", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-any",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "any",
      types: ["Simple", "Simple"],
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // check for an id match on the mocked credential
    expect((response.body[0] as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
    expect((response.body[1] as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
  });

  it("handles valid challenge requests with multiple types, and acumulates values between provider calls", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-GitcoinContributorStatistics#numGrantsContributeToGte#10",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "GitcoinContributorStatistics#numGrantsContributeToGte#10",
      types: [
        "GitcoinContributorStatistics#numGrantsContributeToGte#10",
        "GitcoinContributorStatistics#numGrantsContributeToGte#25",
        "GitcoinContributorStatistics#numGrantsContributeToGte#100",
      ],
      address: "0x0",
      proofs: {
        code: "SECRET_CODE",
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // spy on the providers
    jest
      .spyOn(providers._providers["GitcoinContributorStatistics#numGrantsContributeToGte#10"], "verify")
      .mockImplementation(async (payload: RequestPayload, context: ProviderContext): Promise<VerifiedPayload> => {
        context["update_1"] = true;
        return {
          valid: true,
          record: {
            numGrantsContributeToGte: "10",
          },
        };
      });
    jest
      .spyOn(providers._providers["GitcoinContributorStatistics#numGrantsContributeToGte#25"], "verify")
      .mockImplementation(async (payload: RequestPayload, context: ProviderContext): Promise<VerifiedPayload> => {
        context["update_2"] = true;

        return {
          valid: true,
          record: {
            numGrantsContributeToGte: "25",
          },
        };
      });
    const gitcoinGte100 = jest
      .spyOn(providers._providers["GitcoinContributorStatistics#numGrantsContributeToGte#100"], "verify")
      .mockImplementation(async (payload: RequestPayload, context: ProviderContext): Promise<VerifiedPayload> => {
        return {
          valid: true,
          record: {
            numGrantsContributeToGte: "100",
          },
        };
      });

    // check that ID matches the payload (this has been mocked)
    const expectedId = "did:pkh:eip155:1:0x0";

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    // check for an id match on the mocked credential
    expect((response.body[0] as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);
    expect((response.body[1] as ValidResponseBody).credential.credentialSubject.id).toEqual(expectedId);

    expect(gitcoinGte100).toBeCalledWith(
      {
        issuer: config.issuer,
        type: "GitcoinContributorStatistics#numGrantsContributeToGte#10",
        types: [
          "GitcoinContributorStatistics#numGrantsContributeToGte#10",
          "GitcoinContributorStatistics#numGrantsContributeToGte#25",
          "GitcoinContributorStatistics#numGrantsContributeToGte#100",
        ],
        address: "0x0",
        proofs: { code: "SECRET_CODE" },
      },
      // The expected acumulated value in the context
      { update_1: true, update_2: true }
    );
  });

  it("handles invalid challenge requests where credential.issuer is unknown", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: "unknown",
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-Simple",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(401)
      .expect("Content-Type", /json/);

    expect((response.body as ErrorResponseBody).error).toEqual("Unable to verify payload");
  });

  it("handles invalid challenge requests where challenge credential subject signature checks fail", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0xNotAnEthereumAddress#challenge-Simple",
        address: "0xNotAnEthereumAddress",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "false",
        username: "test",
        signature: "pass",
      },
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(401)
      .expect("Content-Type", /json/);

    expect((response.body as ErrorResponseBody).error).toEqual("Unable to verify payload");
  });

  it("handles invalid challenge requests where 'valid' proof is passed as false (test against Simple Provider)", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-Simple",
        address: "0x0",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "false",
        username: "test",
        signature: "pass",
      },
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(403)
      .expect("Content-Type", /json/);

    expect((response.body as ErrorResponseBody).error).toEqual("Proof is not valid");
  });

  it("handles exception if verify credential throws", async () => {
    jest.spyOn(identityMock, "verifyCredential").mockRejectedValue("Verify Credential Error");

    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0xNotAnEthereumAddress",
        type: "challenge-Simple",
        address: "0xNotAnEthereumAddress",
        challenge: "123456789ABDEFGHIJKLMNOPQRSTUVWXYZ",
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "false",
        username: "test",
        signature: "pass",
      },
    };

    // create a req against the express app
    const response = await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(500)
      .expect("Content-Type", /json/);

    expect((response.body as ErrorResponseBody).error).toEqual("Unable to verify payload");
  });

  it("handles invalid challenge request passed by the additional signer", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-any",
        address: "0x0",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
        },
      },
    };
    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "any",
      types: ["Simple", "Simple"],
      address: "0x0",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
      signer: {
        address: "0x0",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
        },
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true).mockResolvedValue(false);

    // create a req against the express app
    await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(401)
      .expect("Content-Type", /json/);
  });

  it("handles valid challenge request passed by the additional signer", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-any",
        address: "0x0",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
        },
      },
    };

    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "any",
      types: ["Simple", "Simple"],
      address: "0x1",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
      signer: {
        address: "0x0",
        signature: "0x1",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
          credentialSubject: {
            challenge: "I commit that this wallet is under my control",
          },
        },
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // create a req against the express app
    await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);
  });
  it("should not issue credential for additional signer when invalid address is provided", async () => {
    // challenge received from the challenge endpoint
    const challenge = {
      issuer: config.issuer,
      credentialSubject: {
        id: "did:pkh:eip155:1:0x0",
        provider: "challenge-any",
        address: "0x0",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
        },
      },
    };

    // payload containing a signature of the challenge in the challenge credential
    const payload = {
      type: "any",
      types: ["Simple", "Simple"],
      address: "0x1",
      proofs: {
        valid: "true",
        username: "test",
        signature: "pass",
      },
      signer: {
        address: "0xbadAddress",
        signature: "0x1",
        challenge: {
          issuer: "did:key:z6Mkecq4nKTCniqNed5cdDSURj1JX4SEdNhvhitZ48HcJMnN",
          credentialSubject: {
            challenge: "I commit that this wallet is under my control",
          },
        },
      },
    };

    // resolve the verification
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);

    // create a req against the express app
    await request(app)
      .post("/api/v0.0.0/verify")
      .send({ challenge, payload })
      .set("Accept", "application/json")
      .expect(401)
      .expect("Content-Type", /json/);
  });
});

describe("POST /check", function () {
  it("handles valid check requests", async () => {
    const payload = {
      type: "Simple",
      address: "0x0",
      proofs: {
        valid: "true",
      },
    };

    const response = await request(app)
      .post("/api/v0.0.0/check")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body[0].valid).toBe(true);
    expect(response.body[0].type).toEqual("Simple");
  });

  it("handles valid check requests with multiple types", async () => {
    const payload = {
      types: ["Simple", "AnotherType"],
      address: "0x0",
      proofs: {
        valid: "true",
      },
    };

    const response = await request(app)
      .post("/api/v0.0.0/check")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body.length).toBe(2);

    const simple = response.body.find((item: any) => item.type === "Simple");
    const anotherType = response.body.find((item: any) => item.type === "AnotherType");

    expect(simple.valid).toBe(true);
    expect(anotherType.valid).toBe(false);
    expect(anotherType.error).toBeDefined();
    expect(anotherType.code).toBeDefined();
  });

  it("handles missing payload in the check request body", async () => {
    const response = await request(app)
      .post("/api/v0.0.0/check")
      .send({})
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Incorrect payload");
  });

  it("handles malformed payload in the check request body", async () => {
    const payload = "bad :(";

    const response = await request(app)
      .post("/api/v0.0.0/check")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Incorrect payload");
  });

  it("handles empty types array in the check request body", async () => {
    const payload = {
      types: [] as unknown as string[],
      address: "0x0",
    };

    const response = await request(app)
      .post("/api/v0.0.0/check")
      .send({ payload })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body.length).toEqual(0);
  });
});

const mockMultiAttestationRequest: MultiAttestationRequest[] = [
  {
    schema: "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4",
    data: [
      {
        recipient: "0x0987654321098765432109876543210987654321",
        data: easSchemaMock.encodeEasScore({
          score: 23.45,
          scorer_id: 123,
        }),
        expirationTime: NO_EXPIRATION,
        revocable: false,
        refUID: ZERO_BYTES32,
        value: "25000000000000000",
      },
    ],
  },
  {
    schema: "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4",
    data: [
      {
        recipient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        data: easSchemaMock.encodeEasScore({
          score: 23.45,
          scorer_id: 123,
        }),
        expirationTime: NO_EXPIRATION,
        revocable: true,
        refUID: ZERO_BYTES32,
        value: "25000000000000000",
      },
    ],
  },
];

describe("POST /eas", () => {
  let getEASFeeAmountSpy: jest.SpyInstance;
  let formatMultiAttestationRequestSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);
    getEASFeeAmountSpy = jest
      .spyOn(easFeesMock, "getEASFeeAmount")
      .mockReturnValue(Promise.resolve(utils.parseEther("0.025")));
  });

  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("handles valid requests including some invalid credentials", async () => {
    formatMultiAttestationRequestSpy = jest
      .spyOn(easSchemaMock, "formatMultiAttestationRequest")
      .mockReturnValue(Promise.resolve(mockMultiAttestationRequest));
    const nonce = 0;
    const failedCredential = {
      "@context": "https://www.w3.org/2018/credentials/v1",
      type: ["VerifiableCredential", "Stamp"],
      issuer: "BAD_ISSUER",
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
        provider: "failure",
        hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
      },
      expirationDate: "9999-12-31T23:59:59Z",
    };

    const credentials = [failedCredential];

    const expectedPayload = {
      passport: {
        multiAttestationRequest: mockMultiAttestationRequest,
        fee: "25000000000000000",
        nonce,
      },
      signature: expect.any(Object),
      invalidCredentials: [failedCredential],
    };

    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual(expectedPayload);
    expect(response.body.signature.r).toBe("r");
  });

  it("properly formats domain separator", () => {
    const domainSeparator = getAttestationDomainSeparator("0xa");
    expect(domainSeparator).toEqual({
      name: "GitcoinVerifier",
      version: "1",
      chainId: "10",
      verifyingContract: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
    });
  });

  it("handles request with only invalid credentials", async () => {
    formatMultiAttestationRequestSpy = jest
      .spyOn(easSchemaMock, "formatMultiAttestationRequest")
      .mockReturnValue(Promise.resolve([]));
    const nonce = 0;
    const failedCredential = {
      "@context": "https://www.w3.org/2018/credentials/v1",
      type: ["VerifiableCredential", "Stamp"],
      issuer: "BAD_ISSUER",
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
        provider: "failure",
        hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
      },
      expirationDate: "9999-12-31T23:59:59Z",
    };

    const credentials = [failedCredential];
    const expectedPayload = {
      passport: {
        multiAttestationRequest: [] as MultiAttestationRequest[],
        fee: "25000000000000000",
        nonce,
      },
      signature: expect.any(Object),
      invalidCredentials: [failedCredential],
    };

    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual(expectedPayload);
    expect(response.body.signature.r).toBe("r");
  });

  it("handles missing stamps in the request body", async () => {
    const nonce = 0;
    const credentials: VerifiableCredential[] = [];
    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("No stamps provided");
  });

  it("handles bad chain ID", async () => {
    const nonce = 0;
    const credentials: VerifiableCredential[] = [];
    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex: "0x694206969" })
      .set("Accept", "application/json")
      .expect(404)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("No onchainInfo found for chainId 0x694206969");
  });

  it("handles invalid recipient in the request body", async () => {
    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Invalid recipient");
  });

  it("returns the fee information in the response as wei units", async () => {
    formatMultiAttestationRequestSpy = jest
      .spyOn(easSchemaMock, "formatMultiAttestationRequest")
      .mockReturnValue(Promise.resolve(mockMultiAttestationRequest));
    const nonce = 0;
    const expectedFeeUsd = 2;

    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const expectedPayload = {
      passport: {
        multiAttestationRequest: mockMultiAttestationRequest,
        fee: "25000000000000000",
        nonce,
      },
      signature: expect.any(Object),
      invalidCredentials: [] as VerifiableCredential[],
    };

    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toMatchObject(expectedPayload);
    expect(getEASFeeAmountSpy).toHaveBeenCalledTimes(1);
    expect(getEASFeeAmountSpy).toHaveBeenCalledWith(expectedFeeUsd);
  });
  it("should throw a 400 error if every credentialSubject.id is not equivalent", async () => {
    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000001",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHla=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Every credential's id must be equivalent");
  });
});

describe("POST /eas/passport", () => {
  let verifyCredentialSpy: jest.SpyInstance;
  let formatMultiAttestationRequestSpy: jest.SpyInstance;

  beforeEach(() => {
    verifyCredentialSpy = jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);
    formatMultiAttestationRequestSpy = jest
      .spyOn(easPassportSchemaMock, "formatMultiAttestationRequest")
      .mockResolvedValue(mockMultiAttestationRequest);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("handles missing stamps in the request body", async () => {
    const nonce = 0;
    const credentials: VerifiableCredential[] = [];
    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("No stamps provided");
  });

  it("handles invalid recipient in the request body", async () => {
    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Invalid recipient");
  });

  it("should throw a 400 error if every credentialSubject.id is not equivalent", async () => {
    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000001",
          provider: "test1",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Every credential's id must be equivalent");
  });

  it("successfully verifies and formats passport", async () => {
    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body.passport.multiAttestationRequest).toEqual(mockMultiAttestationRequest);
    expect(response.body.passport.nonce).toEqual(nonce);
    expect(verifyCredentialSpy).toBeCalledTimes(credentials.length);
    expect(formatMultiAttestationRequestSpy).toBeCalled();
  });

  it("handles error during the formatting of the passport", async () => {
    formatMultiAttestationRequestSpy.mockRejectedValue(new IAMError("Formatting error"));

    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(500)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Error formatting onchain passport, IAMError: Formatting error");
  });

  it("handles error during credential verification", async () => {
    verifyCredentialSpy.mockRejectedValue(new Error("Verification error"));

    const nonce = 0;
    const credentials = [
      {
        "@context": "https://www.w3.org/2018/credentials/v1",
        type: ["VerifiableCredential", "Stamp"],
        issuer: config.issuer,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x5678000000000000000000000000000000000000",
          provider: "test",
          hash: "v0.0.0:8JZcQJy6uwNGPDZnvfGbEs6mf5OZVD1mUOdhKNrOHls=",
        },
        expirationDate: "9999-12-31T23:59:59Z",
      },
    ];

    const response = await request(app)
      .post("/api/v0.0.0/eas/passport")
      .send({ credentials, nonce, chainIdHex })
      .set("Accept", "application/json")
      .expect(500)
      .expect("Content-Type", /json/);

    expect(response.body.error).toEqual("Error formatting onchain passport, Error: Verification error");
  });
});

describe("POST /convert", () => {
  // let verifyCredentialSpy: jest.SpyInstance;
  // let formatMultiAttestationRequestSpy: jest.SpyInstance;

  beforeEach(() => {});

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("converts a credential into a valid credential of type EthereumEip712Signature2021", async () => {
    let verifyCredentialSpy = jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);
    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + 3600 * 1000);

    const response = await request(app)
      .post("/api/v0.0.0/convert")
      .send({
        issuer: config.issuer,
        expirationDate: expirationDate.toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x12345",
          provider: "MyProvider",
          hash: "v0.0.0:secret-hash",
          "@context": [
            {
              hash: "https://schema.org/Text",
              provider: "https://schema.org/Text",
            },
          ],
        },
      })
      .set("Accept", "application/json")
      .expect(200)
      .expect("Content-Type", /json/);

    const responseObject = response.body as VerifiableCredential;

    expect(responseObject.proof.type).toEqual("EthereumEip712Signature2021");

    verifyCredentialSpy.mockRestore();
    const isValidCredential = await identityMock.verifyCredential(DIDKit, responseObject);
    expect(isValidCredential).toBe(true);

    // Just testing the validating the stamp when we tamper with a field fails
    // --> just to double-check that the original verifyCredential is used, and not the mock
    const isInvalidValidCredential = await identityMock.verifyCredential(DIDKit, {
      ...responseObject,
      issuer: "bad-issuer",
    });
    expect(isInvalidValidCredential).toBe(false);
  });

  it("fails to convert an invalid credential", async () => {
    let verifyCredentialSpy = jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(false);
    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + 3600 * 1000);

    const response = await request(app)
      .post("/api/v0.0.0/convert")
      .send({
        issuer: config.issuer,
        expirationDate: expirationDate.toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x12345",
          provider: "MyProvider",
          hash: "v0.0.0:secret-hash",
          "@context": [
            {
              hash: "https://schema.org/Text",
              provider: "https://schema.org/Text",
            },
          ],
        },
      })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    const responseObject = response.body as VerifiableCredential;
    expect(responseObject).toEqual({
      error: "Invalid credential.",
    });
  });

  it("fails to convert a valid credential from invalid issuer", async () => {
    let verifyCredentialSpy = jest.spyOn(identityMock, "verifyCredential").mockResolvedValue(true);
    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + 3600 * 1000);

    const response = await request(app)
      .post("/api/v0.0.0/convert")
      .send({
        issuer: "bad-issuer",
        expirationDate: expirationDate.toISOString(),
        credentialSubject: {
          id: "did:pkh:eip155:1:0x12345",
          provider: "MyProvider",
          hash: "v0.0.0:secret-hash",
          "@context": [
            {
              hash: "https://schema.org/Text",
              provider: "https://schema.org/Text",
            },
          ],
        },
      })
      .set("Accept", "application/json")
      .expect(400)
      .expect("Content-Type", /json/);

    const responseObject = response.body as VerifiableCredential;
    expect(responseObject).toEqual({
      error: "Invalid credential.",
    });
  });
});
