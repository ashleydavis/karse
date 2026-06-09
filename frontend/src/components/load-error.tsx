import { Alert, AlertTitle, Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight } from "@fortawesome/free-solid-svg-icons";

type LoadErrorProps = {
    // The message to show. Connectivity failures already carry the
    // "Make sure your internet or VPN is connected" hint (see lib/load-error.ts).
    message: string;
    // Re-attempts the failed load. Usually the TanStack Query `refetch` for the
    // page's primary query. When omitted, no retry button is shown.
    onRetry?: () => void;
};

// Shared error state shown when a page's primary data load fails (including a
// connectivity timeout). Replaces the loading spinner so the page never spins
// forever, and offers a retry path so the user can re-attempt the load.
export function LoadError({ message, onRetry }: LoadErrorProps) {
    return (
        <Alert
            severity="error"
            data-test-id="load-error"
            action={
                onRetry && (
                    <Button
                        color="inherit"
                        size="small"
                        onClick={onRetry}
                        data-test-id="load-error-retry"
                        startIcon={<FontAwesomeIcon icon={faRotateRight} />}
                    >
                        Retry
                    </Button>
                )
            }
        >
            <AlertTitle>Could not load data</AlertTitle>
            {message}
        </Alert>
    );
}
