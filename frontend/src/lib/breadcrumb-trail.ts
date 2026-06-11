// Pure helpers that shape the nav-bar breadcrumb trail so it never wraps onto a
// second line or grows the nav-bar height: middle-truncation of long resource
// names and collapsing of over-long trails. Kept UI-free so it is unit-testable.

// One entry in the breadcrumb trail; a missing "to" marks the current (non-linked) page.
export type Crumb = {
    label: string;
    to?: string;
};

// Maximum number of crumbs shown in the trail before inner crumbs are collapsed
// into a single "..." crumb. The deepest current trail (pod detail) is four
// crumbs, so four keeps every existing trail intact while capping anything deeper.
export const MAX_TRAIL_ITEMS = 4;

// Maximum number of characters shown for a single resource-name crumb before it
// is middle-truncated. Long Kubernetes names would otherwise widen the nav bar.
export const MAX_NAME_LENGTH = 24;

// The placeholder used for the collapsed inner crumbs and the middle of a
// truncated name.
export const ELLIPSIS = "...";

// Middle-truncates a label that exceeds the limit, keeping the start and end
// visible and replacing the middle with "...". Shorter labels are returned
// unchanged. The result is never longer than the limit.
export function middleTruncate(label: string, limit: number): string {
    if (label.length <= limit)
    {
        return label;
    }
    const keep = limit - ELLIPSIS.length;
    const head = Math.ceil(keep / 2);
    const tail = Math.floor(keep / 2);
    return label.slice(0, head) + ELLIPSIS + label.slice(label.length - tail);
}

// Collapses a trail longer than maxItems by keeping the first crumb and the
// last (maxItems - 2) crumbs, inserting a single non-linked "..." crumb between
// them. The first (root) and last (current) crumbs always stay visible. Trails
// at or under the cap are returned unchanged.
export function collapseCrumbs(crumbs: Crumb[], maxItems: number): Crumb[] {
    if (crumbs.length <= maxItems)
    {
        return crumbs;
    }
    const tailCount = maxItems - 2;
    const tail = crumbs.slice(crumbs.length - tailCount);
    return [
        crumbs[0],
        { label: ELLIPSIS },
        ...tail,
    ];
}

// The "from" value the All resources page tags its row links with, so a detail
// page reached from that page can show it as the breadcrumb origin.
export const FROM_ALL_RESOURCES = "all-resources";

// The breadcrumb trail for a resource detail page reached from another page,
// showing the originating page followed by the specific resource, e.g.
// "All resources > nginx-abc". The origin crumb links back to the page the user
// came from; the resource is the current (non-linked) leaf, showing only the
// resource name (no kind prefix), middle-truncated to keep the trail on one line.
//
// `kind` is still required (non-null) so the origin trail is only built for the
// recognised detail routes the All resources page links to; it is no longer shown
// in the leaf label.
//
// Returns null when no origin trail applies, so the caller falls back to the
// normal pathname-derived trail. That happens when `from` is not a recognised
// origin, or the kind/name needed for the leaf is missing (so we never render a
// half-formed "All resources > " trail).
export function originCrumbs(
    from: string | null,
    kind: string | null,
    name: string | null,
): Crumb[] | null {
    if (from !== FROM_ALL_RESOURCES || kind === null || name === "" || name === null)
    {
        return null;
    }
    return [
        { label: "All resources", to: "/all-resources" },
        { label: middleTruncate(name, MAX_NAME_LENGTH) },
    ];
}
