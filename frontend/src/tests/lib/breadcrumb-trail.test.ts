import { middleTruncate, collapseCrumbs, originCrumbs, performanceOrigin, tabLabel, POD_TAB_LABELS, CONTAINER_TAB_LABELS, FROM_ALL_RESOURCES, FROM_CLUSTER_PERFORMANCE, FROM_NODE_PERFORMANCE, MAX_NAME_LENGTH, MAX_TRAIL_ITEMS } from "../../lib/breadcrumb-trail";
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

describe("tabLabel", () => {
    test("resolves the active pod tab to its label", () => {
        expect(tabLabel(POD_TAB_LABELS, "performance")).toBe("Performance");
        expect(tabLabel(POD_TAB_LABELS, "containers")).toBe("Containers");
        expect(tabLabel(POD_TAB_LABELS, "init-containers")).toBe("Init Containers");
        expect(tabLabel(POD_TAB_LABELS, "labels")).toBe("Labels");
        expect(tabLabel(POD_TAB_LABELS, "logs")).toBe("Logs");
        expect(tabLabel(POD_TAB_LABELS, "commands")).toBe("Commands");
        expect(tabLabel(POD_TAB_LABELS, "yaml")).toBe("YAML");
    });

    test("falls back to the Status (detail) label for a missing or unknown tab", () => {
        expect(tabLabel(POD_TAB_LABELS, null)).toBe("Status");
        expect(tabLabel(POD_TAB_LABELS, "detail")).toBe("Status");
        expect(tabLabel(POD_TAB_LABELS, "does-not-exist")).toBe("Status");
    });

    test("does not read 'Status' for the Performance tab (regression: hard-coded Status)", () => {
        // The pod breadcrumb used to show "Status" for every non-stub tab because
        // its label map omitted them; the Performance tab must read "Performance".
        expect(tabLabel(POD_TAB_LABELS, "performance")).not.toBe("Status");
    });

    test("covers every tab the container detail page exposes", () => {
        expect(tabLabel(CONTAINER_TAB_LABELS, "logs")).toBe("Logs");
        expect(tabLabel(CONTAINER_TAB_LABELS, "commands")).toBe("Commands");
        expect(tabLabel(CONTAINER_TAB_LABELS, "yaml")).toBe("YAML");
        expect(tabLabel(CONTAINER_TAB_LABELS, null)).toBe("Status");
    });
});

describe("originCrumbs", () => {
    test("builds an All resources origin trail showing only the resource name", () => {
        expect(originCrumbs(FROM_ALL_RESOURCES, "Pod", "nginx-abc")).toEqual([
            { label: "All resources", to: "/all-resources" },
            { label: "nginx-abc" },
        ]);
    });

    test("the origin crumb links back to the All resources page and the leaf is current", () => {
        const result = originCrumbs(FROM_ALL_RESOURCES, "Deployment", "web-deploy");
        expect(result).not.toBeNull();
        expect(result![0].to).toBe("/all-resources");
        expect(result![result!.length - 1].to).toBeUndefined();
        expect(result![result!.length - 1].label).toBe("web-deploy");
    });

    test("omits the kind prefix from the leaf crumb", () => {
        const result = originCrumbs(FROM_ALL_RESOURCES, "Deployment", "web-deploy");
        expect(result![result!.length - 1].label).not.toContain("Deployment");
    });

    test("middle-truncates a long resource name in the leaf crumb", () => {
        const name = "really-long-pod-name-that-exceeds-the-breadcrumb-limit-0123456789";
        const result = originCrumbs(FROM_ALL_RESOURCES, "Pod", name);
        const leaf = result![result!.length - 1].label;
        expect(leaf.startsWith("really-long")).toBe(true);
        expect(leaf).toContain("...");
        expect(leaf.endsWith("0123456789")).toBe(true);
    });

    test("returns null when there is no origin (so the normal trail is used)", () => {
        expect(originCrumbs(null, "Pod", "nginx-abc")).toBeNull();
    });

    test("returns null for an unrecognised origin", () => {
        expect(originCrumbs("somewhere-else", "Pod", "nginx-abc")).toBeNull();
    });

    test("returns null when the kind is unknown", () => {
        expect(originCrumbs(FROM_ALL_RESOURCES, null, "nginx-abc")).toBeNull();
    });

    test("returns null when the name is missing or empty", () => {
        expect(originCrumbs(FROM_ALL_RESOURCES, "Pod", null)).toBeNull();
        expect(originCrumbs(FROM_ALL_RESOURCES, "Pod", "")).toBeNull();
    });

    test("builds a node Performance origin trail linking back to that node's Performance tab", () => {
        // A pod drilled into from a node's Performance treemap shows the node as the
        // origin crumb; the crumb links to the node's Performance tab (so the trail
        // and the back button agree) and the pod is the current leaf.
        const result = originCrumbs(`${FROM_NODE_PERFORMANCE}:node-cp`, "Pod", "web-abc");
        expect(result).toEqual([
            { label: "node-cp", to: "/nodes/node-cp?tab=performance" },
            { label: "web-abc" },
        ]);
    });

    test("builds a cluster Performance origin trail linking back to the cluster Performance tab", () => {
        const result = originCrumbs(FROM_CLUSTER_PERFORMANCE, "Pod", "web-abc");
        expect(result).toEqual([
            { label: "Cluster", to: "/cluster?tab=performance" },
            { label: "web-abc" },
        ]);
    });

    test("builds a Performance origin trail even when the kind is unknown (treemap links only pods)", () => {
        // Unlike the All resources origin, the Performance origin does not need a kind:
        // the treemap only ever drills into pods, so a missing kind must not suppress it.
        const result = originCrumbs(FROM_CLUSTER_PERFORMANCE, null, "web-abc");
        expect(result).not.toBeNull();
        expect(result![0].label).toBe("Cluster");
    });
});

describe("performanceOrigin", () => {
    test("resolves the cluster Performance origin to the cluster hub's Performance tab", () => {
        expect(performanceOrigin(FROM_CLUSTER_PERFORMANCE)).toEqual({
            path: "/cluster",
            backTo: "/cluster?tab=performance",
            crumbLabel: "Cluster",
        });
    });

    test("resolves a node Performance origin to that node's Performance tab", () => {
        expect(performanceOrigin(`${FROM_NODE_PERFORMANCE}:node-cp`)).toEqual({
            path: "/nodes/node-cp",
            backTo: "/nodes/node-cp?tab=performance",
            crumbLabel: "node-cp",
        });
    });

    test("middle-truncates a long node name in the crumb label but not in the path", () => {
        const name = "really-long-node-name-that-exceeds-the-breadcrumb-limit-0123456789";
        const result = performanceOrigin(`${FROM_NODE_PERFORMANCE}:${name}`);
        expect(result!.path).toBe(`/nodes/${name}`);
        expect(result!.crumbLabel).toContain("...");
        expect(result!.crumbLabel.length).toBe(MAX_NAME_LENGTH);
    });

    test("returns null for a non-Performance 'from' so the normal Pods back target is used", () => {
        expect(performanceOrigin(null)).toBeNull();
        expect(performanceOrigin(FROM_ALL_RESOURCES)).toBeNull();
        expect(performanceOrigin("somewhere-else")).toBeNull();
    });

    test("returns null when a node origin carries no node name", () => {
        expect(performanceOrigin(`${FROM_NODE_PERFORMANCE}:`)).toBeNull();
    });
});
