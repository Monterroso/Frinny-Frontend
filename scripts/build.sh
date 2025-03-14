#!/bin/bash

# Check if version is provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/build.sh <version> [--create-zip]"
  echo "  --create-zip: Optional flag to create module.zip (for local testing)"
  exit 1
fi

VERSION=$1
CREATE_ZIP=false

# Check for --create-zip flag
if [ "$2" == "--create-zip" ]; then
  CREATE_ZIP=true
fi

# Update version in module.json
echo "Updating version to $VERSION in module.json..."
if command -v jq &> /dev/null; then
  # Use jq if available
  jq ".version = \"$VERSION\"" frinny/module.json > temp.json && mv temp.json frinny/module.json
  jq ".download = \"https://github.com/Monterroso/Frinny-Frontend/releases/download/v$VERSION/module.zip\"" frinny/module.json > temp.json && mv temp.json frinny/module.json
  
  echo "Updated module.json:"
  cat frinny/module.json | grep -E "version|download"
else
  echo "jq not found. Please install jq or manually update the version in module.json."
  exit 1
fi

# Create zip file if requested
if [ "$CREATE_ZIP" = true ]; then
  echo "Creating module.zip..."
  cd frinny
  zip -r ../module.zip *
  cd ..
  echo "module.zip created in the root directory"
fi

echo "Build completed successfully!"
echo "module.json updated with version $VERSION"
echo ""
echo "IMPORTANT: After committing and pushing these changes to the main branch,"
echo "the GitHub Actions workflow will automatically create a release with this version." 