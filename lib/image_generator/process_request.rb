class ProcessRequest
  include Mandate

  initialize_with :event, :content

  def call
    # write_output_to_file if output_filepath
    response
  end

  private
  memoize
  def response
    # counts = CountLinesOfCode.(submission).to_json

    {
      statusCode: 200,
      statusDescription: "200 OK",
      headers: { 'Content-Type': 'application/json' },
      isBase64Encoded: false,
      body: url
    }
  end

  def url
    body[:url]
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end
end
