/**
 * Used for Journey session storage.
 */
export type SessionStorage = {
  /** Core registry identifier for this storage instance */
  id: string;
};

/**
 * Used for OIDC tokens and authorization state.
 */
export type OidcStorage = {
  /** Core registry identifier for this storage instance */
  id: string;
};
