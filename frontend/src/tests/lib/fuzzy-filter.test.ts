import type { Row } from "@tanstack/react-table";
import { fuzzyMatch, fuzzyGlobalFilter } from "../../lib/fuzzy-filter";
import { labelsToPairs } from "../../components/labels-cell-pairs";

describe("fuzzyMatch", () => {
    test("matches an exact substring", () => {
        expect(fuzzyMatch("nginx-deployment", "nginx")).toBe(true);
    });

    test("matches a gap-tolerant subsequence", () => {
        expect(fuzzyMatch("nginx-deployment", "ngnx")).toBe(true);
    });

    test("matches characters spread across the whole string", () => {
        expect(fuzzyMatch("nginx-deployment", "ndep")).toBe(true);
    });

    test("is case-insensitive on both sides", () => {
        expect(fuzzyMatch("NGINX-Deployment", "NgInX")).toBe(true);
    });

    test("ignores separators in the query so they act as gaps", () => {
        expect(fuzzyMatch("nginx-deployment", "ng-x")).toBe(true);
    });

    test("ignores spaces in the query", () => {
        expect(fuzzyMatch("nginx-deployment", "ng x")).toBe(true);
    });

    test("returns false when a needle character is missing", () => {
        expect(fuzzyMatch("nginx", "nginxz")).toBe(false);
    });

    test("returns false when characters are present but out of order", () => {
        expect(fuzzyMatch("abc", "cba")).toBe(false);
    });

    test("returns false when a repeated character lacks enough occurrences", () => {
        expect(fuzzyMatch("abc", "aa")).toBe(false);
    });

    test("matches a repeated character when enough occurrences exist", () => {
        expect(fuzzyMatch("banana", "aaa")).toBe(true);
    });

    test("returns true for an empty query", () => {
        expect(fuzzyMatch("anything", "")).toBe(true);
    });

    test("returns true for a query of only separator characters", () => {
        expect(fuzzyMatch("anything", "- /")).toBe(true);
    });

    test("returns true for an empty query against an empty string", () => {
        expect(fuzzyMatch("", "")).toBe(true);
    });

    test("returns false for a non-empty query against an empty string", () => {
        expect(fuzzyMatch("", "a")).toBe(false);
    });

    test("matches digits", () => {
        expect(fuzzyMatch("pod-12345", "12345")).toBe(true);
    });

    test("matches a mix of letters and digits as a subsequence", () => {
        expect(fuzzyMatch("replicaset-7d9f8", "rs7d")).toBe(true);
    });
});

// Builds a minimal fake Tanstack Row exposing just the getAllCells/getValue
// surface that fuzzyGlobalFilter relies on. Each entry in `cellValues` becomes
// one cell.
function makeRow(cellValues: unknown[]): Row<unknown> {
    return {
        getAllCells: () => cellValues.map((value) => ({
            getValue: () => value,
        })),
    } as unknown as Row<unknown>;
}

// Invokes the global filter with the required (but unused-by-Karse) addMeta
// callback supplied as a no-op, so call sites stay terse.
function runFilter(row: Row<unknown>, filterValue: unknown): boolean {
    return fuzzyGlobalFilter(row, "any", filterValue, () => {});
}

describe("fuzzyGlobalFilter", () => {
    test("keeps a row when one cell value fuzzy-matches the query", () => {
        const row = makeRow(["nginx-deployment", "default", "Running"]);
        expect(runFilter(row,"ngnx")).toBe(true);
    });

    test("drops a row when no cell value matches the query", () => {
        const row = makeRow(["nginx-deployment", "default", "Running"]);
        expect(runFilter(row,"zzz")).toBe(false);
    });

    test("keeps every row for a blank query", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,"")).toBe(true);
    });

    test("keeps every row for a whitespace-only query", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,"   ")).toBe(true);
    });

    test("treats a non-string filter value as no filter and keeps the row", () => {
        const row = makeRow(["anything"]);
        expect(runFilter(row,42)).toBe(true);
    });

    test("does not match across cell boundaries", () => {
        // "ab" is a subsequence of "a"+"b" concatenated, but each lives in its
        // own cell, so a per-cell match must fail.
        const row = makeRow(["a", "b"]);
        expect(runFilter(row,"ab")).toBe(false);
    });

    test("matches against a numeric cell value", () => {
        const row = makeRow([12345, "name"]);
        expect(runFilter(row,"234")).toBe(true);
    });

    test("matches against a nested object cell value via its flattened values", () => {
        const row = makeRow([{ status: "Running", restarts: 3 }]);
        expect(runFilter(row,"running")).toBe(true);
    });

    test("flattens nested object values into one space-joined searchable string", () => {
        // { first: "foo", second: "bar" } collapses to "foo bar", so a
        // subsequence spanning both values within the same cell matches.
        const row = makeRow([{ first: "foo", second: "bar" }]);
        expect(runFilter(row,"fb")).toBe(true);
    });

    test("ignores null and undefined cell values", () => {
        const row = makeRow([null, undefined, "nginx"]);
        expect(runFilter(row,"ngx")).toBe(true);
    });

    test("returns false when all cells are null or undefined and query is non-empty", () => {
        const row = makeRow([null, undefined]);
        expect(runFilter(row,"x")).toBe(false);
    });

    test("skips cells whose column opts out of global filtering", () => {
        // The hidden health column carries values like "Healthy"/"Error" that
        // must never affect search. A cell that opts out with enableGlobalFilter:
        // false is excluded, so a query that only matches it finds nothing.
        const row = {
            getAllCells: () => [
                {
                    getValue: () => "nginx",
                    column: { columnDef: {} },
                },
                {
                    getValue: () => "Healthy",
                    column: { columnDef: { enableGlobalFilter: false } },
                },
            ],
        } as unknown as Row<unknown>;
        expect(runFilter(row, "healthy")).toBe(false);
        expect(runFilter(row, "nginx")).toBe(true);
    });
});

// The resource tables feed labels into the filter as one cell holding the
// space-joined "key=value" pairs (the same string the Labels column renders),
// and node / namespace as their own plain cells. These cases prove a query on a
// label pair, a node, or a namespace narrows the table, matching the per-cell
// rows the tables actually build. See pods-table.tsx / nodes-table.tsx.
describe("fuzzyGlobalFilter expanded criteria (labels, node, namespace)", () => {
    // A pod row as the pods table builds it: name, namespace, node, then the
    // joined labels cell.
    function makePodRow(): Row<unknown> {
        return makeRow([
            "nginx-deployment-abc",
            "default",
            "node-worker",
            "app=nginx tier=frontend",
        ]);
    }

    test("matches a full label key=value pair", () => {
        expect(runFilter(makePodRow(), "app=nginx")).toBe(true);
    });

    test("matches on a label key alone", () => {
        expect(runFilter(makePodRow(), "tier")).toBe(true);
    });

    test("matches on a label value alone", () => {
        expect(runFilter(makePodRow(), "frontend")).toBe(true);
    });

    test("matches a label pair fuzzily, ignoring the separator", () => {
        // "app nginx" drops the "=" and still subsequence-matches "app=nginx".
        expect(runFilter(makePodRow(), "app nginx")).toBe(true);
    });

    test("does not match a label value the row does not carry", () => {
        expect(runFilter(makePodRow(), "backend")).toBe(false);
    });

    test("matches on the node the resource runs on", () => {
        expect(runFilter(makePodRow(), "node-worker")).toBe(true);
    });

    test("matches the node fuzzily", () => {
        expect(runFilter(makePodRow(), "nwk")).toBe(true);
    });

    test("does not match a node the row is not on", () => {
        expect(runFilter(makePodRow(), "node-control")).toBe(false);
    });

    test("matches on the namespace the resource lives in", () => {
        expect(runFilter(makePodRow(), "default")).toBe(true);
    });

    test("does not match a namespace the row is not in", () => {
        expect(runFilter(makePodRow(), "kube-system")).toBe(false);
    });

    test("treats a resource with no labels (empty joined cell) as having nothing to match on", () => {
        const row = makeRow(["redis-cache-xyz", "default", "node-worker", ""]);
        expect(runFilter(row, "app=nginx")).toBe(false);
    });
});

// A subsequence match with no bound on how far apart the matched characters may
// sit degenerates once a cell gets long: nearly any short query can be found
// scattered across a few hundred characters, so every row survives every query.
// The rows below are the reproduction: four pods identical in every field except
// their labels cell, which carries the standard Kubernetes / Helm recommended
// label set plus the controller-added labels (pod-template-hash,
// controller-revision-hash, statefulset.kubernetes.io/pod-name, helm.sh/chart,
// service.istio.io/*) that any Deployment-, StatefulSet- or DaemonSet-managed pod
// carries on a real cluster. Joined into the Labels column's searchable
// "key=value" text those cells run to roughly 300 characters each, where the
// unbounded match kept 4/4 rows for "redis", "postgres" and "cache".
describe("fuzzyGlobalFilter over real-shaped label cells", () => {
    const REAL_LABELS: Record<string, string>[] = [
        {
            "app.kubernetes.io/component": "controller",
            "app.kubernetes.io/instance": "ingress-nginx",
            "app.kubernetes.io/managed-by": "Helm",
            "app.kubernetes.io/name": "ingress-nginx",
            "app.kubernetes.io/part-of": "ingress-nginx",
            "app.kubernetes.io/version": "1.9.4",
            "helm.sh/chart": "ingress-nginx-4.8.3",
            "pod-template-hash": "6b8f7c9d4f",
        },
        {
            "app.kubernetes.io/instance": "prometheus",
            "app.kubernetes.io/managed-by": "Helm",
            "app.kubernetes.io/name": "prometheus-node-exporter",
            "app.kubernetes.io/part-of": "prometheus",
            "app.kubernetes.io/version": "1.7.0",
            "controller-revision-hash": "5c74d8b9f7",
            "helm.sh/chart": "prometheus-node-exporter-4.24.0",
            "pod-template-generation": "3",
        },
        {
            "app.kubernetes.io/component": "database",
            "app.kubernetes.io/instance": "postgres",
            "app.kubernetes.io/managed-by": "Helm",
            "app.kubernetes.io/name": "postgresql",
            "controller-revision-hash": "postgres-postgresql-77d9c8b64",
            "helm.sh/chart": "postgresql-13.2.24",
            "statefulset.kubernetes.io/pod-name": "postgres-postgresql-0",
        },
        {
            "app.kubernetes.io/component": "web",
            "app.kubernetes.io/instance": "shop",
            "app.kubernetes.io/managed-by": "Helm",
            "app.kubernetes.io/name": "storefront",
            "app.kubernetes.io/version": "2.14.1",
            "helm.sh/chart": "storefront-0.9.2",
            "pod-template-hash": "84cd7f6b95",
            "security.istio.io/tlsMode": "istio",
            "service.istio.io/canonical-name": "storefront",
            "service.istio.io/canonical-revision": "latest",
        },
    ];

    const POD_NAMES = ["nginx-deployment-abc", "redis-cache-xyz", "postgres-primary-0", "frontend-web-123"];

    // The cells the pods table's column definitions produce, in order: name,
    // namespace, phase, ready, containers, restarts, node, then the joined labels
    // cell. Only the labels cell differs between pods.
    function podRows(): Row<unknown>[] {
        return POD_NAMES.map((name, index) => makeRow([
            name,
            "default",
            "Running",
            "1/1",
            1,
            0,
            "fake-node-1",
            labelsToPairs(REAL_LABELS[index]).join(" "),
        ]));
    }

    function survivors(query: string): string[] {
        return podRows()
            .map((row, index) => (runFilter(row, query) ? POD_NAMES[index] : null))
            .filter((name): name is string => name !== null);
    }

    test("the label cells under test really are long enough to degenerate an unbounded match", () => {
        for (const labels of REAL_LABELS) {
            expect(labelsToPairs(labels).join(" ").length).toBeGreaterThan(250);
        }
    });

    test("a query matching one pod's name keeps exactly that pod", () => {
        expect(survivors("redis")).toEqual(["redis-cache-xyz"]);
        expect(survivors("postgres")).toEqual(["postgres-primary-0"]);
        expect(survivors("nginx")).toEqual(["nginx-deployment-abc"]);
        expect(survivors("frontend")).toEqual(["frontend-web-123"]);
    });

    test("a query matching nothing keeps no pods", () => {
        expect(survivors("zzzqqq")).toEqual([]);
    });

    test("a label value shared by every pod still keeps every pod", () => {
        // Every pod carries app.kubernetes.io/managed-by=Helm, so label search must
        // still return all four. The fix must not achieve its narrowing by
        // dropping labels out of the search.
        expect(survivors("Helm")).toEqual(POD_NAMES);
    });

    test("a label value carried by one pod keeps only that pod", () => {
        // Only the fourth pod carries security.istio.io/tlsMode=istio.
        expect(survivors("tlsMode")).toEqual(["frontend-web-123"]);
    });

    test("a full key=value pair from a real-shaped label set keeps only the pod carrying it", () => {
        expect(survivors("app.kubernetes.io/instance=prometheus")).toEqual(["redis-cache-xyz"]);
    });
});

// The bound the fix introduces, stated directly on fuzzyMatch.
describe("fuzzyMatch bounded window", () => {
    test("rejects a subsequence whose characters are scattered too far apart", () => {
        // "abc" is a subsequence of this text, but 60 characters of filler sit
        // between the letters, so it is not a plausible match for what was typed.
        const scattered = `a${"x".repeat(30)}b${"x".repeat(30)}c`;
        expect(scattered).toContain("a");
        expect(fuzzyMatch(scattered, "abc")).toBe(false);
    });

    test("still accepts a subsequence whose characters sit close together", () => {
        expect(fuzzyMatch("axbxc", "abc")).toBe(true);
    });

    test("finds a close match even when an earlier, too-scattered one exists first", () => {
        // The leading "a" starts a match that runs past the bound; the matcher must
        // keep looking and find the tight "abc" at the end rather than give up.
        expect(fuzzyMatch(`a${"x".repeat(40)}abc`, "abc")).toBe(true);
    });
});
