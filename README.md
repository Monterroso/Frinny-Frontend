# Frinny - AI Assistant for Foundry VTT

An AI assistant for Pathfinder 2E that helps with character creation, leveling, and combat.

## Development

### Local Development Workflow

To update the module version and prepare for a release:

1. Use the version bump script to update the version number:

```bash
./scripts/bump-version.sh patch  # Options: major, minor, patch
```

This will:
- Calculate the next version number based on semantic versioning
- Update the version in `frinny/module.json`
- Update the download URL in `module.json`
- Optionally create a local `module.zip` file for testing

2. Commit and push your changes to the main branch:

```bash
git add frinny/module.json
git commit -m "Bump version to X.Y.Z"
git push origin main
```

3. The GitHub Actions workflow will automatically:
   - Detect the version change
   - Create a module.zip package
   - Create a GitHub release with the new version
   - Upload the module.zip to the release

### Manual Local Build

If you need to manually set a specific version:

```bash
./scripts/build.sh 1.2.3 [--create-zip]
```

The `--create-zip` flag is optional and will create a local zip file for testing.

## Installation

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/Monterroso/Frinny-Frontend/releases)
2. Extract the zip file
3. Copy the extracted folder to your Foundry VTT modules directory
4. Restart Foundry VTT
5. Enable the module in your world

### Installation via Foundry VTT

1. In the Foundry VTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. In the "Manifest URL" field, paste:
   ```
   https://raw.githubusercontent.com/Monterroso/Frinny-Frontend/main/frinny/module.json
   ```
4. Click "Install"
5. Enable the module in your world 