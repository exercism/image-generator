require "test_helper"
require 'json'

module ImageGenerator
  class ProcessRequestTest < Minitest::Test
    def test_e2e
      track_slug = 'ruby'
      exercise_slug = 'bob'
      user_handle = 'ihid'

      event = JSON.parse({
        body: {
          type: :solution,
          track_slug:,
          exercise_slug:,
          user_handle:
        }.to_json
      }.to_json)

      ImageGenerator::Solutions::RetrieveSolutionData.expects(:call).with(
        track_slug, exercise_slug, user_handle
      ).returns({
        solution: {}
      })

      sample_path = Dir.chdir(__dir__) do
        File.expand_path("../test/sample.png")
      end
      ImageGenerator::Solutions::AddAnnotations.expects(:call).
        returns(sample_path)

      expected = {
        statusCode: 200,
        statusDescription: "200 OK",
        headers: { 'Content-Type': 'image/png' },
        isBase64Encoded: false,
        body: File.read(sample_path)
      }
      assert_equal expected, ProcessRequest.(event, {})
    end
  end
end
