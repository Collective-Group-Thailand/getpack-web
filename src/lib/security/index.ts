export {
  contentSecurityPolicy,
  createNonce,
  cspDirectives,
  serialiseCsp,
  type CspOptions,
  type CspOrigins,
} from "./csp";
export {
  driverHandoverHeaders,
  isDriverHandoverPath,
  isHttpsRequest,
  securityHeaders,
  type SecurityHeaderOptions,
} from "./headers";

/** The request header the proxy stamps so a root layout can read the nonce (Next docs). */
export const NONCE_HEADER = "x-nonce";
export const CSP_HEADER = "content-security-policy";
