#!/usr/bin/env bash

# Synopsis:
# Run the snippet extractor using the Docker image.

# Arguments:
# $1: track slug
# $2: path to source code
# $3: path to output directory (optional)

# Output:
# Extract the snippet from an iteration's code.
# If the output directory is specified, also write the response to that directory.

# Example:
# ./bin/run-in-docker.sh csharp tests/csharp/simple.cs

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 2 ]]; then
    echo "usage: ./bin/run-in-docker.sh track-slug <path/to/source/code/> [path/to/output/directory/]"
    exit 1
fi

track_slug="${1}"
source_code=$(cat "${2}")
container_port=9876

# Build the Docker image, unless SKIP_BUILD is set
if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --rm -t exercism/snippet-extractor .
fi

# Run the Docker image using the settings mimicking the production environment
container_id=$(docker run \
    --detach \
    --publish ${container_port}:8080 \
    exercism/snippet-extractor)

echo "${track_slug}: extracting snippet..."

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

docker stop $container_id > /dev/null
