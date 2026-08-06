// Grouping kubeconfig contexts by the environment they point at (production, staging, ...).
//
// This is a display and grouping concern only: nothing here switches a context, calls the
// backend, or touches the kubeconfig, so it is consistent with the read-only invariant.
// The contexts page and both header pickers resolve through this module, so there is one
// rule rather than a copy per surface.

// The environments a context can belong to. "unassigned" is the fallback bucket for a
// context whose name carries no recognisable token and that carries no explicit label.
export type ClusterEnvironment =
    | "production"
    | "staging"
    | "development"
    | "test"
    | "local"
    | "unassigned";

// The stable display order for environment groups: production first (so the riskiest
// cluster is never buried), unassigned last. Every surface that groups contexts renders
// them in this order rather than whatever order the kubeconfig or a sort happened to give.
export const ENVIRONMENT_ORDER: ClusterEnvironment[] = [
    "production",
    "staging",
    "development",
    "test",
    "local",
    "unassigned",
];

// The environments the developer can pick as an explicit label. "unassigned" is deliberately
// absent: it is the absence of an environment, and clearing the label already hands the
// decision back to the context's name.
export const LABELLABLE_ENVIRONMENTS: ClusterEnvironment[] = [
    "production",
    "staging",
    "development",
    "test",
    "local",
];

// The heading shown for each environment.
export const ENVIRONMENT_LABELS: Record<ClusterEnvironment, string> = {
    production: "Production",
    staging: "Staging",
    development: "Development",
    test: "Test / QA",
    local: "Local",
    unassigned: "Unassigned",
};

// The name segments that identify each environment, lowercase. A segment must match one of
// these exactly: they are never matched as bare substrings, so `devops-prod` is production
// (its `devops` segment is not `dev`) and `predev` matches nothing at all.
//
// "unassigned" has no tokens: it is what a name that matches nothing resolves to.
const ENVIRONMENT_TOKENS: Record<ClusterEnvironment, string[]> = {
    production: ["prod", "prd", "production"],
    staging: ["stg", "stage", "staging"],
    development: ["dev", "develop", "development"],
    test: ["test", "testing", "qa"],
    local: ["local", "localhost", "minikube", "kind"],
    unassigned: [],
};

// Splits a context name into its lowercase segments: on any run of non-alphanumeric
// characters, and also at every letter/digit boundary, so `staging2` yields `staging` and
// `2` rather than one unmatchable `staging2`.
function nameSegments(contextName: string): string[] {
    return contextName
        .toLowerCase()
        .replace(/([a-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([a-z])/g, "$1 $2")
        .split(/[^a-z0-9]+/)
        .filter((segment) => segment.length > 0);
}

// Infers a context's environment from its name alone, case-insensitively and by segment.
//
// A name can carry more than one token (`prod-test-eu`). Ties are broken by
// ENVIRONMENT_ORDER, so the riskiest environment named wins and a context mentioning
// production is never quietly grouped as something softer.
export function inferEnvironment(contextName: string): ClusterEnvironment {
    const segments = new Set(nameSegments(contextName));
    for (const environment of ENVIRONMENT_ORDER) {
        if (ENVIRONMENT_TOKENS[environment].some((token) => segments.has(token))) {
            return environment;
        }
    }
    return "unassigned";
}

// The developer's explicit environment labels, keyed by context name. Keying by name (rather
// than by position or cluster) is what lets a label survive a context disappearing from the
// kubeconfig and coming back, and stops a stale label attaching itself to a different cluster.
export type EnvironmentLabels = Record<string, ClusterEnvironment>;

// A context's resolved environment plus where it came from, so the UI can show which
// contexts were tagged by hand rather than read off their name.
export type ResolvedEnvironment = {
    environment: ClusterEnvironment;
    source: "label" | "inferred";
};

// True when a stored value is one of the known environments. Stored labels come from local
// storage, so a hand-edited or stale entry naming something else is ignored rather than
// trusted.
function isEnvironment(value: any): value is ClusterEnvironment {
    return ENVIRONMENT_ORDER.includes(value);
}

// Resolves one context's environment: an explicit label wins, otherwise the environment
// inferred from the name, otherwise "unassigned". Clearing a label therefore falls back to
// the inferred environment, never straight to unassigned.
export function resolveEnvironment(contextName: string, labels: EnvironmentLabels): ResolvedEnvironment {
    const labelled = labels[contextName];
    if (isEnvironment(labelled)) {
        return {
            environment: labelled,
            source: "label",
        };
    }
    return {
        environment: inferEnvironment(contextName),
        source: "inferred",
    };
}

// Returns the explicit label set on a context, or null when it has none. Used by the
// contexts page to show "Auto" versus a hand-picked environment in its selector.
export function contextLabel(contextName: string, labels: EnvironmentLabels): ClusterEnvironment | null {
    const labelled = labels[contextName];
    return isEnvironment(labelled) ? labelled : null;
}

// The environment selector's "let the name decide" option value. A selector cannot use the
// empty string for it, because MUI reserves "" for "nothing selected", so the no-label choice
// needs a value of its own.
export const AUTO_ENVIRONMENT_VALUE = "auto";

// Maps a value chosen in an environment selector to the label it should set: null for the
// "auto" choice (and for anything else that is not a known environment), otherwise the chosen
// environment. Lets the contexts page hand a raw selector string straight to
// setContextEnvironment without casting it.
export function environmentFromSelection(value: string): ClusterEnvironment | null {
    return isEnvironment(value) ? value : null;
}

// One environment's group of contexts, ready to render as a heading plus its rows.
export type EnvironmentGroup<T> = {
    environment: ClusterEnvironment;
    label: string;
    items: T[];
};

// Groups contexts by their resolved environment, in ENVIRONMENT_ORDER, dropping every
// environment that no context resolved to. The order of contexts within a group is the
// order they were given in, so a caller's own sort or filter is preserved.
//
// Only the contexts passed in are ever grouped, so a label naming a context that is no
// longer in the kubeconfig produces no phantom row. The label itself is left in storage, so
// it applies again if that context comes back.
export function groupByEnvironment<T extends { name: string }>(
    contexts: T[],
    labels: EnvironmentLabels,
): EnvironmentGroup<T>[] {
    const groups: EnvironmentGroup<T>[] = [];
    for (const environment of ENVIRONMENT_ORDER) {
        const items = contexts.filter((context) => resolveEnvironment(context.name, labels).environment === environment);
        if (items.length > 0) {
            groups.push({
                environment,
                label: ENVIRONMENT_LABELS[environment],
                items,
            });
        }
    }
    return groups;
}
