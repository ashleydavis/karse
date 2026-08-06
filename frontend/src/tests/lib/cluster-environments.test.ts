import {
    inferEnvironment,
    resolveEnvironment,
    contextLabel,
    environmentFromSelection,
    groupByEnvironment,
    AUTO_ENVIRONMENT_VALUE,
    ENVIRONMENT_ORDER,
    ENVIRONMENT_LABELS,
    LABELLABLE_ENVIRONMENTS,
    type EnvironmentLabels,
} from "../../lib/cluster-environments";

// No explicit labels: the resolver falls through to name inference.
const NO_LABELS: EnvironmentLabels = {};

describe("inferEnvironment", () => {
    test("matches a production token as a name segment", () => {
        expect(inferEnvironment("prod-eu-1")).toBe("production");
    });

    test("matches production when the token is the trailing segment", () => {
        expect(inferEnvironment("acme-cluster-prod")).toBe("production");
    });

    test("matches the long form production", () => {
        expect(inferEnvironment("production-eu")).toBe("production");
    });

    test("matches the prd abbreviation", () => {
        expect(inferEnvironment("prd-01")).toBe("production");
    });

    test("devops-prod is production, not development", () => {
        expect(inferEnvironment("devops-prod")).toBe("production");
    });

    test("matches staging", () => {
        expect(inferEnvironment("staging-eu-west")).toBe("staging");
    });

    test("matches the stg abbreviation", () => {
        expect(inferEnvironment("acme-stg-1")).toBe("staging");
    });

    test("matches stage", () => {
        expect(inferEnvironment("stage.acme.internal")).toBe("staging");
    });

    test("matches development", () => {
        expect(inferEnvironment("my-dev-box")).toBe("development");
    });

    test("matches the long form development", () => {
        expect(inferEnvironment("development-cluster")).toBe("development");
    });

    test("matches test", () => {
        expect(inferEnvironment("kwok-karse-test-1")).toBe("test");
    });

    test("matches qa", () => {
        expect(inferEnvironment("qa-cluster")).toBe("test");
    });

    test("matches local", () => {
        expect(inferEnvironment("local-cluster")).toBe("local");
    });

    test("matches minikube", () => {
        expect(inferEnvironment("minikube")).toBe("local");
    });

    test("matches kind as a whole segment", () => {
        expect(inferEnvironment("kind-karse")).toBe("local");
    });

    test("is case-insensitive", () => {
        expect(inferEnvironment("ACME-PROD-1")).toBe("production");
    });

    test("splits at a letter/digit boundary so staging2 still matches", () => {
        expect(inferEnvironment("staging2")).toBe("staging");
    });

    test("splits on an underscore", () => {
        expect(inferEnvironment("acme_dev_1")).toBe("development");
    });

    test("splits on a slash", () => {
        expect(inferEnvironment("acme/staging")).toBe("staging");
    });

    test("a token buried in a longer word does not match", () => {
        expect(inferEnvironment("predevelopmentplan")).toBe("unassigned");
    });

    test("devops alone is not development", () => {
        expect(inferEnvironment("devops-cluster")).toBe("unassigned");
    });

    test("a name carrying two tokens resolves to the riskier one", () => {
        expect(inferEnvironment("prod-test-eu")).toBe("production");
    });

    test("staging beats development when a name carries both", () => {
        expect(inferEnvironment("dev-staging-mirror")).toBe("staging");
    });

    test("a name with no recognisable token is unassigned", () => {
        expect(inferEnvironment("arn:aws:eks:eu-west-1:1234:cluster/apollo")).toBe("unassigned");
    });

    test("the e2e kwok context names carry no token", () => {
        expect(inferEnvironment("kwok-karse-e2e-4821-1")).toBe("unassigned");
    });

    test("an empty name is unassigned", () => {
        expect(inferEnvironment("")).toBe("unassigned");
    });
});

describe("resolveEnvironment", () => {
    test("falls back to the inferred environment when nothing is labelled", () => {
        expect(resolveEnvironment("prod-eu-1", NO_LABELS)).toEqual({
            environment: "production",
            source: "inferred",
        });
    });

    test("an unrecognised name resolves to unassigned by inference", () => {
        expect(resolveEnvironment("apollo", NO_LABELS)).toEqual({
            environment: "unassigned",
            source: "inferred",
        });
    });

    test("an explicit label overrides the inferred environment", () => {
        expect(resolveEnvironment("devops-prod", { "devops-prod": "development" })).toEqual({
            environment: "development",
            source: "label",
        });
    });

    test("an explicit label gives an environment to a name that infers nothing", () => {
        expect(resolveEnvironment("apollo", { apollo: "production" })).toEqual({
            environment: "production",
            source: "label",
        });
    });

    test("a label matching the inferred environment still reports itself as a label", () => {
        expect(resolveEnvironment("prod-eu-1", { "prod-eu-1": "production" })).toEqual({
            environment: "production",
            source: "label",
        });
    });

    test("clearing a label restores the inferred environment, not unassigned", () => {
        const labelled: EnvironmentLabels = { "prod-eu-1": "development" };
        expect(resolveEnvironment("prod-eu-1", labelled).environment).toBe("development");
        const cleared: EnvironmentLabels = {};
        expect(resolveEnvironment("prod-eu-1", cleared)).toEqual({
            environment: "production",
            source: "inferred",
        });
    });

    test("a label naming a different context does not leak onto this one", () => {
        expect(resolveEnvironment("apollo", { artemis: "production" })).toEqual({
            environment: "unassigned",
            source: "inferred",
        });
    });

    test("a stored label that is not a known environment is ignored", () => {
        const labels = { apollo: "sandbox" } as any;
        expect(resolveEnvironment("apollo", labels)).toEqual({
            environment: "unassigned",
            source: "inferred",
        });
    });
});

describe("contextLabel", () => {
    test("returns the explicit label when one is set", () => {
        expect(contextLabel("apollo", { apollo: "staging" })).toBe("staging");
    });

    test("returns null when no label is set", () => {
        expect(contextLabel("apollo", NO_LABELS)).toBeNull();
    });

    test("returns null for a stored value that is not a known environment", () => {
        expect(contextLabel("apollo", { apollo: "sandbox" } as any)).toBeNull();
    });
});

describe("environmentFromSelection", () => {
    test("the auto value clears the label", () => {
        expect(environmentFromSelection(AUTO_ENVIRONMENT_VALUE)).toBeNull();
    });

    test("an environment value sets that label", () => {
        expect(environmentFromSelection("production")).toBe("production");
    });

    test("every labellable environment round-trips", () => {
        for (const environment of LABELLABLE_ENVIRONMENTS) {
            expect(environmentFromSelection(environment)).toBe(environment);
        }
    });

    test("an unrecognised value clears the label rather than setting a bogus one", () => {
        expect(environmentFromSelection("sandbox")).toBeNull();
    });

    test("the auto value is not itself a known environment", () => {
        expect(ENVIRONMENT_ORDER).not.toContain(AUTO_ENVIRONMENT_VALUE);
    });

    test("the auto value is not the empty string, which MUI reserves", () => {
        expect(AUTO_ENVIRONMENT_VALUE).not.toBe("");
    });
});

describe("groupByEnvironment", () => {
    const CONTEXTS = [
        { name: "apollo" },
        { name: "my-dev-box" },
        { name: "prod-eu-1" },
        { name: "qa-cluster" },
        { name: "staging-eu-west" },
        { name: "minikube" },
        { name: "devops-prod" },
    ];

    test("groups in the stable order with production first and unassigned last", () => {
        const groups = groupByEnvironment(CONTEXTS, NO_LABELS);
        expect(groups.map((group) => group.environment)).toEqual([
            "production",
            "staging",
            "development",
            "test",
            "local",
            "unassigned",
        ]);
    });

    test("puts each context in its inferred group", () => {
        const groups = groupByEnvironment(CONTEXTS, NO_LABELS);
        const byEnvironment = Object.fromEntries(groups.map((group) => [group.environment, group.items.map((item) => item.name)]));
        expect(byEnvironment.production).toEqual(["prod-eu-1", "devops-prod"]);
        expect(byEnvironment.staging).toEqual(["staging-eu-west"]);
        expect(byEnvironment.development).toEqual(["my-dev-box"]);
        expect(byEnvironment.test).toEqual(["qa-cluster"]);
        expect(byEnvironment.local).toEqual(["minikube"]);
        expect(byEnvironment.unassigned).toEqual(["apollo"]);
    });

    test("carries the display heading for each group", () => {
        const groups = groupByEnvironment([{ name: "prod-eu-1" }], NO_LABELS);
        expect(groups).toEqual([
            {
                environment: "production",
                label: "Production",
                items: [{ name: "prod-eu-1" }],
            },
        ]);
    });

    test("drops environments no context resolved to", () => {
        const groups = groupByEnvironment([{ name: "prod-eu-1" }, { name: "prod-us-1" }], NO_LABELS);
        expect(groups.map((group) => group.environment)).toEqual(["production"]);
    });

    test("an explicit label moves a context into that group", () => {
        const groups = groupByEnvironment(CONTEXTS, { "devops-prod": "development" });
        const byEnvironment = Object.fromEntries(groups.map((group) => [group.environment, group.items.map((item) => item.name)]));
        expect(byEnvironment.production).toEqual(["prod-eu-1"]);
        expect(byEnvironment.development).toEqual(["my-dev-box", "devops-prod"]);
    });

    test("a label for a context that is no longer in the kubeconfig produces no phantom row", () => {
        const labels: EnvironmentLabels = {
            "prod-eu-1": "staging",
            "retired-cluster": "production",
        };
        const groups = groupByEnvironment([{ name: "prod-eu-1" }], labels);
        expect(groups).toEqual([
            {
                environment: "staging",
                label: "Staging",
                items: [{ name: "prod-eu-1" }],
            },
        ]);
    });

    test("a label for a context that comes back applies again", () => {
        const labels: EnvironmentLabels = { "retired-cluster": "production" };
        const whileMissing = groupByEnvironment([{ name: "apollo" }], labels);
        expect(whileMissing.map((group) => group.environment)).toEqual(["unassigned"]);
        const whenBack = groupByEnvironment([{ name: "apollo" }, { name: "retired-cluster" }], labels);
        expect(whenBack.map((group) => group.environment)).toEqual(["production", "unassigned"]);
        expect(whenBack[0].items).toEqual([{ name: "retired-cluster" }]);
    });

    test("a kubeconfig where nothing matches puts every context under unassigned", () => {
        const groups = groupByEnvironment([{ name: "apollo" }, { name: "artemis" }, { name: "hermes" }], NO_LABELS);
        expect(groups).toEqual([
            {
                environment: "unassigned",
                label: "Unassigned",
                items: [{ name: "apollo" }, { name: "artemis" }, { name: "hermes" }],
            },
        ]);
    });

    test("no contexts produces no groups", () => {
        expect(groupByEnvironment([], NO_LABELS)).toEqual([]);
    });

    test("the order contexts were given in is preserved within a group", () => {
        const contexts = [{ name: "prod-c" }, { name: "prod-a" }, { name: "prod-b" }];
        expect(groupByEnvironment(contexts, NO_LABELS)[0].items).toEqual(contexts);
    });
});

describe("environment metadata", () => {
    test("every environment in the order has a display label", () => {
        for (const environment of ENVIRONMENT_ORDER) {
            expect(typeof ENVIRONMENT_LABELS[environment]).toBe("string");
            expect(ENVIRONMENT_LABELS[environment].length).toBeGreaterThan(0);
        }
    });

    test("unassigned is last so an ungrouped context never leads the list", () => {
        expect(ENVIRONMENT_ORDER[ENVIRONMENT_ORDER.length - 1]).toBe("unassigned");
    });

    test("production is first so the riskiest cluster is never buried", () => {
        expect(ENVIRONMENT_ORDER[0]).toBe("production");
    });

    test("every environment except unassigned can be picked as a label", () => {
        expect(LABELLABLE_ENVIRONMENTS).toEqual(ENVIRONMENT_ORDER.filter((environment) => environment !== "unassigned"));
    });
});
