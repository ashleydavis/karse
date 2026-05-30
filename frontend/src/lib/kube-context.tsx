import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Context } from "karse-types";
import { fetchContexts, switchContext } from "./api-client";

type KubeContextValue = {
    contexts: Context[];
    current: string | null;
    isLoading: boolean;
    error: Error | null;
    switchTo: (name: string) => Promise<void>;
};

const Ctx = createContext<KubeContextValue | null>(null);

export function KubeContextProvider({ children }: { children: ReactNode }) {
    const qc = useQueryClient();
    const query = useQuery({ queryKey: ["contexts"], queryFn: fetchContexts });
    const data = query.data;

    async function switchTo(name: string): Promise<void> {
        await switchContext(name);
        await qc.invalidateQueries({ queryKey: ["contexts"] });
        await qc.invalidateQueries({ queryKey: ["cluster"] });
    }

    const value: KubeContextValue = {
        contexts: data?.contexts ?? [],
        current: data?.current ?? null,
        isLoading: query.isLoading,
        error: (query.error as Error | null) ?? null,
        switchTo,
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKubeContext(): KubeContextValue {
    const value = useContext(Ctx);
    if (value === null) {
        throw new Error("useKubeContext must be used inside <KubeContextProvider>");
    }
    return value;
}
