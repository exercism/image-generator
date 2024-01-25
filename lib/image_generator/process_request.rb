module ImageGenerator
  class ProcessRequest
    include Mandate

    initialize_with :event, :content

    def call
      {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'image/png' },
        isBase64Encoded: true,
        body: Base64.encode64(screenshot)
      }
    end

    memoize
    def screenshot
      if matchdata = SOLUTION_REGEXP.match(event["rawPath"])
        CaptureSolutionScreenshot.(**extract_captures(matchdata))
      end

      # TODO: Raise if this doesn't match
    end

    def extract_captures(matchdata)
      matchdata.named_captures.transform_keys(&:to_sym)
    end

    SOLUTION_REGEXP = /^\/tracks\/(?<track_slug>[^\\]+)\/exercises\/(?<exercise_slug>[^\\]+)\/solutions\/(?<user_handle>[^\\]+).png$/
  end
end
