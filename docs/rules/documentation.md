# Documentation

## Required documents

These live in `docs/` and must stay in sync with the code.

- `docs/architecture.md`: internal/architectural overview.
- `docs/api.md`: backend HTTP API reference.
- `docs/user-guide.md`: user-facing guide.
- `docs/development.md`: local development and how to run the project.
- `docs/audit-log.md`: how kubectl invocations are audited.
- `docs/security.md`: the project's security posture.
- `docs/roadmap.md`: planned work.
- `docs/faq.md`: frequently asked questions.
- `docs/manual-testing/`: the kwok-based manual/e2e testing manual (one scenario per directory).

## Documentation rules

These apply to every change.

- Keep `docs/` guides and the manual-testing manual in sync with code changes. Any change that affects behaviour, the API, the architecture, or how the project is run must update the matching document(s) in the same change.
- The testing manual under `docs/manual-testing/` must gain or update a scenario for every new feature (see the testing rules).
- Keep the required documents above current with every change that affects them.
