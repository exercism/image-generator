#!/usr/bin/env bash

# Synopsis:
# Capture an image.

# Arguments:
# $1: url to capture an image from
# $2: the selector passed to 'document.querySelector()' to determine what element to capture
# $3: path to output directory (optional)

# Output:
# Capture an image from an URL.
# If the output directory is specified, also write the image to that directory.

# Example:
# ./bin/run.sh https://exercism.org/images/solutions/ruby/two-fer/erikSchierboom '#page-image-solution'

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 2 ]]; then
    echo "usage: ./bin/run.sh image-url selector [path/to/output/directory/]"
    exit 1
fi

image_url="${1}"
selector="${2}"

echo "generating image..."

# Call the function with the correct JSON event payload
body_json=$(jq -n --arg url "${image_url}" --arg selector "${selector}" '{url: $url, selector: $selector}')
event_json=$(jq -n --arg b "${body_json}" '{body: $b}')

if [ -z "${3}" ]; then
    ruby "./bin/run.rb" "${event_json}"
else
    output_dir=$(realpath "${3%/}")
    mkdir -p "${output_dir}"
    ruby "./bin/run.rb" "${event_json}" | jq -r '.body' | base64 --decode > "${output_dir}/image.png"
fi

echo "done"
