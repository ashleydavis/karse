import { contextPickerGroups } from "../../lib/context-picker-rows";
import { compileEnvironments } from "../../lib/cluster-environments";
import type { Context } from "karse-types";

// contextPickerGroups is the pure core of the header's merged context picker: it decides
// exactly which contexts the dropdown lists for a given search box query, and which
// environment subheading each one sits under. Testing it covers what the picker shows.

// A kubeconfig spread across two named environments plus one context matching neither, so
// the Unassigned bucket is exercised alongside the labelled ones.
function contextsFixture(): Context[] {
    return [
        {
            name: "prod-eu-1",
            cluster: "eks-prod-eu",
            user: "prod-eu-user",
            namespace: null,
        },
        {
            name: "prod-us-1",
            cluster: "eks-prod-us",
            user: "prod-us-user",
            namespace: "payments",
        },
        {
            name: "staging-eu-1",
            cluster: "eks-staging-eu",
            user: "staging-eu-user",
            namespace: null,
        },
        {
            name: "kwok-karse-test",
            cluster: "kwok-karse-test",
            user: "kwok-karse-test",
            namespace: null,
        },
    ];
}

// Two environments matched by name pattern, in the user's own list order.
function environments() {
    return compileEnvironments([
        {
            id: "production",
            name: "Production",
            color: "error",
            pattern: "^prod-",
        },
        {
            id: "staging",
            name: "Staging",
            color: "warning",
            pattern: "^staging-",
        },
    ]);
}

// Flattens the groups to `[heading, ...contextNames]` pairs so a test asserts headings and
// rows together, in render order.
function rendered(groups: ReturnType<typeof contextPickerGroups>): [string, string[]][] {
    return groups.map((group) => [group.environment.name, group.items.map((ctx) => ctx.name)]);
}

describe("contextPickerGroups", () => {
    test("an empty query lists every context, grouped by environment with Unassigned last", () => {
        const groups = contextPickerGroups(contextsFixture(), "", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Production", ["prod-eu-1", "prod-us-1"]],
            ["Staging", ["staging-eu-1"]],
            ["Unassigned", ["kwok-karse-test"]],
        ]);
    });

    test("filters by context name", () => {
        const groups = contextPickerGroups(contextsFixture(), "staging-eu", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Staging", ["staging-eu-1"]],
        ]);
    });

    test("filters by cluster name, matching a context whose own name does not", () => {
        const groups = contextPickerGroups(contextsFixture(), "eks-prod-us", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Production", ["prod-us-1"]],
        ]);
    });

    test("matches case-insensitively", () => {
        const groups = contextPickerGroups(contextsFixture(), "PROD-EU", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Production", ["prod-eu-1"]],
        ]);
    });

    test("omits an environment whose every context the query hides", () => {
        const groups = contextPickerGroups(contextsFixture(), "prod", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Production", ["prod-eu-1", "prod-us-1"]],
        ]);
    });

    test("a query nothing matches produces no groups at all", () => {
        const groups = contextPickerGroups(contextsFixture(), "no-such-context", environments(), {});
        expect(groups).toEqual([]);
    });

    test("sorts the rows within a group by name", () => {
        const reversed = contextsFixture().reverse();
        const groups = contextPickerGroups(reversed, "prod", environments(), {});
        expect(rendered(groups)).toEqual([
            ["Production", ["prod-eu-1", "prod-us-1"]],
        ]);
    });

    test("an explicit label overrides the pattern match for that context", () => {
        const groups = contextPickerGroups(contextsFixture(), "kwok", environments(), { "kwok-karse-test": "staging" });
        expect(rendered(groups)).toEqual([
            ["Staging", ["kwok-karse-test"]],
        ]);
    });

    test("leaves the caller's context list untouched", () => {
        const contexts = contextsFixture();
        contextPickerGroups(contexts, "", environments(), {});
        expect(contexts.map((ctx) => ctx.name)).toEqual([
            "prod-eu-1",
            "prod-us-1",
            "staging-eu-1",
            "kwok-karse-test",
        ]);
    });
});
