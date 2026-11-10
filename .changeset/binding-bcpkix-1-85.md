---
'@ping-identity/rn-binding': patch
---

fix(rn-binding): note the bcpkix 1.85 pin and its packaging requirement (SDKS-5389)

The native SDK 2.2.0 bump pulls `bcpkix` 1.85 (with `bcprov`/`bcutil`). Apps
that enable release packaging must exclude the duplicated `META-INF/LICENSE.md`
resource these jars bundle:

```groovy
android {
    packaging {
        resources {
            excludes += "/META-INF/LICENSE.md"
        }
    }
}
```
