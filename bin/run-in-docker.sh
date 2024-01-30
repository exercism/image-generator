#!/usr/bin/env bash

# Synopsis:
# Capture an image using Docker.

# Arguments:
# $1: url to capture an image from
# $2: path to output directory (optional)

# Output:
# Capture an image from an URL.
# If the output directory is specified, also write the image to that directory.

# Example:
# ./bin/run-in-docker.sh https://exercism.org/images/solutions/csharp/two-fer/erikschierboom

# Stop executing when a command returns a non-zero return code
set -e

# If any required arguments is missing, print the usage and exit
if (( $# != 2 )); then
    echo "usage: ./bin/run-in-docker.sh image-url path/to/output/directory/"
    exit 1
fi

port=9876
tag="exercism/image-generator"
platform="linux/amd64"

image_url="${1}"
output_dir=$(realpath "${2%/}")
mkdir -p "${output_dir}"

if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --platform "${platform}" -t "${tag}" .
fi

echo "capturing image..."

container_id=$(docker run -d --platform "${platform}" -p ${port}:8080 "${tag}")
trap "docker stop $container_id > /dev/null" EXIT

event_json=$(jq -n --arg url "${image_url}" '{url: $url}')
curl "http://localhost:${port}/2015-03-31/functions/function/invocations" -d "${event_json}" --silent > "${output_dir}/response.json"

jq -r '.body' "${output_dir}/response.json" | base64 --decode > "${output_dir}/image.png"

echo "done"
