# Frinny - AI Assistant for Foundry VTT

An AI assistant for Pathfinder 2E that helps with character creation, leveling, and combat.

## Development

### Local Build

To build the module locally for testing:

1. Run the build script with the desired version number:

```bash
./scripts/build.sh 1.1.2
```

This will:
- Update the version in `frinny/module.json`
- Create a `module.zip` file in the root directory

### Automated Deployment

This project uses GitHub Actions for automated deployment. To release a new version:

1. Go to the GitHub repository
2. Navigate to the "Actions" tab
3. Select the "Release Module" workflow
4. Click "Run workflow"
5. Enter the new version number (e.g., 1.1.2)
6. Choose whether this is a pre-release
7. Click "Run workflow"

The GitHub Action will:
- Update the version in module.json
- Update the download URL in module.json
- Create a module.zip file
- Commit the changes to the repository
- Create a GitHub release with the specified version
- Upload the module.zip file to the release

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