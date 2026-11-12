---
'@ping-identity/rn-binding': patch
---

fix(rn-binding): note the bcpkix 1.85 pin and its packaging requirement (SDKS-5389)

The native SDK 2.2.0 bump pulls `bcpkix` 1.85 (with `bcprov`/`bcutil`). These
jars each bundle `META-INF/LICENSE.md`, which fails debug and release packaging
alike with "2 files found with path 'META-INF/LICENSE.md'". Exclude the
duplicate resource:

```groovy
android {
    packaging {
        resources {
            excludes += "/META-INF/LICENSE.md"
        }
    }
}
```

The exclude drops Bouncy Castle's license text from the APK. Apps that must
ship third-party license notices (for example for app-store compliance) should
serve them another way, such as bundling the licenses in their own assets or
using a license-report plugin.
