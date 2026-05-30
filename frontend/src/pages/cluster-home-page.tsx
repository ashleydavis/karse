import { ClusterOverview } from "../components/cluster-overview";
import { NodesTable } from "../components/nodes-table";

export function ClusterHomePage() {
    return (
        <div className="flex flex-col gap-6">
            <ClusterOverview />
            <NodesTable />
        </div>
    );
}
