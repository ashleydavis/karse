import { useCallback } from "react";
import { useNavigate, useSearchParams, type To } from "react-router-dom";

// Query-param keys that carry shareable UI state and must survive navigation
// between pages so a copied link reproduces the same view.
const SHAREABLE_PARAMS = ["context", "namespace"];

// Builds a query string containing only the shareable params present in the
// given search params, preserving the selected context and namespace.
function shareableSearch(searchParams: URLSearchParams): string {
    const next = new URLSearchParams();
    for (const key of SHAREABLE_PARAMS) {
        const value = searchParams.get(key);
        if (value !== null) {
            next.set(key, value);
        }
    }
    const query = next.toString();
    return query === "" ? "" : `?${query}`;
}

// Returns a navigate function that preserves the shareable context/namespace
// query params, so clicking through the app keeps the URL shareable.
export function useShareableNavigate(): (pathname: string) => void {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    return useCallback(
        (pathname: string) => {
            navigate({ pathname, search: shareableSearch(searchParams) });
        },
        [navigate, searchParams],
    );
}

// Returns a builder that turns a pathname into a react-router To value carrying
// the shareable context/namespace query params, for use with <Link to=...>.
export function useShareableTo(): (pathname: string) => To {
    const [searchParams] = useSearchParams();
    return useCallback(
        (pathname: string) => ({ pathname, search: shareableSearch(searchParams) }),
        [searchParams],
    );
}
