import { middleTruncate, collapseCrumbs, MAX_NAME_LENGTH, MAX_TRAIL_ITEMS } from "../../lib/breadcrumb-trail";
import type { Crumb } from "../../lib/breadcrumb-trail";

describe("middleTruncate", () => {
    test("returns a short label unchanged", () => {
        expect(middleTruncate("nginx-abc", 24)).toBe("nginx-abc");
    });

    test("returns a label exactly at the limit unchanged", () => {
        const label = "a".repeat(24);
        expect(middleTruncate(label, 24)).toBe(label);
    });

    test("middle-truncates a long label keeping the start and end visible", () => {
        const label = "really-long-pod-name-that-exceeds-the-breadcrumb-limit-0123456789";
        const result = middleTruncate(label, 24);
        expect(result).toContain("...");
        expect(result.startsWith("really-long")).toBe(true);
        expect(result.endsWith("0123456789")).toBe(true);
    });

    test("never produces a result longer than the limit", () => {
        const label = "x".repeat(100);
        expect(middleTruncate(label, 24).length).toBe(24);
    });

    test("splits the kept characters head-heavy when the budget is odd", () => {
        // limit 24 - 3 for "..." = 21 kept: head = ceil(21/2) = 11, tail = 10.
        const label = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const result = middleTruncate(label, 24);
        expect(result).toBe("ABCDEFGHIJK...0123456789");
        expect(result.split("...")[0].length).toBe(11);
        expect(result.split("...")[1].length).toBe(10);
    });
});

describe("collapseCrumbs", () => {
    const crumb = (label: string): Crumb => {
        return {
            label,
        };
    };

    test("returns a trail at the cap unchanged", () => {
        const trail = [crumb("Pods"), crumb("default"), crumb("nginx-abc"), crumb("Status")];
        expect(collapseCrumbs(trail, 4)).toEqual(trail);
    });

    test("returns a short trail unchanged", () => {
        const trail = [crumb("Nodes"), crumb("node-cp")];
        expect(collapseCrumbs(trail, 4)).toEqual(trail);
    });

    test("collapses an over-long trail to first, ellipsis, then the last two", () => {
        const trail = [crumb("A"), crumb("B"), crumb("C"), crumb("D"), crumb("E")];
        expect(collapseCrumbs(trail, 4)).toEqual([
            crumb("A"),
            crumb("..."),
            crumb("D"),
            crumb("E"),
        ]);
    });

    test("keeps the first (root) and last (current) crumbs visible after collapsing", () => {
        const trail = [crumb("A"), crumb("B"), crumb("C"), crumb("D"), crumb("E"), crumb("F")];
        const result = collapseCrumbs(trail, 4);
        expect(result[0]).toEqual(crumb("A"));
        expect(result[result.length - 1]).toEqual(crumb("F"));
        expect(result.length).toBe(4);
    });

    test("the inserted ellipsis crumb is not a link", () => {
        const trail = [crumb("A"), crumb("B"), crumb("C"), crumb("D"), crumb("E")];
        const result = collapseCrumbs(trail, 4);
        expect(result[1].to).toBeUndefined();
        expect(result[1].label).toBe("...");
    });
});

describe("breadcrumb constants", () => {
    test("the trail cap is four", () => {
        expect(MAX_TRAIL_ITEMS).toBe(4);
    });

    test("the name length limit is twenty-four", () => {
        expect(MAX_NAME_LENGTH).toBe(24);
    });
});
