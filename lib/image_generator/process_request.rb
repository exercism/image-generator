require 'capybara/dsl'
require 'selenium-webdriver'

class ProcessRequest
  include Mandate

  initialize_with :event, :content

  def call
    Capybara.run_server = false
    Capybara.default_max_wait_time = 7
    
    Capybara.register_driver :selenium_chrome_headless do |app|
      options = ::Selenium::WebDriver::Chrome::Options.new
      options.add_argument("window-size=1400,1000")
      options.add_argument("headless=new")
      options.add_argument('no-sandbox')
  
      Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
    end

    image_file = Tempfile.new('image-generator')

    session = Capybara::Session.new(:selenium_chrome_headless)
    session.visit(url.to_s)
    session.save_screenshot(image_file.path)

    {
      statusCode: 200,
      statusDescription: "200 OK",
      headers: { 'Content-Type': 'application/json' },
      isBase64Encoded: true,
      body: Base64.encode64(File.read(image_file.path))
    }
  end

  private
  def url
    Addressable::URI.parse(body[:url])
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end
end
