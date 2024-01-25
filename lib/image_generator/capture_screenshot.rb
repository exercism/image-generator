require 'capybara/dsl'
require 'selenium-webdriver'

class ImageGenerator::CaptureScreenshot
  include Mandate

  initialize_with :url do
    @url = Addressable::URI.parse(url).to_s
  end

  def call
    setup_capybara
    take_screenshot!
    crop_screenshot!

    File.read(screenshot_filepath)
  end

  private
  attr_reader :url

  def take_screenshot!
    session = Capybara::Session.new(DRIVER_NAME)
    session.visit(url)

    # Let any JavaScript run - it would be nice to have some completion hook instead
    sleep(1)

    @bounds = session.evaluate_script("document.querySelector('#{selector}').getBoundingClientRect()")
    session.save_screenshot(screenshot_filepath)
    session.quit
  end

  def crop_screenshot!
    crop_arg = "#{@bounds["width"]}x#{@bounds["height"]}+#{@bounds["left"]}+#{@bounds["top"]}"
    p crop_arg
    `convert #{screenshot_filepath} -crop #{crop_arg} #{screenshot_filepath}`
  end

  def setup_capybara
    Capybara.run_server = false
    Capybara.default_max_wait_time = 7

    Capybara.register_driver DRIVER_NAME do |app|
      options = ::Selenium::WebDriver::Chrome::Options.new
      options.add_argument("window-size=1400,1000")
      options.add_argument("headless=new")
      options.add_argument('no-sandbox')
      options.add_argument('--force-device-scale-factor=1')

      Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
    end
  end

  memoize
  def screenshot_filepath = Tempfile.new(['image-generator', '.png']).path
  def selector = "#image-content"

  DRIVER_NAME = :selenium_chrome_headless
end
