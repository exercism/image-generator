#!/usr/bin/env bash

# Synopsis:
# Run the image generator.

# Arguments:
# $1: image url
# $2: path to output directory (optional)

# Output:
# Capture an image from an URL.
# If the output directory is specified, also write the image to that directory.

# Example:
# ./bin/run.sh https://exercism.org/images/solutions/ruby/two-fer/erikSchierboom

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 1 ]]; then
    echo "usage: ./bin/run.sh image-url [path/to/output/directory/]"
    exit 1
fi

image_url="${1}"

if [ ! -z "${2}" ]; then
    output_dir=$(realpath "${2%/}")
fi

echo "${image_url}: counting lines of code..."

# Call the function with the correct JSON event payload
body_json=$(jq -n --arg url "${image_url}" '{url: $url}')
event_json=$(jq -n --arg b "${body_json}" '{body: $b}')
ruby "./bin/run.rb" "${event_json}"

echo "${image_url}: done"
