require "json"
require "mandate"
require "fileutils"
require "./lib/image_generator/process_request"

module ImageGenerator
  def self.process(event:, context:)
    ProcessRequest.(event, context)
  end
end
