import { Box, CircularProgress } from "@mui/material";

// Shared loading indicator shown while a page's primary data query is in flight.
// Renders a large, clearly visible spinner (no text) centred in the content area,
// in place of a blank page, so every list and detail page signals loading consistently.
export function LoadingIndicator() {
    return (
        <Box
            data-test-id="loading-indicator"
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 6,
                minHeight: 200,
            }}
        >
            <CircularProgress size={56} thickness={4} />
        </Box>
    );
}
