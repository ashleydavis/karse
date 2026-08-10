// Grouping kubeconfig contexts by the environment they point at (production, staging, ...).
//
// The environment list belongs to the user: it is an ordered list of rows, each a name, a
// regular expression matched against the whole context name, and a chip colour. The list is
// stored in the `karse-config` local-storage entry and edited on the Config page. Karse ships
// a default list, but nothing here is hard-coded behind it: deleting a default deletes it.
//
// This is a display and grouping concern only: nothing here switches a context, calls the
// backend, or touches the kubeconfig, so it is consistent with the read-only invariant.
// The contexts page and both header pickers resolve through this module, so there is one
// rule rather than a copy per surface.

// The MUI chip colours an environment can be drawn in. Kept as a closed list so a stored
// colour can be validated, and so the editor can offer the choices.
export type EnvironmentColor = "error" | "warning" | "info" | "secondary" | "success" | "default";

// Every colour an environment may use, in the order the editor offers them.
export const ENVIRONMENT_COLORS: EnvironmentColor[] = [
    "error",
    "warning",
    "info",
    "secondary",
    "success",
    "default",
];

// One environment in the user's list. `id` is stable across renames, because it is what an
// explicit per-context label refers to; `pattern` is the regular expression source the user
// typed, stored as a string because local storage cannot hold a compiled `RegExp`.
export type EnvironmentDefinition = {
    id: string;
    name: string;
    pattern: string;
    color: EnvironmentColor;
};

// The built-in fallback bucket, for a context that matches no environment in the list. It is
// not a row in the list and has no regular expression: it is the absence of a match, which is
// why it survives the user clearing the list entirely.
export const UNASSIGNED_ENVIRONMENT: EnvironmentDefinition = {
    id: "unassigned",
    name: "Unassigned",
    pattern: "",
    color: "default",
};

// The longest regular expression the editor accepts. A pathological expression cannot reach a
// shell or kubectl (see the read-only invariant), but it can still make the browser tab work
// hard, so the length is capped and matching only ever runs against short context names.
export const MAX_PATTERN_LENGTH = 200;

// Builds the boundary-anchored expression the shipped defaults use: a token must be delimited
// by a non-letter or the end of the name, so `devops-prod` is production (its `devops` is not
// `dev`) and `predevelopmentplan` matches nothing. Digits are not boundaries, so `staging2`
// still matches `staging`.
function tokenPattern(tokens: string[]): string {
    return `(^|[^a-z])(${tokens.join("|")})([^a-z]|$)`;
}

// The list Karse ships with, and what "reset to defaults" restores. Every row is an ordinary
// editable row: the user can rename it, rewrite its expression, move it, or delete it.
export const DEFAULT_ENVIRONMENTS: EnvironmentDefinition[] = [
    {
        id: "production",
        name: "Production",
        pattern: tokenPattern(["production", "prod", "prd"]),
        color: "error",
    },
    {
        id: "staging",
        name: "Staging",
        pattern: tokenPattern(["staging", "stage", "stg"]),
        color: "warning",
    },
    {
        id: "development",
        name: "Development",
        pattern: tokenPattern(["development", "develop", "dev"]),
        color: "info",
    },
    {
        id: "test",
        name: "Test / QA",
        pattern: tokenPattern(["testing", "test", "qa"]),
        color: "secondary",
    },
    {
        id: "local",
        name: "Local",
        pattern: tokenPattern(["localhost", "local", "minikube", "kind"]),
        color: "success",
    },
];

// Checks a regular expression the user typed. Returns null when it is usable, otherwise the
// message the editor shows beside the field. Nothing that fails this is ever saved, so a
// stored list can never hold an expression that throws when it is compiled.
export function validatePattern(pattern: string): string | null {
    if (pattern.trim() === "") {
        return "Enter a regular expression.";
    }
    if (pattern.length > MAX_PATTERN_LENGTH) {
        return `Keep the expression to ${MAX_PATTERN_LENGTH} characters or fewer.`;
    }
    try {
        new RegExp(pattern, "i");
    }
    catch (error: any) {
        return `Not a valid regular expression: ${error.message}`;
    }
    return null;
}

// Checks an environment name. Returns null when it is usable, otherwise the message the
// editor shows beside the field.
export function validateEnvironmentName(name: string): string | null {
    if (name.trim() === "") {
        return "Enter a name.";
    }
    return null;
}

// One environment with its expression already compiled. Compiling is done once per change to
// the list rather than once per context per render, which is where this would otherwise get
// slow on a kubeconfig with many contexts.
export type CompiledEnvironment = {
    definition: EnvironmentDefinition;
    regex: RegExp;
};

// Compiles the user's list, case-insensitively and against the whole context name. A row
// whose expression will not compile is dropped rather than crashing every surface that groups
// contexts; the editor and the stored-value validation both prevent one being saved.
export function compileEnvironments(environments: EnvironmentDefinition[]): CompiledEnvironment[] {
    const compiled: CompiledEnvironment[] = [];
    for (const definition of environments) {
        try {
            compiled.push({
                definition,
                regex: new RegExp(definition.pattern, "i"),
            });
        }
        catch {
            // Skipped: an uncompilable row matches nothing rather than breaking the page.
        }
    }
    return compiled;
}

// The developer's explicit environment labels, keyed by context name, valued by environment
// id. Keying by name (rather than by position or cluster) is what lets a label survive a
// context disappearing from the kubeconfig and coming back, and stops a stale label attaching
// itself to a different cluster.
export type EnvironmentLabels = Record<string, string>;

// A context's resolved environment plus where it came from, so the UI can show which
// contexts were tagged by hand rather than matched by their name.
export type ResolvedEnvironment = {
    environment: EnvironmentDefinition;
    source: "label" | "inferred";
};

// Resolves one context's environment: an explicit label wins, otherwise the first environment
// in the list whose expression matches the context name, otherwise Unassigned. Order is what
// decides precedence, so moving a row up or down changes which environment wins a name that
// matches two. A label naming an environment that is no longer in the list is ignored, and
// the context falls back to the matched environment.
export function resolveEnvironment(
    contextName: string,
    environments: CompiledEnvironment[],
    labels: EnvironmentLabels,
): ResolvedEnvironment {
    const labelled = labels[contextName];
    const labelledEnvironment = environments.find((environment) => environment.definition.id === labelled);
    if (labelledEnvironment !== undefined) {
        return {
            environment: labelledEnvironment.definition,
            source: "label",
        };
    }
    for (const environment of environments) {
        if (environment.regex.test(contextName)) {
            return {
                environment: environment.definition,
                source: "inferred",
            };
        }
    }
    return {
        environment: UNASSIGNED_ENVIRONMENT,
        source: "inferred",
    };
}

// Returns the id of the environment explicitly labelled on a context, or null when it has
// none (or when its label names an environment the user has since deleted). Used by the
// contexts page to show "Auto" versus a hand-picked environment in its selector.
export function contextLabel(
    contextName: string,
    environments: CompiledEnvironment[],
    labels: EnvironmentLabels,
): string | null {
    const labelled = labels[contextName];
    const exists = environments.some((environment) => environment.definition.id === labelled);
    return exists ? labelled : null;
}

// The environment selector's "let the name decide" option value. A selector cannot use the
// empty string for it, because MUI reserves "" for "nothing selected", so the no-label choice
// needs a value of its own.
export const AUTO_ENVIRONMENT_VALUE = "auto";

// Maps a value chosen in an environment selector to the label it should set: null for the
// "auto" choice (and for anything that is not an environment in the list), otherwise the
// chosen environment's id. Lets the contexts page hand a raw selector string straight to
// setContextEnvironment.
export function environmentFromSelection(value: string, environments: CompiledEnvironment[]): string | null {
    const exists = environments.some((environment) => environment.definition.id === value);
    return exists ? value : null;
}

// One environment's group of contexts, ready to render as a heading plus its rows.
export type EnvironmentGroup<T> = {
    environment: EnvironmentDefinition;
    items: T[];
};

// Groups contexts by their resolved environment, in the user's list order, with Unassigned
// last and every environment no context resolved to dropped. The order of contexts within a
// group is the order they were given in, so a caller's own sort or filter is preserved.
//
// Only the contexts passed in are ever grouped, so a label naming a context that is no longer
// in the kubeconfig produces no phantom row. The label itself is left in storage, so it
// applies again if that context comes back.
export function groupByEnvironment<T extends { name: string }>(
    contexts: T[],
    environments: CompiledEnvironment[],
    labels: EnvironmentLabels,
): EnvironmentGroup<T>[] {
    const buckets = new Map<string, T[]>();
    for (const context of contexts) {
        const resolved = resolveEnvironment(context.name, environments, labels);
        const bucket = buckets.get(resolved.environment.id);
        if (bucket === undefined) {
            buckets.set(resolved.environment.id, [context]);
        }
        else {
            bucket.push(context);
        }
    }
    const groups: EnvironmentGroup<T>[] = [];
    for (const environment of environments) {
        const items = buckets.get(environment.definition.id);
        if (items !== undefined) {
            groups.push({
                environment: environment.definition,
                items,
            });
        }
    }
    const unassigned = buckets.get(UNASSIGNED_ENVIRONMENT.id);
    if (unassigned !== undefined) {
        groups.push({
            environment: UNASSIGNED_ENVIRONMENT,
            items: unassigned,
        });
    }
    return groups;
}

// Derives a stable id for a newly added environment from its name, uniquified against the
// ids already in use (and against the built-in Unassigned bucket). The id is what labels
// refer to, so it is fixed at creation and never changes when the environment is renamed.
export function environmentId(name: string, existing: EnvironmentDefinition[]): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const root = slug === "" ? "environment" : slug;
    const taken = new Set(existing.map((environment) => environment.id));
    taken.add(UNASSIGNED_ENVIRONMENT.id);
    if (!taken.has(root)) {
        return root;
    }
    let suffix = 2;
    while (taken.has(`${root}-${suffix}`)) {
        suffix += 1;
    }
    return `${root}-${suffix}`;
}

// Reads the environment list out of a value loaded from local storage. An absent list yields
// the defaults, so an entry written before the list existed reads back as the shipped
// behaviour. A malformed one (not an array, a row missing its name or expression, an
// expression that no longer compiles) also yields the defaults rather than breaking the page.
// An empty array is a valid list, not an absent one: it is how "clear the list" persists.
export function normalizeEnvironments(value: any): EnvironmentDefinition[] {
    if (value === undefined || value === null) {
        return DEFAULT_ENVIRONMENTS;
    }
    if (!Array.isArray(value)) {
        return DEFAULT_ENVIRONMENTS;
    }
    const environments: EnvironmentDefinition[] = [];
    for (const row of value) {
        if (row === null || typeof row !== "object") {
            return DEFAULT_ENVIRONMENTS;
        }
        if (typeof row.id !== "string" || row.id.trim() === "") {
            return DEFAULT_ENVIRONMENTS;
        }
        if (typeof row.name !== "string" || validateEnvironmentName(row.name) !== null) {
            return DEFAULT_ENVIRONMENTS;
        }
        if (typeof row.pattern !== "string" || validatePattern(row.pattern) !== null) {
            return DEFAULT_ENVIRONMENTS;
        }
        environments.push({
            id: row.id,
            name: row.name,
            pattern: row.pattern,
            color: ENVIRONMENT_COLORS.includes(row.color) ? row.color : "default",
        });
    }
    return environments;
}
