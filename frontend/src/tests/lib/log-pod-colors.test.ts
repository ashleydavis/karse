import { POD_NAME_COLORS, colorForPod } from "../../lib/log-pod-colors";

// The hue (0-360 on the colour wheel) of a "#rrggbb" colour. Used to prove no
// pod-name colour sits in the red/orange/yellow arc, which the log viewer
// reserves for the "error" and "warning" highlights.
function hueOf(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (chroma === 0) {
        return 0;
    }
    let hue: number;
    if (max === r) {
        hue = ((g - b) / chroma) % 6;
    }
    else if (max === g) {
        hue = (b - r) / chroma + 2;
    }
    else {
        hue = (r - g) / chroma + 4;
    }
    hue = hue * 60;
    if (hue < 0) {
        hue = hue + 360;
    }
    return hue;
}

// The MUI palette shades the log viewer uses for the severity highlights: red
// for "error" and yellow/amber for "warning".
const ERROR_HIGHLIGHT_COLOR = "#e57373";
const WARNING_HIGHLIGHT_COLOR = "#ffb74d";

describe("POD_NAME_COLORS", () => {
    test("never reuses the error or warning highlight colour", () => {
        expect(POD_NAME_COLORS).not.toContain(ERROR_HIGHLIGHT_COLOR);
        expect(POD_NAME_COLORS).not.toContain(WARNING_HIGHLIGHT_COLOR);
    });

    test("every colour sits outside the red/orange/yellow arc of the colour wheel", () => {
        // Reds run from ~340 through 0 to ~20, orange/yellow from ~20 to ~70.
        // Every pod colour must be clear of both bands (cyan/blue/green/purple).
        for (const color of POD_NAME_COLORS) {
            const hue = hueOf(color);
            expect(hue).toBeGreaterThan(75);
            expect(hue).toBeLessThan(330);
        }
    });

    test("the error and warning highlight colours would themselves fail that check", () => {
        // Guards the check above: it really does reject red and yellow.
        expect(hueOf(ERROR_HIGHLIGHT_COLOR)).toBeLessThan(75);
        expect(hueOf(WARNING_HIGHLIGHT_COLOR)).toBeLessThan(75);
    });

    test("has no duplicate colours", () => {
        expect(new Set(POD_NAME_COLORS).size).toBe(POD_NAME_COLORS.length);
    });
});

describe("colorForPod", () => {
    test("always returns a colour from the pod palette", () => {
        const pods = ["web", "nginx-abc", "api-7d9f8b5c6d-xyz12", "kube-proxy-99", ""];
        for (const pod of pods) {
            expect(POD_NAME_COLORS).toContain(colorForPod(pod));
        }
    });

    test("is deterministic for a given pod name", () => {
        expect(colorForPod("nginx-abc")).toBe(colorForPod("nginx-abc"));
        expect(colorForPod("web")).toBe(colorForPod("web"));
    });

    test("never colours a pod name red or yellow", () => {
        const pods = ["web", "nginx-abc", "api", "cache", "worker-1", "worker-2", "db-0", "db-1", "ingress"];
        for (const pod of pods) {
            expect(colorForPod(pod)).not.toBe(ERROR_HIGHLIGHT_COLOR);
            expect(colorForPod(pod)).not.toBe(WARNING_HIGHLIGHT_COLOR);
            const hue = hueOf(colorForPod(pod));
            expect(hue).toBeGreaterThan(75);
            expect(hue).toBeLessThan(330);
        }
    });

    test("different pod names can map to different colours", () => {
        const pods = ["web", "nginx-abc", "api", "cache", "worker-1", "worker-2", "db-0", "db-1"];
        const colors = new Set(pods.map((pod) => colorForPod(pod)));
        expect(colors.size).toBeGreaterThan(1);
    });
});
