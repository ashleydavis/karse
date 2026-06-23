# Testing

Test setup for Karse. Every change must follow every rule below.

## Frameworks and layout

- The two testing frameworks for this project are **Jest** (backend unit tests) and **Playwright** (e2e tests). No other test runners are used.
- Backend tests run with `bun run test` (which invokes Jest via `@swc/jest`).
- Every **backend** non-React TypeScript module has tests under `backend/src/tests/`, mirroring the source tree. The one exception is `index.ts`, pure bootstrap wiring covered by the smoke script.
- The **frontend is not unit-tested at all** per project policy. This includes React components, pages, and non-React `frontend/src/lib/*.ts` modules (`api-client.ts`, `query-client.ts`, `font-awesome.ts`). They are exercised by the Playwright e2e suite and `scripts/smoke-tests.sh`.
- **E2E tests** live in `e2e/src/` and use `@playwright/test`. They are run by `scripts/e2e-tests.sh`, which spins up two kwok clusters, starts the full stack, then invokes Playwright. E2E tests use `test.describe` and `test` (Playwright's API).

## Testing rules

These apply to every change.

- **Every new feature or code change must add or update**: backend unit tests (Jest), smoke tests (`scripts/smoke-tests.sh`), e2e tests (`e2e/src/e2e.test.ts`), and the e2e/manual testing manual under `docs/testing-manual/` (the matching feature's `detail.md`; reusable kwok fixtures live under `docs/testing-manual/_fixtures-kwok/`). No feature is done until these tests and documentation have been updated/extended.
- **Every new frontend feature must have e2e test coverage.** New pages, components, and interactions are not considered done until `e2e/src/e2e.test.ts` has a `test.describe` block covering them. Add `data-test-id` attributes to new elements as needed to make assertions reliable. Do not ship frontend code without corresponding e2e tests.
- **UI-observable behaviour must be verified through the UI and screenshotted, even when the change is "below" the UI layer.** If a change touches *any* code the UI calls (React components and pages, `frontend/src/lib/*`, data/transform/search/filter/formatting/sorting helpers, or a backend handler that feeds a view) **and** its effect can be observed by using the running app, it must be exercised through the UI in an e2e test **and** captured as screenshots for human review, in **both light and dark mode**, for every affected view and every affected state. "No visible chrome change", "logic-only change", "it's a layer below the UI", or "tests already cover it" are **not** valid reasons to skip screenshots. The test is simple: *if the developer could see the difference by using the app, screenshots that show that difference are required.* Capture before/after (or matched-state) shots so the behaviour is visible, not just the static page, for example: a search/filter term actually narrowing a table (one shot per criterion/column it newly matches, plus the cleared state), each distinct state of an indicator (not only its initial state), and both the empty/guidance and populated states of a view. Agent review must reject a UI-observable change that lacks these screenshots.
- **A new or changed UI component must be screenshotted even before any page consumes it.** If no page renders it yet (its consumers arrive in later tickets), render it **in isolation** (a scratch render or story mounting it with sample props, covering each distinct state including any null/empty case) and screenshot it in light and dark. "No page consumes it yet", "not wired in", "nothing to render", and "the e2e ticket covers it later" are not valid reasons to skip a component's screenshots. A component ticket may not declare its Test Plan `N/A` on the grounds that it has no consumer yet.
- Tests **never** use `test.skip` or `describe.skip`.
- Tests **always** use `describe` and `test`, never `it`.
- Tests must not be fudged: each assertion checks a specific value, fixtures use realistic shapes (the structurally significant fields the real tool would return), and fakes are not asserted against themselves. Inject collaborators (e.g. a fake `run`) rather than mocking the module under test.
- Where mocking a module is required, prefer Jest's `__mocks__` directory adjacent to the module being mocked.

## Running the suites

- After every code-delivering step, run `bun run tests:all` from the **repo root** and confirm it is green. This runs compile, unit tests, smoke tests, and e2e tests in sequence. When asked to run tests or told tests are failing, always run `bun run tests:all` and gather the full results before responding — never run a subset and ask follow-up questions.
- **Run test commands verbatim. Never wrap them.** Do not prefix with `timeout` (it can kill the suite mid-run — kwok clusters plus the full stack plus Playwright take a while — and report a false failure that is yours, not the code's). Do not pipe to `tail`, `head`, `grep`, or anything that truncates output (you cannot "gather the full results" from a truncated stream). Run `bun run tests:all` exactly as written and read all of its output. If the run is long, run it in the background and read the complete log, but never cap or filter it.
- **Never claim a root cause is "confirmed" until it is proven by running tests.** Reading code and reasoning about a failure produces a *hypothesis*, not a confirmation. Say "I suspect" or "my hypothesis is" until you have reproduced the failure and verified the fix by actually running the relevant tests (with kwok where applicable). Do not state or imply that a cause is confirmed, or that a fix works, on the basis of static analysis alone.
