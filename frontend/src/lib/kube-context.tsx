import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Context } from "karse-types";
import { fetchContexts, switchContext, setGlobalNamespace } from "./api-client";

// Shared kubeconfig-backed app state: the list of contexts, the active (tab-local
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

// Provides the list of kubeconfig contexts, the active selection, and the
// kubeconfig mutations to the component tree.
export function KubeContextProvider({ children }: { children: ReactNode }) {
    // undefined = user hasn't picked yet (fall through to global current); string = tab-local pick
    const [userSelection, setUserSelection] = useState<string | undefined>(undefined);
    const query = useQuery({ queryKey: ["contexts"], queryFn: fetchContexts });
    const qc = useQueryClient();
    const data = query.data;

    const current = userSelection !== undefined ? userSelection : (data?.current ?? null);

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
        switchTo: setUserSelection,
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
