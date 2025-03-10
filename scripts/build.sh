#!/bin/bash

# Check if version is provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/build.sh <version>"
  exit 1
fi

VERSION=$1

# Update version in module.json
echo "Updating version to $VERSION in module.json..."
if command -v jq &> /dev/null; then
  # Use jq if available
  jq ".version = \"$VERSION\"" frinny/module.json > temp.json && mv temp.json frinny/module.json
  jq ".download = \"https://github.com/Monterroso/Frinny-Frontend/releases/download/v$VERSION/module.zip\"" frinny/module.json > temp.json && mv temp.json frinny/module.json
else
  echo "jq not found. Please install jq or manually update the version in module.json."
  exit 1
fi

# Create zip file
echo "Creating module.zip..."
cd frinny
zip -r ../module.zip *
cd ..

echo "Build completed successfully!"
echo "module.json updated with version $VERSION"
echo "module.zip created in the root directory" 