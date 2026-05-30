import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Context } from "karse-types";
import { fetchContexts } from "./api-client";

type KubeContextValue = {
    contexts: Context[];
    current: string | null;
    isLoading: boolean;
    error: Error | null;
    switchTo: (name: string) => void;
};

const Ctx = createContext<KubeContextValue | null>(null);

export function KubeContextProvider({ children }: { children: ReactNode }) {
    // undefined = user hasn't picked yet (fall through to global current); string = tab-local pick
    const [userSelection, setUserSelection] = useState<string | undefined>(undefined);
    const query = useQuery({ queryKey: ["contexts"], queryFn: fetchContexts });
    const data = query.data;

    const current = userSelection !== undefined ? userSelection : (data?.current ?? null);

    const value: KubeContextValue = {
        contexts: data?.contexts ?? [],
        current,
        isLoading: query.isLoading,
        error: (query.error as Error | null) ?? null,
        switchTo: setUserSelection,
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
