import { Chip } from "@mui/material";
import type { EnvironmentDefinition } from "../lib/cluster-environments";

// The props of the shared environment chip. `source` reports whether the environment came
// from an explicit label or from the context's name; a labelled chip is drawn filled so it is
// visibly distinct from a matched one.
type Props = {
    environment: EnvironmentDefinition;
    source: "label" | "inferred";
    testId?: string;
};

// The one way Karse renders a context's environment: a small chip naming the environment in
// the colour the user gave it, filled when the developer labelled it by hand and outlined
// when it was matched from the context name.
export function EnvironmentChip({ environment, source, testId }: Props) {
    return (
        <Chip
            label={environment.name}
            size="small"
            color={environment.color}
            variant={source === "label" ? "filled" : "outlined"}
            data-test-id={testId}
            data-environment={environment.id}
            data-environment-source={source}
            title={source === "label" ? `Labelled ${environment.name}` : `Matched ${environment.name} from the context name`}
        />
    );
}
