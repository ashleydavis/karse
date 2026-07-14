import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams, type To } from "react-router-dom";

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

// Splits a navigation target that may carry its own query string (e.g. an origin's
// "/nodes/node-cp?tab=pods") into its pathname and the params it pins. Those params
// are then overlaid on the shareable ones, so a caller can navigate to a whole target
// string and still have the context/namespace carried across. A target with no query
// string yields no params and behaves exactly as a bare pathname.
function splitTarget(target: string): { pathname: string; params: Record<string, string> } {
    const [pathname, search] = target.split("?");
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(search ?? "")) {
        params[key] = value;
    }
    return {
        pathname,
        params,
    };
}

// Returns a navigate function that preserves the shareable context/namespace/tab
// query params, so clicking through the app keeps the URL shareable. The target may
// carry its own query string, whose params are pinned on top of the shareable ones.
// The optional extraParams overlay further params on the target URL (e.g. tagging the
// origin page with "from" so the destination's breadcrumb reflects where it came from).
export function useShareableNavigate(): (target: string, extraParams?: Record<string, string>) => void {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    return useCallback(
        (target: string, extraParams?: Record<string, string>) => {
            const { pathname, params } = splitTarget(target);
            navigate({
                pathname,
                search: shareableSearch(searchParams, {
                    ...params,
                    ...extraParams,
                }),
            });
        },
        [navigate, searchParams],
    );
}

// Returns a builder that turns a target into a react-router To value carrying the
// shareable context/namespace/tab query params, for use with <Link to=...>. As with
// useShareableNavigate, the target may carry its own query string and the optional
// extraParams overlay further params on the target URL.
export function useShareableTo(): (target: string, extraParams?: Record<string, string>) => To {
    const [searchParams] = useSearchParams();
    return useCallback(
        (target: string, extraParams?: Record<string, string>) => {
            const { pathname, params } = splitTarget(target);
            return {
                pathname,
                search: shareableSearch(searchParams, {
                    ...params,
                    ...extraParams,
                }),
            };
        },
        [searchParams],
    );
}

// Returns the "from" tag for the page currently being viewed: its pathname plus the
// sub tab it has open, e.g. "/nodes/node-cp?tab=pods". Every link to another resource
// tags its destination with this, so the destination's breadcrumb can show the path
// the user actually took and link back to the exact view they left (see
// `pathOriginCrumbs`). Only the tab is carried: context and namespace are shareable
// params the destination keeps anyway, and "from" itself is never chained on.
export function useOriginTag(): string {
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const tab = searchParams.get("tab");
    return tab === null ? pathname : `${pathname}?tab=${tab}`;
}
