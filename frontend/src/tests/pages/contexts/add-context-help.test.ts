import { addContextCommands, addContextHeading, addContextIntro } from "../../../pages/contexts/lib/add-context-help";

describe("add-context-help", () => {
    test("provides the EKS command with placeholders", () => {
        const eks = addContextCommands.find((c) => c.label === "Amazon EKS");
        expect(eks?.command).toBe("aws eks update-kubeconfig --name <cluster-name> --region <region>");
    });

    test("provides the AKS command with placeholders", () => {
        const aks = addContextCommands.find((c) => c.label === "Azure AKS");
        expect(aks?.command).toBe("az aks get-credentials --resource-group <resource-group> --name <cluster-name>");
    });

    test("lists EKS before AKS", () => {
        expect(addContextCommands.map((c) => c.label)).toEqual(["Amazon EKS", "Azure AKS"]);
    });

    test("heading states there are no contexts", () => {
        expect(addContextHeading).toBe("No contexts found.");
    });

    test("intro tells the user to reload after adding a context", () => {
        expect(addContextIntro).toContain("reload this page");
    });
});
