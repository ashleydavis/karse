// The label wording used for the dropdown entry that clears the namespace selection, and
// for the header trigger when nothing is selected. Shared by both so the trigger and the
// entry that produces its state always read the same.
export const ALL_NAMESPACES_LABEL = "All namespaces";

// The text the header's namespace trigger shows: the active namespace's name, or
// "All namespaces" when none is set, so the trigger always states the scope in force.
export function namespaceTriggerLabel(namespace: string | null): string {
    if (namespace === null) {
        return ALL_NAMESPACES_LABEL;
    }
    return namespace;
}
