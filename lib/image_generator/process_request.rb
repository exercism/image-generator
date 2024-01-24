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
      body: 'hello'
    }
  end

  def submission
    puts event
    puts body[:submission_uuid]
    puts body[:submission_filepaths]
    puts body[:track_slug]
    puts content
    Submission.new(body[:submission_uuid], body[:submission_filepaths], body[:track_slug])
  end

  def write_output_to_file
    File.write(output_filepath, response.to_json)
  end

  def output_filepath
    return if body[:output_dir].nil?

    "#{body[:output_dir]}/response.json"
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end
end
