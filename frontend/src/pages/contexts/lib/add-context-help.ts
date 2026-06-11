// The static, display-only guidance shown on the contexts page when the
// kubeconfig has no contexts at all. A new user with an empty kubeconfig would
// otherwise hit a dead end, so this provides copy-ready commands for the two
// common managed-Kubernetes clouds. This is the single source of truth for that
// guidance, so the empty-state component and its tests agree on the exact text.
//
// Read-only invariant: these are strings the user copies into their own
// terminal. Karse never runs them, suggests running them automatically, or
// shells out to aws/az.

// A single labelled, copy-ready command for adding a context.
export type AddContextCommand = {
    // The cloud/provider this command targets (e.g. "Amazon EKS").
    label: string;
    // The exact shell command, with <placeholders> the user substitutes.
    command: string;
};

// The EKS and AKS commands shown in the empty state, in display order.
export const addContextCommands: AddContextCommand[] = [
    {
        label: "Amazon EKS",
        command: "aws eks update-kubeconfig --name <cluster-name> --region <region>",
    },
    {
        label: "Azure AKS",
        command: "az aks get-credentials --resource-group <resource-group> --name <cluster-name>",
    },
];

// The short heading shown above the add-a-context commands.
export const addContextHeading = "No contexts found.";

// The one-line intro telling the user what the commands below do.
export const addContextIntro = "Add a Kubernetes context to your kubeconfig, then reload this page to see it.";
