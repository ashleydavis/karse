import { tokenizeLogLine, type LogSegment } from "../../lib/log-highlight";

// Reassembling the segments must always reproduce the original line: highlighting
// never alters the stored text.
function reassemble(segments: LogSegment[]): string {
    return segments.map((segment) => segment.text).join("");
}

describe("tokenizeLogLine", () => {
    test("a line with no keywords is a single plain segment", () => {
        expect(tokenizeLogLine("start worker processes")).toEqual([
            { text: "start worker processes", kind: "plain" },
        ]);
    });

    test("highlights a standalone 'error' as an error segment", () => {
        expect(tokenizeLogLine("connection error occurred")).toEqual([
            { text: "connection ", kind: "plain" },
            { text: "error", kind: "error" },
            { text: " occurred", kind: "plain" },
        ]);
    });

    test("highlights a standalone 'warning' as a warning segment", () => {
        expect(tokenizeLogLine("disk warning threshold")).toEqual([
            { text: "disk ", kind: "plain" },
            { text: "warning", kind: "warning" },
            { text: " threshold", kind: "plain" },
        ]);
    });

    test("matching is case-insensitive and preserves the original casing in the segment", () => {
        expect(tokenizeLogLine("ERROR: fatal")).toEqual([
            { text: "ERROR", kind: "error" },
            { text: ": fatal", kind: "plain" },
        ]);
        expect(tokenizeLogLine("Warning: retrying")).toEqual([
            { text: "Warning", kind: "warning" },
            { text: ": retrying", kind: "plain" },
        ]);
    });

    test("matches keywords flanked by punctuation without mangling it", () => {
        const segments = tokenizeLogLine("[error] level=warning done");
        expect(segments).toEqual([
            { text: "[", kind: "plain" },
            { text: "error", kind: "error" },
            { text: "] level=", kind: "plain" },
            { text: "warning", kind: "warning" },
            { text: " done", kind: "plain" },
        ]);
        expect(reassemble(segments)).toBe("[error] level=warning done");
    });

    test("does not highlight the keyword as a substring of a larger word", () => {
        expect(tokenizeLogLine("a terror in errorField and warnings")).toEqual([
            { text: "a terror in errorField and warnings", kind: "plain" },
        ]);
    });

    test("highlights every occurrence in a line with multiple matches", () => {
        const segments = tokenizeLogLine("error then warning then error");
        expect(segments.filter((s) => s.kind === "error")).toHaveLength(2);
        expect(segments.filter((s) => s.kind === "warning")).toHaveLength(1);
        expect(reassemble(segments)).toBe("error then warning then error");
    });

    test("a keyword at the very start and end of the line is highlighted", () => {
        expect(tokenizeLogLine("error")).toEqual([{ text: "error", kind: "error" }]);
        expect(tokenizeLogLine("warning")).toEqual([{ text: "warning", kind: "warning" }]);
    });

    test("an empty line yields no segments", () => {
        expect(tokenizeLogLine("")).toEqual([]);
    });
});
