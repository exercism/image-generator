# This must happen above the env require below
if ENV["CAPTURE_CODE_COVERAGE"]
  require 'simplecov'
  SimpleCov.start
end

gem 'minitest'

require "minitest/autorun"
require 'minitest/pride'
require "mocha/minitest"
require 'pathname'

class Minitest::Test
  SAFE_WRITE_PATH = Pathname.new('/tmp/output')
  SOLUTION_PATH = Pathname.new('/tmp')
end

$LOAD_PATH.unshift File.expand_path('../lib', __dir__)
require "image_generator"

class Minitest::Test
end
