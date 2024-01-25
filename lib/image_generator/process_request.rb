module ImageGenerator
  class ProcessRequest
    include Mandate

    initialize_with :event, :content

    def call
      {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'image/jpg' },
        isBase64Encoded: true,
        body: Base64.encode64(screenshot)
      }
    end

    memoize
    def screenshot
      return unless (matchdata = SOLUTION_REGEXP.match(event["rawPath"]))

      data = extract_captures(matchdata)
      CaptureSolutionScreenshot.(data[:track_slug], data[:exercise_slug], data[:user_handle])

      # TODO: Raise if this doesn't match
    end

    def extract_captures(matchdata)
      matchdata.named_captures.transform_keys(&:to_sym)
    end

    SOLUTION_REGEXP = %r{^/tracks/(?<track_slug>[^\\]+)/exercises/(?<exercise_slug>[^\\]+)/solutions/(?<user_handle>[^\\]+).jpg$}
  end
end
