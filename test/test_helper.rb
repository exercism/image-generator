# Always run in test mode
ENV["EXERCISM_ENV"] = "test"

gem 'minitest'

require "minitest/autorun"
require 'minitest/pride'
require "mocha/minitest"
require 'pathname'

$LOAD_PATH.unshift File.expand_path('../lib', __dir__)
require "image_generator"

module Minitest
  class Test
  end
end
