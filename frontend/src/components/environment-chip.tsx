import { Chip } from "@mui/material";
import { ENVIRONMENT_LABELS, type ClusterEnvironment } from "../lib/cluster-environments";

// The MUI chip colour each environment is drawn in. Production is the alarm colour so a view
// pointed at production is unmistakable; unassigned is the neutral default.
const ENVIRONMENT_COLORS: Record<ClusterEnvironment, "error" | "warning" | "info" | "secondary" | "success" | "default"> = {
    production: "error",
    staging: "warning",
    development: "info",
    test: "secondary",
    local: "success",
    unassigned: "default",
};

// The props of the shared environment chip. `source` reports whether the environment came
// from an explicit label or from the context's name; a labelled chip is drawn filled so it is
// visibly distinct from an inferred one.
type Props = {
    environment: ClusterEnvironment;
    source: "label" | "inferred";
    testId?: string;
};

// The one way Karse renders a context's environment: a small chip naming the environment,
// filled when the developer labelled it by hand and outlined when it was inferred from the
// context name.
export function EnvironmentChip({ environment, source, testId }: Props) {
    return (
        <Chip
            label={ENVIRONMENT_LABELS[environment]}
            size="small"
            color={ENVIRONMENT_COLORS[environment]}
            variant={source === "label" ? "filled" : "outlined"}
            data-test-id={testId}
            data-environment={environment}
            data-environment-source={source}
            title={source === "label" ? `Labelled ${ENVIRONMENT_LABELS[environment]}` : `Inferred ${ENVIRONMENT_LABELS[environment]} from the context name`}
        />
    );
}
