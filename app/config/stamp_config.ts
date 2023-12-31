import { SignatureType } from "@gitcoin/passport-types";

export const IAM_SIGNATURE_TYPE: SignatureType = process.env.NEXT_PUBLIC_PASSPORT_IAM_SIGNATURE_TYPE as SignatureType;
const USE_STAMPS_V2 = IAM_SIGNATURE_TYPE === "EIP712";

const CERAMIC_CACHE_ENDPOINT_V1 = process.env.NEXT_PUBLIC_CERAMIC_CACHE_ENDPOINT;
const CERAMIC_CACHE_ENDPOINT_V2 = process.env.NEXT_PUBLIC_CERAMIC_CACHE_ENDPOINT_V2;
export const CERAMIC_CACHE_ENDPOINT = USE_STAMPS_V2 ? CERAMIC_CACHE_ENDPOINT_V2 : CERAMIC_CACHE_ENDPOINT_V1;

const IAM_ISSUER_DID_V1 = process.env.NEXT_PUBLIC_PASSPORT_IAM_ISSUER_DID || "";
const IAM_ISSUER_DID_V2 = process.env.NEXT_PUBLIC_PASSPORT_IAM_ISSUER_DID_V2 || "";
export const IAM_ISSUER_DID = USE_STAMPS_V2 ? IAM_ISSUER_DID_V2 : IAM_ISSUER_DID_V1;
