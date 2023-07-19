require "zeitwerk"
load File.expand_path('../../lib/image_generator.rb', __FILE__)

def run(event:, context:)
  ImageGenerator.process_request(event: event, context: context)
end
