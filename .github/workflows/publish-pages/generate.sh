#!/bin/env bash

# Create output directory
rm -rf _site
mkdir -p _site

# Copy CSS to output directory
cat \
    .github/workflows/publish-pages/org-export.css \
    > _site/style.css

# Function to process org files
process_org_file() {
    local org_file="$1"
    local base_name=$(basename "$org_file" .org)
    local output_file="_site/${base_name}.html"

    echo "Processing: $org_file -> $output_file"
    emacs --batch --load .github/workflows/publish-pages/org-export.el "$org_file"

    # Move the generated HTML file to the output directory
    if [ -f "${org_file%.org}.html" ]; then
        mv "${org_file%.org}.html" "$output_file"
    fi
}

# Process all other .org files in the repository
find . -name "*.org" -not -path "./.git/*" | while read -r org_file; do
    process_org_file "$org_file"
done

if [ -f "_site/readme.html" ]; then
    echo "Moving readme.html to index.html"
    mv "_site/readme.html" "_site/index.html"
fi

# List generated files for debugging
echo "Generated files:"
find _site -type f
