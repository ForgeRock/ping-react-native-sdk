<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# Contributing

Thanks for contributing to the React Native Ping SDK monorepo.

We appreciate feedback and contributions to this repository.

## Development Workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains:

- SDK packages in `packages/*`.
- A sample app in `PingSampleApp/`.

To get started with the project, run Yarn in the root directory to install dependencies for all workspaces:

```sh
yarn install
```

Since the project relies on Yarn workspaces, do not use `npm` for development workflows.

The sample app in `PingSampleApp/` demonstrates usage of the SDK packages. You should run it to validate changes.

It is configured to use local workspace packages. JavaScript/TypeScript changes are reflected through Metro, while native Android/iOS changes require rebuilding the sample app.

If you want to use native IDEs:

- Open `PingSampleApp/android` in Android Studio.
- Open `PingSampleApp/ios` in Xcode.

You can use the following commands from the root directory.

To start Metro:

```sh
yarn workspace PingSampleApp run start
```

To run the sample app on Android:

```sh
yarn sample:run:android
```

To run the sample app on iOS:

```sh
yarn sample:run:ios
```

Make sure your code passes TypeScript and ESLint checks.

TODO: Add project-wide `yarn typecheck` and `yarn lint` scripts, then replace this section with:

```sh
yarn typecheck
yarn lint
```

To fix formatting/lint errors:

TODO: Add and document `yarn lint --fix` once lint setup is available.

Remember to add tests for your change when possible. Run relevant unit tests by:

```sh
yarn test:browser
yarn test:oidc
yarn test:logger
yarn test:storage
```

### Scripts

The root `package.json` contains scripts for common tasks:

- `yarn install`: install workspace dependencies.
- TODO: Add `yarn typecheck` script for TypeScript checks.
- TODO: Add `yarn lint` script for ESLint checks.
- TODO: Add `yarn lint --fix` support as part of lint setup.
- `yarn packages:build`: build all workspaces in topological order.
- `yarn sample:run:android`: run the sample app on Android.
- `yarn sample:run:ios`: run the sample app on iOS.
- `yarn sample:clean-install`: clean and reinstall sample app dependencies.
- `yarn sample:restart:metro`: restart Metro with reset cache.
- `yarn test:browser`: run browser package tests.
- `yarn test:oidc`: run OIDC package tests.
- `yarn test:logger`: run logger package tests.
- `yarn test:storage`: run storage package tests.
- `yarn test:device-id`: run device-id package tests.
- `yarn test:device-profile`: run device-profile package tests.

### Sending A Pull Request

When you are sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that lint and relevant tests are passing.
- Review the documentation to make sure it is accurate.
- Follow the pull request template when opening a pull request.
- For pull requests that change API or implementation behavior, discuss with maintainers first by opening an issue.
- Do not modify Gradle version settings without explicit approval.
- Avoid adding new dependencies unless explicitly requested.
