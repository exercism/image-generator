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

    def track_slug = body[:track_slug]
    def exercise_slug = body[:exercise_slug]
    def user_handle = body[:user_handle]

    memoize
    def body = JSON.parse(event['body'], symbolize_names: true)
  end
end
