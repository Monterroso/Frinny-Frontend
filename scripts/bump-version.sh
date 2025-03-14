#!/bin/bash

# Function to display usage information
usage() {
  echo "Usage: ./scripts/bump-version.sh [major|minor|patch]"
  echo "  major: Bump the major version (X.0.0)"
  echo "  minor: Bump the minor version (x.X.0)"
  echo "  patch: Bump the patch version (x.x.X)"
  exit 1
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed."
  echo "Please install jq first:"
  echo "  - macOS: brew install jq"
  echo "  - Ubuntu/Debian: sudo apt-get install jq"
  echo "  - Windows: choco install jq"
  exit 1
fi

# Check if argument is provided
if [ $# -ne 1 ]; then
  usage
fi

# Get current version from module.json
CURRENT_VERSION=$(jq -r '.version' frinny/module.json)
echo "Current version: $CURRENT_VERSION"

# Split version into components
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Bump version based on argument
case "$1" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    usage
    ;;
esac

# Create new version string
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW_VERSION"

# Ask for confirmation
read -p "Do you want to update to version $NEW_VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 0
fi

# Ask if user wants to create a zip file for local testing
read -p "Do you want to create a module.zip file for local testing? (y/n) " -n 1 -r
echo
CREATE_ZIP_FLAG=""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  CREATE_ZIP_FLAG="--create-zip"
fi

# Run the build script with the new version
./scripts/build.sh "$NEW_VERSION" $CREATE_ZIP_FLAG

echo "Version bumped to $NEW_VERSION"
if [[ -n "$CREATE_ZIP_FLAG" ]]; then
  echo "module.zip created for local testing"
fi
echo "You can now commit the changes and push to GitHub."
echo "To create a release, run the GitHub Actions workflow." 