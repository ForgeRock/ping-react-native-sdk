/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { buildNextInput, normalizeCallbacks } from '../callbackHelpers';

type JourneyNode = import('../types').JourneyNode;

describe('Journey callback helpers', () => {
  it('normalizes callback fields with deterministic type indexes', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'NameCallback', output: [] },
        { type: 'PasswordCallback', output: [] },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({
      id: 'NameCallback:0',
      ref: { type: 'NameCallback', typeIndex: 0 },
      kind: 'text',
      executionMode: 'manual',
    });
    expect(fields[1]).toMatchObject({
      id: 'NameCallback:1',
      ref: { type: 'NameCallback', typeIndex: 1 },
    });
    expect(fields[0]?.prompt).toBe('');
  });

  it('keeps callback message separate from prompt fallback policy', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'TextOutputCallback',
          message: 'Server message only',
          output: [],
        },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      id: 'TextOutputCallback:0',
      prompt: '',
      message: 'Server message only',
    });
  });

  it('does not synthesize option labels when callback omits them', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ChoiceCallback',
          options: [{ value: 'a' }, 'server-option'],
          output: [],
        },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.options).toEqual([
      { index: 0, label: '', value: { value: 'a' } },
      { index: 1, label: 'server-option', value: 'server-option' },
    ]);
  });

  it('normalizes native choice callback options from choices key', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ChoiceCallback',
          choices: ['email', 'sms'],
          output: [],
        },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.options).toEqual([
      { index: 0, label: 'email', value: 'email' },
      { index: 1, label: 'sms', value: 'sms' },
    ]);
  });

  it('does not apply implicit selectedIndex default for choice callbacks', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'ChoiceCallback', options: ['A', 'B'], output: [] }],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.defaultValue).toBeUndefined();
  });

  it('marks HiddenValueCallback as non-interactive manual field', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'HiddenValueCallback', value: 'false', output: [] }],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      id: 'HiddenValueCallback:0',
      executionMode: 'manual',
      requiresUserInput: false,
      kind: 'text',
    });
  });

  it('does not treat negative selectedIndex as a default value', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'ConfirmationCallback', selectedIndex: -1, output: [] },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.defaultValue).toBeUndefined();
  });

  it('resolves required when callback payload uses isRequired key', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'TermsAndConditionsCallback', isRequired: true, output: [] },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.required).toBe(true);
  });

  it('builds next payload for supported manual callbacks', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'PasswordCallback', output: [] },
        { type: 'NumberAttributeInputCallback', output: [] },
      ],
    };

    const result = buildNextInput(node, {
      'NameCallback:0': 'demo-user',
      'PasswordCallback:0': 'demo-pass',
      'NumberAttributeInputCallback:0': '42',
    });

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.input).toEqual({
      callbacks: [
        { type: 'NameCallback', index: 0, value: 'demo-user' },
        { type: 'PasswordCallback', index: 0, value: 'demo-pass' },
        { type: 'NumberAttributeInputCallback', index: 0, value: 42 },
      ],
    });
  });

  it('does not coerce empty string number input to zero', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NumberAttributeInputCallback', output: [] }],
    };

    const result = buildNextInput(node, {
      'NumberAttributeInputCallback:0': '',
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'INVALID_VALUE',
        message:
          'Callback "NumberAttributeInputCallback" requires a numeric value.',
        fieldId: 'NumberAttributeInputCallback:0',
        callbackType: 'NumberAttributeInputCallback',
      },
    ]);
  });

  it('blocks canSubmit when DeviceProfileCallback is not in handledCallbackTypes', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'DeviceProfileCallback', output: [] }],
    };

    const result = buildNextInput(node, {});

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'INTEGRATION_REQUIRED',
        message:
          'Callback "DeviceProfileCallback" requires additional integration.',
        fieldId: 'DeviceProfileCallback:0',
        callbackType: 'DeviceProfileCallback',
      },
    ]);
  });

  it('allows canSubmit when DeviceProfileCallback is listed in handledCallbackTypes', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'DeviceProfileCallback', output: [] }],
    };

    const result = buildNextInput(
      node,
      {},
      new Set(['DeviceProfileCallback'] as const),
    );

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.input).toEqual({});
  });

  it('enforces required terms acceptance', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'TermsAndConditionsCallback', required: true, output: [] },
      ],
    };

    const result = buildNextInput(node, {
      'TermsAndConditionsCallback:0': false,
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'REQUIRED_CONSENT_MISSING',
        message:
          'Required callback "TermsAndConditionsCallback" must be accepted to continue.',
        fieldId: 'TermsAndConditionsCallback:0',
        callbackType: 'TermsAndConditionsCallback',
      },
    ]);
  });

  it('normalizes consent mapping callback as required boolean input', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ConsentMappingCallback',
          message: 'Allow profile sharing',
          required: true,
          accepted: false,
          output: [],
        },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      id: 'ConsentMappingCallback:0',
      ref: { type: 'ConsentMappingCallback', typeIndex: 0 },
      kind: 'boolean',
      executionMode: 'manual',
      required: true,
      message: 'Allow profile sharing',
      defaultValue: false,
    });
  });

  it('classifies fido and captcha callbacks as integration-required', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'FidoAuthenticationCallback', output: [] },
        { type: 'ReCaptchaEnterpriseCallback', output: [] },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      id: 'FidoAuthenticationCallback:0',
      executionMode: 'integration_required',
    });
    expect(fields[1]).toMatchObject({
      id: 'ReCaptchaEnterpriseCallback:0',
      executionMode: 'integration_required',
    });
  });

  it('classifies external IdP callback casing variants as integration-required', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'IdPCallback', output: [] },
        { type: 'IdpCallback', output: [] },
      ],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      id: 'IdPCallback:0',
      executionMode: 'integration_required',
    });
    expect(fields[1]).toMatchObject({
      id: 'IdpCallback:0',
      executionMode: 'integration_required',
    });
  });

  it('enforces required consent mapping acceptance and builds boolean payload', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ConsentMappingCallback',
          required: true,
          accepted: false,
          output: [],
        },
      ],
    };

    const rejected = buildNextInput(node, {
      'ConsentMappingCallback:0': false,
    });

    expect(rejected.canSubmit).toBe(false);
    expect(rejected.issues).toEqual([
      {
        code: 'REQUIRED_CONSENT_MISSING',
        message:
          'Required callback "ConsentMappingCallback" must be accepted to continue.',
        fieldId: 'ConsentMappingCallback:0',
        callbackType: 'ConsentMappingCallback',
      },
    ]);

    const accepted = buildNextInput(node, {
      'ConsentMappingCallback:0': true,
    });

    expect(accepted.canSubmit).toBe(true);
    expect(accepted.issues).toEqual([]);
    expect(accepted.input).toEqual({
      callbacks: [
        {
          type: 'ConsentMappingCallback',
          index: 0,
          value: true,
        },
      ],
    });
  });

  it('does not force terms callback as required when payload does not mark it required', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'TermsAndConditionsCallback', output: [] }],
    };

    const result = buildNextInput(node, {
      'TermsAndConditionsCallback:0': false,
    });

    expect(result.canSubmit).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.input).toEqual({
      callbacks: [
        {
          type: 'TermsAndConditionsCallback',
          index: 0,
          value: false,
        },
      ],
    });
  });

  it('enforces required text callback value', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', required: true, output: [] }],
    };

    const result = buildNextInput(node, {
      'NameCallback:0': '   ',
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'INVALID_VALUE',
        message: 'Callback "NameCallback" requires a non-empty value.',
        fieldId: 'NameCallback:0',
        callbackType: 'NameCallback',
      },
    ]);
  });

  it('enforces required KBA question and answer', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'KbaCreateCallback', required: true, output: [] }],
    };

    const result = buildNextInput(node, {
      'KbaCreateCallback:0': {
        selectedQuestion: '',
        selectedAnswer: ' ',
        allowUserDefinedQuestions: true,
      },
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'INVALID_VALUE',
        message:
          'Callback "KbaCreateCallback" requires non-empty KBA question and answer values.',
        fieldId: 'KbaCreateCallback:0',
        callbackType: 'KbaCreateCallback',
      },
    ]);
  });

  it('rejects out-of-range choice index', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ChoiceCallback',
          choices: ['email', 'sms'],
          output: [],
        },
      ],
    };

    const result = buildNextInput(node, {
      'ChoiceCallback:0': 10,
    });

    expect(result.canSubmit).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'INVALID_VALUE',
        message:
          'Callback "ChoiceCallback" selected option index is out of range.',
        fieldId: 'ChoiceCallback:0',
        callbackType: 'ChoiceCallback',
      },
    ]);
  });
});

describe('normalizeCallbacks — typed named fields', () => {
  it('surfaces type shorthand equal to ref.type on every field', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        {
          type: 'ChoiceCallback',
          choices: ['a', 'b'],
          defaultChoice: 0,
          output: [],
        },
      ],
    };
    const fields = normalizeCallbacks(node);
    fields.forEach((f) => {
      expect(f.type).toBe(f.ref.type);
    });
  });

  it('adds choices and defaultChoice to ChoiceCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ChoiceCallback',
          choices: ['email', 'sms', 'totp'],
          defaultChoice: 1,
          selectedIndex: 0,
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('ChoiceCallback');
    if (field.type === 'ChoiceCallback') {
      expect(field.choices).toEqual(['email', 'sms', 'totp']);
      expect(field.defaultChoice).toBe(1);
    }
  });

  it('adds predefinedQuestions and allowUserDefinedQuestions to KbaCreateCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'KbaCreateCallback',
          predefinedQuestions: ['What is your pet?', 'What city?'],
          allowUserDefinedQuestions: true,
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('KbaCreateCallback');
    if (field.type === 'KbaCreateCallback') {
      expect(field.predefinedQuestions).toEqual([
        'What is your pet?',
        'What city?',
      ]);
      expect(field.allowUserDefinedQuestions).toBe(true);
    }
  });

  it('adds version, terms, createDate to TermsAndConditionsCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'TermsAndConditionsCallback',
          version: '1.0',
          terms: 'By using this service...',
          createDate: '2026-01-01',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('TermsAndConditionsCallback');
    if (field.type === 'TermsAndConditionsCallback') {
      expect(field.version).toBe('1.0');
      expect(field.terms).toBe('By using this service...');
      expect(field.createDate).toBe('2026-01-01');
    }
  });

  it('adds waitTime to PollingWaitCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'PollingWaitCallback', waitTime: 3000, output: [] }],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('PollingWaitCallback');
    if (field.type === 'PollingWaitCallback') {
      expect(field.waitTime).toBe(3000);
    }
  });

  it('adds messageType to TextOutputCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'TextOutputCallback',
          messageType: 'ERROR',
          message: 'Oops',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('TextOutputCallback');
    if (field.type === 'TextOutputCallback') {
      expect(field.messageType).toBe('ERROR');
    }
  });

  it('adds callbackId to HiddenValueCallback fields without colliding with field id', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'HiddenValueCallback',
          id: 'csrf-token',
          value: 'abc123',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('HiddenValueCallback');
    expect(field.id).toBe('HiddenValueCallback:0'); // field key, not shadowed
    if (field.type === 'HiddenValueCallback') {
      expect(field.callbackId).toBe('csrf-token');
    }
  });

  it('adds selectedIndex and defaultOption to ConfirmationCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ConfirmationCallback',
          options: ['OK', 'Cancel'],
          selectedIndex: 0,
          defaultOption: 'POSITIVE',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('ConfirmationCallback');
    if (field.type === 'ConfirmationCallback') {
      expect(field.selectedIndex).toBe(0);
      expect(field.defaultOption).toBe('POSITIVE');
    }
  });

  it('adds messageType to SuspendedTextOutputCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'SuspendedTextOutputCallback',
          messageType: 'WARNING',
          message: 'Session paused',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('SuspendedTextOutputCallback');
    if (field.type === 'SuspendedTextOutputCallback') {
      expect(field.messageType).toBe('WARNING');
    }
  });

  it('adds name and optional fields to ConsentMappingCallback fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ConsentMappingCallback',
          name: 'profile-read',
          displayName: 'Read Profile',
          icon: 'profile-icon',
          accessLevel: 'READ',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('ConsentMappingCallback');
    if (field.type === 'ConsentMappingCallback') {
      expect(field.name).toBe('profile-read');
      expect(field.displayName).toBe('Read Profile');
      expect(field.icon).toBe('profile-icon');
      expect(field.accessLevel).toBe('READ');
    }
  });

  it('omits optional ConsentMappingCallback fields when absent from payload', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'ConsentMappingCallback',
          name: 'minimal-consent',
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('ConsentMappingCallback');
    if (field.type === 'ConsentMappingCallback') {
      expect(field.name).toBe('minimal-consent');
      expect(field.displayName).toBeUndefined();
      expect(field.icon).toBeUndefined();
      expect(field.accessLevel).toBeUndefined();
    }
  });

  it('adds value to FidoRegistrationCallback fields when present', () => {
    const credentialOptions = {
      challenge: 'abc123',
      rp: { id: 'example.com' },
    };
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'FidoRegistrationCallback',
          value: credentialOptions,
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('FidoRegistrationCallback');
    if (field.type === 'FidoRegistrationCallback') {
      expect(field.value).toEqual(credentialOptions);
    }
  });

  it('omits value from FidoRegistrationCallback fields when absent', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'FidoRegistrationCallback', output: [] }],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('FidoRegistrationCallback');
    if (field.type === 'FidoRegistrationCallback') {
      expect(field.value).toBeUndefined();
    }
  });

  it('adds value to FidoAuthenticationCallback fields when present', () => {
    const assertionOptions = { challenge: 'xyz789', rpId: 'example.com' };
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        {
          type: 'FidoAuthenticationCallback',
          value: assertionOptions,
          output: [],
        },
      ],
    };
    const [field] = normalizeCallbacks(node);
    expect(field.type).toBe('FidoAuthenticationCallback');
    if (field.type === 'FidoAuthenticationCallback') {
      expect(field.value).toEqual(assertionOptions);
    }
  });
});
