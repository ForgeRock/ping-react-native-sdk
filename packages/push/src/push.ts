/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { LoggerInstance } from '@ping-identity/rn-types';
import { DeviceEventEmitter, Platform } from 'react-native';
import { PushEvents } from './events';
import {
  fromNativeCredential,
  fromNativeCredentialList,
  fromNativeNotification,
  fromNativeNotificationList,
  fromNativeToken,
  fromNativeWrappedCredential,
  getNativeModule,
  toNativePushConfig,
} from './NativeRNPingPush';
import type {
  PushClient,
  PushClientConfig,
  PushConfig,
  PushCredential,
  PushError,
  PushNotification,
} from './types';

// Cache the APNs/FCM token at module-load time so it is never lost even if
// createPushClient() is called after the token event has already fired.
let _moduleLoadToken: string | null = null;
DeviceEventEmitter.addListener(
  Platform.OS === 'ios'
    ? PushEvents.APNS_TOKEN_RECEIVED
    : PushEvents.FCM_TOKEN_RECEIVED,
  (token: string) => {
    _moduleLoadToken = token;
  },
);

// Cache push messages that arrive while the app is open but before createPushClient()
// is called (e.g. user is on a different screen). Native only queues messages when the
// React context isn't ready yet (cold start), so these two queues never overlap.
const _jsPendingMessages: Record<string, string>[] = [];
DeviceEventEmitter.addListener(
  PushEvents.PUSH_MESSAGE_RECEIVED,
  (data: Record<string, string>) => {
    _jsPendingMessages.push(data);
  },
);

const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Creates a reusable Push MFA client instance.
 *
 * Resolves the provided {@link PushConfig} into a flat {@link PushClientConfig}
 * wire format, calls `initialize()` on the native module, and returns a
 * {@link PushClient} bound to the returned opaque client handle id.
 *
 * @param config - Optional runtime push configuration.
 * @returns A promise resolving to a {@link PushClient} bound to the resolved configuration.
 * @throws Error when the native Push module is unavailable.
 *
 * @example
 * ```ts
 * import { createPushClient } from '@ping-identity/rn-push';
 *
 * const client = await createPushClient({ timeoutMs: 20000 });
 * const credential = await client.addCredentialFromUri('pushauth://...');
 * ```
 */
export async function createPushClient(
  config: PushConfig = {},
): Promise<PushClient> {
  const logger = config.logger ?? noopLogger;

  const resolvedConfig: PushClientConfig = {
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
    storageId: config.storage?.id,
    enableCredentialCache: config.enableCredentialCache,
    timeoutMs: config.timeoutMs,
    cleanupMode: config.notificationCleanupConfig?.cleanupMode,
    maxStoredNotifications:
      config.notificationCleanupConfig?.maxStoredNotifications,
    maxNotificationAgeDays:
      config.notificationCleanupConfig?.maxNotificationAgeDays,
    encryptionEnabled: config.ios?.encryptionEnabled,
  };

  const clientId = await getNativeModule().initialize(
    toNativePushConfig(resolvedConfig),
  );

  logger.debug(
    `Push createClient config ${JSON.stringify(
      { hasLogger: Boolean(resolvedConfig.loggerId) },
      null,
      2,
    )}`,
  );
  logger.info('Push createClient success');

  // Ensure the device token is registered before returning the client.
  // Android: always fetch directly from Firebase — bypasses the DeviceEventEmitter
  //   path that can silently drop the token on real devices before the bridge is ready.
  // iOS: apply the cached APNs token if it arrived via didRegisterForRemoteNotificationsWithDeviceToken
  //   before createPushClient() was called. APNs has no on-demand fetch API so the
  //   event listener is the only mechanism available.
  if (Platform.OS === 'android') {
    await getNativeModule()
      .refreshToken(clientId)
      .then((result) => {
        const token = fromNativeToken(result as object);
        if (token) {
          _moduleLoadToken = token;
          tokenCallbacks.forEach((cb) => {
            try {
              cb(token);
            } catch (_e) {
              /* swallowed */
            }
          });
        }
      })
      .catch((err) => {
        logger.warn(`Push refreshToken (init) failed: ${err}`);
      });
  } else if (_moduleLoadToken) {
    const cachedToken = _moduleLoadToken;
    await getNativeModule()
      .setDeviceToken(clientId, cachedToken, null)
      .then(() => {
        tokenCallbacks.forEach((cb) => {
          try {
            cb(cachedToken);
          } catch (_e) {
            /* swallowed */
          }
        });
      })
      .catch((err) => {
        logger.warn(`Push setDeviceToken (cached) failed: ${err}`);
      });
  }

  type NotifCb = (n: PushNotification | null) => void;
  const notifCallbacks = new Set<NotifCb>();
  type TokenCb = (token: string) => void;
  const tokenCallbacks = new Set<TokenCb>();

  const tokenEventName =
    Platform.OS === 'ios'
      ? PushEvents.APNS_TOKEN_RECEIVED
      : PushEvents.FCM_TOKEN_RECEIVED;

  const tokenSub = DeviceEventEmitter.addListener(
    tokenEventName,
    (token: string) => {
      _moduleLoadToken = token;
      getNativeModule()
        .setDeviceToken(clientId, token, null)
        .then(() => {
          tokenCallbacks.forEach((cb) => {
            try {
              cb(token);
            } catch (_e) {
              /* user callback errors are intentionally swallowed */
            }
          });
        })
        .catch((err) => {
          logger.warn(`Push setDeviceToken failed: ${err}`);
        });
    },
  );

  const notifSub = DeviceEventEmitter.addListener(
    PushEvents.PUSH_MESSAGE_RECEIVED,
    async (data: Record<string, string>) => {
      // Remove from JS pre-client queue if it was captured there first (shouldn't
      // happen in practice since notifSub is registered before the drain, but be safe).
      const idx = _jsPendingMessages.indexOf(data);
      if (idx !== -1) _jsPendingMessages.splice(idx, 1);
      try {
        const result = await getNativeModule().processNotification(
          clientId,
          data as unknown as object,
        );
        const n = fromNativeNotification(result);
        notifCallbacks.forEach((cb) => {
          try {
            cb(n);
          } catch (_e) {
            /* user callback errors are intentionally swallowed */
          }
        });
      } catch (err) {
        logger.warn(`Push processNotification failed: ${err}`);
        notifCallbacks.forEach((cb) => {
          try {
            cb(null);
          } catch (_e) {
            /* user callback errors are intentionally swallowed */
          }
        });
      }
    },
  );

  // Drain messages that arrived before this client was created. Two sources:
  //   1. Native queue — cold start: FCM arrived before React context was ready.
  //   2. JS queue — app was open but client not yet created (user on another screen).
  // Process after a microtask tick so the caller can register onNotification() first.
  Promise.resolve().then(async () => {
    try {
      const nativePending =
        (await getNativeModule().consumePendingMessages()) as Record<
          string,
          string
        >[];
      const jsPending = _jsPendingMessages.splice(0);
      const allPending = [...nativePending, ...jsPending];
      for (const data of allPending) {
        try {
          const result = await getNativeModule().processNotification(
            clientId,
            data as unknown as object,
          );
          const n = fromNativeNotification(result);
          notifCallbacks.forEach((cb) => {
            try {
              cb(n);
            } catch (_e) {
              /* user callback errors are intentionally swallowed */
            }
          });
        } catch (err) {
          logger.warn(`Push drain processNotification failed: ${err}`);
          notifCallbacks.forEach((cb) => {
            try {
              cb(null);
            } catch (_e) {
              /* user callback errors are intentionally swallowed */
            }
          });
        }
      }
    } catch (err) {
      logger.warn(`Push drain consumePendingMessages failed: ${err}`);
    }
  });

  function removeInternalListeners() {
    tokenSub.remove();
    notifSub.remove();
    notifCallbacks.clear();
    tokenCallbacks.clear();
  }

  return {
    /**
     * Enrolls a new push credential from a `pushauth://` URI.
     *
     * @param uri - The `pushauth://` enrollment URI received from the server.
     * @returns A promise that resolves to the newly enrolled {@link PushCredential}.
     * @throws {@link PushError} with code `'invalid_uri'` if the URI is malformed.
     * @throws {@link PushError} with code `'duplicate_credential'` if already enrolled.
     * @throws {@link PushError} with code `'registration_failed'` if server registration fails.
     * @example
     * ```ts
     * const credential = await client.addCredentialFromUri('pushauth://...');
     * ```
     */
    async addCredentialFromUri(uri: string): Promise<PushCredential> {
      logger.debug('Push addCredentialFromUri requested');
      try {
        const result = await getNativeModule().addCredentialFromUri(
          clientId,
          uri,
        );
        logger.info('Push addCredentialFromUri success');
        return fromNativeCredential(result);
      } catch (error) {
        logger.error('Push addCredentialFromUri failed');
        throw error;
      }
    },

    /**
     * Saves an updated credential back to native storage.
     *
     * @param credential - The credential to persist. Must have been obtained from
     *   the bridge (e.g. via `getCredential`). The `sharedSecret` field is handled
     *   natively and is never included in the JS representation.
     * @returns A promise that resolves to the saved {@link PushCredential}.
     * @throws {@link PushError} with code `'credential_not_found'` if the credential does not exist.
     * @throws {@link PushError} with code `'storage_failure'` if persistence fails.
     * @example
     * ```ts
     * const saved = await client.saveCredential(credential);
     * ```
     */
    async saveCredential(credential: PushCredential): Promise<PushCredential> {
      logger.debug('Push saveCredential requested');
      try {
        // TODO-REVISIT: sharedSecret excluded from round-trip — the JS credential
        // object never carries sharedSecret (native-only field). The native side
        // must look up the credential by id and merge JS-editable fields rather
        // than accepting a full credential object. See requirements open question §2.
        const result = await getNativeModule().saveCredential(
          clientId,
          credential as unknown as object,
        );
        logger.info('Push saveCredential success');
        return fromNativeCredential(result);
      } catch (error) {
        logger.error('Push saveCredential failed');
        throw error;
      }
    },

    /**
     * Returns all push credentials stored on the device.
     *
     * @returns A promise that resolves to an array of {@link PushCredential} objects.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const credentials = await client.getCredentials();
     * ```
     */
    async getCredentials(): Promise<PushCredential[]> {
      logger.debug('Push getCredentials requested');
      try {
        const result = await getNativeModule().getCredentials(clientId);
        logger.info('Push getCredentials success');
        return fromNativeCredentialList(result);
      } catch (error) {
        logger.error('Push getCredentials failed');
        throw error;
      }
    },

    /**
     * Returns a specific push credential by its identifier.
     *
     * @param credentialId - The unique credential identifier.
     * @returns A promise that resolves to the {@link PushCredential}, or `null` if not found.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const credential = await client.getCredential('cred-id');
     * ```
     */
    async getCredential(credentialId: string): Promise<PushCredential | null> {
      logger.debug('Push getCredential requested');
      try {
        const result = await getNativeModule().getCredential(
          clientId,
          credentialId,
        );
        logger.info('Push getCredential success');
        return fromNativeWrappedCredential(result);
      } catch (error) {
        logger.error('Push getCredential failed');
        throw error;
      }
    },

    /**
     * Deletes a push credential by its identifier.
     *
     * @param credentialId - The unique credential identifier to delete.
     * @returns A promise that resolves to `true` if deleted, `false` if not found.
     * @throws {@link PushError} with code `'storage_failure'` if deletion fails.
     * @example
     * ```ts
     * const deleted = await client.deleteCredential('cred-id');
     * ```
     */
    async deleteCredential(credentialId: string): Promise<boolean> {
      logger.debug('Push deleteCredential requested');
      try {
        const result = await getNativeModule().deleteCredential(
          clientId,
          credentialId,
        );
        logger.info('Push deleteCredential success');
        return result;
      } catch (error) {
        logger.error('Push deleteCredential failed');
        throw error;
      }
    },

    /**
     * Updates the device push token, optionally scoped to a specific credential.
     *
     * @param token - The new device push token (FCM token on Android, APNs token on iOS).
     * @param credentialId - Optional credential identifier. When omitted, the token
     *   is set globally for all credentials.
     * @returns A promise that resolves to `true` when the token is successfully updated.
     * @throws {@link PushError} with code `'registration_failed'` if the server update fails.
     * @example
     * ```ts
     * // Global token update
     * await client.setDeviceToken(fcmToken);
     * // Scoped token update
     * await client.setDeviceToken(fcmToken, 'cred-id');
     * ```
     */
    async setDeviceToken(
      token: string,
      credentialId?: string,
    ): Promise<boolean> {
      logger.debug('Push setDeviceToken requested');
      try {
        const result = await getNativeModule().setDeviceToken(
          clientId,
          token,
          credentialId ?? null,
        );
        logger.info('Push setDeviceToken success');
        return result;
      } catch (error) {
        logger.error('Push setDeviceToken failed');
        throw error;
      }
    },

    /**
     * Returns the current device push token.
     *
     * @returns A promise that resolves to the device token string, or `null` if not set.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const token = await client.getDeviceToken();
     * ```
     */
    async getDeviceToken(): Promise<string | null> {
      logger.debug('Push getDeviceToken requested');
      try {
        const result = await getNativeModule().getDeviceToken(clientId);
        logger.info('Push getDeviceToken success');
        return fromNativeToken(result);
      } catch (error) {
        logger.error('Push getDeviceToken failed');
        throw error;
      }
    },

    /**
     * Processes an incoming push notification from a dictionary payload.
     *
     * @param messageData - The raw push message data dictionary (e.g. from FCM `getData()`
     *   on Android or APNs `userInfo` on iOS).
     * @returns A promise resolving to a {@link PushNotification}, or `null` for unsupported payloads.
     * @throws {@link PushError} with code `'message_parsing_failed'` if the payload cannot be parsed.
     * @example
     * ```ts
     * const notification = await client.processNotification(message.getData());
     * if (notification) {
     *   await client.approveNotification(notification.id);
     * }
     * ```
     */
    async processNotification(
      messageData: Record<string, unknown>,
    ): Promise<PushNotification | null> {
      logger.debug('Push processNotification requested');
      try {
        const result = await getNativeModule().processNotification(
          clientId,
          messageData as unknown as object,
        );
        logger.info('Push processNotification success');
        return fromNativeNotification(result);
      } catch (error) {
        logger.error('Push processNotification failed');
        throw error;
      }
    },

    /**
     * Processes an incoming push notification from a raw string or JWT payload.
     *
     * @param message - The raw push message string received from the push service.
     * @returns A promise resolving to a {@link PushNotification}, or `null` for unsupported payloads.
     * @throws {@link PushError} with code `'message_parsing_failed'` if the payload cannot be parsed.
     * @example
     * ```ts
     * const notification = await client.processNotificationFromMessage(rawMessage);
     * ```
     */
    async processNotificationFromMessage(
      message: string,
    ): Promise<PushNotification | null> {
      logger.debug('Push processNotificationFromMessage requested');
      try {
        const result = await getNativeModule().processNotificationFromMessage(
          clientId,
          message,
        );
        logger.info('Push processNotificationFromMessage success');
        return fromNativeNotification(result);
      } catch (error) {
        logger.error('Push processNotificationFromMessage failed');
        throw error;
      }
    },

    /**
     * Approves a standard push notification.
     *
     * @param notificationId - The unique notification identifier.
     * @returns A promise that resolves to `true` when approved successfully.
     * @throws {@link PushError} with code `'notification_not_found'` if not found.
     * @throws {@link PushError} with code `'policy_violation'` if approval violates policy.
     * @example
     * ```ts
     * await client.approveNotification(notification.id);
     * ```
     */
    async approveNotification(notificationId: string): Promise<boolean> {
      logger.debug('Push approveNotification requested');
      try {
        const result = await getNativeModule().approveNotification(
          clientId,
          notificationId,
        );
        logger.info('Push approveNotification success');
        return result;
      } catch (error) {
        logger.error('Push approveNotification failed');
        throw error;
      }
    },

    /**
     * Approves a challenge push notification with a user-provided response.
     *
     * @param notificationId - The unique notification identifier.
     * @param challengeResponse - The user's challenge response string.
     * @returns A promise that resolves to `true` when approved successfully.
     * @throws {@link PushError} with code `'notification_not_found'` if not found.
     * @throws {@link PushError} with code `'invalid_parameter_value'` if `challengeResponse` is empty.
     * @example
     * ```ts
     * await client.approveChallengeNotification(notification.id, selectedAnswer);
     * ```
     */
    async approveChallengeNotification(
      notificationId: string,
      challengeResponse: string,
    ): Promise<boolean> {
      logger.debug('Push approveChallengeNotification requested');
      if (!challengeResponse.trim()) {
        logger.error('Push approveChallengeNotification failed');
        throw {
          type: 'argument_error',
          error: 'invalid_parameter_value',
          message: 'challengeResponse must not be empty',
        } satisfies PushError;
      }
      try {
        const result = await getNativeModule().approveChallengeNotification(
          clientId,
          notificationId,
          challengeResponse,
        );
        logger.info('Push approveChallengeNotification success');
        return result;
      } catch (error) {
        logger.error('Push approveChallengeNotification failed');
        throw error;
      }
    },

    /**
     * Approves a biometric push notification using the specified authentication method.
     *
     * @param notificationId - The unique notification identifier.
     * @param authenticationMethod - The biometric authentication method identifier.
     * @returns A promise that resolves to `true` when approved successfully.
     * @throws {@link PushError} with code `'notification_not_found'` if not found.
     * @throws {@link PushError} with code `'invalid_parameter_value'` if `authenticationMethod` is empty.
     * @example
     * ```ts
     * await client.approveBiometricNotification(notification.id, 'biometric');
     * ```
     */
    async approveBiometricNotification(
      notificationId: string,
      authenticationMethod: string,
    ): Promise<boolean> {
      logger.debug('Push approveBiometricNotification requested');
      if (!authenticationMethod.trim()) {
        logger.error('Push approveBiometricNotification failed');
        throw {
          type: 'argument_error',
          error: 'invalid_parameter_value',
          message: 'authenticationMethod must not be empty',
        } satisfies PushError;
      }
      try {
        const result = await getNativeModule().approveBiometricNotification(
          clientId,
          notificationId,
          authenticationMethod,
        );
        logger.info('Push approveBiometricNotification success');
        return result;
      } catch (error) {
        logger.error('Push approveBiometricNotification failed');
        throw error;
      }
    },

    /**
     * Denies a push notification.
     *
     * @param notificationId - The unique notification identifier.
     * @returns A promise that resolves to `true` when denied successfully.
     * @throws {@link PushError} with code `'notification_not_found'` if not found.
     * @example
     * ```ts
     * await client.denyNotification(notification.id);
     * ```
     */
    async denyNotification(notificationId: string): Promise<boolean> {
      logger.debug('Push denyNotification requested');
      try {
        const result = await getNativeModule().denyNotification(
          clientId,
          notificationId,
        );
        logger.info('Push denyNotification success');
        return result;
      } catch (error) {
        logger.error('Push denyNotification failed');
        throw error;
      }
    },

    /**
     * Returns all push notifications that are pending a user response.
     *
     * @returns A promise resolving to an array of pending {@link PushNotification} objects.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const pending = await client.getPendingNotifications();
     * ```
     */
    async getPendingNotifications(): Promise<PushNotification[]> {
      logger.debug('Push getPendingNotifications requested');
      try {
        const result =
          await getNativeModule().getPendingNotifications(clientId);
        logger.info('Push getPendingNotifications success');
        return fromNativeNotificationList(result);
      } catch (error) {
        logger.error('Push getPendingNotifications failed');
        throw error;
      }
    },

    /**
     * Returns all push notifications stored on the device.
     *
     * @returns A promise resolving to an array of all {@link PushNotification} objects.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const all = await client.getAllNotifications();
     * ```
     */
    async getAllNotifications(): Promise<PushNotification[]> {
      logger.debug('Push getAllNotifications requested');
      try {
        const result = await getNativeModule().getAllNotifications(clientId);
        logger.info('Push getAllNotifications success');
        return fromNativeNotificationList(result);
      } catch (error) {
        logger.error('Push getAllNotifications failed');
        throw error;
      }
    },

    /**
     * Returns a specific push notification by its identifier.
     *
     * @param notificationId - The unique notification identifier.
     * @returns A promise resolving to the {@link PushNotification}, or `null` if not found.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const notification = await client.getNotification('notif-id');
     * ```
     */
    async getNotification(
      notificationId: string,
    ): Promise<PushNotification | null> {
      logger.debug('Push getNotification requested');
      try {
        const result = await getNativeModule().getNotification(
          clientId,
          notificationId,
        );
        logger.info('Push getNotification success');
        return fromNativeNotification(result);
      } catch (error) {
        logger.error('Push getNotification failed');
        throw error;
      }
    },

    /**
     * Runs the configured notification cleanup strategy.
     *
     * @param credentialId - Optional credential identifier. When provided, only
     *   notifications associated with that credential are considered for cleanup.
     *   When omitted, cleanup applies across all credentials.
     * @returns A promise resolving to the number of notifications that were removed.
     * @throws {@link PushError} with code `'not_initialized'` if the client is not initialized.
     * @example
     * ```ts
     * const removed = await client.cleanupNotifications();
     * ```
     */
    async cleanupNotifications(credentialId?: string): Promise<number> {
      logger.debug('Push cleanupNotifications requested');
      try {
        const result = await getNativeModule().cleanupNotifications(
          clientId,
          credentialId ?? null,
        );
        logger.info('Push cleanupNotifications success');
        return result;
      } catch (error) {
        logger.error('Push cleanupNotifications failed');
        throw error;
      }
    },

    async refreshToken(): Promise<string | null> {
      logger.debug('Push refreshToken requested');
      try {
        const result = await getNativeModule().refreshToken(clientId);
        const token = fromNativeToken(result);
        if (token) {
          tokenCallbacks.forEach((cb) => {
            try {
              cb(token);
            } catch (_e) {
              /* swallowed */
            }
          });
        }
        logger.info('Push refreshToken success');
        return token;
      } catch (error) {
        logger.error('Push refreshToken failed');
        throw error;
      }
    },

    onTokenRegistered(cb: TokenCb): () => void {
      tokenCallbacks.add(cb);
      return () => {
        tokenCallbacks.delete(cb);
      };
    },

    onNotification(cb: NotifCb): () => void {
      notifCallbacks.add(cb);
      return () => {
        notifCallbacks.delete(cb);
      };
    },

    /**
     * Releases native push client resources and clears cached state.
     *
     * @remarks
     * Safe to call multiple times — subsequent calls on an already-closed client
     * are a no-op on both platforms. After calling `close()`, the client instance
     * should be discarded and a new one created if push operations are needed again.
     *
     * @returns A promise that resolves when resources are released.
     * @example
     * ```ts
     * await client.close();
     * ```
     */
    async close(): Promise<void> {
      logger.debug('Push close requested');
      removeInternalListeners();
      try {
        await getNativeModule().close(clientId);
        logger.info('Push close success');
      } catch (error) {
        logger.error('Push close failed');
        throw error;
      }
    },
  };
}

/**
 * Parses the raw `numbersChallenge` string from a {@link PushNotification} into
 * an array of numbers.
 *
 * Both native SDKs expose this as an instance method on their `PushNotification`
 * types. This standalone function avoids class complexity and works with the plain
 * object shape returned over the bridge.
 *
 * @param notification - The {@link PushNotification} containing the raw `numbersChallenge` field.
 * @returns An array of parsed integers, or an empty array if `numbersChallenge` is
 *   `null`, `undefined`, or an empty string.
 * @throws Never — invalid entries in the CSV string are filtered out silently.
 *
 * @example
 * ```ts
 * const numbers = getNumbersChallenge(notification);
 * // notification.numbersChallenge = '12,34,56'
 * // => [12, 34, 56]
 *
 * const empty = getNumbersChallenge({ ...notification, numbersChallenge: null });
 * // => []
 * ```
 */
export function getNumbersChallenge(notification: PushNotification): number[] {
  const raw = notification.numbersChallenge;
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}
