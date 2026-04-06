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
        { type: 'TextOutputCallback', message: 'Server message only', output: [] },
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
      callbacks: [{ type: 'ConfirmationCallback', selectedIndex: -1, output: [] }],
    };

    const fields = normalizeCallbacks(node);

    expect(fields).toHaveLength(1);
    expect(fields[0]?.defaultValue).toBeUndefined();
  });

  it('resolves required when callback payload uses isRequired key', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'TermsAndConditionsCallback', isRequired: true, output: [] }],
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
        message: 'Callback "NumberAttributeInputCallback" requires a numeric value.',
        fieldId: 'NumberAttributeInputCallback:0',
        callbackType: 'NumberAttributeInputCallback',
      },
    ]);
  });

  it('treats device profile callback as output-only for helper submit planning', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'DeviceProfileCallback', output: [] },
      ],
    };

    const result = buildNextInput(node, {});

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
        message: 'Required callback "TermsAndConditionsCallback" must be accepted to continue.',
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
        message: 'Required callback "ConsentMappingCallback" must be accepted to continue.',
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
        message: 'Callback "KbaCreateCallback" requires non-empty KBA question and answer values.',
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
        message: 'Callback "ChoiceCallback" selected option index is out of range.',
        fieldId: 'ChoiceCallback:0',
        callbackType: 'ChoiceCallback',
      },
    ]);
  });
});
