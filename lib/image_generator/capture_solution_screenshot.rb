require 'capybara/dsl'
require 'selenium-webdriver'

module ImageGenerator
  class CaptureSolutionScreenshot
    include Mandate

    initialize_with track_slug: Mandate::NO_DEFAULT, exercise_slug: Mandate::NO_DEFAULT, user_handle: Mandate::NO_DEFAULT

    def call
      CaptureScreenshot.(url)
    end

    private
    def url
      "http://local.exercism.io:3020/images/solutions/#{track_slug}/#{exercise_slug}/#{user_handle}"
    end
  end
end
