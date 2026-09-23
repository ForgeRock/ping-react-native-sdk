---
'@ping-identity/rn-davinci': minor
---

feat(rn-davinci): expose DaVinci IMAGE display-only image collector (SDKS-5381)

Adds the `IMAGE` collector type exposing `key`, `imageUrl`, `description`, and
optional `hyperlinkUrl`, with the same names, optionality, and defaults as the
native collectors. The collector is classified `output_only` and never
contributes to `next()` input; the SDK does not download, cache, render, or
open image or hyperlink URLs.
