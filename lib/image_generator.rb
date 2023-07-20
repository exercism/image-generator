require 'mandate'
require 'json'
require 'rest-client'
require "open-uri"
require 'exercism-config'
require "image_processing/vips"

require "zeitwerk"
loader = Zeitwerk::Loader.for_gem
loader.setup

require 'aws_lambda_ric'
require 'io/console'
require 'stringio'

module AwsLambdaRuntimeInterfaceClient
  class LambdaRunner

    def send_error_response(lambda_invocation, err, exit_code = nil, runtime_loop_active = true)
      error_object = err.to_lambda_response
      @lambda_server.send_error_response(
        request_id: lambda_invocation.request_id,
        error_object: error_object,
        error: err,
        xray_cause: XRayCause.new(error_object).as_json
      )

      @exit_code = exit_code unless exit_code.nil?
      @runtime_loop_active = runtime_loop_active
    end
  end
end

module ImageGenerator
  def self.process_request(event:, context:)
    'HIHI'
    # ProcessRequest.(event, context)
  end

  def self.tmp_dir
    @tmp_dir ||= Dir.chdir(File.expand_path(File.dirname(__FILE__))) do
      File.expand_path("../tmp")
    end
  end
end
