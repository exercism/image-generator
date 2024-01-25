require 'capybara/dsl'
require 'selenium-webdriver'

module ImageGenerator
  class CaptureScreenshot
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
      width = @bounds["width"].to_f * SCALE_FACTOR
      height = @bounds["height"].to_f * SCALE_FACTOR
      left = @bounds["left"].to_f * SCALE_FACTOR
      top = @bounds["top"].to_f * SCALE_FACTOR

      crop_arg = "#{width}x#{height}+#{left}+#{top}"
      `convert #{screenshot_filepath} -crop #{crop_arg} -quality 85 #{screenshot_filepath}`
    end

    def setup_capybara
      Capybara.run_server = false
      Capybara.default_max_wait_time = 7

      Selenium::WebDriver.logger.level = :debug

      Capybara.register_driver DRIVER_NAME do |app|
        options = ::Selenium::WebDriver::Chrome::Options.new

        options.add_argument("--window-size=1400,1000")
        options.add_argument("--force-device-scale-factor=#{SCALE_FACTOR}")
        options.add_argument('--hide-scrollbars')
        options.add_argument("--headless=new")

        # Useful for debugging
        options.add_argument('--enable-logging')
        options.add_argument('--log-level=0')

        # # Needed for docker
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')

        # Needed for readonly FS (e.g. Lambda)
        options.add_argument('--user-data-dir=/tmp/user-data')
        options.add_argument('--data-path=/tmp/data-path')
        options.add_argument('--homedir=/tmp')
        options.add_argument('--disk-cache-dir=/tmp/cache-dir')

        # Maybe useful - keep around in case
        options.add_argument('--single-process')
        options.add_argument('--disable-gpu')
        options.add_argument("--disable-dev-tools")
        options.add_argument("--no-zygote")
        options.add_argument("--remote-debugging-port=9222")
        # options.add_argument('--v=99')
        # options.add_argument('--ignore-certificate-errors')

        Capybara::Selenium::Driver.new(
          app, 
                                       browser: :chrome, 
    # service: ::Selenium::WebDriver::Service.chrome(path: '/opt/google/chrome/chrome'),
                                       options: options
        )
      end
    end

    memoize
    # Only /tmp is writeable on AWS Lambda
    def screenshot_filepath
      Tempfile.new(['image-generator', '.jpg'], '/tmp').path
    end

    def selector 
      "#image-content"
    end

    DRIVER_NAME = :selenium_chrome_headless
    SCALE_FACTOR = 2
  end
end
