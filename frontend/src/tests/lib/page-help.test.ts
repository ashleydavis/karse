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

    test("the logs page lists pods and follows one pod's logs", () => {
        expect(commandsFor("/logs", ONE_NAMESPACE)).toEqual([
            "kubectl --context prod-cluster get pods -n web -o json",
            "kubectl --context prod-cluster logs -f <pod> -n web --tail=200",
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
            "kubectl --context prod-cluster logs web-0 -n default",
        ]);
    });

    test("a pod detail page titles itself with the pod name", () => {
        expect(buildPageHelp("/pods/default/web-0", ALL_NAMESPACES)!.title).toBe("Pod: web-0");
    });

    test("a container detail page explains that a container has no object of its own", () => {
        const help = buildPageHelp("/pods/default/web-0/containers/nginx", ALL_NAMESPACES);
        expect(help!.title).toBe("Container: nginx");
        expect(help!.source).toContain("no object of its own");
        expect(help!.commands.map((c) => c.command)).toEqual([
            "kubectl --context prod-cluster get pod web-0 -n default -o json",
            "kubectl --context prod-cluster describe pod web-0 -n default",
            "kubectl --context prod-cluster logs web-0 -c nginx -n default",
        ]);
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

    test("a workload detail page queries the workload, its events, and its pods", () => {
        expect(commandsFor("/statefulsets/default/db", ALL_NAMESPACES)).toEqual([
            "kubectl --context prod-cluster get statefulsets db -n default -o json",
            "kubectl --context prod-cluster get events -n default --field-selector=involvedObject.name=db,involvedObject.namespace=default -o json",
            "kubectl --context prod-cluster get pods -n default -o json",
        ]);
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
