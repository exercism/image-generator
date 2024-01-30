#!/usr/bin/env bash

# Synopsis:
# Capture an image using Docker.

# Arguments:
# $1: raw path to image
# $2: path to output directory

# Output:
# Create an image from a raw image path and write the image to the output directory.

# Example:
# ./bin/run-in-docker.sh /tracks/ruby/exercises/two-fer/solutions/erikschierboom.jpg $PWD/output

# Stop executing when a command returns a non-zero return code
set -e

# If any required arguments is missing, print the usage and exit
if (( $# != 2 )); then
    echo "usage: ./bin/run-in-docker.sh raw-image-path path/to/output/directory/"
    exit 1
fi

port=9876
tag="exercism/image-generator"
platform="linux/amd64"

raw_image_path="${1}"
output_dir=$(realpath "${2%/}")
mkdir -p "${output_dir}"

if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --platform "${platform}" -t "${tag}" .
fi

echo "capturing image..."

container_id=$(docker run -d --platform "${platform}" -p ${port}:8080 "${tag}")
trap "docker stop $container_id > /dev/null" EXIT

event_json=$(jq -n --arg rawPath "${raw_image_path}" '{rawPath: $rawPath}')
curl "http://localhost:${port}/2015-03-31/functions/function/invocations" -d "${event_json}" --silent > "${output_dir}/response.json"

jq -r '.body' "${output_dir}/response.json" | base64 --decode > "${output_dir}/image.webp"

echo "done"
