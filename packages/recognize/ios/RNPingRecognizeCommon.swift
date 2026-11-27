/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingRecognize
import React
import RNPingCore

/// Shared PingOne Recognize execution logic for React Native iOS bridges.
///
/// Ceremony outcomes resolve as discriminated payloads —
/// `{ type: "success", recognizeId }` or `{ type: "failure", code, message }` —
/// because the native `enroll()` / `authenticate()` write the result, or the
/// client error, into the callback inputs on both paths and the server
/// expects `next()` to proceed. Only bridge-level failures (blank journey id,
/// missing callback) reject the promise.
///
/// - Note: The ceremony runs on the main actor. Keyless presents its own
///   camera UI and the native README requires an active view controller on the
///   main thread.
@objcMembers
public class RNPingRecognizeCommon: NSObject {

  /// Stable error codes emitted by the Recognize module.
  ///
  /// Keep these in sync with JS `RecognizeErrorCode` and Android `RecognizeErrorCodes`.
  private enum RecognizeErrorCode: String {
    case recognizeError = "RECOGNIZE_ERROR"
    case callbackNotFound = "RECOGNIZE_CALLBACK_NOT_FOUND"
  }

  /// Shared `SDK_ERROR` code used when a failure carries no `RecognizeError`.
  private static let sdkErrorCode = "1000"

  /// Runs the active Journey Recognize callback (enroll or authenticate).
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Run options (`index`, `retrieveSelfie`).
  ///   - config: Per-call runtime configuration payload (currently unused).
  ///   - resolver: Promise resolver for the ceremony outcome payload.
  ///   - rejecter: Promise rejecter for bridge-level errors.
  @objc
  public static func runForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)

    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: RecognizeErrorCode.recognizeError.rawValue,
          message: "Journey id must not be empty for Recognize."
        )
      )
      return
    }

    let parsedOptions = parseRunOptions(options)

    Task { @MainActor in
      guard let callback = await resolveRecognizeCallback(
        journeyId: journeyId,
        index: parsedOptions.index
      ) else {
        handlers.reject(
          GenericError(
            type: .stateError,
            error: RecognizeErrorCode.callbackNotFound.rawValue,
            message: "No active PingOneRecognizeCallback found for journey \(journeyId) at index \(parsedOptions.index)."
          )
        )
        return
      }

      guard let result = await execute(
        callback,
        retrieveSelfie: parsedOptions.retrieveSelfie
      ) else {
        handlers.reject(
          GenericError(
            type: .stateError,
            error: RecognizeErrorCode.recognizeError.rawValue,
            message: "Callback at index \(parsedOptions.index) is neither an enroll nor an authenticate Recognize callback."
          )
        )
        return
      }

      switch result {
      case .success(let success):
        NSLog(
          "[opt2] recognize success: recognizeId=%@ signedJwt?%d clientState?%d",
          success.recognizeId ?? "",
          (success.signedJwt ?? "").isEmpty ? 0 : 1,
          (success.clientState ?? "").isEmpty ? 0 : 1
        )
        handlers.resolve(createSuccessPayload(success))
      case .failure(let error):
        // Ceremony failure resolves (never rejects): the native callback has
        // already recorded the client error into its inputs, so the server
        // expects `next()` to proceed.
        NSLog(
          "[opt2] recognize failure: %@",
          String(describing: error)
        )
        handlers.resolve(createFailureResultPayload(error: error))
      }
    }
  }

  /// Runs the enroll or authenticate ceremony for the resolved callback.
  ///
  /// - Parameters:
  ///   - callback: Recognize callback resolved from the active node.
  ///   - retrieveSelfie: Whether native should retain the captured frame.
  /// - Returns: The native ceremony result, or `nil` when the callback is
  ///   neither an enroll nor an authenticate subclass.
  @MainActor
  private static func execute(
    _ callback: AbstractRecognizeCallback,
    retrieveSelfie: Bool
  ) async -> Result<RecognizeSuccess, Error>? {
    switch callback {
    case let enroll as PingOneRecognizeEnrollCallback:
      return await enroll.enroll { $0.retrieveSelfie = retrieveSelfie }
    case let authenticate as PingOneRecognizeAuthenticateCallback:
      return await authenticate.authenticate { $0.retrieveSelfie = retrieveSelfie }
    default:
      return nil
    }
  }

  /// Resolves the Journey Recognize callback at the given type index.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Zero-based index among the active Recognize callbacks.
  /// - Returns: The resolved callback, or `nil` when the journey is unknown
  ///   or no callback exists at the index.
  private static func resolveRecognizeCallback(
    journeyId: String,
    index: Int
  ) async -> AbstractRecognizeCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? AbstractRecognizeCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Builds the `{ type: "success", recognizeId }` payload.
  ///
  /// The signed JWT and client state are already in the callback inputs and
  /// are never returned to JavaScript. The captured selfie, when requested, is
  /// not forwarded in this proof of concept.
  ///
  /// - Parameter success: Native ceremony success value.
  /// - Returns: Payload dictionary for JS.
  static func createSuccessPayload(_ success: RecognizeSuccess) -> NSDictionary {
    return ["type": "success", "recognizeId": success.recognizeId ?? ""]
  }

  /// Builds the `{ type: "failure", code, message }` payload.
  ///
  /// - Parameter error: Native error from the `Result.failure` branch.
  /// - Returns: Payload dictionary for JS. `code` is the shared Recognize
  ///   error code as a string; failures without a `RecognizeError` use the
  ///   shared `SDK_ERROR` code `1000`.
  static func createFailureResultPayload(error: Error) -> NSDictionary {
    if let recognizeError = error as? RecognizeError {
      return [
        "type": "failure",
        "code": String(recognizeError.code),
        "message": recognizeError.message,
      ]
    }
    return [
      "type": "failure",
      "code": sdkErrorCode,
      "message": error.localizedDescription.isEmpty
        ? "PingOne Recognize operation failed."
        : error.localizedDescription,
    ]
  }

  /// Parsed run options.
  ///
  /// - Note: `@unchecked Sendable` because this is an immutable value wrapper
  ///   around bridge-provided dictionary data, captured by the main-actor Task.
  struct RunOptions: @unchecked Sendable {
    /// Zero-based index among the active Recognize callbacks.
    let index: Int
    /// Whether native should retain the captured frame.
    let retrieveSelfie: Bool
  }

  /// Parses run options from the JS payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: Parsed options with defaults applied (index 0, no selfie).
  static func parseRunOptions(_ options: NSDictionary) -> RunOptions {
    return RunOptions(
      index: parseCallbackIndex(options),
      retrieveSelfie: parseRetrieveSelfie(options)
    )
  }

  /// Parses the callback index from the options payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: Zero-based index, or 0 when absent or malformed.
  private static func parseCallbackIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber {
      return value.intValue
    }
    if let value = options["index"] as? String, let parsed = Int(value) {
      return parsed
    }
    return 0
  }

  /// Parses the `retrieveSelfie` flag from the options payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: The flag, or `false` when absent or malformed.
  private static func parseRetrieveSelfie(_ options: NSDictionary) -> Bool {
    if let value = options["retrieveSelfie"] as? NSNumber {
      return value.boolValue
    }
    if let value = options["retrieveSelfie"] as? String {
      return value.lowercased() == "true"
    }
    return false
  }
}
