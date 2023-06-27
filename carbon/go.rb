
sample_code = <<~'CODE'
class TwoFer
  def self.two_fer(name = "you")
    "One for #{name}, one for me."
  end
end
CODE

# Relative to pwd
code_filepath = '../tmp/sample.js'

options = [
  "--start 0", # Start line
  "--end 15", # End line
  "--config config.json", # The config file relative to pwd
  "-p dark", # Which preset to use
  "--skip-display", # Don't output to terminal
  "--save-to tmp/", # Directory to save to
  "--save-as sample" # Filename without the extension
]

File.write(code_filepath, sample_code)

`carbon-now #{code_filepath} #{options.join(" ")}`
