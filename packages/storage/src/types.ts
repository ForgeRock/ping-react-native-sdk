//Configuration types

/**
   * Cache strategy type.
   * - "NO_CACHE" - No caching, always fetch fresh data
   * - "CACHE" - Cache the item in memory, even if storage operation fails
   * - "CACHE_ON_FAILURE" - Cache only if storage operation fails
   * 
   * Note: Cached data is stored in plain text and not encrypted.
*/
export type CacheStrategy =
  | 'NO_CACHE'
  | 'CACHE_ON_FAILURE' // NOTE: Has to be aligned in both Platforms first
  | 'CACHE';

export type StorageType = 'memory' | 'encrypted' | 'datastore';
export type BaseStorageConfig = {
  /**
   * Storage type: "memory", "encrypted", or "datastore"
  */
  type?: StorageType;

  /**
   * Optional encryption alias for keychain or secure store.
   */
  keyAlias?: string;

  /**
   * Optional file name for persistent storage.
   * Used when storage type is "encrypted" or "datastore".
  */
  fileName?: string;
  
  /**
    * Optional StrongBox preference for Android.
  */
  strongBoxPreferred?: boolean;

  cacheStrategy?: CacheStrategy;

  /**
  * Optional flag to enforce asymmetric key usage (Android SecretKeyEncryptor).
  * Only applicable when using encrypted storage.
  */
  enforceAsymmetricKey?: boolean;
};

export type SessionStorageConfig = BaseStorageConfig & {
  encrypted?: boolean;
};

export type OidcStorageConfig = BaseStorageConfig & {
  encrypted?: boolean;
};
// TODO: Move SSOToken and Tokens definitions to the shared types package once finalized.
/**
 * Represents an SSO token used for authentication.
 * @internal
 */
type SSOToken = {
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
type Tokens = {
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

// Domain specific storage types

/**
 * Storage interface for managing Journey session state.
 * Backed by a native Storage<SSOToken> instance for platform-specific persistence.
 */
export type SessionStorage = {
  /** Unique identifier for this storage instance */
  id: string;
  /**
   * Persists an SSO token to storage.
   * @param value - The SSO token to save
   * @returns Promise resolving to true if save was successful, false otherwise
   */
  save: (value: SSOToken) => Promise<boolean>;
  /**
   * Retrieves the current session from storage.
   * @returns Promise resolving to the SSO token if found, null otherwise
   */
  getSession: () => Promise<SSOToken | null>;
  /**
   * Removes the session from storage.
   * @returns Promise resolving to true if deletion was successful, false otherwise
   */
  delete: () => Promise<boolean>;
};

/**
 * Storage interface for managing OIDC (OpenID Connect) tokens.
 * Backed by a native Storage<Tokens> instance for platform-specific persistence.
 */
export type OidcStorage = {
  /** Unique identifier for this storage instance */
  id: string;
  /**
   * Persists OIDC tokens to storage.
   * @param value - The tokens to save
   * @returns Promise resolving to true if save was successful, false otherwise
   */
  save: (value: Tokens) => Promise<boolean>;
  /**
   * Retrieves the stored tokens.
   * @returns Promise resolving to the tokens if found, null otherwise
   */
  getTokens: () => Promise<Tokens | null>;
  /**
   * Removes the tokens from storage.
   * @returns Promise resolving to true if deletion was successful, false otherwise
   */
  delete: () => Promise<boolean>;
};