import { useCallback } from "react";
import { useNavigate, useSearchParams, type To } from "react-router-dom";

// Query-param keys that carry shareable UI state and must survive navigation
// between pages so a copied link reproduces the same view.
//
// "from" is deliberately not here: it tags only the immediate origin of the page
// it is set on (e.g. a detail page reached from the All resources list) and must
// not stick to every onward navigation. It is set explicitly via extraParams when
// a page wants to record where a link came from, and is dropped the moment the
// user navigates on.
const SHAREABLE_PARAMS = ["context", "namespace", "tab"];

// Builds a query string containing only the shareable params present in the given
// search params (preserving the selected context, namespace, and tab), then
// overlaying any explicit extra params the caller supplies (used to set "from").
function shareableSearch(
    searchParams: URLSearchParams,
    extraParams?: Record<string, string>,
): string {
    const next = new URLSearchParams();
    for (const key of SHAREABLE_PARAMS) {
        const value = searchParams.get(key);
        if (value !== null) {
            next.set(key, value);
        }
    }
    for (const [key, value] of Object.entries(extraParams ?? {})) {
        next.set(key, value);
    }
    const query = next.toString();
    return query === "" ? "" : `?${query}`;
}

// Returns a navigate function that preserves the shareable context/namespace
// query params, so clicking through the app keeps the URL shareable. The optional
// extraParams overlay further params on the target URL (e.g. tagging the origin
// page with "from" so the destination's breadcrumb reflects where it came from).
export function useShareableNavigate(): (pathname: string, extraParams?: Record<string, string>) => void {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    return useCallback(
        (pathname: string, extraParams?: Record<string, string>) => {
            navigate({ pathname, search: shareableSearch(searchParams, extraParams) });
        },
        [navigate, searchParams],
    );
}

// Returns a builder that turns a pathname into a react-router To value carrying
// the shareable context/namespace query params, for use with <Link to=...>. The
// optional extraParams overlay further params on the target URL.
export function useShareableTo(): (pathname: string, extraParams?: Record<string, string>) => To {
    const [searchParams] = useSearchParams();
    return useCallback(
        (pathname: string, extraParams?: Record<string, string>) => ({ pathname, search: shareableSearch(searchParams, extraParams) }),
        [searchParams],
    );
}
