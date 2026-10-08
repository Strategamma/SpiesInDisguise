# Goal
Publish the static PWA from `public/` through GitHub Pages.

# Scope
Add the minimal GitHub Actions Pages workflow and preserve the existing Render gateway deployment.

# Approach
Upload `public/` as the Pages artifact and deploy it on pushes to `main`; keep relative PWA asset paths compatible with the `/SpiesInDisguise/` subpath.

# Risks
The repository owner must select GitHub Actions as the Pages source once; publishing can take several minutes.

# Verification
Validate the workflow, relative asset paths, automated tests, and the live Pages URL after GitHub deploys it.
