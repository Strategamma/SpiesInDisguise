# Goal
Make the existing game folder the GitHub repository root so GitHub Desktop can publish every required file.

# Scope
Relocate the accidentally nested Git metadata and repository attributes only; preserve all game files and the existing GitHub remote/history.

# Approach
Move `.git` and `.gitattributes` from the empty `SpiesInDisguise/` child into the current project root, remove the now-empty child directory, then verify repository root, remote, file status, tests, and required deployment files.

# Risks
The GitHub branch may contain a newer web-upload commit, so publishing may require GitHub Desktop to fetch and reconcile it before pushing.

# Verification
Confirm the repository root is this folder, required files are tracked as changes, the origin URL is correct, and the test suite passes.
