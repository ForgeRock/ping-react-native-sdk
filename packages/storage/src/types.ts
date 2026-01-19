/**
 * Used for Journey session storage.
 * @example
 * ```typescript
 * const sessionStorage: SessionStorage = configureSessionStorage({
 *   keyAlias: 'session_key',
 *   fileName: 'session_data'
 * });
 * console.log(sessionStorage.id); // Unique identifier used by Core SDK
 * ```
 */
export type SessionStorage = {
  /** Unique identifier for this storage configuration, registered in the Core SDK registry. */
  id: string;
};

/**
 * Used for OIDC tokens and authorization state.
 * @example
 * ```typescript
 * const oidcStorage: OidcStorage = configureOidcStorage({
 *   keyAlias: 'oidc_key',
 *   fileName: 'oidc_tokens'
 * });
 * console.log(oidcStorage.id); // Unique identifier used by Core SDK
 * ```
 */
export type OidcStorage = {
  /** Unique identifier for this storage configuration, registered in the Core SDK registry. */
  id: string;
};
