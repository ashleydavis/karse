import { labelsToPairs } from "../../components/labels-cell-pairs";

// labelsToPairs is the pure core of the Labels column: it produces the exact
// "key=value" strings the cell renders as chips AND the string the table's fuzzy
// search matches against, so testing it covers what the column shows and what it
// searches.
describe("labelsToPairs", () => {
    test("flattens a labels map into key=value strings", () => {
        expect(labelsToPairs({ app: "web", tier: "frontend" })).toEqual([
            "app=web",
            "tier=frontend",
        ]);
    });

    test("sorts pairs by key so render order is stable", () => {
        expect(labelsToPairs({ tier: "frontend", app: "web" })).toEqual([
            "app=web",
            "tier=frontend",
        ]);
    });

    test("returns an empty list for a resource with no labels", () => {
        expect(labelsToPairs({})).toEqual([]);
    });

    test("returns an empty list for undefined labels", () => {
        expect(labelsToPairs(undefined)).toEqual([]);
    });

    test("returns an empty list for null labels", () => {
        expect(labelsToPairs(null)).toEqual([]);
    });

    test("keeps an empty value as key=", () => {
        expect(labelsToPairs({ "node-role.kubernetes.io/worker": "" })).toEqual([
            "node-role.kubernetes.io/worker=",
        ]);
    });
});
