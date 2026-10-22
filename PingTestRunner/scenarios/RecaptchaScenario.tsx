/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * RecaptchaScenario — headless test screen for @ping-identity/rn-recaptcha E2E tests.
 *
 * Renders the active Journey step through useJourney + useJourneyForm with
 * ReCaptchaEnterpriseCallback claimed via `handledCallbackTypes`, a Verify
 * button driving `recaptcha.verifyForJourney`, and a Next button gated on
 * `form.canSubmit` that calls `actions.next(form.input)`.
 *
 * Real Google verification requires an environment-configured site key and a
 * reCAPTCHA Enterprise-enabled journey tree. When the environment lacks one the
 * scenario degrades deterministically: the verify attempt surfaces the bridge
 * failure payload (or a no-field error) in recaptcha-result, so E2E asserts
 * wiring rather than Google's service.
 *
 * testIDs:
 *   recaptcha-start-btn             → calls client.init() then actions.start()
 *   recaptcha-loading               → visible while actions.loading === true
 *   recaptcha-error                 → visible when actions.error !== null
 *   recaptcha-field-{fieldId}       → per-callback field (e.g. recaptcha-field-NameCallback:0)
 *   recaptcha-field-recaptcha-info-{fieldId} → informational badge on ReCaptchaEnterpriseCallback fields
 *   recaptcha-verify-button         → runs createRecaptchaClient().verifyForJourney
 *   recaptcha-result                → verify outcome (success | failure code/message | error)
 *   recaptcha-next-btn              → calls actions.next(form.input), rendered when form.canSubmit
 *   recaptcha-next-blocked          → visible when a ContinueNode is present but canSubmit is false
 *   recaptcha-success               → visible on SuccessNode
 *   recaptcha-failure               → visible on FailureNode/ErrorNode
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createJourneyClient,
  useJourney,
  useJourneyForm,
} from '@ping-identity/rn-journey';
import type {
  JourneyFormValue,
  JourneyNormalizedField,
} from '@ping-identity/rn-journey';
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';
import { callbackType } from '@ping-identity/rn-types';
import type { JourneyCallbackType } from '@ping-identity/rn-journey';

// ─── launch args ─────────────────────────────────────────────────────────────

interface RecaptchaLaunchArgs {
  PING_SERVER_URL?: string;
  PING_REALM_PATH?: string;
  PING_JOURNEY_NAME?: string;
  PING_COOKIE_NAME?: string;
}

const args = LaunchArguments.value<RecaptchaLaunchArgs>();
const SERVER_URL = args.PING_SERVER_URL ?? '';
const REALM_PATH = args.PING_REALM_PATH ?? '/alpha';
const JOURNEY_NAME = args.PING_JOURNEY_NAME ?? 'Login';
const COOKIE_NAME = args.PING_COOKIE_NAME ?? 'iPlanetDirectoryPro';
// Stable module-level set — useJourneyForm keys its submit plan on the
// handledCallbackTypes identity, so it must not be recreated per render.
const HANDLED_CALLBACK_TYPES: ReadonlySet<JourneyCallbackType> = new Set([
  callbackType.ReCaptchaEnterpriseCallback,
]);

// ─── verify outcome state ────────────────────────────────────────────────────

type VerifyOutcome =
  | { kind: 'success' }
  | { kind: 'failure'; code: string; message: string }
  | { kind: 'error'; message: string };

function renderOutcome(outcome: VerifyOutcome): string {
  if (outcome.kind === 'success') {
    return 'Verification succeeded';
  }
  if (outcome.kind === 'failure') {
    return `Verification failed (${outcome.code}): ${outcome.message}`;
  }
  return `Verify error: ${outcome.message}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function RecaptchaScenario(): React.JSX.Element {
  if (!SERVER_URL.trim()) {
    return <RecaptchaNotConfigured />;
  }
  return <RecaptchaFlow />;
}

/**
 * Deterministic degradation screen rendered when no server is configured.
 * Keeps the same testID surface (verify button + result) so E2E can assert
 * wiring without a live environment.
 */
function RecaptchaNotConfigured(): React.JSX.Element {
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const handleVerify = useCallback(() => {
    setOutcome({
      kind: 'error',
      message:
        'Journey not configured — set PING_SERVER_URL (plus a reCAPTCHA Enterprise-enabled tree) to exercise live verification.',
    });
  }, []);

  return (
    <View>
      <Text testID="recaptcha-not-configured">
        reCAPTCHA scenario requires PING_SERVER_URL.
      </Text>
      <Button
        testID="recaptcha-verify-button"
        title="Verify"
        onPress={handleVerify}
      />
      {outcome !== null && (
        <Text testID="recaptcha-result">{renderOutcome(outcome)}</Text>
      )}
    </View>
  );
}

function RecaptchaFlow(): React.JSX.Element {
  const client = useMemo(
    () =>
      createJourneyClient({
        serverUrl: SERVER_URL,
        realm: REALM_PATH,
        cookie: COOKIE_NAME,
        timeout: 25000,
      }),
    [],
  );

  const [node, actions] = useJourney(client);
  const form = useJourneyForm(node, {
    handledCallbackTypes: HANDLED_CALLBACK_TYPES,
  });

  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const handleStart = useCallback(async () => {
    try {
      await client.init();
      await actions.start(JOURNEY_NAME, { forceAuth: true });
      setOutcome(null);
    } catch {
      // actions.error updated by hook
    }
  }, [client, actions]);

  const handleVerify = useCallback(async () => {
    const recaptchaFields = form.fields.filter(
      (field) => field.ref.type === callbackType.ReCaptchaEnterpriseCallback,
    );
    if (recaptchaFields.length === 0) {
      setOutcome({
        kind: 'error',
        message:
          'No ReCaptchaEnterpriseCallback field on the active Journey node.',
      });
      return;
    }
    try {
      // Created per attempt, mirroring the README usage example. The factory
      // resolves the native module eagerly — a missing module surfaces here as
      // an error outcome instead of crashing the scenario.
      const recaptcha = createRecaptchaClient();
      let last: VerifyOutcome | null = null;
      for (const field of recaptchaFields) {
        const result = await recaptcha.verifyForJourney(client, {
          index: field.ref.typeIndex,
          // site key is read natively from the callback payload — never passed here
        });
        if (result.type === 'success') {
          // The token is credential-equivalent — never rendered or logged.
          last = { kind: 'success' };
        } else {
          // Callback inputs already carry the client error; the server decides
          // whether to re-issue the Captcha node.
          last = {
            kind: 'failure',
            code: result.code,
            message: result.message,
          };
        }
      }
      setOutcome(last);
    } catch (error) {
      setOutcome({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [client, form.fields]);

  const handleNext = useCallback(async () => {
    try {
      await actions.next(form.input);
    } catch {
      // actions.error updated by hook
    }
  }, [actions, form.input]);

  return (
    <View>
      <Button
        testID="recaptcha-start-btn"
        title="Start"
        onPress={handleStart}
      />

      {actions.loading && <Text testID="recaptcha-loading">Loading…</Text>}

      {actions.error !== null && (
        <Text testID="recaptcha-error">{actions.error.message}</Text>
      )}

      <Button
        testID="recaptcha-verify-button"
        title="Verify"
        onPress={handleVerify}
      />

      {outcome !== null && (
        <Text testID="recaptcha-result">{renderOutcome(outcome)}</Text>
      )}

      {node?.type === 'ContinueNode' && !actions.loading && (
        <View>
          {form.fields.map((field) => (
            <FlowFieldInput
              key={field.id}
              field={field}
              value={form.values[field.id]}
              onValueChange={(val) => form.setValue(field.id, val)}
            />
          ))}
          {form.canSubmit ? (
            <Button
              testID="recaptcha-next-btn"
              title="Next"
              onPress={handleNext}
            />
          ) : (
            form.issues.length > 0 && (
              <Text testID="recaptcha-next-blocked">
                {form.issues[0].message}
              </Text>
            )
          )}
        </View>
      )}

      {node?.type === 'SuccessNode' && (
        <Text testID="recaptcha-success">Success</Text>
      )}

      {(node?.type === 'FailureNode' || node?.type === 'ErrorNode') && (
        <Text testID="recaptcha-failure">
          {node.cause ?? node.message ?? 'Failure'}
        </Text>
      )}
    </View>
  );
}

// ─── FlowFieldInput ──────────────────────────────────────────────────────────

interface FlowFieldInputProps {
  field: JourneyNormalizedField;
  value: JourneyFormValue | undefined;
  onValueChange: (val: JourneyFormValue) => void;
}

function FlowFieldInput({
  field,
  value,
  onValueChange,
}: FlowFieldInputProps): React.JSX.Element | null {
  const testID = `recaptcha-field-${field.id}`;

  // ReCaptchaEnterpriseCallback carries no user-editable value — the native
  // callback fills its own inputs during verifyForJourney. Surface the
  // informational site key instead of an input control.
  if (field.type === 'ReCaptchaEnterpriseCallback') {
    return (
      <View testID={testID}>
        <Text testID={`recaptcha-field-recaptcha-info-${field.id}`}>
          {field.siteKey
            ? 'reCAPTCHA Enterprise (site key present)'
            : 'reCAPTCHA Enterprise (no site key in payload)'}
        </Text>
      </View>
    );
  }

  if (field.kind === 'output') {
    return (
      <Text testID={`recaptcha-field-output-${field.id}`}>
        {field.prompt || field.message || ''}
      </Text>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <Switch
        testID={testID}
        value={typeof value === 'boolean' ? value : false}
        onValueChange={onValueChange}
      />
    );
  }

  if (field.kind === 'choice') {
    return (
      <View testID={testID}>
        {(field.options ?? []).map((opt) => (
          <TouchableOpacity
            key={opt.index}
            testID={`${testID}-option-${opt.index}`}
            onPress={() => onValueChange(opt.index)}
          >
            <Text>{String(opt.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <TextInput
      testID={testID}
      secureTextEntry={field.kind === 'password'}
      value={typeof value === 'string' ? value : ''}
      onChangeText={(t) => onValueChange(t)}
      placeholder={field.prompt}
    />
  );
}
