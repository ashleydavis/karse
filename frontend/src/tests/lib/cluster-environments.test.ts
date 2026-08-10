import {
    compileEnvironments,
    contextLabel,
    environmentFromSelection,
    environmentId,
    groupByEnvironment,
    normalizeEnvironments,
    resolveEnvironment,
    validateEnvironmentName,
    validatePattern,
    DEFAULT_ENVIRONMENTS,
    MAX_PATTERN_LENGTH,
    UNASSIGNED_ENVIRONMENT,
    type EnvironmentDefinition,
} from "../../lib/cluster-environments";

// The compiled default list, which is what an untouched install resolves through.
const defaults = compileEnvironments(DEFAULT_ENVIRONMENTS);

// A two-row list whose expressions both match `blue-green-1`, used for the precedence tests.
const blue: EnvironmentDefinition = {
    id: "blue",
    name: "Blue",
    pattern: "blue",
    color: "info",
};
const green: EnvironmentDefinition = {
    id: "green",
    name: "Green",
    pattern: "green",
    color: "success",
};

// The environment a context name resolves to under a given list, as an id.
function environmentOf(name: string, environments: EnvironmentDefinition[], labels = {}): string {
    return resolveEnvironment(name, compileEnvironments(environments), labels).environment.id;
}

describe("resolveEnvironment", () => {
    test("returns the first environment in the list whose expression matches", () => {
        expect(environmentOf("blue-green-1", [blue, green])).toBe("blue");
    });

    test("reordering the list changes which environment wins a name matching two", () => {
        expect(environmentOf("blue-green-1", [green, blue])).toBe("green");
    });

    test("a name matching one expression resolves to that environment whatever the order", () => {
        expect(environmentOf("blue-1", [blue, green])).toBe("blue");
        expect(environmentOf("blue-1", [green, blue])).toBe("blue");
    });

    test("a name matching nothing resolves to Unassigned", () => {
        expect(environmentOf("apollo", [blue, green])).toBe("unassigned");
    });

    test("matching is case-insensitive", () => {
        expect(environmentOf("BLUE-1", [blue])).toBe("blue");
    });

    test("matching runs against the whole context name, not a name segment", () => {
        const substring: EnvironmentDefinition = {
            id: "infra",
            name: "Infra",
            pattern: "fra",
            color: "info",
        };
        expect(environmentOf("infrastructure-eu", [substring])).toBe("infra");
    });

    test("reports where the environment came from", () => {
        const matched = resolveEnvironment("blue-1", compileEnvironments([blue]), {});
        expect(matched.source).toBe("inferred");
        const labelled = resolveEnvironment("apollo", compileEnvironments([blue]), { apollo: "blue" });
        expect(labelled.source).toBe("label");
    });

    test("an empty list puts every context in Unassigned", () => {
        for (const name of ["prod-eu-1", "my-dev-box", "apollo", "minikube"]) {
            expect(environmentOf(name, [])).toBe("unassigned");
        }
    });

    test("the Unassigned bucket keeps its built-in name and colour", () => {
        const resolved = resolveEnvironment("apollo", [], {});
        expect(resolved.environment.name).toBe("Unassigned");
        expect(resolved.environment.color).toBe("default");
    });

    test("an explicit label overrides the expression that would have matched", () => {
        expect(environmentOf("blue-1", [blue, green], { "blue-1": "green" })).toBe("green");
    });

    test("a label naming a deleted environment is ignored and the expression result is used", () => {
        expect(environmentOf("blue-1", [blue], { "blue-1": "green" })).toBe("blue");
    });

    test("a label naming a deleted environment falls through to Unassigned when nothing matches", () => {
        expect(environmentOf("apollo", [blue], { apollo: "green" })).toBe("unassigned");
    });
});

describe("the default list", () => {
    test("reproduces the documented production cases", () => {
        expect(environmentOf("devops-prod", DEFAULT_ENVIRONMENTS)).toBe("production");
        expect(environmentOf("production-eu", DEFAULT_ENVIRONMENTS)).toBe("production");
        expect(environmentOf("prod-eu-1", DEFAULT_ENVIRONMENTS)).toBe("production");
        expect(environmentOf("ACME-PROD-1", DEFAULT_ENVIRONMENTS)).toBe("production");
    });

    test("reproduces the documented development cases", () => {
        expect(environmentOf("my-dev-box", DEFAULT_ENVIRONMENTS)).toBe("development");
        expect(environmentOf("acme-development", DEFAULT_ENVIRONMENTS)).toBe("development");
    });

    test("reproduces the documented unassigned case", () => {
        expect(environmentOf("predevelopmentplan", DEFAULT_ENVIRONMENTS)).toBe("unassigned");
        expect(environmentOf("apollo", DEFAULT_ENVIRONMENTS)).toBe("unassigned");
    });

    test("matches the staging, test and local tokens", () => {
        expect(environmentOf("staging-eu-west", DEFAULT_ENVIRONMENTS)).toBe("staging");
        expect(environmentOf("acme-stg-2", DEFAULT_ENVIRONMENTS)).toBe("staging");
        expect(environmentOf("staging2", DEFAULT_ENVIRONMENTS)).toBe("staging");
        expect(environmentOf("qa-cluster", DEFAULT_ENVIRONMENTS)).toBe("test");
        expect(environmentOf("acme-testing", DEFAULT_ENVIRONMENTS)).toBe("test");
        expect(environmentOf("minikube", DEFAULT_ENVIRONMENTS)).toBe("local");
        expect(environmentOf("kind-dashboard", DEFAULT_ENVIRONMENTS)).toBe("local");
    });

    test("puts production first, so a name mentioning two lands in the riskier one", () => {
        expect(environmentOf("prod-test-eu", DEFAULT_ENVIRONMENTS)).toBe("production");
        expect(environmentOf("dev-staging-mirror", DEFAULT_ENVIRONMENTS)).toBe("staging");
    });

    test("every default expression compiles", () => {
        expect(defaults).toHaveLength(DEFAULT_ENVIRONMENTS.length);
    });
});

describe("groupByEnvironment", () => {
    const contexts = [
        { name: "prod-eu-1" },
        { name: "my-dev-box" },
        { name: "apollo" },
        { name: "devops-prod" },
    ];

    test("groups in the list order, with Unassigned last", () => {
        const groups = groupByEnvironment(contexts, defaults, {});
        expect(groups.map((group) => group.environment.id)).toEqual(["production", "development", "unassigned"]);
    });

    test("drops every environment no context resolved to", () => {
        const groups = groupByEnvironment([{ name: "apollo" }], defaults, {});
        expect(groups.map((group) => group.environment.id)).toEqual(["unassigned"]);
    });

    test("keeps the order the contexts were given in within a group", () => {
        const groups = groupByEnvironment(contexts, defaults, {});
        expect(groups[0].items.map((item) => item.name)).toEqual(["prod-eu-1", "devops-prod"]);
    });

    test("reordering the list reorders the groups", () => {
        const reversed = compileEnvironments(DEFAULT_ENVIRONMENTS.slice().reverse());
        const groups = groupByEnvironment(contexts, reversed, {});
        expect(groups.map((group) => group.environment.id)).toEqual(["development", "production", "unassigned"]);
    });

    test("an empty list puts every context under one Unassigned group", () => {
        const groups = groupByEnvironment(contexts, [], {});
        expect(groups).toHaveLength(1);
        expect(groups[0].environment.id).toBe(UNASSIGNED_ENVIRONMENT.id);
        expect(groups[0].items).toHaveLength(4);
    });

    test("a label for a context that is not present produces no phantom group", () => {
        const groups = groupByEnvironment([{ name: "apollo" }], defaults, { "gone-prod": "local" });
        expect(groups.map((group) => group.environment.id)).toEqual(["unassigned"]);
    });
});

describe("contextLabel", () => {
    test("returns the label when it names an environment in the list", () => {
        expect(contextLabel("apollo", defaults, { apollo: "production" })).toBe("production");
    });

    test("returns null when the context has no label", () => {
        expect(contextLabel("apollo", defaults, {})).toBeNull();
    });

    test("returns null when the label names an environment that was deleted", () => {
        expect(contextLabel("apollo", compileEnvironments([blue]), { apollo: "production" })).toBeNull();
    });
});

describe("environmentFromSelection", () => {
    test("maps an environment id in the list to itself", () => {
        expect(environmentFromSelection("production", defaults)).toBe("production");
    });

    test("maps the auto choice to null", () => {
        expect(environmentFromSelection("auto", defaults)).toBeNull();
    });

    test("maps an unknown id to null", () => {
        expect(environmentFromSelection("blue", defaults)).toBeNull();
    });
});

describe("validatePattern", () => {
    test("accepts a usable expression", () => {
        expect(validatePattern("^prod")).toBeNull();
    });

    test("rejects an expression that does not compile, with a readable message", () => {
        const message = validatePattern("prod(");
        expect(message).not.toBeNull();
        expect(message).toContain("Not a valid regular expression");
    });

    test("rejects an empty expression", () => {
        expect(validatePattern("   ")).toBe("Enter a regular expression.");
    });

    test("rejects an expression longer than the cap", () => {
        expect(validatePattern("a".repeat(MAX_PATTERN_LENGTH + 1))).toContain(String(MAX_PATTERN_LENGTH));
    });
});

describe("validateEnvironmentName", () => {
    test("accepts a name", () => {
        expect(validateEnvironmentName("Blue")).toBeNull();
    });

    test("rejects a blank name", () => {
        expect(validateEnvironmentName("  ")).toBe("Enter a name.");
    });
});

describe("normalizeEnvironments", () => {
    test("a stored config with no environment list yields the defaults", () => {
        expect(normalizeEnvironments(undefined)).toEqual(DEFAULT_ENVIRONMENTS);
    });

    test("a stored value that is not an array yields the defaults", () => {
        expect(normalizeEnvironments({ production: "prod" })).toEqual(DEFAULT_ENVIRONMENTS);
        expect(normalizeEnvironments("production")).toEqual(DEFAULT_ENVIRONMENTS);
    });

    test("a row with no expression yields the defaults", () => {
        expect(normalizeEnvironments([{ id: "blue", name: "Blue" }])).toEqual(DEFAULT_ENVIRONMENTS);
    });

    test("a row whose expression does not compile yields the defaults", () => {
        expect(normalizeEnvironments([{ id: "blue", name: "Blue", pattern: "blue(", color: "info" }])).toEqual(DEFAULT_ENVIRONMENTS);
    });

    test("a row with no name yields the defaults", () => {
        expect(normalizeEnvironments([{ id: "blue", name: "  ", pattern: "blue", color: "info" }])).toEqual(DEFAULT_ENVIRONMENTS);
    });

    test("a stored empty list is kept, because that is how a cleared list persists", () => {
        expect(normalizeEnvironments([])).toEqual([]);
    });

    test("a valid stored list is read back as it was written", () => {
        expect(normalizeEnvironments([blue, green])).toEqual([blue, green]);
    });

    test("an unrecognised colour falls back to the neutral default", () => {
        const normalized = normalizeEnvironments([{ id: "blue", name: "Blue", pattern: "blue", color: "chartreuse" }]);
        expect(normalized[0].color).toBe("default");
    });
});

describe("compileEnvironments", () => {
    test("compiles every usable row, case-insensitively", () => {
        const compiled = compileEnvironments([blue]);
        expect(compiled).toHaveLength(1);
        expect(compiled[0].regex.test("BLUE")).toBe(true);
    });

    test("drops a row whose expression will not compile rather than throwing", () => {
        const compiled = compileEnvironments([blue, { id: "bad", name: "Bad", pattern: "bad(", color: "info" }]);
        expect(compiled.map((environment) => environment.definition.id)).toEqual(["blue"]);
    });
});

describe("environmentId", () => {
    test("slugs the name", () => {
        expect(environmentId("Test / QA", [])).toBe("test-qa");
    });

    test("uniquifies against the ids already in use", () => {
        expect(environmentId("Blue", [blue])).toBe("blue-2");
    });

    test("never collides with the built-in Unassigned bucket", () => {
        expect(environmentId("Unassigned", [])).toBe("unassigned-2");
    });

    test("falls back to a usable id when the name slugs to nothing", () => {
        expect(environmentId("///", [])).toBe("environment");
    });
});
