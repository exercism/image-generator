module ImageGenerator
  class GenerateCarbon
    include Mandate

    initialize_with :code

    def call

      Dir.chdir(File.expand_path(File.dirname(__FILE__))) do
      code_filepath = File.expand_path("../../tmp/#{uuid}")
        File.write(code_filepath, code)
        `carbon-now #{code_filepath} #{CARBON_OPTIONS % uuid}`
      end

      uuid
    end

    private
    memoize
    def uuid = SecureRandom.uuid

    CARBON_OPTIONS = [
      "--start 0", # Start line
      "--end 15", # End line
      "--config config.json", # The config file relative to pwd
      "-p dark", # Which preset to use
      "--skip-display", # Don't output to terminal
      "--save-to ../../tmp/", # Directory to save to
      "--save-as %s" # Filename without the extension
    ].join(" ").freeze
    private_constant :CARBON_OPTIONS

  end
end
