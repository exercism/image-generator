source 'https://rubygems.org'

git_source(:github) do |repo_name|
  repo_name = "#{repo_name}/#{repo_name}" unless repo_name.include?('/')
  "https://github.com/#{repo_name}.git"
end

# gem 'json'
# gem 'mandate'
# gem 'rake'
# gem 'rest-client'
# gem 'zeitwerk'
# gem 'exercism-config'
# gem "image_processing", "~> 1.0"
gem 'aws-sdk-lambda'

group :development, :test do
  gem 'sinatra'
end

group :test do
  gem 'minitest'
  gem 'minitest-stub-const'
  gem 'mocha'
  gem 'simplecov', '~> 0.17.0'
  gem 'rubocop', require: false
  gem 'rubocop-minitest', require: false
  gem 'rubocop-performance', require: false
end
