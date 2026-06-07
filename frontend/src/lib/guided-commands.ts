// Pure, display-only kubectl command suggestions for Karse resources.
// Karse is strictly READ-ONLY: these strings are shown for the user to copy and
// run themselves. Nothing in this module executes or wires commands to any adapter.

import { fuzzyMatch } from "./fuzzy-filter";

// The resource kinds for which guided commands can be generated.
export type GuidedResourceKind = "pod" | "node" | "deployment" | "statefulset" | "daemonset";

// Identifies a single resource for which to build command suggestions.
export type GuidedResourceTarget = {
    kind: GuidedResourceKind;
    name: string;
    namespace?: string;
};

// A single suggested command with a short human-readable label.
export type GuidedCommand = {
    label: string;
    command: string;
};

// Appends a `-n <namespace>` flag when a namespace is present.
function withNamespace(command: string, namespace?: string): string {
    if (namespace)
    {
        return `${command} -n ${namespace}`;
    }
    return command;
}

// Builds the kubectl command suggestions for a single pod.
function buildPodCommands(name: string, namespace?: string): GuidedCommand[] {
    return [
        {
            label: "Describe pod",
            command: withNamespace(`kubectl describe pod ${name}`, namespace),
        },
        {
            label: "View logs",
            command: withNamespace(`kubectl logs ${name}`, namespace),
        },
        {
            label: "Follow logs",
            command: withNamespace(`kubectl logs -f ${name}`, namespace),
        },
        {
            label: "Open a shell",
            command: withNamespace(`kubectl exec -it ${name} -- sh`, namespace),
        },
        {
            label: "Get pod YAML",
            command: withNamespace(`kubectl get pod ${name} -o yaml`, namespace),
        },
        {
            label: "Delete pod",
            command: withNamespace(`kubectl delete pod ${name}`, namespace),
        },
    ];
}

// Builds the kubectl command suggestions for a single node.
function buildNodeCommands(name: string): GuidedCommand[] {
    return [
        {
            label: "Describe node",
            command: `kubectl describe node ${name}`,
        },
        {
            label: "Get node YAML",
            command: `kubectl get node ${name} -o yaml`,
        },
        {
            label: "List pods on node",
            command: `kubectl get pods --all-namespaces --field-selector spec.nodeName=${name}`,
        },
        {
            label: "Cordon node",
            command: `kubectl cordon ${name}`,
        },
        {
            label: "Drain node",
            command: `kubectl drain ${name} --ignore-daemonsets --delete-emptydir-data`,
        },
        {
            label: "Uncordon node",
            command: `kubectl uncordon ${name}`,
        },
    ];
}

// Builds the kubectl command suggestions for a workload (deployment, statefulset, daemonset).
function buildWorkloadCommands(kind: string, name: string, namespace?: string): GuidedCommand[] {
    const commands: GuidedCommand[] = [
        {
            label: `Describe ${kind}`,
            command: withNamespace(`kubectl describe ${kind} ${name}`, namespace),
        },
        {
            label: "Get YAML",
            command: withNamespace(`kubectl get ${kind} ${name} -o yaml`, namespace),
        },
        {
            label: "Restart rollout",
            command: withNamespace(`kubectl rollout restart ${kind}/${name}`, namespace),
        },
        {
            label: "Rollout status",
            command: withNamespace(`kubectl rollout status ${kind}/${name}`, namespace),
        },
    ];
    if (kind === "deployment" || kind === "statefulset")
    {
        commands.push({
            label: "Scale replicas",
            command: withNamespace(`kubectl scale ${kind} ${name} --replicas=3`, namespace),
        });
    }
    commands.push({
        label: `Delete ${kind}`,
        command: withNamespace(`kubectl delete ${kind} ${name}`, namespace),
    });
    return commands;
}

// Returns the display-only kubectl command suggestions for the given resource.
export function buildGuidedCommands(target: GuidedResourceTarget): GuidedCommand[] {
    if (target.kind === "pod")
    {
        return buildPodCommands(target.name, target.namespace);
    }
    if (target.kind === "node")
    {
        return buildNodeCommands(target.name);
    }
    return buildWorkloadCommands(target.kind, target.name, target.namespace);
}

// Filters a list of guided commands by a search query, fuzzy-matching the query
// against each command's label and command text. An empty/blank query returns
// the list unchanged. Pure: used by the Commands tab's search box.
export function filterGuidedCommands(commands: GuidedCommand[], query: string): GuidedCommand[] {
    if (query.trim().length === 0)
    {
        return commands;
    }
    return commands.filter((c) => fuzzyMatch(c.label, query) || fuzzyMatch(c.command, query));
}
