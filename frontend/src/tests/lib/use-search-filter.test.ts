import { SEARCH_DEBOUNCE_MS, SEARCH_PARAM } from "../../lib/use-search-filter";

// The debounce delay is part of the resource-search contract: tables must not
// re-filter on every keystroke. Pin the value so a silent change is caught.
describe("SEARCH_DEBOUNCE_MS", () => {
    test("is 250 milliseconds", () => {
        expect(SEARCH_DEBOUNCE_MS).toBe(250);
    });
});

// The param key is part of the shareable-URL contract: every link already shared
// carries "q", so renaming it would silently break those links. Pin it.
describe("SEARCH_PARAM", () => {
    test("is the query-string key 'q'", () => {
        expect(SEARCH_PARAM).toBe("q");
    });
});
