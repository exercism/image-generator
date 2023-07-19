#!/usr/bin/env bash

# Synopsis:
# Run the solution image generator using the Docker image.

# Arguments:
# $1: track slug
# $2: the source code
# $3: path to output directory (optional)

# Output:
# Create an image for an iteration's code.
# If the output directory is specified, also write the response to that directory.

# Example:
# ./bin/run-in-docker.sh csharp "Console.WriteLine(42);"

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 2 ]]; then
    echo "usage: ./bin/run-in-docker.sh track-slug <source-code> [path/to/output/directory/]"
    exit 1
fi

track_slug="${1}"
source_code="${2}"
container_port=9876
image_tag="exercism/solution-image-generator"

# Build the Docker image, unless SKIP_BUILD is set
if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --rm -t "${image_tag}" .
fi

# Run the Docker image using the settings mimicking the production environment
container_id=$(docker run \
    --detach \
    --publish ${container_port}:8080 \
    "${image_tag}")

echo "${track_slug}: creating image..."

#  the function with the correct JSON event payload
body_json=$(jq -n --arg l "${track_slug}" --arg s "${source_code}" '{language: $l, source_code: $s}')
event_json=$(jq -n --arg b "${body_json}" '{body: $b}')
function_url="http://localhost:${container_port}/2015-03-31/functions/function/invocations"

if [ -z "${3}" ]; then
    curl -XPOST "${function_url}" --data "${event_json}"
    echo ""
else
    output_dir=$(realpath "${3%/}")
    curl -XPOST "${function_url}" --data "${event_json}" --silent > "${output_dir}/snippet.txt"    
fi

echo "${track_slug}: done"

docker stop "${container_id}" > /dev/null
