#!/usr/bin/env bash

# Synopsis:
# Run the solution image generator using the Docker image.

# Arguments:
# $1: track slug
# $2: exercise slug
# $3: user handle

# Output:
# Create an image for an iteration's code.

# Example:
# ./bin/run-in-docker.sh csharp bob foo 

# If any required arguments is missing, print the usage and exit
if [[ $# -lt 3 ]]; then
    echo "usage: ./bin/run-in-docker.sh track-slug exercise-slug user-handle"
    exit 1
fi

export EXERCISM_ENV=development

track_slug="${1}"
exercise_slug="${2}"
user_handle="${3}"
container_port=9876
image_tag="exercism/solution-image-generator"
aws_lambda_rie_path="/usr/local/bin/aws-lambda-rie"

if ! command -v aws-lambda-rie &> /dev/null
then
    curl -Lo "${aws_lambda_rie_path}" https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie
    chmod +x "${aws_lambda_rie_path}"
fi

# Build the Docker image, unless SKIP_BUILD is set
if [[ -z "${SKIP_BUILD}" ]]; then
    docker build --build-arg EXERCISM_ENV=development --rm -t "${image_tag}" .
fi

# Run the Docker image using the settings mimicking the production environment
container_id=$(
    docker run \
        --detach \
        --volume /usr/local/bin/aws-lambda-rie:/aws-lambda/aws-lambda-rie \
        --volume $PWD/tmp:/var/task/tmp \
        --env SPI_URL=http://host.docker.internal:3020 \
        --publish ${container_port}:8080 \
        --entrypoint /aws-lambda/aws-lambda-rie \
        "${image_tag}" \
            aws_lambda_ric lib/image_generator.ImageGenerator.process_request)

echo "${track_slug}/${exercise_slug}/${user_handle}: creating image..."

# Call the function with the correct JSON event payload
body_json=$(jq -n --arg t "${track_slug}" --arg e "${exercise_slug}" --arg u "${user_handle}" '{track_slug: $t, exercise_slug: $e, user_handle: $u}')
event_json=$(jq -n --arg b "${body_json}" '{body: $b}')
function_url="http://localhost:${container_port}/2015-03-31/functions/function/invocations"

curl -XPOST "${function_url}" --data "${event_json}"

# docker logs "${container_id}"
echo "${track_slug}/${exercise_slug}/${user_handle}: done"

docker stop "${container_id}" > /dev/null
