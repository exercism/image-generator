module ImageGenerator::Solutions
  class GenerateCarbon
    include Mandate

    initialize_with :code, :file_extension

    # This should return the absolute path to the generated carbon image
    def call
      within_file_directory do
        root_filepath = File.expand_path("#{ImageGenerator.tmp_dir}/#{uuid}")
        code_filepath = "#{root_filepath}#{file_extension}"
        File.write(code_filepath, code)
        `carbon-now #{code_filepath} #{CARBON_OPTIONS % uuid}`

        "#{root_filepath}.png"
      end
    end

    private
    memoize
    def uuid = SecureRandom.uuid

    def within_file_directory(&block)
      Dir.chdir(File.expand_path(File.dirname(__FILE__)), &block)
    end

    CARBON_OPTIONS = [
      "--start 0", # Start line
      "--end 15", # End line
      "--config carbon_config.json", # The config file relative to pwd
      "-p dark", # Which preset to use
      "--skip-display", # Don't output to terminal
      "--save-to #{ImageGenerator.tmp_dir}", # Directory to save to
      "--save-as %s" # Filename without the extension
    ].join(" ").freeze
    private_constant :CARBON_OPTIONS

  end
end
