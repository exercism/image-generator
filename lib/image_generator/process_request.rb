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
    session = Capybara::Session.new(:headless_chrome)
    session.visit(url.to_s)
    @bounds = session.evaluate_script("document.querySelector('#{selector}').getBoundingClientRect()")
    session.save_screenshot(screenshot_file)
    session.quit
  end

  def crop_screenshot
    crop_arg = "#{@bounds["width"]}x#{@bounds["height"]}+#{@bounds["left"]}+#{@bounds["top"]}"
    `convert #{screenshot_file} -crop #{crop_arg} #{screenshot_file}`
  end

  def setup_capybara
    # Capybara.run_server = false
    # Capybara.default_max_wait_time = 7

    # Capybara.register_driver DRIVER_NAME do |app|
    #   options = ::Selenium::WebDriver::Chrome::Options.new
    #   options.add_argument("window-size=1400,1000")
    #   options.add_argument("headless")
    #   options.add_argument('no-sandbox')
    #   options.add_argument('disable-dev-shm-usage')
    #   options.add_argument('single-process')
    #   options.add_argument('disable-gpu')
    #   options.add_argument('enable-features=NetworkService,NetworkServiceInProcess')
    #   options.add_argument('user-data-dir=/tmp/user-data')
    #   options.add_argument('data-path=/tmp/data-path')
    #   options.add_argument('homedir=/tmp')
    #   options.add_argument('disk-cache-dir=/tmp/cache-dir')

    #   Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
    # end


    Capybara.register_driver DRIVER_NAME do |app|
      caps = ::Selenium::WebDriver::Remote::Capabilities.chrome(
        "goog:chromeOptions": {
          args: CHROMIUM_ARGS
        }
      )

      Capybara::Selenium::Driver.new(app,
                                     browser: :chrome,
                                     capabilities: caps)
    end

    Capybara.default_driver = DRIVER_NAME
    Capybara.javascript_driver = DRIVER_NAME
    Capybara::Session.new DRIVER_NAME
  end

  def url
    Addressable::URI.parse(body[:url])
  end

  def selector
    body[:selector]
  end

  memoize
  def body
    JSON.parse(event["body"], symbolize_names: true)
  end

  memoize
  def screenshot_file
    Tempfile.new('image-generator').path
  end

  DRIVER_NAME = :headless_chrome

  CHROMIUM_ARGS = %w[headless
                 enable-features=NetworkService,NetworkServiceInProcess
                 no-sandbox
                 disable-dev-shm-usage
                 disable-gpu]
end
