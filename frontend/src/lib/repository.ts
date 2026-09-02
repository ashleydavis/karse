// The public source repository. Mirrors the git remote (git@github.com:ashleydavis/karse.git)
// so every surface that points users at the project home reads the same URL.
export const GITHUB_URL = "https://github.com/ashleydavis/karse";

// The repository's new-issue page. Karse is local-only and read-only, so it cannot
// take a bug report itself; the sidebar's "Report a bug" entry hands the user to
// GitHub here instead.
export const GITHUB_NEW_ISSUE_URL = GITHUB_URL + "/issues/new";
