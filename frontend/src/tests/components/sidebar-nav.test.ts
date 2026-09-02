import { BOTTOM_NAV_ITEMS, isExternalNavItem, isNavItemActive } from "../../components/sidebar-nav";
import { GITHUB_NEW_ISSUE_URL } from "../../lib/repository";

// BOTTOM_NAV_ITEMS is the pinned bottom section of the sidebar, rendered in array
// order, so the array is what decides which entries appear and where.
describe("BOTTOM_NAV_ITEMS", () => {
    test("holds Report a bug then About, in that order", () => {
        expect(BOTTOM_NAV_ITEMS.map((item) => item.label)).toEqual([
            "Report a bug",
            "About",
        ]);
    });

    test("points Report a bug at the repository's new-issue page", () => {
        const [reportABug] = BOTTOM_NAV_ITEMS;
        expect(isExternalNavItem(reportABug)).toBe(true);
        expect(reportABug).toMatchObject({
            href: "https://github.com/ashleydavis/karse/issues/new",
            label: "Report a bug",
        });
    });

    test("takes the new-issue URL from the shared repository constant", () => {
        const [reportABug] = BOTTOM_NAV_ITEMS;
        if (!isExternalNavItem(reportABug)) {
            throw new Error("expected Report a bug to be an outbound entry");
        }
        expect(reportABug.href).toBe(GITHUB_NEW_ISSUE_URL);
    });

    test("keeps About as an in-app route entry", () => {
        const about = BOTTOM_NAV_ITEMS[1];
        expect(isExternalNavItem(about)).toBe(false);
        expect(about).toMatchObject({
            to: "/about",
            label: "About",
        });
    });

    test("gives every entry an icon", () => {
        for (const item of BOTTOM_NAV_ITEMS) {
            expect(item.icon).toBeDefined();
        }
    });
});

// isNavItemActive decides the selected/active highlight for a nav entry. The
// bug-report entry sits directly above About, so an over-broad path match would
// light it up on /about.
describe("isNavItemActive", () => {
    const [reportABug, about] = BOTTOM_NAV_ITEMS;

    test("never highlights the outbound bug-report entry, on any route", () => {
        const routes = [
            "/",
            "/about",
            "/about/anything",
            "/cluster",
            "/all-resources",
            "/pods/default/nginx",
            "https://github.com/ashleydavis/karse/issues/new",
        ];
        for (const pathname of routes) {
            expect(isNavItemActive(reportABug, pathname, false)).toBe(false);
            expect(isNavItemActive(reportABug, pathname, true)).toBe(false);
        }
    });

    test("highlights About on /about", () => {
        expect(isNavItemActive(about, "/about", false)).toBe(true);
    });

    test("does not highlight About on another route", () => {
        expect(isNavItemActive(about, "/cluster", false)).toBe(false);
    });

    test("highlights All resources instead when a detail page was reached from it", () => {
        const allResources = { to: "/all-resources", icon: about.icon, label: "All resources" };
        expect(isNavItemActive(allResources, "/pods/default/nginx", true)).toBe(true);
        expect(isNavItemActive(about, "/about", true)).toBe(false);
    });

    test("highlights a list entry for its own detail pages", () => {
        const pods = { to: "/pods", icon: about.icon, label: "Pods" };
        expect(isNavItemActive(pods, "/pods/default/nginx", false)).toBe(true);
    });
});
