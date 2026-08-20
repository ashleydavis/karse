import { namespaceTriggerLabel, ALL_NAMESPACES_LABEL } from "../../components/namespace-trigger-label";

// namespaceTriggerLabel is the pure core of the header's namespace trigger: it produces the
// exact text the trigger renders, so testing it covers what the control says the scope is.
describe("namespaceTriggerLabel", () => {
    test("renders the active namespace name", () => {
        expect(namespaceTriggerLabel("kube-system")).toBe("kube-system");
    });

    test("renders 'All namespaces' when no namespace is active", () => {
        expect(namespaceTriggerLabel(null)).toBe("All namespaces");
    });

    test("uses the same wording as the dropdown's clear entry when none is active", () => {
        expect(namespaceTriggerLabel(null)).toBe(ALL_NAMESPACES_LABEL);
    });

    test("renders a long namespace name in full, leaving truncation to the trigger's styling", () => {
        const long = "a-very-long-namespace-name-that-would-overflow-the-header";
        expect(namespaceTriggerLabel(long)).toBe(long);
    });

    test("renders an empty namespace name as-is rather than falling back to the clear wording", () => {
        expect(namespaceTriggerLabel("")).toBe("");
    });
});
