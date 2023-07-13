require "zeitwerk"
load File.expand_path('../../lib/snippet_extractor.rb', __FILE__)

def run(event:, context:)
  SnippetExtractor.process_request(event: event, context: context)
end
