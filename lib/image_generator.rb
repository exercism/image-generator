require 'mandate'
require 'json'
require 'rest-client'
require "open-uri"
require 'exercism-config'
require "image_processing/vips"

require "zeitwerk"
loader = Zeitwerk::Loader.for_gem
loader.setup

module ImageGenerator
  def self.process_request(event:, context:)
    ProcessRequest.(event, context)
  end

  def self.tmp_dir
    @tmp_dir ||= Dir.chdir(File.expand_path(File.dirname(__FILE__))) do
      File.expand_path("../tmp")
    end
  end
end
