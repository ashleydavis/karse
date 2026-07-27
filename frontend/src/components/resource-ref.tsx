import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Link as MuiLink } from "@mui/material";
import { resourceNameSegments, resourcePath } from "../lib/resource-link";
import { useOriginTag, useShareableTo } from "../lib/nav-state";
import { CopyNameButton } from "./copy-button";

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
//
// Every reference is a resource name, so it carries the two-form copy menu beside
// it: a user who reads a namespace, a node, or an involved object anywhere in the
// app can copy either its short name or its full path without going to its page
// first. Putting the menu here rather than at each call site is what makes it
// present on every referenced resource, in every table and on every detail page,
// rather than only where someone remembered to add one. A reference with no name
// renders as its placeholder text with no control, so a user cannot copy a dash.
//
// `copyTestId` names the copy control for e2e tests; it defaults to the
// reference's own test id with "-copy" appended. `copyLabel` gives the control its
// accessible name ("copy the pod's namespace"); it defaults to naming the kind, so
// an unnamed caller still gets "copy namespace default" rather than "copy".
export function ResourceRef({
    kind,
    name,
    namespace = "",
    label,
    testId,
    copyTestId,
    copyLabel,
}: {
    kind: string;
    name: string;
    namespace?: string;
    label?: ReactNode;
    testId?: string;
    copyTestId?: string;
    copyLabel?: string;
}) {
    const shareableTo = useShareableTo();
    const from = useOriginTag();
    const path = resourcePath(kind, name, namespace);
    const text: ReactNode = label ?? name;

    // The reference itself: a link when the kind has a detail page, plain text when
    // it has none. The copy menu sits beside it either way, because a name is worth
    // copying whether or not Karse can navigate to it.
    const reference: ReactNode = path === null
        ? <span data-test-id={testId}>{text}</span>
        : (
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

    if (name === "")
    {
        return reference;
    }

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
            {reference}
            <CopyNameButton
                segments={resourceNameSegments(kind, name, namespace)}
                label={copyLabel ?? `${kind.toLowerCase()} ${name}`}
                testId={copyTestId ?? `${testId ?? "resource-ref"}-copy`}
            />
        </span>
    );
}
