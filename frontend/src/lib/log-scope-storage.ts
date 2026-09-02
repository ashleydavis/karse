// The Logs page's scope: the namespace it is pointed at, the pod names ticked in the
// picker, and the picker's search text. This is what survives navigating away and a full
// reload. The stream itself and the streamed log lines are deliberately not part of it:
// re-opening a follow per pod on a bare page load would start cluster reads nobody asked
// for, and the lines are not stored, so there would be nothing to restore them into.
export type LogScope = {
    namespace: string;
    pods: string[];
    search: string;
};

// localStorage key holding the Logs page's scope. Named once here so the page, the
// helpers and the tests cannot drift apart on it.
export const LOG_SCOPE_STORAGE_KEY = "karse-log-scope";

// A fresh copy of the page's original empty state: no namespace chosen, nothing ticked,
// no search text. Returned whenever storage holds nothing usable, and returned as a new
// object each call so a caller holding it cannot alter what the next caller receives.
export function emptyLogScope(): LogScope {
    return {
        namespace: "",
        pods: [],
        search: "",
    };
}

// Whether a scope holds nothing worth restoring. An empty scope is stored as no entry at
// all, so clearing the page leaves storage in the same state as never having used it.
function isEmptyLogScope(scope: LogScope): boolean {
    return scope.namespace === "" && scope.pods.length === 0 && scope.search === "";
}

// Reads the stored scope, falling back to the empty state when the entry is absent,
// unparseable, not an object, or carries a wrong-typed field. Individual pod names that
// are not strings are dropped rather than restored, so one bad name cannot poison the
// rest of the selection. Nothing here throws: a corrupt entry leaves the page empty, the
// same way the other persisted settings behave.
export function loadLogScope(): LogScope {
    try {
        const raw = localStorage.getItem(LOG_SCOPE_STORAGE_KEY);
        if (raw === null) {
            return emptyLogScope();
        }
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return emptyLogScope();
        }
        if (typeof parsed.namespace !== "string" || typeof parsed.search !== "string" || !Array.isArray(parsed.pods)) {
            return emptyLogScope();
        }
        return {
            namespace: parsed.namespace,
            pods: parsed.pods.filter((pod: any) => typeof pod === "string"),
            search: parsed.search,
        };
    }
    catch {
        return emptyLogScope();
    }
}

// Persists the scope, or removes the entry when the scope is empty. Removing rather than
// writing an empty record is what stops the page rewriting a blank entry straight after
// the user clears it, so a reload after clearing really does come back empty.
export function saveLogScope(scope: LogScope): void {
    if (isEmptyLogScope(scope)) {
        localStorage.removeItem(LOG_SCOPE_STORAGE_KEY);
        return;
    }
    localStorage.setItem(LOG_SCOPE_STORAGE_KEY, JSON.stringify(scope));
}

// Removes the stored scope outright, backing the Logs page's "Clear saved scope" control.
// Distinct from resetting the page's in-memory state: both are needed, or the next load
// restores what the user just cleared.
export function clearLogScope(): void {
    localStorage.removeItem(LOG_SCOPE_STORAGE_KEY);
}

// Drops restored pod names the cluster no longer has, keeping the ones it still does.
// Pod names change every time a deployment rolls, so a restored selection routinely names
// pods that are gone; they must not be shown as ticked-but-missing, nor sent to the
// backend as pods to follow.
export function prunePods(stored: string[], available: string[]): string[] {
    return stored.filter((name) => available.includes(name));
}
