# read-only-invariant manual tests

**Feature:** [read-only-invariant](../../spec/read-only-invariant/index.md)

Manual tests that Karse never issues a mutating kubectl verb against a cluster. There is no dedicated fixture; the invariant is checked as a cross-cutting assertion within several scenarios.

## Fixtures
- [17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/) (YAML reads only)
- [18-guided-commands](../_fixtures-kwok/18-guided-commands/) (copy-only, no network)
- [25-live-logs](../_fixtures-kwok/25-live-logs/) (audit log shows only `get` / `logs -f`)
