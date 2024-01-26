require "json"
require "mandate"
require "fileutils"
require 'base64'

require 'zeitwerk'
loader = Zeitwerk::Loader.for_gem
loader.setup

module ImageGenerator
  def self.process(event:, context:)
    ProcessRequest.(event, context)
  rescue => e
    { error: e }
  end
end
