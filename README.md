# React Native Ping SDK (POC)

This repository demonstrates the **Ping Identity React Native SDK (Proof of Concept)** — a modular setup where native SDKs (Storage, OIDC, Browser, Journey, etc.) are wrapped as independent TurboModules and integrated into a sample React Native app.

---

## Setup: Prepare Packages

Install all workspace dependencies for the SDK packages:

```bash
yarn packages:force-install
````

This ensures all local modules under `packages/*` are properly bootstrapped before running the sample app.

---

## Run the Sample App

### **Android**

```bash
yarn sample:clean-install
yarn sample:run:android
```

### **iOS**

```bash
yarn sample:clean-install
yarn sample:run:ios
```

---

## Notes

* `sample:clean-install` clears and reinstalls dependencies inside the sample app (`PingSampleApp`).
* The sample app lives **outside** the monorepo workspace but consumes the local packages directly.

---

## Monorepo Structure (Example)

```
react-native-pingidentity/
├── packages/
│   ├── storage/
│   ├── oidc/
│   ├── browser/
│   └── journey/
└── PingSampleApp/
```

Each package is published independently and can be consumed as a standalone NPM module, or tested together using the sample app.

---

