/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Parse an `mfauth://` URI and extract the component URIs encoded as query parameters.
 *
 * @param uri - The `mfauth://` URI to parse, e.g.
 *   `mfauth://totp/Issuer:account?oathURI=<encoded-otpauth-uri>&pushURI=<encoded-pushauth-uri>`
 * @returns An object with optional `oathUri` and `pushUri` fields.
 *   Returns `{}` when the URI is not an `mfauth:` URI or cannot be parsed.
 *
 * @remarks
 * `pushUri` is reserved for future Push notification integration. It is decoded
 * from the `pushURI` query parameter when present, but is not yet consumed by
 * any Push client in this package.
 *
 * @example
 * ```ts
 * const uri =
 *   'mfauth://totp/Issuer:account' +
 *   '?oathURI=otpauth%3A%2F%2Ftotp%2FIssuer%3Aaccount%3Fsecret%3DJBSWY3DPEHPK3PXP' +
 *   '&pushURI=pushauth%3A%2F%2Fpush%2FIssuer%3Aaccount%3Fsecret%3DABC';
 *
 * const { oathUri, pushUri } = parseMfauthUri(uri);
 * // oathUri === 'otpauth://totp/Issuer:account?secret=JBSWY3DPEHPK3PXP'
 * // pushUri === 'pushauth://push/Issuer:account?secret=ABC'
 * ```
 */
export function parseMfauthUri(uri: string): {
  oathUri?: string;
  pushUri?: string;
} {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mfauth:') return {};
    const oathUri = parsed.searchParams.get('oathURI') ?? undefined;
    const pushUri = parsed.searchParams.get('pushURI') ?? undefined;
    return { oathUri, pushUri };
  } catch {
    return {};
  }
}
