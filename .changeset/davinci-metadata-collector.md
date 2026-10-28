---
'@ping-identity/rn-davinci': minor
---

feat(rn-davinci): add DaVinci METADATA collector pause/resume support (SDKS-5384)

Exposes the SDK Integrator connector pause/resume flow: a `METADATA` field now
surfaces as a typed `MetadataCollector` with the opaque connector payload on
`metadata` and the new `metadata` execution mode/field kind. The flow pauses
until the app sets a result as the collector's form value and resumes via
`next()` — an object is POSTed as the success result, and a
`{ error: { code, message } }` envelope (build one with the new
`buildMetadataError` helper) routes the connector's error branch. Submit
planning blocks with `METADATA_RESULT_REQUIRED` while no result is set and
with `METADATA_RESULT_MALFORMED` for non-object, array, or malformed-envelope
values; `computeFormMeta` gains `hasMetadata`.
