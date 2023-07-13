require 'mandate'
require 'json'

require "zeitwerk"
loader = Zeitwerk::Loader.for_gem
loader.setup

module ImageGenerator
  def self.process_request(event:, context:)
    ProcessRequest.(event, context)
  end
end
