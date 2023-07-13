require "test_helper"
require 'json'

module ImageGenerator
  class ProcessRequestTest < Minitest::Test
    def test_e2e
      code = <<~CODE.strip
        # This is a file
        Some code
      CODE

      event = JSON.parse({
        body: {
          language: :ruby,
          code: code
        }.to_json
      }.to_json)

      expected = {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'text/plain' },
        isBase64Encoded: false,
        body: "foobar"
      }
      assert_equal expected, ProcessRequest.(event, {})
    end
  end
end
