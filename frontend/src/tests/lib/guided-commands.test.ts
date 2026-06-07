import { buildGuidedCommands, filterGuidedCommands } from "../../lib/guided-commands";

describe("buildGuidedCommands for pods", () => {
    test("includes a namespace flag on every command when a namespace is given", () => {
        const commands = buildGuidedCommands({ kind: "pod", name: "web-0", namespace: "prod" });
        expect(commands.every((c) => c.command.endsWith(" -n prod"))).toBe(true);
    });

    test("omits the namespace flag when no namespace is given", () => {
        const commands = buildGuidedCommands({ kind: "pod", name: "web-0" });
        expect(commands.some((c) => c.command.includes(" -n "))).toBe(false);
    });

    test("produces the expected pod command set", () => {
        const commands = buildGuidedCommands({ kind: "pod", name: "web-0", namespace: "prod" });
        expect(commands.map((c) => c.command)).toEqual([
            "kubectl describe pod web-0 -n prod",
            "kubectl logs web-0 -n prod",
            "kubectl logs -f web-0 -n prod",
            "kubectl exec -it web-0 -- sh -n prod",
            "kubectl get pod web-0 -o yaml -n prod",
            "kubectl delete pod web-0 -n prod",
        ]);
    });

    test("labels match the command list one-to-one", () => {
        const commands = buildGuidedCommands({ kind: "pod", name: "web-0" });
        expect(commands.map((c) => c.label)).toEqual([
            "Describe pod",
            "View logs",
            "Follow logs",
            "Open a shell",
            "Get pod YAML",
            "Delete pod",
        ]);
    });
});

describe("buildGuidedCommands for nodes", () => {
    test("never includes a namespace flag (nodes are cluster-scoped)", () => {
        const commands = buildGuidedCommands({ kind: "node", name: "node-1", namespace: "ignored" });
        expect(commands.some((c) => c.command.includes(" -n "))).toBe(false);
    });

    test("produces the expected node command set", () => {
        const commands = buildGuidedCommands({ kind: "node", name: "node-1" });
        expect(commands.map((c) => c.command)).toEqual([
            "kubectl describe node node-1",
            "kubectl get node node-1 -o yaml",
            "kubectl get pods --all-namespaces --field-selector spec.nodeName=node-1",
            "kubectl cordon node-1",
            "kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data",
            "kubectl uncordon node-1",
        ]);
    });
});

describe("buildGuidedCommands for workloads", () => {
    test("deployment includes a scale-replicas command", () => {
        const commands = buildGuidedCommands({ kind: "deployment", name: "api", namespace: "prod" });
        expect(commands.some((c) => c.command === "kubectl scale deployment api --replicas=3 -n prod")).toBe(true);
    });

    test("statefulset includes a scale-replicas command", () => {
        const commands = buildGuidedCommands({ kind: "statefulset", name: "db", namespace: "prod" });
        expect(commands.some((c) => c.command === "kubectl scale statefulset db --replicas=3 -n prod")).toBe(true);
    });

    test("daemonset omits the scale-replicas command", () => {
        const commands = buildGuidedCommands({ kind: "daemonset", name: "agent", namespace: "prod" });
        expect(commands.some((c) => c.label === "Scale replicas")).toBe(false);
    });

    test("produces the expected deployment command set with namespace flags", () => {
        const commands = buildGuidedCommands({ kind: "deployment", name: "api", namespace: "prod" });
        expect(commands.map((c) => c.command)).toEqual([
            "kubectl describe deployment api -n prod",
            "kubectl get deployment api -o yaml -n prod",
            "kubectl rollout restart deployment/api -n prod",
            "kubectl rollout status deployment/api -n prod",
            "kubectl scale deployment api --replicas=3 -n prod",
            "kubectl delete deployment api -n prod",
        ]);
    });

    test("daemonset command set without a namespace omits namespace flags", () => {
        const commands = buildGuidedCommands({ kind: "daemonset", name: "agent" });
        expect(commands.map((c) => c.command)).toEqual([
            "kubectl describe daemonset agent",
            "kubectl get daemonset agent -o yaml",
            "kubectl rollout restart daemonset/agent",
            "kubectl rollout status daemonset/agent",
            "kubectl delete daemonset agent",
        ]);
    });

    test("uses the kind in the describe and delete labels", () => {
        const commands = buildGuidedCommands({ kind: "statefulset", name: "db" });
        expect(commands[0].label).toBe("Describe statefulset");
        expect(commands[commands.length - 1].label).toBe("Delete statefulset");
    });
});

describe("filterGuidedCommands", () => {
    const commands = buildGuidedCommands({ kind: "pod", name: "web-0", namespace: "prod" });

    test("returns the full list for an empty query", () => {
        expect(filterGuidedCommands(commands, "")).toEqual(commands);
    });

    test("returns the full list for a whitespace-only query", () => {
        expect(filterGuidedCommands(commands, "   ")).toEqual(commands);
    });

    test("filters by command text", () => {
        const result = filterGuidedCommands(commands, "delete");
        expect(result).toHaveLength(1);
        expect(result[0].command).toBe("kubectl delete pod web-0 -n prod");
    });

    test("filters by label, case-insensitively", () => {
        const result = filterGuidedCommands(commands, "OPEN A SHELL");
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("Open a shell");
    });

    test("returns an empty list when nothing matches", () => {
        expect(filterGuidedCommands(commands, "zzzzz")).toHaveLength(0);
    });

    test("can match more than one command", () => {
        const result = filterGuidedCommands(commands, "logs");
        expect(result.length).toBeGreaterThan(1);
        expect(result.every((c) => c.command.includes("logs"))).toBe(true);
    });
});
