/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Config from 'react-native-config';
import { createRecognizeClient } from '@ping-identity/rn-recognize';
import type {
  JourneyInstance,
  RecognizeResult,
} from '@ping-identity/rn-recognize';
import Keyless, {
  SetupConfig,
  BiomAuthConfig,
  BiomEnrollConfig,
  BiomDeEnrollConfig,
  ClientStateType,
} from '@react-native-keyless/sdk';
import type { KeylessResult } from '@react-native-keyless/sdk';

/**
 * Which data layer executes the Recognize ceremony.
 *
 * - `ping-native`: `@ping-identity/rn-recognize` bridging the Ping native
 *   Recognize modules (assessment Option 2).
 * - `keyless-vendor`: the Keyless React Native package driven directly from
 *   JavaScript through a Journey/DaVinci adapter (assessment Option 1).
 */
export type RecognizeProvider = 'ping-native' | 'keyless-vendor';

export type RecognizeRunOptions = {
  index?: number;
  retrieveSelfie?: boolean;
};

/**
 * A Journey callback payload as surfaced by `useJourney` nodes. Kept
 * structural so the executor does not import rn-journey types directly.
 */
export type RecognizeNodeCallback = {
  type: string;
  raw?: {
    output?: Array<{ name?: string; value?: unknown }>;
    input?: Array<{ name?: string; value?: unknown }>;
  };
};

/**
 * One prepared write-back entry for a Journey `PingOneRecognizeCallback`:
 * submit through `next({callbacks: [entry]})`.
 */
export type RecognizeSubmitInput = {
  type: string;
  value: string[];
  index: number;
};

export type RecognizeExecutor = {
  /** Resolved provider name, for screens to display. */
  provider: RecognizeProvider;
  runForJourney(
    journey: JourneyInstance,
    options?: RecognizeRunOptions,
    nodeCallbacks?: RecognizeNodeCallback[],
  ): Promise<RecognizeResult>;
  runForDaVinci(
    daVinci: unknown,
    options?: RecognizeRunOptions,
  ): Promise<RecognizeResult>;
};

const VENDOR_GATE_MESSAGE =
  'keyless-vendor provider does not support DaVinci yet (collector write-back pending)';

const vendorGateResult = (): RecognizeResult => ({
  type: 'failure',
  code: 'PROVIDER_UNSUPPORTED',
  message: VENDOR_GATE_MESSAGE,
});

// ---------------------------------------------------------------------------
// ping-native executor — thin wrapper over @ping-identity/rn-recognize
// ---------------------------------------------------------------------------

function createPingNativeExecutor(): RecognizeExecutor {
  const client = createRecognizeClient();
  return {
    provider: 'ping-native',
    runForJourney: (journey, options) => client.runForJourney(journey, options),
    runForDaVinci: (daVinci, options) =>
      client.runForDaVinci(daVinci as never, options),
  };
}

// ---------------------------------------------------------------------------
// keyless-vendor executor — Keyless RN package driven from JS
// ---------------------------------------------------------------------------

type RecognizeServerFields = {
  apiKey: string;
  host: string;
  operationType: string;
  clientState: string;
  transactionData: string;
  audience: string;
  generateClientState: boolean;
  inputNames: string[];
  inputOriginalValues: string[];
};

type VendorOutcome = {
  signedJwt: string;
  clientState: string;
  recognizeId: string;
  devicePublicSigningKey: string;
  clientError: string;
  clientErrorCode: string;
};

function readServerFields(
  callback: RecognizeNodeCallback,
): RecognizeServerFields | null {
  const output = callback.raw?.output;
  if (!Array.isArray(output)) {
    return null;
  }
  const read = (name: string): string => {
    const entry = output.find(item => item.name === name);
    const value = entry?.value;
    return typeof value === 'string' ? value : '';
  };
  const generateClientStateRaw = output.find(
    item => item.name === 'generateClientState',
  )?.value;
  return {
    apiKey: read('apiKey'),
    host: read('host'),
    operationType: read('operationType'),
    clientState: read('clientState'),
    transactionData: read('transactionData'),
    audience: read('audience'),
    generateClientState:
      generateClientStateRaw === true ||
      (typeof generateClientStateRaw === 'string' &&
        generateClientStateRaw.toLowerCase() === 'true'),
    inputNames: (callback.raw?.input ?? []).map(item => item.name ?? ''),
    inputOriginalValues: (callback.raw?.input ?? []).map(item =>
      typeof item.value === 'string' ? item.value : '',
    ),
  };
}

const emptyOutcome = (
  clientError: string,
  clientErrorCode: string,
): VendorOutcome => ({
  signedJwt: '',
  clientState: '',
  recognizeId: '',
  devicePublicSigningKey: '',
  clientError,
  clientErrorCode,
});

const toFailure = (result: KeylessResult<unknown>): string =>
  result.isFailure()
    ? JSON.stringify({
        code: result.error.code,
        message: result.error.message ?? '',
      })
    : '{}';

/**
 * Builds the ordered positional write-back for a Journey
 * `PingOneRecognizeCallback`: one value per server-defined slot, in the
 * server's order, keeping the server's original value wherever the ceremony
 * produced nothing (mirrors the iOS native module's nil-skip semantics).
 */
export function buildVendorSubmitInput(
  callback: RecognizeNodeCallback,
  outcome: VendorOutcome,
  index: number,
): RecognizeSubmitInput {
  const fields = readServerFields(callback);
  const byName: Record<string, string> = {
    IDToken1signedJwt: outcome.signedJwt,
    IDToken1clientState: outcome.clientState,
    IDToken1recognizeId: outcome.recognizeId,
    IDToken1devicePublicSigningKey: outcome.devicePublicSigningKey,
    IDToken1clientError: outcome.clientError,
    IDToken1clientErrorCode: outcome.clientErrorCode,
  };
  const slotNames = fields?.inputNames.length
    ? fields.inputNames
    : [
        'IDToken1signedJwt',
        'IDToken1clientState',
        'IDToken1recognizeId',
        'IDToken1devicePublicSigningKey',
        'IDToken1clientError',
        'IDToken1clientErrorCode',
      ];
  const originalValues = fields?.inputOriginalValues ?? [];
  const value = slotNames.map((name, slotIndex) => {
    const submitted = byName[name] ?? '';
    return submitted !== '' ? submitted : (originalValues[slotIndex] ?? '');
  });
  return { type: 'PingOneRecognizeCallback', value, index };
}

function createKeylessVendorExecutor(): RecognizeExecutor {
  const signingKey = async (): Promise<string> => {
    const result = await Keyless.getDevicePublicSigningKey();
    return result.isSuccess() ? result.data : '';
  };

  const ensureConfigured = async (
    fields: RecognizeServerFields,
  ): Promise<boolean> => {
    const configured = await Keyless.configure(
      new SetupConfig({ apiKey: fields.apiKey, hosts: [fields.host] }),
    );
    if (!configured.isSuccess()) {
      console.warn(
        `[recognize-executor] configure failed -> ${toFailure(configured)}`,
      );
      return false;
    }
    return true;
  };

  const runCeremony = async (
    fields: RecognizeServerFields,
  ): Promise<VendorOutcome> => {
    const jwtSigningInfo = fields.transactionData
      ? {
          claimTransactionData: fields.transactionData,
          audience: fields.audience || undefined,
        }
      : undefined;

    if (fields.operationType === 'AUTHENTICATE') {
      const first = await Keyless.authenticate(
        new BiomAuthConfig({ jwtSigningInfo }),
      );
      if (first.isSuccess()) {
        return {
          signedJwt: first.data.signedJwt ?? '',
          clientState: first.data.clientState ?? '',
          recognizeId: '',
          devicePublicSigningKey: await signingKey(),
          clientError: '',
          clientErrorCode: '',
        };
      }
      console.warn(
        `[recognize-executor] authenticate failed -> ${toFailure(first)}`,
      );
      console.warn(
        '[recognize-executor] falling back: de-enroll + enroll + authenticate',
      );
      const deEnrolled = await Keyless.deEnroll(new BiomDeEnrollConfig());
      if (!deEnrolled.isSuccess()) {
        return emptyOutcome(
          deEnrolled.isFailure() ? (deEnrolled.error.message ?? '') : '',
          deEnrolled.isFailure() ? String(deEnrolled.error.code) : '1000',
        );
      }
      const reEnrolled = await Keyless.enroll(
        new BiomEnrollConfig({
          jwtSigningInfo,
          clientState: fields.clientState || undefined,
        }),
      );
      if (!reEnrolled.isSuccess()) {
        return emptyOutcome(
          reEnrolled.isFailure() ? (reEnrolled.error.message ?? '') : '',
          reEnrolled.isFailure() ? String(reEnrolled.error.code) : '1000',
        );
      }
      const retried = await Keyless.authenticate(
        new BiomAuthConfig({ jwtSigningInfo }),
      );
      if (retried.isSuccess()) {
        return {
          signedJwt: retried.data.signedJwt ?? '',
          clientState: retried.data.clientState ?? '',
          recognizeId: reEnrolled.data.keylessId,
          devicePublicSigningKey: await signingKey(),
          clientError: '',
          clientErrorCode: '',
        };
      }
      return emptyOutcome(
        retried.isFailure() ? (retried.error.message ?? '') : '',
        retried.isFailure() ? String(retried.error.code) : '1000',
      );
    }

    // ENROLL — reconcile a stale device enrollment (Keyless 20001) by
    // de-enrolling first.
    let result = await Keyless.enroll(
      new BiomEnrollConfig({
        jwtSigningInfo,
        clientState: fields.clientState || undefined,
        generatingClientState: fields.generateClientState
          ? ClientStateType.BACKUP
          : undefined,
      }),
    );
    if (
      !result.isSuccess() &&
      result.isFailure() &&
      result.error.code === 20001
    ) {
      console.warn(
        '[recognize-executor] enroll rejected (20001) -> de-enrolling first',
      );
      const deEnrolled = await Keyless.deEnroll(new BiomDeEnrollConfig());
      if (!deEnrolled.isSuccess()) {
        return emptyOutcome(
          deEnrolled.isFailure() ? (deEnrolled.error.message ?? '') : '',
          deEnrolled.isFailure() ? String(deEnrolled.error.code) : '1000',
        );
      }
      result = await Keyless.enroll(
        new BiomEnrollConfig({
          jwtSigningInfo,
          clientState: fields.clientState || undefined,
          generatingClientState: fields.generateClientState
            ? ClientStateType.BACKUP
            : undefined,
        }),
      );
    }
    if (result.isSuccess()) {
      return {
        signedJwt: result.data.signedJwt ?? '',
        clientState: result.data.clientState ?? '',
        recognizeId: result.data.keylessId,
        devicePublicSigningKey: await signingKey(),
        clientError: '',
        clientErrorCode: '',
      };
    }
    return emptyOutcome(
      result.isFailure() ? (result.error.message ?? '') : '',
      result.isFailure() ? String(result.error.code) : '1000',
    );
  };

  return {
    provider: 'keyless-vendor',
    async runForJourney(journey, options, nodeCallbacks) {
      const index = options?.index ?? 0;
      const callback = nodeCallbacks?.filter(
        cb => cb.type === 'PingOneRecognizeCallback',
      )[index];
      if (!callback) {
        return {
          type: 'failure',
          code: 'RECOGNIZE_CALLBACK_NOT_FOUND',
          message: `No PingOneRecognizeCallback at index ${index}.`,
        };
      }
      const fields = readServerFields(callback);
      if (!fields) {
        return {
          type: 'failure',
          code: 'RECOGNIZE_FIELDS_MISSING',
          message: 'No raw output fields on the Recognize callback.',
        };
      }
      if (!fields.apiKey || !fields.host) {
        return {
          type: 'failure',
          code: 'RECOGNIZE_CONFIG_MISSING',
          message: 'Recognize callback is missing apiKey/host.',
        };
      }
      if (!(await ensureConfigured(fields))) {
        return {
          type: 'failure',
          code: '1000',
          message: 'Keyless configure failed.',
        };
      }
      const outcome = await runCeremony(fields);
      if (outcome.clientErrorCode) {
        return {
          type: 'failure',
          code: outcome.clientErrorCode,
          message: outcome.clientError,
        };
      }
      return { type: 'success', recognizeId: outcome.recognizeId };
    },
    async runForDaVinci() {
      console.warn(`[recognize-executor] ${VENDOR_GATE_MESSAGE}`);
      return vendorGateResult();
    },
  };
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

/**
 * Creates the Recognize executor selected by `RECOGNIZE_PROVIDER`.
 * Defaults to `ping-native` when unset or unrecognized.
 */
export function createRecognizeExecutor(): RecognizeExecutor {
  const raw = (Config.RECOGNIZE_PROVIDER ?? '').trim().toLowerCase();
  if (raw === 'keyless-vendor') {
    return createKeylessVendorExecutor();
  }
  if (raw && raw !== 'ping-native') {
    console.warn(
      `[recognize-executor] unknown RECOGNIZE_PROVIDER "${raw}", using ping-native`,
    );
  }
  return createPingNativeExecutor();
}
