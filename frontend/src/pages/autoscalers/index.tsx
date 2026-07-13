import { AutoscalersTable } from "./components/autoscalers-table";

// Route-level component for the Autoscalers page (/autoscalers): the read-only table of
// horizontal pod autoscalers and how each is performing against its target metric.
export function AutoscalersPage() {
    return <AutoscalersTable />;
}
