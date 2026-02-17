/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * User profile claims resolved from OIDC userinfo.
 *
 * @remarks
 * Keys and value shapes are deployment-specific and controlled by AM/Ping configuration.
 */
export type JourneyUserInfo = Record<string, unknown>;

/**
 * Session payload exposed by `user()`.
 */
export type JourneyUserSession = {
  /**
   * Access token string.
   */
  accessToken: string;
  /**
   * Optional refresh token string.
   */
  refreshToken?: string;
  /**
   * Optional token expiry in seconds.
   */
  expiresIn?: number;
  /**
   * Optional user profile claims.
   */
  userInfo?: JourneyUserInfo;
};
