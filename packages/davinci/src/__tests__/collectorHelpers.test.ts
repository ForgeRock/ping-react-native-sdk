/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  buildNextInput,
  computeFormMeta,
  normalizeCollectors,
  resolveExecutionMode,
  resolveFieldKind,
} from '../collectorHelpers';
import type {
  ContinueNode,
  DaVinciCollector,
  DaVinciNormalizedCollector,
} from '../types';

const manualTypes = [
  'TEXT',
  'PASSWORD',
  'PASSWORD_VERIFY',
  'SINGLE_SELECT',
  'DROPDOWN',
  'RADIO',
  'MULTI_SELECT',
  'COMBOBOX',
  'CHECKBOX',
  'PHONE_NUMBER',
  'DEVICE_REGISTRATION',
  'DEVICE_AUTHENTICATION',
];

const immediateTypes = ['SUBMIT_BUTTON', 'ACTION', 'FLOW_BUTTON', 'FLOW_LINK'];

const baseField = (
  key: string,
  type: string,
  required = false,
): DaVinciCollector =>
  ({
    key,
    type,
    label: `${key}-label`,
    required,
    value: '',
  }) as DaVinciCollector;

/** Wraps raw collectors in a ContinueNode for buildNextInput. */
const makeNode = (collectors: DaVinciCollector[]): ContinueNode => ({
  type: 'ContinueNode',
  collectors,
});

describe('resolveExecutionMode', () => {
  it.each(manualTypes)('returns manual for %s', (type) => {
    expect(resolveExecutionMode(type)).toBe('manual');
  });

  it('returns output_only for LABEL', () => {
    expect(resolveExecutionMode('LABEL')).toBe('output_only');
  });

  it.each(immediateTypes)('returns immediate for %s', (type) => {
    expect(resolveExecutionMode(type)).toBe('immediate');
  });

  it('returns unsupported for unknown type', () => {
    expect(resolveExecutionMode('UNKNOWN_TYPE')).toBe('unsupported');
    expect(resolveExecutionMode('')).toBe('unsupported');
  });

  it('never returns integration_required for any base-registry type', () => {
    const allKnownTypes = [...manualTypes, 'LABEL', ...immediateTypes];
    allKnownTypes.forEach((type) => {
      expect(resolveExecutionMode(type)).not.toBe('integration_required');
    });
  });

  it('returns integration_required for SOCIAL_LOGIN_BUTTON', () => {
    expect(resolveExecutionMode('SOCIAL_LOGIN_BUTTON')).toBe(
      'integration_required',
    );
  });
});

describe('resolveFieldKind', () => {
  it('returns text for TEXT and HIDDEN', () => {
    expect(resolveFieldKind('TEXT')).toBe('text');
    expect(resolveFieldKind('HIDDEN')).toBe('text');
  });

  it('returns password for PASSWORD and PASSWORD_VERIFY', () => {
    expect(resolveFieldKind('PASSWORD')).toBe('password');
    expect(resolveFieldKind('PASSWORD_VERIFY')).toBe('password');
  });

  it.each(['SINGLE_SELECT', 'DROPDOWN', 'RADIO'])(
    'returns singleSelect for %s',
    (type) => {
      expect(resolveFieldKind(type)).toBe('singleSelect');
    },
  );

  it.each(['MULTI_SELECT', 'COMBOBOX', 'CHECKBOX'])(
    'returns multiSelect for %s',
    (type) => {
      expect(resolveFieldKind(type)).toBe('multiSelect');
    },
  );

  it('returns phone for PHONE_NUMBER', () => {
    expect(resolveFieldKind('PHONE_NUMBER')).toBe('phone');
  });

  it.each(['DEVICE_REGISTRATION', 'DEVICE_AUTHENTICATION'])(
    'returns device for %s',
    (type) => {
      expect(resolveFieldKind(type)).toBe('device');
    },
  );

  it('returns output for LABEL', () => {
    expect(resolveFieldKind('LABEL')).toBe('output');
  });

  it.each(['SUBMIT_BUTTON', 'ACTION', 'FLOW_BUTTON', 'FLOW_LINK'])(
    'returns flow for %s',
    (type) => {
      expect(resolveFieldKind(type)).toBe('flow');
    },
  );

  it('returns integration for SOCIAL_LOGIN_BUTTON', () => {
    expect(resolveFieldKind('SOCIAL_LOGIN_BUTTON')).toBe('integration');
  });

  it('returns unknown for unrecognised types', () => {
    expect(resolveFieldKind('UNKNOWN_TYPE')).toBe('unknown');
    expect(resolveFieldKind('')).toBe('unknown');
  });
});

describe('normalizeCollectors', () => {
  it('enriches each collector with executionMode and requiresUserInput', () => {
    const collectors: DaVinciCollector[] = [
      baseField('username', 'TEXT', true),
      baseField('submit', 'SUBMIT_BUTTON'),
      { key: 'msg', type: 'LABEL', content: 'hi' },
      baseField('mystery', 'BAD_TYPE'),
    ];

    const result = normalizeCollectors(collectors);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      key: 'username',
      executionMode: 'manual',
      requiresUserInput: true,
    });
    expect(result[1]).toMatchObject({
      key: 'submit',
      executionMode: 'immediate',
      requiresUserInput: false,
    });
    expect(result[2]).toMatchObject({
      key: 'msg',
      executionMode: 'output_only',
      requiresUserInput: false,
    });
    expect(result[3]).toMatchObject({
      key: 'mystery',
      executionMode: 'unsupported',
      requiresUserInput: false,
    });
  });

  it('requiresUserInput is true only for manual types', () => {
    manualTypes.forEach((type) => {
      const [normalized] = normalizeCollectors([baseField('k', type)]);
      expect(normalized.requiresUserInput).toBe(true);
    });

    [...immediateTypes, 'LABEL', 'UNKNOWN'].forEach((type) => {
      const [normalized] = normalizeCollectors([
        type === 'LABEL'
          ? ({ key: 'k', type, content: 'c' } as DaVinciCollector)
          : baseField('k', type),
      ]);
      expect(normalized.requiresUserInput).toBe(false);
    });
  });

  it('returns an empty array for empty input', () => {
    expect(normalizeCollectors([])).toEqual([]);
  });

  it('resolves kind per collector type', () => {
    const collectors: DaVinciCollector[] = [
      baseField('username', 'TEXT'),
      baseField('password', 'PASSWORD'),
      baseField('country', 'SINGLE_SELECT'),
      baseField('roles', 'MULTI_SELECT'),
      baseField('phone', 'PHONE_NUMBER'),
      baseField('device', 'DEVICE_AUTHENTICATION'),
      { key: 'banner', type: 'LABEL', content: 'hi' } as DaVinciCollector,
      baseField('submit', 'SUBMIT_BUTTON'),
      baseField('mystery', 'WHAT'),
    ];

    const result = normalizeCollectors(collectors);
    expect(result.map((c) => c.kind)).toEqual([
      'text',
      'password',
      'singleSelect',
      'multiSelect',
      'phone',
      'device',
      'output',
      'flow',
      'unknown',
    ]);
  });

  it('extracts defaultValue from a server-seeded TEXT collector', () => {
    const collector: DaVinciCollector = {
      key: 'username',
      type: 'TEXT',
      label: 'Username',
      required: true,
      value: 'alice',
    } as DaVinciCollector;

    const [normalized] = normalizeCollectors([collector]);
    expect(normalized.defaultValue).toBe('alice');
  });

  it('extracts defaultValue from a server-seeded MULTI_SELECT collector', () => {
    const collector: DaVinciCollector = {
      key: 'roles',
      type: 'MULTI_SELECT',
      label: 'Roles',
      required: false,
      value: ['admin', 'user'],
      options: [],
    } as DaVinciCollector;

    const [normalized] = normalizeCollectors([collector]);
    expect(normalized.defaultValue).toEqual(['admin', 'user']);
  });

  it('extracts defaultValue from a server-seeded PHONE_NUMBER collector', () => {
    const collector: DaVinciCollector = {
      key: 'phone',
      type: 'PHONE_NUMBER',
      label: 'Phone',
      required: false,
      defaultCountryCode: '+1',
      validatePhoneNumber: true,
      countryCode: '+44',
      phoneNumber: '5551234',
    } as DaVinciCollector;

    const [normalized] = normalizeCollectors([collector]);
    expect(normalized.defaultValue).toEqual({
      countryCode: '+44',
      phoneNumber: '5551234',
    });
  });

  it('returns undefined defaultValue for collectors with no seed', () => {
    const [normalized] = normalizeCollectors([
      { key: 'banner', type: 'LABEL', content: 'hi' } as DaVinciCollector,
    ]);
    expect(normalized.defaultValue).toBeUndefined();
  });

  it('passes through raw from the bridge payload', () => {
    const raw = { type: 'TEXT', inputType: 'TEXT', key: 'username' };
    const collector: DaVinciCollector = {
      key: 'username',
      type: 'TEXT',
      label: 'Username',
      required: true,
      value: '',
      raw,
    } as DaVinciCollector;

    const [normalized] = normalizeCollectors([collector]);
    expect(normalized.raw).toBe(raw);
  });
});

describe('buildNextInput — no active node', () => {
  it('returns NO_ACTIVE_CONTINUE_NODE when node is null', () => {
    const result = buildNextInput(null, {});
    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'NO_ACTIVE_CONTINUE_NODE' });
    expect(result.input.collectors).toEqual([]);
  });

  it('returns NO_ACTIVE_CONTINUE_NODE when node is undefined', () => {
    const result = buildNextInput(undefined, {});
    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'NO_ACTIVE_CONTINUE_NODE' });
  });

  it('returns NO_ACTIVE_CONTINUE_NODE for non-ContinueNode', () => {
    const result = buildNextInput(
      { type: 'SuccessNode', session: { value: 'tok' } },
      {},
    );
    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'NO_ACTIVE_CONTINUE_NODE' });
  });
});

describe('buildNextInput — integration_required path', () => {
  it('omits handled integration collectors silently when type is in the set', () => {
    const handled = new Set(['SOCIAL_LOGIN_BUTTON']);
    const result = buildNextInput(
      makeNode([baseField('idp', 'SOCIAL_LOGIN_BUTTON')]),
      {},
      handled,
    );
    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.input.collectors).toEqual([]);
  });

  it('emits INTEGRATION_REQUIRED issue and blocks submit when type is not in the set', () => {
    const result = buildNextInput(
      makeNode([baseField('idp', 'SOCIAL_LOGIN_BUTTON')]),
      {},
      new Set(),
    );
    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'INTEGRATION_REQUIRED',
        key: 'idp',
      }),
    ]);
    expect(result.input.collectors).toEqual([]);
  });

  it('emits INTEGRATION_REQUIRED issue when handledCollectorTypes is omitted', () => {
    const result = buildNextInput(
      makeNode([baseField('idp', 'SOCIAL_LOGIN_BUTTON')]),
      {},
    );
    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'INTEGRATION_REQUIRED',
      key: 'idp',
    });
  });
});

describe('buildNextInput — flowKey path', () => {
  it('emits a single-entry payload for the chosen FLOW_BUTTON', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('forgot', 'FLOW_BUTTON'),
    ]);

    const result = buildNextInput(node, { username: '' }, undefined, 'forgot');

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.input.collectors).toEqual([
      { key: 'forgot', value: 'forgot' },
    ]);
  });

  it('ignores all other values when flowKey is provided', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('password', 'PASSWORD', true),
      baseField('forgot', 'FLOW_LINK'),
    ]);

    const result = buildNextInput(
      node,
      { username: 'alice', password: 'secret' },
      undefined,
      'forgot',
    );

    expect(result.input.collectors).toEqual([
      { key: 'forgot', value: 'forgot' },
    ]);
    expect(result.input.collectors).toHaveLength(1);
  });

  it('does not produce REQUIRED_VALUE_MISSING issues in flowKey path', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('forgot', 'FLOW_BUTTON'),
    ]);

    const result = buildNextInput(node, {}, undefined, 'forgot');

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('still emits the key even when the flowKey is unknown', () => {
    const node = makeNode([baseField('username', 'TEXT')]);

    const result = buildNextInput(node, {}, undefined, 'missing-key');

    expect(result.canSubmit).toBe(true);
    expect(result.input.collectors).toEqual([
      { key: 'missing-key', value: 'missing-key' },
    ]);
  });
});

describe('buildNextInput — manual collector path', () => {
  it('returns canSubmit=true with no issues when required fields are filled', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('password', 'PASSWORD', true),
    ]);

    const result = buildNextInput(node, {
      username: 'alice',
      password: 'secret',
    });

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.input.collectors).toEqual([
      { key: 'username', value: 'alice' },
      { key: 'password', value: 'secret' },
    ]);
  });

  it('returns REQUIRED_VALUE_MISSING when a required field is unset', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('password', 'PASSWORD', true),
    ]);

    const result = buildNextInput(node, { username: 'alice' });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'REQUIRED_VALUE_MISSING',
        key: 'password',
      }),
    ]);
  });

  it('returns REQUIRED_VALUE_MISSING when a required field is empty string', () => {
    const node = makeNode([baseField('username', 'TEXT', true)]);

    const result = buildNextInput(node, { username: '' });

    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'REQUIRED_VALUE_MISSING',
      key: 'username',
    });
  });

  it('omits collectors with undefined value rather than emitting null', () => {
    const node = makeNode([baseField('opt', 'TEXT')]);

    const result = buildNextInput(node, {});

    expect(result.canSubmit).toBe(true);
    expect(result.input.collectors).toEqual([]);
  });

  it('treats MULTI_SELECT value as string[]', () => {
    const node = makeNode([baseField('roles', 'MULTI_SELECT', true)]);

    const result = buildNextInput(node, { roles: ['a', 'b'] });

    expect(result.canSubmit).toBe(true);
    expect(result.input.collectors).toEqual([
      { key: 'roles', value: ['a', 'b'] },
    ]);
  });

  it('treats empty MULTI_SELECT array as REQUIRED_VALUE_MISSING', () => {
    const node = makeNode([baseField('roles', 'MULTI_SELECT', true)]);

    const result = buildNextInput(node, { roles: [] });

    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'REQUIRED_VALUE_MISSING',
      key: 'roles',
    });
  });

  it('treats PHONE_NUMBER value as { countryCode, phoneNumber }', () => {
    const node = makeNode([baseField('phone', 'PHONE_NUMBER', true)]);

    const phone = { countryCode: '+1', phoneNumber: '5555555' };
    const result = buildNextInput(node, { phone });

    expect(result.canSubmit).toBe(true);
    expect(result.input.collectors).toEqual([{ key: 'phone', value: phone }]);
  });

  it('treats PHONE_NUMBER with empty phoneNumber as REQUIRED_VALUE_MISSING', () => {
    const node = makeNode([baseField('phone', 'PHONE_NUMBER', true)]);

    const result = buildNextInput(node, {
      phone: { countryCode: '+1', phoneNumber: '' },
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'REQUIRED_VALUE_MISSING',
      key: 'phone',
    });
  });

  it('treats DEVICE_AUTHENTICATION value as { type, id?, description? }', () => {
    const node = makeNode([baseField('device', 'DEVICE_AUTHENTICATION', true)]);

    const device = { type: 'EMAIL', id: 'abc', description: 'email' };
    const result = buildNextInput(node, { device });

    expect(result.canSubmit).toBe(true);
    expect(result.input.collectors).toEqual([{ key: 'device', value: device }]);
  });

  it('treats DEVICE_AUTHENTICATION with empty type as REQUIRED_VALUE_MISSING', () => {
    const node = makeNode([baseField('device', 'DEVICE_AUTHENTICATION', true)]);

    const result = buildNextInput(node, { device: { type: '' } });

    expect(result.canSubmit).toBe(false);
    expect(result.issues[0]).toMatchObject({
      code: 'REQUIRED_VALUE_MISSING',
      key: 'device',
    });
  });
});

describe('buildNextInput — excluded modes', () => {
  it('includes SUBMIT_BUTTON with its key as the value so the native SDK sets actionKey/eventType', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('submit', 'SUBMIT_BUTTON'),
    ]);

    const result = buildNextInput(node, { username: 'alice' });

    expect(result.input.collectors).toEqual([
      { key: 'username', value: 'alice' },
      { key: 'submit', value: 'submit' },
    ]);
  });

  it('includes only the first SUBMIT_BUTTON when multiple are present', () => {
    const node = makeNode([
      baseField('submit1', 'SUBMIT_BUTTON'),
      baseField('submit2', 'SUBMIT_BUTTON'),
    ]);

    const result = buildNextInput(node, {});

    expect(
      result.input.collectors.filter((c) => c.key === 'submit1'),
    ).toHaveLength(1);
    expect(
      result.input.collectors.filter((c) => c.key === 'submit2'),
    ).toHaveLength(0);
  });

  it('excludes ACTION, FLOW_BUTTON, and FLOW_LINK from regular-submit payload', () => {
    const node = makeNode([
      baseField('username', 'TEXT', true),
      baseField('action', 'ACTION'),
      baseField('flowBtn', 'FLOW_BUTTON'),
      baseField('flowLink', 'FLOW_LINK'),
    ]);

    const result = buildNextInput(node, { username: 'alice' });

    expect(result.input.collectors).toEqual([
      { key: 'username', value: 'alice' },
    ]);
  });

  it('excludes output_only collectors from payload entirely', () => {
    const node = makeNode([
      { key: 'banner', type: 'LABEL', content: 'hi' } as DaVinciCollector,
      baseField('username', 'TEXT'),
    ]);

    const result = buildNextInput(node, { username: 'alice' });

    expect(result.input.collectors).toEqual([
      { key: 'username', value: 'alice' },
    ]);
  });

  it('excludes integration_required collectors from payload and blocks submit when unhandled', () => {
    const node = makeNode([baseField('idp', 'SOCIAL_LOGIN_BUTTON')]);
    const result = buildNextInput(node, {});

    expect(result.input.collectors).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'INTEGRATION_REQUIRED',
        key: 'idp',
      }),
    ]);
    expect(result.canSubmit).toBe(false);
  });

  it('emits non-blocking UNSUPPORTED_COLLECTOR for unknown types', () => {
    const node = makeNode([baseField('mystery', 'WHAT_IS_THIS')]);

    const result = buildNextInput(node, {});

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_COLLECTOR',
        key: 'mystery',
      }),
    ]);
    expect(result.input.collectors).toEqual([]);
  });

  it('canSubmit stays true when only an UNSUPPORTED_COLLECTOR issue exists', () => {
    const node = makeNode([baseField('mystery', 'BAD')]);

    const result = buildNextInput(node, {});

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toHaveLength(1);
  });
});

describe('computeFormMeta', () => {
  it('flags hasManual when any manual collector is present', () => {
    const collectors = normalizeCollectors([baseField('username', 'TEXT')]);
    expect(computeFormMeta(collectors).hasManual).toBe(true);
  });

  it('flags hasOutputOnly when LABEL is present', () => {
    const collectors = normalizeCollectors([
      { key: 'l', type: 'LABEL', content: 'x' } as DaVinciCollector,
    ]);
    expect(computeFormMeta(collectors).hasOutputOnly).toBe(true);
  });

  it('flags hasUnsupported when an unknown collector is present', () => {
    const collectors = normalizeCollectors([baseField('mystery', 'UNKNOWN')]);
    expect(computeFormMeta(collectors).hasUnsupported).toBe(true);
  });

  it('flags hasIntegrationRequired when a plugin collector is present', () => {
    const integrationCollector: DaVinciNormalizedCollector = {
      ...baseField('idp', 'SOCIAL_LOGIN_BUTTON'),
      executionMode: 'integration_required',
      requiresUserInput: false,
    } as DaVinciNormalizedCollector;

    expect(computeFormMeta([integrationCollector])).toEqual({
      hasManual: false,
      hasOutputOnly: false,
      hasAutoCapable: false,
      hasIntegrationRequired: true,
      hasUnsupported: false,
    });
  });

  it('all flags false for an empty form', () => {
    expect(computeFormMeta([])).toEqual({
      hasManual: false,
      hasOutputOnly: false,
      hasAutoCapable: false,
      hasIntegrationRequired: false,
      hasUnsupported: false,
    });
  });

  it('hasAutoCapable is always false — no auto_capable execution mode exists in the base package', () => {
    const collectors = normalizeCollectors([
      baseField('username', 'TEXT'),
      { key: 'l', type: 'LABEL', content: 'x' } as DaVinciCollector,
      baseField('submit', 'SUBMIT_BUTTON'),
    ]);
    expect(computeFormMeta(collectors).hasAutoCapable).toBe(false);
  });
});

describe('IDP collector (SDKS-5128)', () => {
  const idpCollector: DaVinciCollector = {
    key: 'google-idp-123',
    type: 'SOCIAL_LOGIN_BUTTON',
    label: 'Sign in with Google',
    idpId: 'google-idp-123',
    idpType: 'GOOGLE',
    idpEnabled: true,
  } as DaVinciCollector;

  it("resolveExecutionMode('SOCIAL_LOGIN_BUTTON') returns integration_required", () => {
    expect(resolveExecutionMode('SOCIAL_LOGIN_BUTTON')).toBe(
      'integration_required',
    );
  });

  it("resolveFieldKind('SOCIAL_LOGIN_BUTTON') returns integration", () => {
    expect(resolveFieldKind('SOCIAL_LOGIN_BUTTON')).toBe('integration');
  });

  it('normalizeCollectors gives IDP collector kind:integration and executionMode:integration_required', () => {
    const [normalized] = normalizeCollectors([idpCollector]);
    expect(normalized.executionMode).toBe('integration_required');
    expect(normalized.kind).toBe('integration');
    expect(normalized.requiresUserInput).toBe(false);
  });

  it('buildNextInput blocks submit when IDP collector is not in handledCollectorTypes', () => {
    const node = makeNode([idpCollector]);
    const { canSubmit, issues } = buildNextInput(node, {});
    expect(canSubmit).toBe(false);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INTEGRATION_REQUIRED',
        key: 'google-idp-123',
      }),
    );
  });

  it('buildNextInput allows submit when IDP collector is in handledCollectorTypes', () => {
    const node = makeNode([idpCollector]);
    const { canSubmit, issues } = buildNextInput(
      node,
      {},
      new Set(['SOCIAL_LOGIN_BUTTON']),
    );
    expect(canSubmit).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it('computeFormMeta reflects hasIntegrationRequired:true for IDP-only node', () => {
    const normalized = normalizeCollectors([idpCollector]);
    const meta = computeFormMeta(normalized);
    expect(meta.hasIntegrationRequired).toBe(true);
    expect(meta.hasManual).toBe(false);
  });
});
