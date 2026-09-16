/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Minimal `.env` loader for the XCUITest runner process.
///
/// The runner runs on the macOS host, so it can read the PingTestRunner `.env`
/// file directly from the repository. This mirrors how the Jest/Detox side gets
/// its configuration (Detox injects `.env` values into the app via launchArgs),
/// so local XCUITest runs behave the same without exporting every variable.
///
/// Lookup order (first existing file wins):
/// 1. `PING_TEST_ENV_FILE` from the process environment (explicit override)
/// 2. `.env` in the PingTestRunner root, derived from this source file's
///    compile-time path (`<repo>/PingTestRunner/ios/PingTestRunnerUITests/DotEnv.swift`)
enum DotEnv {

    // MARK: - Loading

    /// Parses the first available `.env` file into a flat key-value dictionary.
    ///
    /// - Parameters:
    ///   - fileName: Name of the env file to locate. Defaults to `.env`.
    ///   - sourceFile: Compile-time path of the caller's source file, used to
    ///     derive the PingTestRunner root. Callers should leave the default.
    /// - Returns: Parsed variables; an empty dictionary when no file exists.
    static func load(
        fileName: String = ".env",
        sourceFile: String = #filePath
    ) -> [String: String] {
        for candidate in candidateURLs(fileName: fileName, sourceFile: sourceFile) {
            if let values = parse(contentsOf: candidate) {
                return values
            }
        }
        return [:]
    }

    // MARK: - Location

    /// Builds the ordered list of `.env` locations to probe.
    private static func candidateURLs(
        fileName: String,
        sourceFile: String
    ) -> [URL] {
        var candidates: [URL] = []

        if let override = ProcessInfo.processInfo.environment["PING_TEST_ENV_FILE"],
           !override.isEmpty {
            candidates.append(URL(fileURLWithPath: override))
        }

        // DotEnv.swift -> PingTestRunnerUITests -> ios -> PingTestRunner
        let runnerRoot = URL(fileURLWithPath: sourceFile)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        candidates.append(runnerRoot.appendingPathComponent(fileName))

        return candidates
    }

    // MARK: - Parsing

    /// Parses env-file contents into key-value pairs.
    ///
    /// Skips blank lines and `#` comments; splits each line on the first `=`;
    /// trims whitespace and strips one layer of surrounding single or double
    /// quotes from values.
    ///
    /// - Parameters:
    ///   - fileURL: URL of the env file to read.
    /// - Returns: Parsed key-value pairs, or `nil` when the file cannot be read.
    private static func parse(contentsOf fileURL: URL) -> [String: String]? {
        guard let contents = try? String(contentsOf: fileURL, encoding: .utf8) else {
            return nil
        }
        var values: [String: String] = [:]
        for rawLine in contents.split(separator: "\n", omittingEmptySubsequences: true) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty, !line.hasPrefix("#"),
                  let separator = line.firstIndex(of: "=") else {
                continue
            }
            let key = String(line[line.startIndex..<separator]).trimmingCharacters(in: .whitespaces)
            var value = String(line[line.index(after: separator)...]).trimmingCharacters(in: .whitespaces)
            if value.count >= 2,
               let first = value.first, let last = value.last,
               (first == "\"" && last == "\"") || (first == "'" && last == "'") {
                value = String(value.dropFirst().dropLast())
            }
            if !key.isEmpty {
                values[key] = value
            }
        }
        return values
    }
}
