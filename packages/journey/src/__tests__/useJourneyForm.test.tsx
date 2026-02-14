/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useJourneyForm } from '../useJourneyForm';

type JourneyFormResult = import('../types').JourneyFormResult;
type JourneyNode = import('../types').JourneyNode;

type JourneyFormHarnessProps = {
  node: JourneyNode | null;
  onResult: (result: JourneyFormResult) => void;
};

/**
 * Returns non-null form result for assertions.
 *
 * @param result - Nullable form result.
 * @returns Non-null form result.
 * @throws {Error} When result is null.
 */
function requireLatest(result: JourneyFormResult | null): JourneyFormResult {
  if (!result) {
    throw new Error('Expected hook result to be available.');
  }
  return result;
}

/**
 * Test harness for observing `useJourneyForm` state.
 *
 * @param props - Harness props.
 * @returns Null render output.
 */
function JourneyFormHarness(props: JourneyFormHarnessProps): React.ReactElement | null {
  const { node, onResult } = props;
  const form = useJourneyForm(node);

  useEffect(() => {
    onResult(form);
  }, [form, onResult]);

  return null;
}

describe('useJourneyForm', () => {
  it('seeds smart defaults for normalized fields', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'TermsAndConditionsCallback', required: true, output: [] },
      ],
    };

    let latest: JourneyFormResult | null = null;

    act(() => {
      TestRenderer.create(
        <JourneyFormHarness
          node={node}
          onResult={(result) => {
            latest = result;
          }}
        />
      );
    });

    const form = requireLatest(latest);
    expect(form.values).toMatchObject({
      'NameCallback:0': '',
      'TermsAndConditionsCallback:0': false,
    });
    expect(form.canSubmit).toBe(false);
  });

  it('builds deterministic input after values are updated', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'TermsAndConditionsCallback', required: true, output: [] },
      ],
    };

    let latest: JourneyFormResult | null = null;

    act(() => {
      TestRenderer.create(
        <JourneyFormHarness
          node={node}
          onResult={(result) => {
            latest = result;
          }}
        />
      );
    });

    act(() => {
      requireLatest(latest).setValue('NameCallback:0', 'demo-user');
      requireLatest(latest).setValue('TermsAndConditionsCallback:0', true);
    });

    const form = requireLatest(latest);
    expect(form.canSubmit).toBe(true);
    expect(form.issues).toEqual([]);
    expect(form.input).toEqual({
      callbacks: [
        { type: 'NameCallback', index: 0, value: 'demo-user' },
        { type: 'TermsAndConditionsCallback', index: 0, value: true },
      ],
    });
  });

  it('resets form values when node changes by default', () => {
    const firstNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };

    const secondNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };

    let latest: JourneyFormResult | null = null;

    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <JourneyFormHarness
          node={firstNode}
          onResult={(result) => {
            latest = result;
          }}
        />
      );
    });

    act(() => {
      requireLatest(latest).setValue('NameCallback:0', 'custom-value');
    });

    expect(requireLatest(latest).values['NameCallback:0']).toBe('custom-value');

    act(() => {
      renderer?.update(
        <JourneyFormHarness
          node={secondNode}
          onResult={(result) => {
            latest = result;
          }}
        />
      );
    });

    expect(requireLatest(latest).values['NameCallback:0']).toBe('');
  });
});
