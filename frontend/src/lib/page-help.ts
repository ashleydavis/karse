// Context-sensitive help for the current page: where the page's data came from and
// the read-only kubectl commands the user can run to get the same information themselves.
//
// Pure and display-only, exactly like guided-commands.ts: nothing here executes a
// command. The strings describe the read-only queries Karse's backend runs through
// the kubectl adapter, rebuilt for the page the user is looking at so they can be
// pasted straight into a terminal.

import type { GuidedCommand } from "./guided-commands";

// The active selection the help is built against: the selected kubectl context and
// namespace. A null context means none is selected (kubeconfig's current context is
// used); a null namespace means "all namespaces".
export type PageHelpSelection = {
    context: string | null;
    namespace: string | null;
};

// The help shown for one page: its name, a plain-English statement of where its data
// came from, and the commands that reproduce that data.
export type PageHelp = {
    title: string;
    source: string;
    commands: GuidedCommand[];
};

// Builds a runnable kubectl command string, pinning it to the selected context so it
// returns the same data the page shows regardless of the user's current kubeconfig
// context. With no context selected the flag is omitted.
function kubectlCommand(context: string | null, args: string[]): string {
    const contextArgs = context === null ? [] : ["--context", context];
    return ["kubectl", ...contextArgs, ...args].join(" ");
}

// The namespace scoping flags a list page's query uses: the selected namespace, or
// `-A` (all namespaces) when none is selected. This mirrors the backend adapter.
function listNamespaceArgs(namespace: string | null): string[] {
    if (namespace === null)
    {
        return ["-A"];
    }
    return ["-n", namespace];
}

// The sentence appended to every page's source text, naming the selected namespace
// scope so the reader knows why the commands are scoped the way they are.
function namespaceScope(namespace: string | null): string {
    if (namespace === null)
    {
        return "No namespace is selected, so the queries cover all namespaces (-A).";
    }
    return `The "${namespace}" namespace is selected, so the queries are scoped to it (-n ${namespace}).`;
}

// Help for the cluster home page, built from the five queries the cluster overview runs.
function clusterHelp(context: string | null): PageHelp {
    return {
        title: "Cluster",
        source: "The cluster summary is built from five read-only kubectl queries against the selected context: the server version, every node, every namespace, every pod in the cluster, and the cluster's Warning events. The Performance tab reads the same nodes and pods plus the metrics API.",
        commands: [
            {
                label: "Server version",
                command: kubectlCommand(context, ["version", "-o", "json"]),
            },
            {
                label: "Nodes",
                command: kubectlCommand(context, ["get", "nodes", "-o", "json"]),
            },
            {
                label: "Namespaces",
                command: kubectlCommand(context, ["get", "namespaces", "-o", "json"]),
            },
            {
                label: "Pods (all namespaces)",
                command: kubectlCommand(context, ["get", "pods", "-A", "-o", "json"]),
            },
            {
                label: "Warning events",
                command: kubectlCommand(context, ["get", "events", "-A", "--field-selector=type=Warning", "-o", "json"]),
            },
        ],
    };
}

// Help for the All resources page, which merges every resource list into one table.
function allResourcesHelp(context: string | null, namespace: string | null): PageHelp {
    const ns = listNamespaceArgs(namespace);
    return {
        title: "All resources",
        source: `Every row comes from a separate kubectl list: pods, nodes, namespaces, deployments, stateful sets, daemon sets, and horizontal pod autoscalers. Karse merges them into one table. ${namespaceScope(namespace)}`,
        commands: [
            {
                label: "Pods",
                command: kubectlCommand(context, ["get", "pods", ...ns, "-o", "json"]),
            },
            {
                label: "Nodes",
                command: kubectlCommand(context, ["get", "nodes", "-o", "json"]),
            },
            {
                label: "Namespaces",
                command: kubectlCommand(context, ["get", "namespaces", "-o", "json"]),
            },
            {
                label: "Deployments",
                command: kubectlCommand(context, ["get", "deployments", ...ns, "-o", "json"]),
            },
            {
                label: "Stateful sets",
                command: kubectlCommand(context, ["get", "statefulsets", ...ns, "-o", "json"]),
            },
            {
                label: "Daemon sets",
                command: kubectlCommand(context, ["get", "daemonsets", ...ns, "-o", "json"]),
            },
            {
                label: "Horizontal pod autoscalers",
                command: kubectlCommand(context, ["get", "horizontalpodautoscalers", ...ns, "-o", "json"]),
            },
        ],
    };
}

// Help for the Contexts page, whose data comes from the local kubeconfig rather than
// from any cluster, so its commands carry no --context flag.
function contextsHelp(): PageHelp {
    return {
        title: "Contexts",
        source: "This page reads your local kubeconfig file, not a cluster. Karse lists the contexts it declares and marks the current one. Switching context is the only write Karse performs, and it changes your kubeconfig, never the cluster.",
        commands: [
            {
                label: "List the contexts in your kubeconfig",
                command: "kubectl config view -o json",
            },
            {
                label: "Show the current context",
                command: "kubectl config current-context",
            },
        ],
    };
}

// Help for the Nodes list page.
function nodesHelp(context: string | null): PageHelp {
    return {
        title: "Nodes",
        source: "The node table is one kubectl query for every node in the selected context. Nodes are not namespaced, so the selected namespace does not scope this page. Resource columns come from the metrics API.",
        commands: [
            {
                label: "Nodes",
                command: kubectlCommand(context, ["get", "nodes", "-o", "json"]),
            },
        ],
    };
}

// Help for a single node's detail page: the node, the pods scheduled on it, and its events.
function nodeDetailHelp(context: string | null, name: string): PageHelp {
    return {
        title: `Node: ${name}`,
        source: `This page is built from three read-only queries: the node "${name}" itself, every pod scheduled onto it (found with a field selector on spec.nodeName), and the events raised against it.`,
        commands: [
            {
                label: "The node",
                command: kubectlCommand(context, ["get", "node", name, "-o", "json"]),
            },
            {
                label: "Pods scheduled on this node",
                command: kubectlCommand(context, ["get", "pods", "-A", `--field-selector=spec.nodeName=${name}`, "-o", "json"]),
            },
            {
                label: "Events for this node",
                command: kubectlCommand(context, ["get", "events", "-A", `--field-selector=involvedObject.kind=Node,involvedObject.name=${name}`, "-o", "json"]),
            },
        ],
    };
}

// Help for the Namespaces list page, whose pod counts come from a second, cluster-wide pod query.
function namespacesHelp(context: string | null): PageHelp {
    return {
        title: "Namespaces",
        source: "The namespace list is one query for the namespaces themselves; the pod count on each row comes from a second query listing every pod in the cluster, which Karse groups by namespace.",
        commands: [
            {
                label: "Namespaces",
                command: kubectlCommand(context, ["get", "namespaces", "-o", "json"]),
            },
            {
                label: "Pods (counted per namespace)",
                command: kubectlCommand(context, ["get", "pods", "-A", "-o", "json"]),
            },
        ],
    };
}

// Help for a single namespace's detail page, built from the namespace plus the resources inside it.
function namespaceDetailHelp(context: string | null, name: string): PageHelp {
    return {
        title: `Namespace: ${name}`,
        source: `This page queries the namespace "${name}" and then everything inside it: its pods, deployments, stateful sets, daemon sets, resource quotas, and limit ranges.`,
        commands: [
            {
                label: "The namespace",
                command: kubectlCommand(context, ["get", "namespace", name, "-o", "json"]),
            },
            {
                label: "Pods in the namespace",
                command: kubectlCommand(context, ["get", "pods", "-n", name, "-o", "json"]),
            },
            {
                label: "Deployments in the namespace",
                command: kubectlCommand(context, ["get", "deployments", "-n", name, "-o", "json"]),
            },
            {
                label: "Stateful sets in the namespace",
                command: kubectlCommand(context, ["get", "statefulsets", "-n", name, "-o", "json"]),
            },
            {
                label: "Daemon sets in the namespace",
                command: kubectlCommand(context, ["get", "daemonsets", "-n", name, "-o", "json"]),
            },
            {
                label: "Resource quotas",
                command: kubectlCommand(context, ["get", "resourcequotas", "-n", name, "-o", "json"]),
            },
            {
                label: "Limit ranges",
                command: kubectlCommand(context, ["get", "limitranges", "-n", name, "-o", "json"]),
            },
        ],
    };
}

// Help for the Pods list page.
function podsHelp(context: string | null, namespace: string | null): PageHelp {
    return {
        title: "Pods",
        source: `The pod table is a single kubectl pod list. ${namespaceScope(namespace)} Resource columns come from the metrics API.`,
        commands: [
            {
                label: "Pods",
                command: kubectlCommand(context, ["get", "pods", ...listNamespaceArgs(namespace), "-o", "json"]),
            },
        ],
    };
}

// The number of recent lines every log stream in Karse tails. The Logs page and the
// pod/container Logs tabs all open the stream with this backlog, so the `kubectl logs`
// commands shown in the help reproduce exactly what those views display.
const LOG_TAIL_LINES = 100;

// Help for a single pod's detail page: the pod plus the events raised against it.
function podDetailHelp(context: string | null, namespace: string, name: string): PageHelp {
    return {
        title: `Pod: ${name}`,
        source: `This page queries the pod "${name}" in the "${namespace}" namespace, and the events raised against it. The Logs tab follows the pod's logs from the last ${LOG_TAIL_LINES} lines; the Commands tab lists commands for acting on the pod yourself.`,
        commands: [
            {
                label: "The pod",
                command: kubectlCommand(context, ["get", "pod", name, "-n", namespace, "-o", "json"]),
            },
            {
                label: "Events for this pod",
                command: kubectlCommand(context, ["get", "events", "-n", namespace, `--field-selector=involvedObject.name=${name},involvedObject.namespace=${namespace}`, "-o", "json"]),
            },
            {
                label: "Logs (as the Logs tab streams them)",
                command: kubectlCommand(context, ["logs", "-f", name, "-n", namespace, `--tail=${LOG_TAIL_LINES}`]),
            },
        ],
    };
}

// Help for a container's detail page. A container is part of its pod, so the page is
// built from the pod's own query, narrowed to the named container: the container's spec
// and status are read straight out of the pod's JSON, so there is no second query.
function containerDetailHelp(context: string | null, namespace: string, pod: string, container: string): PageHelp {
    return {
        title: `Container: ${container}`,
        source: `A container has no object of its own in Kubernetes: this page comes from one query for the pod "${pod}" in the "${namespace}" namespace, narrowed to the "${container}" container. Its spec is read from the pod's spec.containers and its status from the pod's status.containerStatuses, so no separate query is run for the container. Its logs are the pod's logs for that container.`,
        commands: [
            {
                label: "The pod that holds this container (its spec and status)",
                command: kubectlCommand(context, ["get", "pod", pod, "-n", namespace, "-o", "json"]),
            },
            {
                label: "Logs for this container (as the Logs tab streams them)",
                command: kubectlCommand(context, ["logs", "-f", pod, "-c", container, "-n", namespace, `--tail=${LOG_TAIL_LINES}`]),
            },
        ],
    };
}

// The display name of each workload list page, keyed by its route segment.
const WORKLOAD_TITLES: Record<string, string> = {
    deployments: "Deployments",
    statefulsets: "Stateful sets",
    daemonsets: "Daemon sets",
};

// Help for a workload list page (deployments, stateful sets, daemon sets).
function workloadListHelp(kind: string, context: string | null, namespace: string | null): PageHelp {
    const title = WORKLOAD_TITLES[kind] ?? kind;
    return {
        title,
        source: `The table is a single kubectl ${kind} list. ${namespaceScope(namespace)}`,
        commands: [
            {
                label: title,
                command: kubectlCommand(context, ["get", kind, ...listNamespaceArgs(namespace), "-o", "json"]),
            },
        ],
    };
}

// Help for a workload's detail page: the workload, its events, and the pods it owns.
//
// The pod query is not a plain namespace list. Karse reads the workload's
// spec.selector.matchLabels, passes them to kubectl as a label selector (-l), and then
// keeps only the pods the workload actually owns, so a selector shared with another
// workload cannot pull in that workload's pods. The selector is the workload's own, so
// the command carries a <selector> placeholder rather than an invented value.
//
// A deployment does not own its pods directly: it owns ReplicaSets, which own the pods.
// Karse therefore runs an extra ReplicaSet query for deployments so it can trace pod
// ownership through them. Stateful sets and daemon sets own their pods directly and need
// no such lookup, so that command is shown only for deployments.
function workloadDetailHelp(kind: string, context: string | null, namespace: string, name: string): PageHelp {
    const singular = kind.replace(/s$/, "");
    const isDeployment = kind === "deployments";

    const ownership = isDeployment
        ? `A deployment owns ReplicaSets, and those ReplicaSets own the pods, so Karse also lists the ReplicaSets carrying the same selector and keeps the ones this deployment owns. It then lists the pods matching the selector and keeps those owned by one of them.`
        : `A ${singular} owns its pods directly, so Karse lists the pods matching the selector and keeps the ones this ${singular} owns.`;

    const replicaSetCommand = {
        label: "ReplicaSets it owns (pod ownership is traced through them)",
        command: kubectlCommand(context, ["get", "replicasets", "-n", namespace, "-l", "<selector>", "-o", "json"]),
    };

    return {
        title: `${WORKLOAD_TITLES[kind] ?? kind}: ${name}`,
        source: `This page queries the ${singular} "${name}" in the "${namespace}" namespace and the events raised against it, then finds its pods with the label selector from the ${singular}'s own spec.selector.matchLabels (shown below as <selector>). ${ownership}`,
        commands: [
            {
                label: "The workload",
                command: kubectlCommand(context, ["get", kind, name, "-n", namespace, "-o", "json"]),
            },
            {
                label: "Events for this workload",
                command: kubectlCommand(context, ["get", "events", "-n", namespace, `--field-selector=involvedObject.name=${name},involvedObject.namespace=${namespace}`, "-o", "json"]),
            },
            ...(isDeployment ? [replicaSetCommand] : []),
            {
                label: "Pods matching its selector (Karse then keeps the ones it owns)",
                command: kubectlCommand(context, ["get", "pods", "-n", namespace, "-l", "<selector>", "-o", "json"]),
            },
        ],
    };
}

// Help for the Events feed and the event detail page, which read the same event list.
function eventsHelp(context: string | null, namespace: string | null, isDetail: boolean): PageHelp {
    const detailNote = isDetail
        ? " The detail page picks a single event out of that same list by its UID; there is no per-event kubectl query."
        : "";
    return {
        title: isDetail ? "Event" : "Events",
        source: `The events feed is a single kubectl event list. ${namespaceScope(namespace)}${detailNote}`,
        commands: [
            {
                label: "Events",
                command: kubectlCommand(context, ["get", "events", ...listNamespaceArgs(namespace), "-o", "json"]),
            },
        ],
    };
}

// Help for the Errors feed and the error detail page. Errors are derived, not a
// Kubernetes object: Karse combines Warning events with unhealthy pods.
function errorsHelp(context: string | null, namespace: string | null, isDetail: boolean): PageHelp {
    const detailNote = isDetail
        ? " The detail page picks a single error out of that derived list; there is no per-error kubectl query."
        : "";
    return {
        title: isDetail ? "Error" : "Errors",
        source: `Kubernetes has no "error" object. Karse derives this feed from two queries: the Warning events, and the pods (whose failing containers become errors too). ${namespaceScope(namespace)}${detailNote}`,
        commands: [
            {
                label: "Warning events",
                command: kubectlCommand(context, ["get", "events", ...listNamespaceArgs(namespace), "--field-selector=type=Warning", "-o", "json"]),
            },
            {
                label: "Pods (scanned for failing containers)",
                command: kubectlCommand(context, ["get", "pods", ...listNamespaceArgs(namespace), "-o", "json"]),
            },
        ],
    };
}

// Help for the live logs page, which lists pods to choose from and then follows their logs.
function liveLogsHelp(context: string | null, namespace: string | null): PageHelp {
    const ns = namespace ?? "<namespace>";
    return {
        title: "Logs",
        source: `The pod picker is a kubectl pod list; the log stream is a followed kubectl logs call, one per selected pod, starting from the last ${LOG_TAIL_LINES} lines. ${namespaceScope(namespace)}`,
        commands: [
            {
                label: "Pods to choose from",
                command: kubectlCommand(context, ["get", "pods", ...listNamespaceArgs(namespace), "-o", "json"]),
            },
            {
                label: "Follow one pod's logs (as the stream does)",
                command: kubectlCommand(context, ["logs", "-f", "<pod>", "-n", ns, `--tail=${LOG_TAIL_LINES}`]),
            },
        ],
    };
}

// Returns the context-sensitive help for a page, given its route pathname and the
// active context/namespace selection. Returns null for pages with no cluster data
// behind them (About, Config), so the caller can hide the help affordance entirely.
export function buildPageHelp(pathname: string, selection: PageHelpSelection): PageHelp | null {
    const { context, namespace } = selection;
    const segments = pathname.split("/").filter((s) => s.length > 0);
    const [first, second, third, fourth, fifth] = segments;

    if (segments.length === 0 || first === "cluster")
    {
        return clusterHelp(context);
    }
    if (first === "all-resources")
    {
        return allResourcesHelp(context, namespace);
    }
    if (first === "contexts")
    {
        return contextsHelp();
    }
    if (first === "nodes")
    {
        if (second !== undefined)
        {
            return nodeDetailHelp(context, second);
        }
        return nodesHelp(context);
    }
    if (first === "namespaces")
    {
        if (second !== undefined)
        {
            return namespaceDetailHelp(context, second);
        }
        return namespacesHelp(context);
    }
    if (first === "pods")
    {
        if (second !== undefined && third !== undefined && fourth === "containers" && fifth !== undefined)
        {
            return containerDetailHelp(context, second, third, fifth);
        }
        if (second !== undefined && third !== undefined)
        {
            return podDetailHelp(context, second, third);
        }
        return podsHelp(context, namespace);
    }
    if (first === "deployments" || first === "statefulsets" || first === "daemonsets")
    {
        if (second !== undefined && third !== undefined)
        {
            return workloadDetailHelp(first, context, second, third);
        }
        return workloadListHelp(first, context, namespace);
    }
    if (first === "events")
    {
        return eventsHelp(context, namespace, second !== undefined);
    }
    if (first === "errors")
    {
        return errorsHelp(context, namespace, second !== undefined);
    }
    if (first === "logs")
    {
        return liveLogsHelp(context, namespace);
    }
    return null;
}
