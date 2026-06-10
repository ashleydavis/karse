import type { Row } from "@tanstack/react-table";
import type { ClusterError } from "karse-types";
import { errorMatchesQuery, errorsGlobalFilter, errorDisplayStrings } from "../../lib/errors-search";

// A problem-pod error whose distinctive text is spread across different columns,
// so each test can target one column without another column also matching.
const error: ClusterError = {
    source: "Pod",
    namespace: "kube-system",
    objectKind: "Pod",
    objectName: "crasher-abc",
    reason: "CrashLoopBackOff",
    message: "back-off 5m0s restarting failed container",
    count: 7,
    firstSeen: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    lastSeen: new Date(Date.now() - 3 * 3_600_000).toISOString(),
};

describe("errorMatchesQuery", () => {
    test("matches a term in the Source column", () => {
        expect(errorMatchesQuery(error, "Pod")).toBe(true);
    });

    test("matches a term in the Object column", () => {
        expect(errorMatchesQuery(error, "crasher-abc")).toBe(true);
    });

    test("matches a term in the Reason column", () => {
        expect(errorMatchesQuery(error, "CrashLoopBackOff")).toBe(true);
    });

    test("matches a term in the Message column", () => {
        expect(errorMatchesQuery(error, "restarting failed")).toBe(true);
    });

    test("matches a term in the Count column", () => {
        expect(errorMatchesQuery(error, "7")).toBe(true);
    });

    test("matches a term in the Namespace column", () => {
        expect(errorMatchesQuery(error, "kube-system")).toBe(true);
    });

    test("matches the displayed Age text, not the raw timestamp", () => {
        expect(errorMatchesQuery(error, "3h")).toBe(true);
        expect(errorMatchesQuery(error, error.lastSeen)).toBe(false);
    });

    test("is case-insensitive", () => {
        expect(errorMatchesQuery(error, "crashloopbackoff")).toBe(true);
    });

    test("does not match a substring that appears in no column", () => {
        expect(errorMatchesQuery(error, "zzznotfound")).toBe(false);
    });

    test("keeps the row for an empty query", () => {
        expect(errorMatchesQuery(error, "")).toBe(true);
    });

    test("keeps the row for a whitespace-only query", () => {
        expect(errorMatchesQuery(error, "   ")).toBe(true);
    });

    test("matches contiguous substrings only (not a fuzzy subsequence)", () => {
        expect(errorMatchesQuery(error, "clbo")).toBe(false);
    });
});

describe("errorDisplayStrings", () => {
    test("renders the involved object as kind/name", () => {
        expect(errorDisplayStrings(error)).toContain("Pod/crasher-abc");
    });
});

describe("errorsGlobalFilter", () => {
    // Builds the minimal TanStack Row shape the filter reads: it only uses
    // `row.original`.
    function rowFor(value: ClusterError): Row<ClusterError> {
        return { original: value } as Row<ClusterError>;
    }

    test("keeps a row whose namespace contains the query", () => {
        expect(errorsGlobalFilter(rowFor(error), "lastSeen", "kube-system", () => {})).toBe(true);
    });

    test("drops a row that matches no column", () => {
        expect(errorsGlobalFilter(rowFor(error), "lastSeen", "zzznotfound", () => {})).toBe(false);
    });

    test("keeps every row for an empty query", () => {
        expect(errorsGlobalFilter(rowFor(error), "lastSeen", "", () => {})).toBe(true);
    });
});
