module ImageGenerator::Solutions
    class AppendTrackIcon
      include Mandate

    initialize_with :original_image_path, :solution_data

    def call
      download_track_icon!
      download_exercise_icon!
      download_user_avatar!

      track_icon = ImageProcessing::Vips.
        source(track_icon_path).
        resize_to_fill(400, 400). # Set the size
        call(save: false) * # Create a Vips Image, not a file
        [1, 1, 1, 0.03] # Convert to 10% tranparent

      exercise_icon = ImageProcessing::Vips.
        source(exercise_icon_path).
        resize_to_fill(100, 100). # Set the size
        call(save: false) # Create a Vips Image, not a file

      user_avatar = ImageProcessing::Vips.
        source(user_avatar_path).
        resize_to_fill(100, 100). # Set the size
        call(save: false) # Create a Vips Image, not a file

      ImageProcessing::Vips.
        source(original_image_path).
        composite(track_icon, gravity: "south-east", offset: [60, 225]).
        composite(exercise_icon, gravity: "south-east", offset: [30, 30]).
        composite(user_avatar, gravity: "south-west", offset: [30, 30]).
        call(destination: new_image_path)

      new_image_path
    end

    def download_track_icon!
      File.open(track_icon_path, 'wb') do |fo|
        fo.write(URI.open(solution_data[:track_icon_url]).read)
      end
    end

    def download_exercise_icon!
      File.open(exercise_icon_path, 'wb') do |fo|
        fo.write(URI.open(solution_data[:exercise_icon_url]).read)
      end
    end

    def download_user_avatar!
      File.open(user_avatar_path, 'wb') do |fo|
        fo.write(URI.open(solution_data[:user_avatar_url]).read)
      end
    end

    memoize
    def track_icon_path = "#{ImageGenerator.tmp_dir}/#{SecureRandom.uuid}.svg"

    memoize
    def exercise_icon_path = "#{ImageGenerator.tmp_dir}/#{SecureRandom.uuid}.svg"

    memoize
    def user_avatar_path = "#{ImageGenerator.tmp_dir}/#{SecureRandom.uuid}#{File.extname(solution_data[:user_avatar_url])}"

    memoize
    def new_image_path = "#{ImageGenerator.tmp_dir}/#{SecureRandom.uuid}.png"


#     image_path,
#     pipeline = ImageProcessing::Vips
#       .source(file)
#       .convert("png")

#       large  = pipeline.resize_to_limit!(800, 800)
#       medium = pipeline.resize_to_limit!(500, 500)
#       small  = pipeline.resize_to_limit!(300, 300)
#     end
  end
end
