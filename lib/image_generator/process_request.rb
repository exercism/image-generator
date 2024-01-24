require 'capybara/dsl'
require 'selenium-webdriver'

class ProcessRequest
  include Mandate

  initialize_with :event, :content

  def call
    # write_output_to_file if output_filepath
    response
  end

  private
  memoize
  def response
    Capybara.app_host = "#{url.scheme}://#{url.host}"
    Capybara.run_server = false
    Capybara.use_default_driver
    
    Capybara.register_driver :selenium_chrome_headless do |app|
      options = ::Selenium::WebDriver::Chrome::Options.new(args: %w[headless window-size=1400,1000])
  
      options.add_argument("headless=new")
  
      # Specify the download directory to allow retrieving files in system tests
      # options.add_preference("download.default_directory", TestHelpers.download_dir.to_s)
  
      # Without this argument, Chrome cannot be started in Docker
      options.add_argument('no-sandbox')
  
      Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
    end

    session = Capybara::Session.new(:selenium_chrome_headless)
    session.visit(url.path)

    {
      statusCode: 200,
      statusDescription: "200 OK",
      headers: { 'Content-Type': 'application/json' },
      isBase64Encoded: false,
      body: "url: #{url}"
    }
  end

  def url
    Addressable::URI.parse(body[:url])
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end
end
