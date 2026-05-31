import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { Context } from "karse-types";
import { fetchContexts } from "./api-client";

// Value exposed by the kube-context provider.
type KubeContextValue = {
    contexts: Context[];
    current: string | null;
    terminalDefault: string | null;
    isLoading: boolean;
    error: Error | null;
    switchTo: (name: string) => void;
};

// React context holding the selected kubectl context.
const Ctx = createContext<KubeContextValue | null>(null);

// Query-param key used to make the selected context shareable via the URL.
const CONTEXT_PARAM = "context";

// Provides the selected kubectl context, backed by the "context" URL query param
// so the selection survives reloads and can be shared via a link. When the param
// is absent it falls back to the terminal's current context.
export function KubeContextProvider({ children }: { children: ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = useQuery({ queryKey: ["contexts"], queryFn: fetchContexts });
    const data = query.data;

    // URL param wins; otherwise fall through to the terminal's current context.
    const urlContext = searchParams.get(CONTEXT_PARAM);
    const current = urlContext !== null ? urlContext : (data?.current ?? null);

    function switchTo(name: string): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(CONTEXT_PARAM, name);
            return next;
        });
    }

    const value: KubeContextValue = {
        contexts: data?.contexts ?? [],
        current,
        terminalDefault: data?.current ?? null,
        isLoading: query.isLoading,
        error: (query.error as Error | null) ?? null,
        switchTo,
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Returns the selected kubectl context and a setter. Must be called inside KubeContextProvider.
export function useKubeContext(): KubeContextValue {
    const value = useContext(Ctx);
    if (value === null) {
        throw new Error("useKubeContext must be used inside <KubeContextProvider>");
    }
    return value;
}
