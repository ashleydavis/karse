import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBug, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { GITHUB_NEW_ISSUE_URL } from "../lib/repository";

// A sidebar nav entry that navigates to a page inside the app.
export interface RouteNavItem {
    to: string;
    icon: IconDefinition;
    label: string;
}

// A sidebar nav entry that leaves the app for an external site, opened in a new tab.
export interface ExternalNavItem {
    href: string;
    icon: IconDefinition;
    label: string;
}

// Either kind of sidebar nav entry. The sidebar renders both the same way; only
// the link element and the active highlight differ.
export type NavItem = RouteNavItem | ExternalNavItem;

// Nav items pinned to the bottom of the sidebar, below the main resource nav.
// They render in array order, so "Report a bug" sits directly above "About".
export const BOTTOM_NAV_ITEMS: NavItem[] = [
    { href: GITHUB_NEW_ISSUE_URL, icon: faBug, label: "Report a bug" },
    { to: "/about", icon: faCircleInfo, label: "About" },
];

// Distinguishes an outbound entry from an in-app route entry.
export function isExternalNavItem(item: NavItem): item is ExternalNavItem {
    return "href" in item;
}

// Whether a nav entry carries the selected/active highlight for the current
// location. An outbound entry never does: it is not a route, so no location can
// ever be "on" it. `fromAllResources` marks a detail page reached from the All
// resources list, where All resources stays highlighted instead of the resource's
// own list page.
export function isNavItemActive(item: NavItem, pathname: string, fromAllResources: boolean): boolean {
    if (isExternalNavItem(item)) {
        return false;
    }
    if (fromAllResources) {
        return item.to === "/all-resources";
    }
    return pathname === item.to || pathname.startsWith(item.to + "/");
}
