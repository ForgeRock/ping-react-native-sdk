//Configuration types
import type { BaseStorageConfig } from './NativeRNPingStorage';

/**
 * Configuration for session storage.
 * Extends base storage configuration with optional encryption support.
 */
export type SessionStorageConfig = BaseStorageConfig & {
  /** Whether to encrypt the stored session data */
  encrypted?: boolean;
};

/**
 * Configuration for OIDC storage.
 * Extends base storage configuration with optional encryption support for OAuth/OIDC tokens.
 */
export type OidcStorageConfig = BaseStorageConfig & {
  /** Whether to encrypt the stored OIDC tokens */
  encrypted?: boolean;
};

// TODO: Move SSOToken and Tokens definitions to the shared types package once finalized.
/**
 * Represents an SSO token used for authentication.
 * @internal
 */
export type SSOToken = {
  /** Unique identifier for the SSO token */
  id: string;
  /** The actual token value */
  value: string;
  /** URL to redirect to upon successful authentication */
  successUrl: string;
  /** Authentication realm for the SSO session */
  realm: string;
};

/**
 * Represents OAuth/OIDC tokens with metadata.
 * Backed by the native Token type for platform-specific persistence.
 * @internal
 */
export type Tokens = {
  /** Unique identifier for the token */
  id: string;
  /** OAuth access token for API authorization */
  accessToken: string;
  /** Type of token (e.g., "Bearer") */
  tokenType?: string;
  /** Space-delimited list of scopes granted */
  scope?: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** OAuth refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** OpenID Connect ID token */
  idToken?: string;
  /** Internal field: timestamp when the token expires (in seconds since epoch) */
  expireAt: number;
};

// Domain specific storage APIs

/**
 * Backed by native Storage<SSOToken> and used for Journey session state.
 */
export type SessionStorage = {
  set: (token: SSOToken) => Promise<void>;
  getSSOToken: () => Promise<SSOToken | null>;
  deleteSSOToken: () => Promise<void>;
};

/**
 * Backed by native Storage<Token> and used for OIDC tokens and authorization state.
 */
export type OidcStorage = {
  set: (tokens: Tokens) => Promise<void>;
  getTokens: () => Promise<Tokens | null>;
  deleteTokens: () => Promise<void>;
};
