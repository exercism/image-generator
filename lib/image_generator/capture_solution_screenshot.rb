require 'capybara/dsl'
require 'selenium-webdriver'

module ImageGenerator
  class CaptureSolutionScreenshot
    include Mandate

    def initialize(track_slug, exercise_slug, user_handle)
      @track_slug = track_slug
      @exercise_slug = exercise_slug
      @user_handle = user_handle
    end

    def call
      CaptureScreenshot.(url)
    end

    private
    attr_reader :track_slug, :exercise_slug, :user_handle

    def url
      "https://exercism.org/images/solutions/#{track_slug}/#{exercise_slug}/#{user_handle}"
    end
  end
end
