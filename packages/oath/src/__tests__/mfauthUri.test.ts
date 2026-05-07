/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { parseMfauthUri } from '../mfauthUri';

const FULL_MFAUTH_URI =
  'mfauth://totp/Issuer:account' +
  '?oathURI=otpauth%3A%2F%2Ftotp%2FIssuer%3Aaccount%3Fsecret%3DJBSWY3DPEHPK3PXP%26issuer%3DIssuer%26algorithm%3DSHA1%26digits%3D6%26period%3D30' +
  '&pushURI=pushauth%3A%2F%2Fpush%2FIssuer%3Aaccount%3Fsecret%3DABC';

describe('parseMfauthUri', () => {
  it('returns both oathUri and pushUri for a full mfauth:// URI', () => {
    const result = parseMfauthUri(FULL_MFAUTH_URI);

    expect(result.oathUri).toBe(
      'otpauth://totp/Issuer:account?secret=JBSWY3DPEHPK3PXP&issuer=Issuer&algorithm=SHA1&digits=6&period=30',
    );
    expect(result.pushUri).toBe('pushauth://push/Issuer:account?secret=ABC');
  });

  it('returns only oathUri when pushURI param is absent', () => {
    const uri =
      'mfauth://totp/Issuer:account' +
      '?oathURI=otpauth%3A%2F%2Ftotp%2FIssuer%3Aaccount%3Fsecret%3DJBSWY3DPEHPK3PXP';

    const result = parseMfauthUri(uri);

    expect(result.oathUri).toBe(
      'otpauth://totp/Issuer:account?secret=JBSWY3DPEHPK3PXP',
    );
    expect(result.pushUri).toBeUndefined();
  });

  it('returns {} for a plain otpauth:// URI', () => {
    const result = parseMfauthUri(
      'otpauth://totp/Issuer:account?secret=JBSWY3DPEHPK3PXP',
    );

    expect(result).toEqual({});
  });

  it('returns {} for an arbitrary malformed string', () => {
    const result = parseMfauthUri('not-a-uri');

    expect(result).toEqual({});
  });

  it('returns {} for an empty string', () => {
    const result = parseMfauthUri('');

    expect(result).toEqual({});
  });
});
