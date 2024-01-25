#!/usr/bin/env ruby

require("./lib/image_generator")

event = JSON.parse(ARGV[0])
response = ImageGenerator.process(event:, context: {})
puts response.to_json
