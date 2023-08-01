module ImageGenerator
  class ProcessRequest
    include Mandate

    initialize_with :event, :context

    def call
      image_binary_data = ImageGenerator::Solutions::Generate.(
        track_slug, exercise_slug, user_handle
      )

      {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'image/png' },
        isBase64Encoded: true,
        body: Base64.encode64(image_binary_data)
      }
    end

    def track_slug = path_parts[:track_slug]
    def exercise_slug = path_parts[:exercise_slug]
    def user_handle = path_parts[:user_handle]

    memoize
    def path_parts
      regexp = /^\/tracks\/(?<track_slug>[^\\]+)\/exercises\/(?<exercise_slug>[^\\]+)\/solutions\/(?<user_handle>[^\\]+).png$/
      regexp.match(event["rawPath"])

      # TODO: Raise if this doesn't match
    end
  end
end
