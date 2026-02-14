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
      type: 'NameCallback',
      typeIndex: 0,
      kind: 'text',
      capability: 'manual',
    });
    expect(fields[1]).toMatchObject({
      id: 'NameCallback:1',
      type: 'NameCallback',
      typeIndex: 1,
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
});
