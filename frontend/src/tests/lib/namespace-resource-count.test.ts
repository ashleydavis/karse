import type { NamespaceResource } from "karse-types";
import { namespaceResourceCount } from "../../lib/namespace-resource-count";

// Builds a NamespaceResource fixture of the given kind. Other fields are
// realistic but irrelevant to the count.
function makeResource(kind: string, name: string): NamespaceResource {
    return {
        kind,
        name,
        status: "Running",
        detailPath: null,
    };
}

describe("namespaceResourceCount", () => {
    test("counts pods only, matching the namespaces list column", () => {
        // A team-a-like fixture: 3 pods plus a deployment, stateful set, and
        // daemon set. The agreed Resources count is the 3 pods, not all 6.
        const resources = [
            makeResource("Pod", "web-1"),
            makeResource("Pod", "web-2"),
            makeResource("Pod", "web-3"),
            makeResource("Deployment", "web"),
            makeResource("StatefulSet", "db"),
            makeResource("DaemonSet", "agent"),
        ];
        expect(namespaceResourceCount(resources)).toBe(3);
    });

    test("returns 0 when there are no pods (e.g. the pod sub-read failed)", () => {
        // The backend degrades a failed pod read to no Pod entries, so a namespace
        // whose pod query failed contributes 0 here rather than throwing.
        const resources = [
            makeResource("Deployment", "web"),
            makeResource("StatefulSet", "db"),
        ];
        expect(namespaceResourceCount(resources)).toBe(0);
    });

    test("returns 0 for an empty resource list", () => {
        expect(namespaceResourceCount([])).toBe(0);
    });
});
