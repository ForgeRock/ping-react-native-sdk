/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { Tokens } from '@ping-identity/rn-types';

/**
 * User profile claims resolved from OIDC userinfo.
 *
 * @remarks
 * Keys and value shapes are deployment-specific and controlled by AM/Ping configuration.
 */
export type JourneyUserInfo = Record<string, unknown>;

/**
 * SSO token payload resolved from Journey session storage.
 */
export type JourneySSOToken = {
  /**
   * SSO token value.
   */
  value: string;
  /**
   * Success URL associated with the SSO token.
   */
  successUrl: string;
  /**
   * Realm associated with the SSO token.
   */
  realm: string;
};

/**
 * Session payload exposed by `user()`.
 */
export type JourneyUserSession = Pick<
  Tokens,
  'accessToken' | 'refreshToken'
> & {
  /**
   * Optional token expiry in seconds.
   */
  expiresIn?: number;
  /**
   * Optional user profile claims.
   */
  userInfo?: JourneyUserInfo;
};
