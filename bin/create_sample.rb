#!/usr/bin/env ruby

code = <<~'CODE'
class TwoFer
  def self.two_fer(name = "you")
    "One for #{name}, one for me."
  end
end
CODE


# require "zeitwerk"
# load File.expand_path('../../lib/image_generator.rb', __FILE__)

require("./lib/image_generator")


ImageGenerator::GenerateCarbon.(code)
