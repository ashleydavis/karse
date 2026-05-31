import { createContext, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

// Namespace selection context value.
type KubeNamespaceValue = {
    namespace: string | null;
    setNamespace: (name: string | null) => void;
};

// React context holding the selected namespace.
const Ctx = createContext<KubeNamespaceValue | null>(null);

// Query-param key used to make the selected namespace shareable via the URL.
const NAMESPACE_PARAM = "namespace";

// Provides the selected namespace, backed by the "namespace" URL query param so
// the selection survives reloads and can be shared via a link. An absent param
// means "all namespaces" (null).
export function KubeNamespaceProvider({ children }: { children: ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const namespace = searchParams.get(NAMESPACE_PARAM);

    function setNamespace(name: string | null): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (name === null) {
                next.delete(NAMESPACE_PARAM);
            }
            else {
                next.set(NAMESPACE_PARAM, name);
            }
            return next;
        });
    }

    return (
        <Ctx.Provider value={{ namespace, setNamespace }}>
            {children}
        </Ctx.Provider>
    );
}

// Returns the selected namespace and a setter. Must be called inside KubeNamespaceProvider.
export function useKubeNamespace(): KubeNamespaceValue {
    const value = useContext(Ctx);
    if (value === null) {
        throw new Error("useKubeNamespace must be used inside <KubeNamespaceProvider>");
    }
    return value;
}
