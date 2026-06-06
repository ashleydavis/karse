# cross-cutting manual tests

These KWOK scenarios exercise behaviour that has no single dedicated spec feature in `docs/spec/`. They are app-wide concerns, so they live here rather than under one feature.

## Guides
- **Long resource names** (`detail.md`, "Long resource names"): layout holds for names near Kubernetes length limits. Fixture: [11-long-resource-names](../_fixtures-kwok/11-long-resource-names/).
- **Breadcrumb navigation** (`detail.md`, "Breadcrumb navigation"): the navbar breadcrumb trail and back-to-list links. Fixture: [22-breadcrumbs](../_fixtures-kwok/22-breadcrumbs/).
- **Shareable URL state** (`detail.md`, "Shareable URL state"): page, resource, context, and namespace all live in the URL. Fixture: [23-shareable-url-state](../_fixtures-kwok/23-shareable-url-state/).

See [detail.md](./detail.md) for the full steps.
