#!/usr/bin/env bash
#
# Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
#
# This software may be modified and distributed under the terms
# of the MIT license. See the LICENSE file for details.
#

# Verifies that all staged files contain a Ping Identity copyright header.
# Intended to be run as a pre-commit hook via lefthook.
#
# The file types checked are controlled by the glob in lefthook.yml, so this
# script can assume all inputs are source files that require a copyright header.
#
# Usage: check-copyright.sh <file1> <file2> ...

# Constants

# Number of lines from the top of each file to search for the copyright header.
readonly HEADER_SEARCH_LINES=5

# Pattern to match against. Case-insensitive so variations in casing don't
# cause false negatives (e.g. "COPYRIGHT" or "Copyright").
readonly COPYRIGHT_PATTERN="copyright.+ping identity"

# Functions

# Returns 0 (true) if the given file exists on disk, 1 (false) otherwise.
# Deleted files appear as staged but have no content to check.
file_exists() {
  local file_path="$1"
  [[ -f "$file_path" ]]
}

# Returns 0 (true) if the given file contains the copyright header within the
# first $HEADER_SEARCH_LINES lines, 1 (false) otherwise.
has_copyright_header() {
  local file_path="$1"
  head -"$HEADER_SEARCH_LINES" "$file_path" | grep -qiE "$COPYRIGHT_PATTERN"
}

# Prints a formatted error listing all files missing the copyright header
# and exits with a non-zero code to abort the commit.
report_missing_and_fail() {
  local -a missing_files=("$@")

  echo "Missing copyright header in:"
  printf '  %s\n' "${missing_files[@]}"
  exit 1
}

# Main

main() {
  local -a staged_files=("$@")
  local -a missing_files=()

  for file_path in "${staged_files[@]}"; do
    file_exists "$file_path" || continue
    has_copyright_header "$file_path" || missing_files+=("$file_path")
  done

  if [[ ${#missing_files[@]} -gt 0 ]]; then
    report_missing_and_fail "${missing_files[@]}"
  fi
}

main "$@"
