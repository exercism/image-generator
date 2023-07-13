source 'https://rubygems.org'

git_source(:github) do |repo_name|
  repo_name = "#{repo_name}/#{repo_name}" unless repo_name.include?('/')
  "https://github.com/#{repo_name}.git"
end

gem 'json'
gem 'mandate'
gem 'rake'
gem 'zeitwerk'

group :test do
  gem 'minitest', '~> 5.10', '!= 5.10.2'
  gem 'minitest-stub-const'
  gem 'mocha'
  gem 'simplecov', '~> 0.17.0'
  gem 'rubocop', require: false
  gem 'rubocop-minitest', require: false
  gem 'rubocop-performance', require: false
end
