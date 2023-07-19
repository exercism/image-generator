module ImageGenerator::Solutions
    class AddAnnotations
      include Mandate

    initialize_with :carbon_image_path, :solution_data

    def call
      download_track_icon!
      download_exercise_icon!
      download_user_avatar!

      carbon_image = Vips::Image.new_from_file(carbon_image_path)

      track_icon = ImageProcessing::Vips.
        source(track_icon_path).
        resize_to_fill(400, 400). # Set the size
        call(save: false) * # Create a Vips Image, not a file
        [1, 1, 1, 0.07] # Convert to 10% tranparent

      exercise_icon = ImageProcessing::Vips.
        source(exercise_icon_path).
        resize_to_fill(100, 100). # Set the size
        call(save: false) # Create a Vips Image, not a file

      user_avatar = ImageProcessing::Vips.
        source(user_avatar_path).
        resize_to_fill(100, 100). # Set the size
        call(save: false) # Create a Vips Image, not a file

      text = [
        '<span foreground="white">',
        'Check out ',
        %q{<span underline="single">@erikschierboom's</span>},
        ' solution to ',
        '<span underline="single">Bob</span>',
        ' in ',
        '<span underline="single">Ruby</span>',
        ' on ',
        'Exercism!',
        '</span>'
      ].join("")
      text_image = Vips::Image.text( text,
                                    font: "Poppins 38",
                                    spacing: 0,
                                    width: 800, justify: false, rgba: true, align: :centre)

      inset_x = 60
      inset_y = 40
      crop_offset = 140
      ImageProcessing::Vips.
        source(carbon_image).
        crop(0, crop_offset, carbon_image.width, carbon_image.height - crop_offset).
        composite(track_icon, gravity: "south-east", offset: [60, 220]).
        composite(exercise_icon, gravity: "south-east", offset: [inset_x, inset_y]).
        composite(user_avatar, gravity: "south-west", offset: [inset_x, inset_y]).
        composite(
          text_image,
          x: (carbon_image.width / 2.0) - (text_image.width / 2.0),
          y: carbon_image.height - crop_offset - text_image.height - inset_y
        ).
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
