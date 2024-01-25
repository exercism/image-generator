#!/usr/bin/env bash

# Synopsis:
# Run the image generator using Docker.

# Arguments:
# $1: image url
# $2: path to output directory (optional)

# Output:
# Capture an image from an URL.
# If the output directory is specified, also write the image to that directory.

# Example:
# ./bin/run-in-docker.sh https://exercism.org/images/solutions/ruby/two-fer/erikSchierboom

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 1 ]]; then
    echo "usage: ./bin/run-in-docker.sh image-url [path/to/output/directory/]"
    exit 1
fi

image_url="${1}"
container_port=9876

# Build the Docker image, unless SKIP_BUILD is set
if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --rm -t exercism/image-generator .
fi

# Run the Docker image using the settings mimicking the production environment
# The shm-size is set to 2gb as otherwise the page crashes when visiting
container_id=$(docker run \
    --shm-size=2gb \
    --detach \
    --publish ${container_port}:8080 \
    exercism/image-generator)

echo "generating image..."

#  the function with the correct JSON event payload
body_json=$(jq -n --arg url "${image_url}" '{url: $url}')
event_json=$(jq -n --arg b "${body_json}" '{body: $b}')
function_url="http://localhost:${container_port}/2015-03-31/functions/function/invocations"

if [ -z "${2}" ]; then
    curl -XPOST "${function_url}" --data "${event_json}"
else
    output_dir=$(realpath "${2%/}")
    mkdir -p "${output_dir}"
    curl -XPOST "${function_url}" --data "${event_json}" --silent > "${output_dir}/response.json"    
    jq -r '.body' "${output_dir}/response.json" | base64 --decode > "${output_dir}/image.png"
fi

echo "done"

docker stop $container_id > /dev/null
