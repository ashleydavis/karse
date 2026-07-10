// Pure tokeniser for the log viewer's severity highlighting. Kept out of the
// React component so splitting a log line into plain/error/warning segments can
// be unit-tested without a DOM render. Highlighting happens at render time only;
// the stored log text is never altered (concatenating a line's segment `text`
// reproduces the original line exactly).

// How a segment of a log line should be rendered: a matched severity keyword to
// be colour-highlighted, or plain text left untouched.
export type LogSegmentKind = "plain" | "error" | "warning";

// A contiguous run of a log line tagged with how it should be rendered. A line
// tokenises into an ordered list of these.
export interface LogSegment {
    text: string;
    kind: LogSegmentKind;
}

// The severity keywords to highlight. Matched case-insensitively and as whole
// words (see `tokenizeLogLine`).
const ERROR_KEYWORD = "error";
const WARNING_KEYWORD = "warning";

// Builds the whole-word, case-insensitive matcher for the severity keywords.
// Whole-word (word boundaries) rather than substring so surrounding punctuation
// like `[error]`, `level=error`, or `Warning:` still matches, while unrelated
// text such as "terror" or "errorField" is left untouched — this is the
// documented matching choice (see the log-viewer spec). A fresh regex per call
// avoids the shared-lastIndex footgun of a reused global regex.
function keywordPattern(): RegExp {
    return new RegExp(`\\b(${ERROR_KEYWORD}|${WARNING_KEYWORD})\\b`, "gi");
}

// Splits a log line into ordered plain/error/warning segments for highlighting.
// Cheap: a single linear regex scan of the one line, run only on the lines
// actually rendered (not the whole buffer). Every occurrence of "error"/"warning"
// is tagged; all other text stays plain. Concatenating the returned segments'
// `text` yields the input unchanged.
export function tokenizeLogLine(line: string): LogSegment[] {
    const segments: LogSegment[] = [];
    const pattern = keywordPattern();
    let lastIndex = 0;
    let match = pattern.exec(line);
    while (match !== null) {
        if (match.index > lastIndex) {
            segments.push({ text: line.slice(lastIndex, match.index), kind: "plain" });
        }
        const matched = match[0];
        const kind: LogSegmentKind = matched.toLowerCase() === ERROR_KEYWORD ? "error" : "warning";
        segments.push({ text: matched, kind });
        lastIndex = match.index + matched.length;
        match = pattern.exec(line);
    }
    if (lastIndex < line.length) {
        segments.push({ text: line.slice(lastIndex), kind: "plain" });
    }
    return segments;
}
