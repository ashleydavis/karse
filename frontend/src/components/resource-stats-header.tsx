import { Chip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup, faCircleCheck, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import type { ResourceStats } from "../lib/resource-stats";

// A row of summary chips shown at the top of a resource list page: the total
// count plus per-kind healthy and error counts. Counts are derived from the
// already-fetched list (scoped to the current context/namespace), so they update
// whenever the underlying query refetches. testIdPrefix namespaces the
// data-test-id attributes so each page's chips can be asserted independently.
export function ResourceStatsHeader({ stats, testIdPrefix }: { stats: ResourceStats; testIdPrefix: string }) {
    return (
        <div className="flex flex-row gap-2 items-center" data-test-id={`${testIdPrefix}-stats`}>
            <Chip
                icon={<FontAwesomeIcon icon={faLayerGroup} />}
                label={`Total: ${stats.total}`}
                size="small"
                variant="outlined"
                data-test-id={`${testIdPrefix}-stats-total`}
            />
            <Chip
                icon={<FontAwesomeIcon icon={faCircleCheck} />}
                label={`Healthy: ${stats.healthy}`}
                color="success"
                size="small"
                variant="outlined"
                data-test-id={`${testIdPrefix}-stats-healthy`}
            />
            <Chip
                icon={<FontAwesomeIcon icon={faCircleXmark} />}
                label={`Error: ${stats.error}`}
                color={stats.error > 0 ? "error" : "default"}
                size="small"
                variant="outlined"
                data-test-id={`${testIdPrefix}-stats-error`}
            />
        </div>
    );
}
