import { buildPageHelp } from "../../lib/page-help";

// The selection used by most tests: a named context with no namespace selected.
const ALL_NAMESPACES = {
    context: "prod-cluster",
    namespace: null,
};

// A selection scoped to a single namespace.
const ONE_NAMESPACE = {
    context: "prod-cluster",
    namespace: "web",
};

// Returns the command strings of the help for a pathname, for concise assertions.
function commandsFor(pathname: string, selection: { context: string | null; namespace: string | null }): string[] {
    const help = buildPageHelp(pathname, selection);
    expect(help).not.toBeNull();
    return help!.commands.map((c) => c.command);
}

describe("buildPageHelp list pages", () => {
    test("the cluster page lists the five overview queries", () => {
        expect(commandsFor("/cluster", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster version -o json",
            "kubectl --context prod-cluster get nodes -o json",
            "kubectl --context prod-cluster get namespaces -o json",
            "kubectl --context prod-cluster get pods -A -o json",
            "kubectl --context prod-cluster get events -A --field-selector=type=Warning -o json",
        ]);
    });

    test("the root path is treated as the cluster page", () => {
        expect(buildPageHelp("/", ALL_NAMESPACES)!.title).toBe("Cluster");
    });

    test("the pods page queries all namespaces when none is selected", () => {
        expect(commandsFor("/pods", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get pods -A -o json",
        ]);
    });

    test("the pods page scopes its query to the selected namespace", () => {
        expect(commandsFor("/pods", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get pods -n web -o json",
        ]);
    });

    test("the source text names the selected namespace", () => {
        expect(buildPageHelp("/pods", ONE_NAMESPACE)!.source).toContain("-n web");
        expect(buildPageHelp("/pods", ALL_NAMESPACES)!.source).toContain("all namespaces");
    });

    test("the nodes page queries nodes and is not namespace-scoped", () => {
        expect(commandsFor("/nodes", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get nodes -o json",
        ]);
    });

    test("the deployments page queries deployments in the selected namespace", () => {
        expect(commandsFor("/deployments", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get deployments -n web -o json",
        ]);
    });

    test("the errors page derives its feed from warning events and pods", () => {
        expect(commandsFor("/errors", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get events -A --field-selector=type=Warning -o json",
            "kubectl --context prod-cluster get pods -A -o json",
        ]);
    });

    test("the events page queries events", () => {
        expect(commandsFor("/events", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get events -A -o json",
        ]);
    });

    test("the logs page lists pods and follows one pod's logs with the tail the stream really uses", () => {
        expect(commandsFor("/logs", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get pods -n web -o json",
            "kubectl --context prod-cluster logs -f <pod> -n web --tail=100",
        ]);
    });

    test("the contexts page reads the kubeconfig and never pins a context", () => {
        expect(commandsFor("/contexts", ONE_NAMESPACE)).toEqual([
            "kubectl config view -o json",
            "kubectl config current-context",
        ]);
    });

    test("the all resources page lists every resource kind it merges", () => {
        expect(commandsFor("/all-resources", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get pods -A -o json",
            "kubectl --context prod-cluster get nodes -o json",
            "kubectl --context prod-cluster get namespaces -o json",
            "kubectl --context prod-cluster get deployments -A -o json",
            "kubectl --context prod-cluster get statefulsets -A -o json",
            "kubectl --context prod-cluster get daemonsets -A -o json",
            "kubectl --context prod-cluster get horizontalpodautoscalers -A -o json",
        ]);
    });
});

describe("buildPageHelp detail pages", () => {
    test("a pod detail page uses the pod's own namespace, not the selected one", () => {
        expect(commandsFor("/pods/default/web-0", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get pod web-0 -n default -o json",
            "kubectl --context prod-cluster get events -n default --field-selector=involvedObject.name=web-0,involvedObject.namespace=default -o json",
            "kubectl --context prod-cluster logs -f web-0 -n default --tail=100",
        ]);
    });

    test("a pod detail page titles itself with the pod name", () => {
        expect(buildPageHelp("/pods/default/web-0", ALL_NAMESPACES)!.title).toBe("Pod: web-0");
    });

    // The pod's Logs tab follows the stream from the last 100 lines, so the command must
    // show that tail: without it, the help does not reproduce what the tab displays.
    test("a pod detail page's log command carries the tail the Logs tab really uses", () => {
        const help = buildPageHelp("/pods/default/web-0", ALL_NAMESPACES);
        const logs = help!.commands.find((c) => c.label.startsWith("Logs"));
        expect(logs!.command).toContain("--tail=100");
    });

    // A container has no object of its own: its spec and status are read out of the pod's
    // JSON, which the first command already fetches. Karse never runs `kubectl describe`,
    // so the help must not claim it does.
    test("a container detail page shows only the queries Karse really runs, and never describe", () => {
        const help = buildPageHelp("/pods/default/web-0/containers/nginx", ALL_NAMESPACES);
        expect(help!.title).toBe("Container: nginx");
        expect(help!.source).toContain("no object of its own");
        expect(help!.commands.map((c) => c.command)).toEqual([
            "kubectl --context prod-cluster get pod web-0 -n default -o json",
            "kubectl --context prod-cluster logs -f web-0 -c nginx -n default --tail=100",
        ]);
        expect(help!.commands.every((c) => !c.command.includes("describe"))).toBe(true);
    });

    test("a node detail page queries the node, its pods, and its events", () => {
        expect(commandsFor("/nodes/node-a", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get node node-a -o json",
            "kubectl --context prod-cluster get pods -A --field-selector=spec.nodeName=node-a -o json",
            "kubectl --context prod-cluster get events -A --field-selector=involvedObject.kind=Node,involvedObject.name=node-a -o json",
        ]);
    });

    test("a namespace detail page queries the namespace and the resources inside it", () => {
        expect(commandsFor("/namespaces/web", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get namespace web -o json",
            "kubectl --context prod-cluster get pods -n web -o json",
            "kubectl --context prod-cluster get deployments -n web -o json",
            "kubectl --context prod-cluster get statefulsets -n web -o json",
            "kubectl --context prod-cluster get daemonsets -n web -o json",
            "kubectl --context prod-cluster get resourcequotas -n web -o json",
            "kubectl --context prod-cluster get limitranges -n web -o json",
        ]);
    });

    // The adapter finds a workload's pods with the workload's own label selector and then
    // keeps the ones it owns. A bare namespace-wide pod list would return every pod in the
    // namespace, so it must not be shown as the query behind the Pods tab.
    test("a stateful set detail page finds its pods by label selector, not a namespace-wide list", () => {
        expect(commandsFor("/statefulsets/default/db", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get statefulsets db -n default -o json",
            "kubectl --context prod-cluster get events -n default --field-selector=involvedObject.name=db,involvedObject.namespace=default -o json",
            "kubectl --context prod-cluster get pods -n default -l <selector> -o json",
        ]);
    });

    // A deployment owns ReplicaSets, which own the pods, so the adapter runs an extra
    // ReplicaSet query to trace ownership. Only deployments do this.
    test("a deployment detail page shows the ReplicaSet query it traces pod ownership through", () => {
        expect(commandsFor("/deployments/default/web", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get deployments web -n default -o json",
            "kubectl --context prod-cluster get events -n default --field-selector=involvedObject.name=web,involvedObject.namespace=default -o json",
            "kubectl --context prod-cluster get replicasets -n default -l <selector> -o json",
            "kubectl --context prod-cluster get pods -n default -l <selector> -o json",
        ]);
        expect(buildPageHelp("/deployments/default/web", ALL_NAMESPACES)!.source).toContain("ReplicaSets");
    });

    test("a daemon set detail page runs no ReplicaSet query, because it owns its pods directly", () => {
        const help = buildPageHelp("/daemonsets/default/agent", ALL_NAMESPACES);
        expect(help!.commands.every((c) => !c.command.includes("replicasets"))).toBe(true);
        expect(help!.source).toContain("owns its pods directly");
    });

    test("an event detail page reuses the event list query", () => {
        const help = buildPageHelp("/events/abc-123", ALL_NAMESPACES);
        expect(help!.title).toBe("Event");
        expect(help!.source).toContain("by its UID");
        expect(help!.commands.map((c) => c.command)).toEqual([
            "kubectl --context prod-cluster get events -A -o json",
        ]);
    });
});

describe("buildPageHelp with no context selected", () => {
    const NO_CONTEXT = {
        context: null,
        namespace: null,
    };

    test("omits the --context flag so the command uses the kubeconfig's current context", () => {
        expect(commandsFor("/nodes", NO_CONTEXT)).toEqual([
            "kubectl get nodes -o json",
        ]);
    });
});

describe("buildPageHelp for pages with no cluster data", () => {
    test("returns null for the about page", () => {
        expect(buildPageHelp("/about", ALL_NAMESPACES)).toBeNull();
    });

    test("returns null for the config page", () => {
        expect(buildPageHelp("/config", ALL_NAMESPACES)).toBeNull();
    });

    test("returns null for an unknown page", () => {
        expect(buildPageHelp("/nowhere", ALL_NAMESPACES)).toBeNull();
    });
});
