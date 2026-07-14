import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Link as MuiLink } from "@mui/material";
import { resourcePath } from "../lib/resource-link";
import { useOriginTag, useShareableTo } from "../lib/nav-state";

// Renders an inline reference to a Kubernetes resource as a link to that
// resource's detail page, using the shared route resolver so every reference
// across the app navigates the same way. When the reference cannot be resolved
// (empty name, an unsupported kind, or a namespaced kind with no namespace) it
// degrades gracefully to plain text instead of a broken link.
//
// The visible text defaults to the resource name, but callers can pass `label`
// to show a richer form (e.g. "Pod/nginx-abc") while still linking to the same
// place. The shareable context/namespace query params are preserved so the
// destination URL stays shareable, matching the detail-route pattern.
//
// Every link is tagged with the page it was followed from ("from"), so the
// destination's breadcrumb shows the path the user actually took to get there
// rather than the destination's own fixed list-page trail, and its origin crumb
// links back to the exact view (tab included) the reference was clicked on.
export function ResourceRef({
    kind,
    name,
    namespace = "",
    label,
    testId,
}: {
    kind: string;
    name: string;
    namespace?: string;
    label?: ReactNode;
    testId?: string;
}) {
    const shareableTo = useShareableTo();
    const from = useOriginTag();
    const path = resourcePath(kind, name, namespace);
    const text: ReactNode = label ?? name;

    if (path === null)
    {
        return <span data-test-id={testId}>{text}</span>;
    }

    return (
        <MuiLink
            component={Link}
            to={shareableTo(path, { from })}
            underline="hover"
            data-test-id={testId}
            sx={{ fontFamily: "inherit" }}
        >
            {text}
        </MuiLink>
    );
}
