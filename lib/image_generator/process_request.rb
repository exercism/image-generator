require 'capybara/dsl'
require 'selenium-webdriver'

class ProcessRequest
  include Mandate

  initialize_with :event, :content

  def call
    setup_capybara
    take_screenshot
    crop_screenshot
    response
  end

  private
  def response
    {
      statusCode: 200,
      statusDescription: "200 OK",
      headers: { 'Content-Type': 'application/json' },
      isBase64Encoded: true,
      body: Base64.encode64(screenshot)
    }
  end

  def screenshot
    File.read(screenshot_file)
  end

  def take_screenshot
    session = Capybara::Session.new(DRIVER_NAME)
    session.visit(url.to_s)
    # TODO: parameterize selector
    @bounds = session.evaluate_script('document.querySelector(".c-perk").getBoundingClientRect()')
    session.save_screenshot(screenshot_file)
    session.quit
  end

  def crop_screenshot
    crop_arg = "#{@bounds["width"]}x#{@bounds["height"]}+#{@bounds["left"]}+#{@bounds["top"]}"    
    `convert #{screenshot_file} -crop #{crop_arg} #{screenshot_file}`
  end

  def setup_capybara
    Capybara.run_server = false
    Capybara.default_max_wait_time = 7
    
    Capybara.register_driver DRIVER_NAME do |app|
      options = ::Selenium::WebDriver::Chrome::Options.new
      options.add_argument("window-size=1400,1000")
      options.add_argument("headless=new")
      options.add_argument('no-sandbox')
  
      Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
    end
  end

  def url
    Addressable::URI.parse(body[:url])
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end

  memoize
  def screenshot_file
    Tempfile.new('image-generator').path
  end

  DRIVER_NAME = :selenium_chrome_headless
end
