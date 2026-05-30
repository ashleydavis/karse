import { createContext, useContext, useState, type ReactNode } from "react";

// Per-tab namespace selection context value.
type KubeNamespaceValue = {
    namespace: string | null;
    setNamespace: (name: string | null) => void;
};

// React context holding the tab-local namespace selection.
const Ctx = createContext<KubeNamespaceValue | null>(null);

// Provides per-tab namespace selection state to the component tree.
// One instance per browser tab; state is lost on page reload.
export function KubeNamespaceProvider({ children }: { children: ReactNode }) {
    const [namespace, setNamespace] = useState<string | null>(null);
    return (
        <Ctx.Provider value={{ namespace, setNamespace }}>
            {children}
        </Ctx.Provider>
    );
}

// Returns the tab-local namespace selection and a setter.
// Must be called inside KubeNamespaceProvider.
export function useKubeNamespace(): KubeNamespaceValue {
    const value = useContext(Ctx);
    if (value === null) {
        throw new Error("useKubeNamespace must be used inside <KubeNamespaceProvider>");
    }
    return value;
}
