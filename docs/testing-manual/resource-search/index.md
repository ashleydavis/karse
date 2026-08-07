# resource-search manual tests

**Feature:** [resource-search](../../spec/resource-search/index.md)

Manual tests for in-table search (fuzzy/subsequence on most tables, plain substring on events and errors), the committed search text living in the page's URL, column sorting, and the 100-row rendered-row bound with its "Show more" control.

## Fixtures
- [29-fuzzy-search](../_fixtures-kwok/29-fuzzy-search/)
- [23-shareable-url-state](../_fixtures-kwok/23-shareable-url-state/)
- [37-large-pod-list](../_fixtures-kwok/37-large-pod-list/)

Column sorting and per-table search are also exercised in the nodes ([nodes-view](../nodes-view/detail.md)) and pods ([pods-view](../pods-view/detail.md)) scenarios.
