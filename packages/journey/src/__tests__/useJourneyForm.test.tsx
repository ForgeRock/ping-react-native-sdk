/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
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
function JourneyFormHarness(
  props: JourneyFormHarnessProps,
): React.ReactElement | null {
  const { node, onResult } = props;
  const form = useJourneyForm(node);

  useEffect(() => {
    onResult(form);
  }, [form, onResult]);

  return null;
}

describe('useJourneyForm', () => {
  it('seeds callback-provided defaults only', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'TermsAndConditionsCallback', required: true, output: [] },
      ],
    };

    let latest: JourneyFormResult | null = null;

    render(
      <JourneyFormHarness
        node={node}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    const form = requireLatest(latest);
    expect(form.values).toEqual({});
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

    render(
      <JourneyFormHarness
        node={node}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

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

    let rerender: ((ui: React.ReactElement) => void) | null = null;
    const rendered = render(
      <JourneyFormHarness
        node={firstNode}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );
    rerender = rendered.rerender;

    act(() => {
      requireLatest(latest).setValue('NameCallback:0', 'custom-value');
    });

    expect(requireLatest(latest).values['NameCallback:0']).toBe('custom-value');

    act(() => {
      rerender?.(
        <JourneyFormHarness
          node={secondNode}
          onResult={(result) => {
            latest = result;
          }}
        />,
      );
    });

    expect(requireLatest(latest).values['NameCallback:0']).toBeUndefined();
  });

  it('starts with attempted false', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };

    let latest: JourneyFormResult | null = null;

    render(
      <JourneyFormHarness
        node={node}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    expect(requireLatest(latest).attempted).toBe(false);
  });

  it('sets attempted to true after markAttempted is called', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };

    let latest: JourneyFormResult | null = null;

    render(
      <JourneyFormHarness
        node={node}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    expect(requireLatest(latest).attempted).toBe(false);

    act(() => {
      requireLatest(latest).markAttempted();
    });

    expect(requireLatest(latest).attempted).toBe(true);
  });

  it('resets attempted to false when node changes', () => {
    const firstNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'NameCallback', output: [] }],
    };

    const secondNode: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'PasswordCallback', output: [] }],
    };

    let latest: JourneyFormResult | null = null;

    let rerender: ((ui: React.ReactElement) => void) | null = null;
    const rendered = render(
      <JourneyFormHarness
        node={firstNode}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );
    rerender = rendered.rerender;

    act(() => {
      requireLatest(latest).markAttempted();
    });

    expect(requireLatest(latest).attempted).toBe(true);

    act(() => {
      rerender?.(
        <JourneyFormHarness
          node={secondNode}
          onResult={(result) => {
            latest = result;
          }}
        />,
      );
    });

    expect(requireLatest(latest).attempted).toBe(false);
  });

  it('warns in dev when integration_required callbacks are present without handledCallbackTypes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'DeviceProfileCallback', output: [] }],
    };

    render(<JourneyFormHarness node={node} onResult={() => {}} />);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DeviceProfileCallback'),
    );

    warnSpy.mockRestore();
  });

  it('does not warn when integration_required callbacks are listed in handledCallbackTypes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [{ type: 'DeviceProfileCallback', output: [] }],
    };

    function HandledHarness(): React.ReactElement | null {
      const form = useJourneyForm(node, {
        handledCallbackTypes: new Set(['DeviceProfileCallback'] as const),
      });
      useEffect(() => {}, [form]);
      return null;
    }

    render(<HandledHarness />);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('supports callback type based field lookup and updates', () => {
    const node: JourneyNode = {
      type: 'ContinueNode',
      callbacks: [
        { type: 'NameCallback', output: [] },
        { type: 'NameCallback', output: [] },
        { type: 'PasswordCallback', output: [] },
      ],
    };

    let latest: JourneyFormResult | null = null;

    render(
      <JourneyFormHarness
        node={node}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    const form = requireLatest(latest);
    expect(form.getFieldsByType('NameCallback')).toHaveLength(2);
    expect(form.getFieldByType('NameCallback', 1)?.id).toBe('NameCallback:1');

    act(() => {
      const applied = requireLatest(latest).setValueByType(
        'NameCallback',
        'typed-user',
        1,
      );
      expect(applied).toBe(true);
    });

    expect(requireLatest(latest).values['NameCallback:1']).toBe('typed-user');

    const missing = requireLatest(latest).setValueByType(
      'NameCallback',
      'nope',
      99,
    );
    expect(missing).toBe(false);
  });
});
