// The log viewer's pod-name colouring, kept out of the React component so the
// palette and its mapping can be unit-tested. Each streamed line is prefixed
// with its `namespace/pod`, and the pod-name chips above the viewer use the
// same colours, so one pod reads as one colour across the view.

// The palette pod names cycle through. Every entry is deliberately in the
// blue/cyan/teal/green/purple range: red and yellow are reserved for the
// severity highlighting ("error" red, "warning" yellow — see log-highlight.ts),
// so a pod name must never be drawn in either, otherwise an ordinary line reads
// as an error or a warning. All entries are light enough to stay legible on the
// viewer's dark panel and to carry black chip text.
export const POD_NAME_COLORS = [
    "#4fc3f7",
    "#81c784",
    "#4dd0e1",
    "#ba68c8",
    "#64b5f6",
    "#4db6ac",
    "#aed581",
    "#9575cd",
];

// Deterministically maps a pod name to one of the pod-name colours, so a given
// pod keeps the same colour for the life of a stream (and between its line
// prefixes and its chip).
export function colorForPod(pod: string): string {
    let hash = 0;
    for (let i = 0; i < pod.length; i++) {
        hash = (hash * 31 + pod.charCodeAt(i)) >>> 0;
    }
    return POD_NAME_COLORS[hash % POD_NAME_COLORS.length]!;
}
