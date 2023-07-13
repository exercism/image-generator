module ImageGenerator
  class ProcessRequest
    include Mandate

    initialize_with :event, :context

    def call
      GenerateCarbon.(code)

      {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'text/plain' },
        isBase64Encoded: false,
        body: "foobar"
      }
    end

    def code
      body[:code]
    end

    memoize
    def body
      JSON.parse(event['body'], symbolize_names: true)
    end
  end
end
