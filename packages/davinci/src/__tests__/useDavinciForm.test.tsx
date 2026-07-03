/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import { integrationRequiredCollectorTypes } from '../collectorHelpers';
import { useDaVinciForm } from '../useDavinciForm';

type ContinueNode = import('../types').ContinueNode;
type DaVinciNode = import('../types').DaVinciNode;
type DaVinciFormResult = import('../types').DaVinciFormResult;

type Harness = {
  node: DaVinciNode | null | undefined;
  options?: import('../types').DaVinciFormOptions;
  onResult: (result: DaVinciFormResult) => void;
};

function FormHarness(props: Harness): React.ReactElement | null {
  const { node, options, onResult } = props;
  const form = useDaVinciForm(node, options);
  useEffect(() => {
    onResult(form);
  }, [form, onResult]);
  return null;
}

function requireLatest(result: DaVinciFormResult | null): DaVinciFormResult {
  if (!result) throw new Error('Expected form result to be available.');
  return result;
}

const continueNode: ContinueNode = {
  type: 'ContinueNode',
  collectors: [
    {
      key: 'username',
      type: 'TEXT',
      label: 'Username',
      required: true,
      value: 'alice',
    },
    {
      key: 'password',
      type: 'PASSWORD',
      label: 'Password',
      required: true,
      value: '',
    },
    { key: 'submit', type: 'SUBMIT_BUTTON', label: 'Submit', required: false },
    { key: 'forgot', type: 'FLOW_BUTTON', label: 'Forgot?', required: false },
  ],
};

describe('useDaVinciForm — field hydration', () => {
  it('hydrates defaultValue from a server-seeded TEXT collector on first render', () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    // username has value: 'alice' so defaultValue 'alice' is hydrated
    expect(requireLatest(latest).values['username']).toBe('alice');
    // password has value: '' so defaultValue '' is hydrated as an empty string
    expect(requireLatest(latest).values['password']).toBe('');
  });

  it('resets and re-hydrates values when the node changes', async () => {
    const node: DaVinciNode = continueNode;
    let latest: DaVinciFormResult | null = null;

    const { rerender } = render(
      <FormHarness
        node={node}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('username', 'bob');
    });
    expect(requireLatest(latest).values['username']).toBe('bob');

    const nextNode: ContinueNode = {
      type: 'ContinueNode',
      collectors: [
        {
          key: 'username',
          type: 'TEXT',
          label: 'Username',
          required: true,
          value: 'carol',
        },
      ],
    };

    rerender(
      <FormHarness
        node={nextNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    // After node switch, values reset and new defaultValue is hydrated
    expect(requireLatest(latest).values['username']).toBe('carol');
  });

  it('returns empty fields and NO_ACTIVE_CONTINUE_NODE when node is null', () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={null}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    const form = requireLatest(latest);
    expect(form.fields).toEqual([]);
    expect(form.canSubmit).toBe(false);
    expect(form.issues[0]).toMatchObject({ code: 'NO_ACTIVE_CONTINUE_NODE' });
  });
});

describe('useDaVinciForm — setValue / setValues / clearValue / reset', () => {
  it('setValue updates a single field value', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('password', 'secret');
    });

    expect(requireLatest(latest).values['password']).toBe('secret');
  });

  it('setValues merges with a static patch', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValues({ username: 'eve', password: 'pw' });
    });

    expect(requireLatest(latest).values['username']).toBe('eve');
    expect(requireLatest(latest).values['password']).toBe('pw');
  });

  it('setValues merges with an updater function', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValues({ username: 'alice' });
    });

    await act(async () => {
      requireLatest(latest).setValues((prev) => ({
        username: `${prev['username']}-2`,
      }));
    });

    expect(requireLatest(latest).values['username']).toBe('alice-2');
  });

  it('clearValue removes a single key from values', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('password', 'secret');
    });

    await act(async () => {
      requireLatest(latest).clearValue('password');
    });

    expect('password' in requireLatest(latest).values).toBe(false);
  });

  it('reset restores defaultValue hydration', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('username', 'modified');
    });

    await act(async () => {
      requireLatest(latest).reset();
    });

    // username has defaultValue 'alice' (from value: 'alice') so it re-hydrates
    expect(requireLatest(latest).values['username']).toBe('alice');
  });
});

describe('useDaVinciForm — canSubmit / issues', () => {
  it('canSubmit is false before required values are filled', () => {
    const node: ContinueNode = {
      type: 'ContinueNode',
      collectors: [
        {
          key: 'username',
          type: 'TEXT',
          label: 'Username',
          required: true,
          value: '',
        },
        {
          key: 'password',
          type: 'PASSWORD',
          label: 'Password',
          required: true,
          value: '',
        },
      ],
    };
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={node}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    expect(requireLatest(latest).canSubmit).toBe(false);
    expect(
      requireLatest(latest).issues.some(
        (i) => i.code === 'REQUIRED_VALUE_MISSING',
      ),
    ).toBe(true);
  });

  it('canSubmit is true once all required fields are filled', async () => {
    const node: ContinueNode = {
      type: 'ContinueNode',
      collectors: [
        {
          key: 'username',
          type: 'TEXT',
          label: 'Username',
          required: true,
          value: '',
        },
        {
          key: 'password',
          type: 'PASSWORD',
          label: 'Password',
          required: true,
          value: '',
        },
        {
          key: 'submit',
          type: 'SUBMIT_BUTTON',
          label: 'Submit',
          required: false,
        },
      ],
    };
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={node}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('username', 'alice');
      requireLatest(latest).setValue('password', 'secret');
    });

    expect(requireLatest(latest).canSubmit).toBe(true);
    expect(requireLatest(latest).issues).toEqual([]);
  });
});

describe('useDaVinciForm — buildInput', () => {
  it('applies overrides without mutating state', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('password', 'secret');
    });

    const plan = requireLatest(latest).buildInput({ username: 'override' });

    expect(plan.canSubmit).toBe(true);
    expect(plan.input.collectors).toContainEqual({
      key: 'username',
      value: 'override',
    });
    expect(plan.input.collectors).toContainEqual({
      key: 'password',
      value: 'secret',
    });
    // State must not have been mutated
    expect(requireLatest(latest).values['username']).toBe('alice');
  });
});

describe('useDaVinciForm — getField / getFieldsByType / getFieldByType', () => {
  it('getField returns the field by key', () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    const field = requireLatest(latest).getField('username');
    expect(field).toBeDefined();
    expect(field?.key).toBe('username');
    expect(field?.type).toBe('TEXT');
  });

  it('getField returns undefined for unknown key', () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    expect(requireLatest(latest).getField('nonexistent')).toBeUndefined();
  });

  it('getFieldsByType returns all fields of a given type', () => {
    const node: ContinueNode = {
      type: 'ContinueNode',
      collectors: [
        { key: 'a', type: 'TEXT', label: 'A', required: false, value: '' },
        { key: 'b', type: 'TEXT', label: 'B', required: false, value: '' },
        { key: 'c', type: 'PASSWORD', label: 'C', required: false, value: '' },
      ],
    };
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={node}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    const textFields = requireLatest(latest).getFieldsByType('TEXT');
    expect(textFields).toHaveLength(2);
    expect(textFields.map((f) => f.key)).toEqual(['a', 'b']);

    const pwFields = requireLatest(latest).getFieldsByType('PASSWORD');
    expect(pwFields).toHaveLength(1);
  });

  it('getFieldByType returns the nth field of a type', () => {
    const node: ContinueNode = {
      type: 'ContinueNode',
      collectors: [
        { key: 'a', type: 'TEXT', label: 'A', required: false, value: '' },
        { key: 'b', type: 'TEXT', label: 'B', required: false, value: '' },
      ],
    };
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={node}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    expect(requireLatest(latest).getFieldByType('TEXT', 0)?.key).toBe('a');
    expect(requireLatest(latest).getFieldByType('TEXT', 1)?.key).toBe('b');
    expect(requireLatest(latest).getFieldByType('TEXT', 2)).toBeUndefined();
    expect(requireLatest(latest).getFieldByType('TEXT', -1)).toBeUndefined();
  });
});

describe('useDaVinciForm — setValueByType', () => {
  it('sets value for the first field of a type by default', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValueByType('TEXT', 'new-value');
    });

    expect(requireLatest(latest).values['username']).toBe('new-value');
  });

  it('returns false when type is not found', async () => {
    let result = false;
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={continueNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      result = requireLatest(latest).setValueByType('NONEXISTENT', 'value');
    });

    expect(result).toBe(false);
  });
});

describe('useDaVinciForm — handledCollectorTypes', () => {
  it('omits handled integration collectors and allows canSubmit=true', async () => {
    integrationRequiredCollectorTypes.add('IDP');
    try {
      const node: ContinueNode = {
        type: 'ContinueNode',
        collectors: [
          { key: 'idp', type: 'IDP', label: 'IdP', required: false },
          {
            key: 'submit',
            type: 'SUBMIT_BUTTON',
            label: 'Submit',
            required: false,
          },
        ] as ContinueNode['collectors'],
      };
      let latest: DaVinciFormResult | null = null;

      render(
        <FormHarness
          node={node}
          options={{ handledCollectorTypes: new Set(['IDP']) }}
          onResult={(r) => {
            latest = r;
          }}
        />,
      );

      expect(requireLatest(latest).canSubmit).toBe(true);
      expect(requireLatest(latest).issues).toEqual([]);
    } finally {
      integrationRequiredCollectorTypes.delete('IDP');
    }
  });

  it('emits INTEGRATION_REQUIRED and blocks submit when type is not in the set', async () => {
    integrationRequiredCollectorTypes.add('IDP');
    try {
      const node: ContinueNode = {
        type: 'ContinueNode',
        collectors: [
          { key: 'idp', type: 'IDP', label: 'IdP', required: false },
        ] as ContinueNode['collectors'],
      };
      let latest: DaVinciFormResult | null = null;

      render(
        <FormHarness
          node={node}
          onResult={(r) => {
            latest = r;
          }}
        />,
      );

      expect(requireLatest(latest).canSubmit).toBe(false);
      expect(
        requireLatest(latest).issues.some(
          (i) => i.code === 'INTEGRATION_REQUIRED',
        ),
      ).toBe(true);
    } finally {
      integrationRequiredCollectorTypes.delete('IDP');
    }
  });
});

describe('useDaVinciForm — submitFlow', () => {
  const flowNode: ContinueNode = {
    type: 'ContinueNode',
    collectors: [
      {
        key: 'username',
        type: 'TEXT',
        label: 'Username',
        required: true,
        value: 'alice',
      },
      { key: 'forgot', type: 'FLOW_BUTTON', label: 'Forgot?', required: false },
      {
        key: 'register',
        type: 'FLOW_LINK',
        label: 'Register',
        required: false,
      },
    ],
  };

  const successNode: DaVinciNode = {
    type: 'SuccessNode',
    session: { value: 'tok' },
  };

  it('calls options.next with the flow payload and returns the next node', async () => {
    const mockNext = jest.fn(async () => successNode);
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={flowNode}
        options={{ next: mockNext }}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let result: DaVinciNode | undefined;
    await act(async () => {
      result = await requireLatest(latest).submitFlow('forgot');
    });

    expect(result).toBe(successNode);
    expect(mockNext).toHaveBeenCalledTimes(1);
    const callArg = mockNext.mock.calls[0]?.[0];
    expect(callArg?.collectors).toEqual([{ key: 'forgot', value: 'forgot' }]);
  });

  it('uses the form value for the flow key when one is set', async () => {
    const mockNext = jest.fn(async () => successNode);
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={flowNode}
        options={{ next: mockNext }}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      requireLatest(latest).setValue('forgot', 'custom-value');
    });

    await act(async () => {
      await requireLatest(latest).submitFlow('forgot');
    });

    const callArg = mockNext.mock.calls[0]?.[0];
    expect(callArg?.collectors).toEqual([
      { key: 'forgot', value: 'custom-value' },
    ]);
  });

  it('works with a FLOW_LINK collector', async () => {
    const mockNext = jest.fn(async () => successNode);
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={flowNode}
        options={{ next: mockNext }}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    await act(async () => {
      await requireLatest(latest).submitFlow('register');
    });

    expect(mockNext).toHaveBeenCalledTimes(1);
    const callArg = mockNext.mock.calls[0]?.[0];
    expect(callArg?.collectors).toEqual([
      { key: 'register', value: 'register' },
    ]);
  });

  it('throws DaVinciError when neither options.next nor a provider context is available', async () => {
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={flowNode}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let err: unknown;
    await act(async () => {
      err = await requireLatest(latest)
        .submitFlow('forgot')
        .catch((e: unknown) => e);
    });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('DaVinciError');
    expect((err as { code: string }).code).toBe('DAVINCI_STATE_ERROR');
  });

  it('propagates rejection from options.next as-is', async () => {
    const boom = new Error('network failure');
    const mockNext = jest.fn(async () => {
      throw boom;
    });
    let latest: DaVinciFormResult | null = null;

    render(
      <FormHarness
        node={flowNode}
        options={{ next: mockNext }}
        onResult={(r) => {
          latest = r;
        }}
      />,
    );

    let err: unknown;
    await act(async () => {
      err = await requireLatest(latest)
        .submitFlow('forgot')
        .catch((e: unknown) => e);
    });

    expect(err).toBe(boom);
  });
});
