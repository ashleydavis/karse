import { buildLabelRows } from "../../lib/label-rows";

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
});
