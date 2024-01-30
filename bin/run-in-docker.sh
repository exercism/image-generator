#!/usr/bin/env bash

# Synopsis:
# Capture an image using Docker.

# Arguments:
# $1: url to capture an image from
# $2: the selector passed to 'document.querySelector()' to determine what element to capture
# $3: path to output directory (optional)

# Output:
# Capture an image from an URL.
# If the output directory is specified, also write the image to that directory.

# Example:
# ./bin/run-in-docker.sh https://exercism.org/images/solutions/ruby/two-fer/erikSchierboom '#page-image-solution'

# Stop executing when a command returns a non-zero return code
set -e

port=9876
tag="exercism/image-generator"
platform="linux/amd64"

if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --platform "${platform}" -t "${tag}" .
fi

container_id=$(docker run -d --platform "${platform}" -p ${port}:8080 "${tag}")

curl "http://localhost:${port}/2015-03-31/functions/function/invocations" -d '{"payload": {"name": "Spielberg"}}'
echo ''

docker stop $container_id > /dev/null

# # If any required arguments is missing, print the usage and exit
# # if [[ $# -lt 2 ]]; then
# #     echo "usage: ./bin/run-in-docker.sh image-url selector [path/to/output/directory/]"
# #     exit 1
# # fi

# image_url="${1}"
# selector="${2}"
# port=9876
# tag="exercism/image-generator"
# platform="linux/amd64"



# # Run the Docker image using the settings mimicking the production environment
# container_id=$(docker run --platform "${platform}" -p ${port}:8080 "${tag}")

# echo "generating image..."

# curl "http://localhost:${port}/2015-03-31/functions/function/invocations" -d '{}'

# docker stop $container_id

# # #  the function with the correct JSON event payload
# # body_json=$(jq -n --arg url "${image_url}" --arg selector "${selector}" '{url: $url, selector: $selector}')
# # event_json=$(jq -n --arg b "${body_json}" '{body: $b}')
# # echo $event_json
# # function_url="http://localhost:${port}/2015-03-31/functions/function/invocations"

# # if [ -z "${3}" ]; then
# #     curl -XPOST "${function_url}" --data "${event_json}"
# # else
# #     output_dir=$(realpath "${3%/}")
# #     mkdir -p "${output_dir}"
# #     curl -XPOST "${function_url}" --data "${event_json}" --silent > "${output_dir}/response.json"
# #     jq -r '.body' "${output_dir}/response.json" | base64 --decode > "${output_dir}/image.png"
# # fi

# # echo "done"

# # docker stop $container_id > /dev/null
