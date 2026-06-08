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
- `docs/testing-manual/`: the manual/e2e testing manual. Mirrors `docs/spec/` by feature ID (an `index.md` + `detail.md` per feature); the reusable kwok cluster fixtures (`setup.sh`/`teardown.sh`) live under `docs/testing-manual/_fixtures-kwok/`.

## Documentation rules

These apply to every change.

- Keep `docs/` guides and the testing manual in sync with code changes. Any change that affects behaviour, the API, the architecture, or how the project is run must update the matching document(s) in the same change.
- The testing manual under `docs/testing-manual/` must gain or update the matching feature's `detail.md` for every new feature, and a new `docs/testing-manual/<id>/` (mirroring `docs/spec/<id>/`) when a feature is added (see the testing rules).
- **Every testing-manual `detail.md` must be self-contained.** A tester following it from the top needs no outside knowledge to exercise the feature. Each `detail.md` must tell the tester how to start the app before its navigation steps, and the start command must be shown as a fenced ` ```sh ` code block (not inline prose), e.g.:

  ```sh
  bun run dev
  ```

  Then open the frontend at `http://127.0.0.1:5173`, alongside the kwok fixture `setup.sh`/`teardown.sh` it already names. Docs that need the fake-logs form use a `bun run dev:test` code block instead, with the same URL. Do not assume the reader knows to start the app, and do not rely on another document to say so.
- Keep the required documents above current with every change that affects them.
