# about-page manual tests

**Feature:** [about-page](../../spec/about-page/index.md)

Manual tests for the About page: reachable from the sidebar nav, explains what
Karse is and how it works, states the author, and links to the GitHub repo.

## Fixtures
- [13-two-contexts](../_fixtures-kwok/13-two-contexts/) (any fixture with at least one selectable context works; the About page itself reads nothing from the cluster, but a context must be active so the app does not redirect to the Contexts page).
