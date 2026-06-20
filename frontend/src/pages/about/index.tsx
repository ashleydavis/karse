import { Box, Card, CardContent, Link as MuiLink, Stack, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";

// The public source repository. Mirrors the git remote (git@github.com:ashleydavis/karse.git)
// so the About page always points users at the canonical project home.
const GITHUB_URL = "https://github.com/ashleydavis/karse";

// Karse's author/maintainer, taken from the repository owner.
const AUTHOR = "Ashley Davis";

// Static About page: explains what Karse is, how it works, who made it, and links
// to the source on GitHub. It reads nothing from the cluster, so it renders the
// same regardless of the active context.
export function AboutPage() {
    return (
        <Box sx={{ maxWidth: 720, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }} data-test-id="about-page">
            <Card>
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                            About Karse
                        </Typography>

                        <Typography variant="body1" data-test-id="about-what">
                            Karse is a local-only, read-only Kubernetes dashboard that wraps your
                            locally-installed <code>kubectl</code> binary. It runs entirely on your own
                            machine and is for information only: it never mutates cluster state.
                        </Typography>

                        <Typography variant="body1" data-test-id="about-how">
                            It works by shelling out to your local <code>kubectl</code> for read-only
                            cluster queries. The only thing it ever writes is the active context in your
                            kubeconfig, when you switch contexts (via <code>kubectl config use-context</code>).
                        </Typography>

                        <Typography variant="body1" data-test-id="about-author">
                            Karse was made by {AUTHOR}.
                        </Typography>

                        <Box>
                            <MuiLink
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-test-id="about-github-link"
                                sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontWeight: 600 }}
                            >
                                View Karse on GitHub
                                <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: "0.8em" }} />
                            </MuiLink>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
