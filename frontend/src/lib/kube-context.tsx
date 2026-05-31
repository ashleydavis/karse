import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { Context } from "karse-types";
import { fetchContexts, switchContext, setGlobalNamespace } from "./api-client";

// Shared kubeconfig-backed app state: the list of contexts, the active (URL-backed
// or terminal) selection, and the two allowed kubeconfig mutations (set terminal
// default context, set a context's default namespace). Both mutations write the
// kubeconfig and invalidate the contexts query that this provider owns.
type KubeContextValue = {
    contexts: Context[];
    current: string | null;
    terminalDefault: string | null;
    isLoading: boolean;
    error: Error | null;
    switchTo: (name: string) => void;
    setTerminalDefaultContext: UseMutationResult<any, Error, string>;
    setDefaultNamespace: UseMutationResult<any, Error, { context: string; namespace: string | null }>;
};

// React context holding the shared kubeconfig-backed app state.
const Ctx = createContext<KubeContextValue | null>(null);

// Query-param key used to make the selected context shareable via the URL.
const CONTEXT_PARAM = "context";

// Provides the list of kubeconfig contexts, the active selection, and the
// kubeconfig mutations to the component tree. The selection is backed by the
// "context" URL query param so it survives reloads and can be shared via a link.
// When the param is absent it falls back to the terminal's current context.
export function KubeContextProvider({ children }: { children: ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = useQuery({ queryKey: ["contexts"], queryFn: fetchContexts });
    const qc = useQueryClient();
    const data = query.data;

    // URL param wins; otherwise fall through to the terminal's current context.
    const urlContext = searchParams.get(CONTEXT_PARAM);
    const current = urlContext !== null ? urlContext : (data?.current ?? null);

    // Selects a context for this tab by writing it to the "context" URL query param.
    function switchTo(name: string): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(CONTEXT_PARAM, name);
            return next;
        });
    }

    // Switches the terminal's default context in the kubeconfig (kubectl config use-context).
    const setTerminalDefaultContext = useMutation({
        mutationFn: (name: string) => switchContext(name),
        onSuccess: () =>
        {
            void qc.invalidateQueries({ queryKey: ["contexts"] });
        },
    });

    // Sets a context's default namespace in the kubeconfig.
    const setDefaultNamespace = useMutation({
        mutationFn: ({ context, namespace }: { context: string; namespace: string | null }) => setGlobalNamespace(context, namespace),
        onSuccess: () =>
        {
            void qc.invalidateQueries({ queryKey: ["contexts"] });
        },
    });

    const value: KubeContextValue = {
        contexts: data?.contexts ?? [],
        current,
        terminalDefault: data?.current ?? null,
        isLoading: query.isLoading,
        error: (query.error as Error | null) ?? null,
        switchTo,
        setTerminalDefaultContext,
        setDefaultNamespace,
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Returns the shared kubeconfig-backed app state and mutations.
// Must be called inside KubeContextProvider.
export function useKubeContext(): KubeContextValue {
    const value = useContext(Ctx);
    if (value === null)
    {
        throw new Error("useKubeContext must be used inside <KubeContextProvider>");
    }
    return value;
}
