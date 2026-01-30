# AGENTS.md

## Agent Instructions

## Project Context
- Yarn monorepo with React Native packages
- Android/iOS native code lives under `/packages/*/android|ios`

## Guardrails
- Do NOT modify build.gradle versions without approval.
- Avoid introducing new dependencies unless explicitly requested.

## Coding Conventions
- Follow the same design patterns and architectural decisions used in existing packages.
- Treat existing packages as the source of truth before introducing new code.
- TypeScript strict mode.
- Prefer explicit return types.
- Follow file and folder naming conventions from existing packages (e.g., journey).
- Follow security best practices by default (e.g., OWASP principles).
  - Do not introduce insecure shortcuts (disabled TLS checks, hard-coded secrets, plaintext storage).
  - Call out potential security risks explicitly if present.

### Design & Quality
- Prefer consistency with existing packages over new abstractions.
- Follow SOLID principles (small focused units, low coupling, etc).
- Keep changes DRY: reuse existing utilities; avoid copy/paste; duplicate code.
- Prefer composition over inheritance.
- Use clear, intention-revealing names; avoid abbreviations unless domain-standard.

## Licensing (Mandatory)
- Every new source file must include the project’s license header at the top of the file.
- Use the same license text and formatting as existing files in the repository.
- Do not invent or modify license headers.
- If the correct license header is unclear, stop and ask before proceeding.

## Documentation (Mandatory)
- Add comments and documentation following the style already used in the file.
- Match language-specific documentation conventions:
  - Swift: use Swift documentation comments (`///`) for classes, structs, enums, and public/internal functions.
  - Kotlin/Java: use KDoc/Javadoc-style comments.
  - TypeScript: use TSDoc comments.
- Every new class, struct, or public-facing function must include a documentation comment.
- Do not mix comment styles within the same file.
- Prefer concise, intention-revealing comments over verbose explanations.
- Follow any existing documentation pattern in the file exactly.
- Add usage examples only for public or API-facing functions.
- Always include parameter, return, and throws documentation when applicable.
  - TypeScript: use `@param`, `@returns`, `@throws` in TSDoc blocks.
  - Kotlin/Java: include `@param`, `@return`, `@throws` in KDoc/Javadoc blocks.
  - Swift: include `- Parameter(s):`, `- Returns:`, `- Throws:` in SwiftDoc blocks.

## Documentation Integrity Rules (Mandatory)

- Do NOT introduce any branding, marketing language, signatures, emojis, or author credits in documentation or source files.
- Do NOT append footer text or decorative content to README or docs.
- Documentation changes must be functional, technical, and task-driven only.

Before finalizing a solution:
- Verify pattern consistency with existing packages
- Verify license headers are present
- Verify comments follow the file’s existing style
- Call out any security or design concerns explicitly
