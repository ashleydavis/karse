import { SEARCH_DEBOUNCE_MS } from "../../lib/use-search-filter";

// The debounce delay is part of the resource-search contract: tables must not
// re-filter on every keystroke. Pin the value so a silent change is caught.
describe("SEARCH_DEBOUNCE_MS", () => {
    test("is 250 milliseconds", () => {
        expect(SEARCH_DEBOUNCE_MS).toBe(250);
    });
});
