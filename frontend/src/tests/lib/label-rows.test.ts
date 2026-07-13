import { buildLabelRows, compareLabelRows, labelsModalTitle } from "../../lib/label-rows";
import { fuzzyMatch } from "../../lib/fuzzy-filter";

describe("buildLabelRows", () => {
    test("turns a labels object into one row per key/value pair", () => {
        const rows = buildLabelRows({ app: "web", tier: "frontend" });
        expect(rows).toEqual([
            { key: "app", value: "web" },
            { key: "tier", value: "frontend" },
        ]);
    });

    test("sorts rows by key for a stable initial order", () => {
        // Insertion order is tier, app, env; the rows come back sorted by key.
        const rows = buildLabelRows({ tier: "frontend", app: "web", env: "prod" });
        expect(rows.map((r) => r.key)).toEqual(["app", "env", "tier"]);
    });

    test("returns an empty array when there are no labels", () => {
        expect(buildLabelRows({})).toEqual([]);
    });

    test("keeps an empty value (e.g. a bare namespace label)", () => {
        const rows = buildLabelRows({ "kubernetes.io/metadata.name": "" });
        expect(rows).toEqual([{ key: "kubernetes.io/metadata.name", value: "" }]);
    });

    test("shows only the labels passed in, never an aggregate", () => {
        // The Labels tab is per-resource: it builds rows from exactly the one
        // resource's labels object, so two duplicate keys cannot occur and the
        // count equals the number of distinct keys on that resource.
        const rows = buildLabelRows({ app: "web", version: "1.2.3" });
        expect(rows).toHaveLength(2);
    });

    test("returns every label the resource carries, however many", () => {
        // The labels modal exists because a row cannot show them all inline; it
        // must still list the complete set, not the truncated one.
        const rows = buildLabelRows({ app: "many", tier: "backend", env: "prod", region: "eu-west", version: "1.2.3" });
        expect(rows.map((r) => r.key)).toEqual(["app", "env", "region", "tier", "version"]);
    });

    test("returns an empty array for undefined labels", () => {
        expect(buildLabelRows(undefined)).toEqual([]);
    });

    test("returns an empty array for null labels", () => {
        expect(buildLabelRows(null)).toEqual([]);
    });
});

// compareLabelRows is the comparator the shared labels table runs on a column
// header click, so these cover the modal's (and the tab's) sorting.
describe("compareLabelRows", () => {
    const rows = [
        { key: "tier", value: "backend" },
        { key: "app", value: "many" },
        { key: "env", value: "prod" },
    ];

    test("sorts by key ascending", () => {
        const sorted = [...rows].sort((a, b) => compareLabelRows(a, b, "key"));
        expect(sorted.map((r) => r.key)).toEqual(["app", "env", "tier"]);
    });

    test("sorts by value ascending", () => {
        const sorted = [...rows].sort((a, b) => compareLabelRows(a, b, "value"));
        expect(sorted.map((r) => r.value)).toEqual(["backend", "many", "prod"]);
    });

    test("reversing the comparison sorts descending, as a second header click does", () => {
        const sorted = [...rows].sort((a, b) => -compareLabelRows(a, b, "key"));
        expect(sorted.map((r) => r.key)).toEqual(["tier", "env", "app"]);
    });

    test("orders equal values as equal, so an equal-value sort is stable", () => {
        const a = { key: "app", value: "web" };
        const b = { key: "tier", value: "web" };
        expect(compareLabelRows(a, b, "value")).toBe(0);
    });

    test("sorting by key restores buildLabelRows' initial order", () => {
        // Both use localeCompare on the key, so a Key sort is the initial order.
        const built = buildLabelRows({ tier: "backend", app: "many", env: "prod" });
        const sorted = [...rows].sort((a, b) => compareLabelRows(a, b, "key"));
        expect(sorted).toEqual(built);
    });
});

// labelsModalTitle builds the modal's title bar text, which must name whose
// labels are shown when opened from a resource row.
describe("labelsModalTitle", () => {
    test("names the resource by kind and name, then the count", () => {
        expect(labelsModalTitle("Pod", "web-1", 5)).toBe("Pod web-1 labels (5)");
    });

    test("uses the kind supplied by each table, e.g. a node", () => {
        expect(labelsModalTitle("Node", "many-node", 3)).toBe("Node many-node labels (3)");
    });

    test("falls back to a bare title when no resource identity is given", () => {
        expect(labelsModalTitle(undefined, undefined, 2)).toBe("Labels (2)");
    });

    test("uses just the name when the kind is missing", () => {
        expect(labelsModalTitle(undefined, "lonely", 1)).toBe("lonely labels (1)");
    });

    test("uses just the kind when the name is missing", () => {
        expect(labelsModalTitle("Pod", undefined, 4)).toBe("Pod labels (4)");
    });

    test("counts zero labels too", () => {
        expect(labelsModalTitle("Namespace", "default", 0)).toBe("Namespace default labels (0)");
    });
});

// The labels table filters with the shared fuzzyGlobalFilter, which matches a
// query against each cell of a row. These cover what the modal's search box does
// to a resource's label rows: match on the key, on the value, or on neither.
describe("label row search", () => {
    const rows = buildLabelRows({ app: "many", tier: "backend", env: "prod", region: "eu-west", version: "1.2.3" });

    function search(query: string) {
        return rows.filter((row) => fuzzyMatch(row.key, query) || fuzzyMatch(row.value, query));
    }

    test("matches a label by its key", () => {
        expect(search("region")).toEqual([{ key: "region", value: "eu-west" }]);
    });

    test("matches a label by its value", () => {
        expect(search("eu-west")).toEqual([{ key: "region", value: "eu-west" }]);
    });

    test("an empty query keeps every label", () => {
        expect(search("")).toHaveLength(5);
    });

    test("a query matching nothing filters every label out", () => {
        expect(search("zzzznope")).toEqual([]);
    });
});
