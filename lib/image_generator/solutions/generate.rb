module ImageGenerator
  module Solutions
    class Generate
      include Mandate

      initialize_with :track_slug, :exercise_slug, :user_handle

      def call
        # TODO: Verify track slug, exercise slug and user handle are all sensible length strings

        p 'Getting solution'
        solution_data = RetrieveSolutionData.(track_slug, exercise_slug, user_handle)
        p 'Doing carbon'
        image_path = GenerateCarbon.(
          solution_data[:snippet],
          solution_data[:extension]
        )
        p 'Adding annotations'
        image_path = AddAnnotations.(image_path, solution_data)

        # TODO: Create and merge an extra image for the titles etc

        # TODO: Raise a 500 if the carbon image is missing
        # TODO: Catch custom exception from retrieving snippet
        #       and raise some exception that process request returns as a 500
        #       or a 404 (depending on why we can't retrieve stuff).

        p 'Ready to go'
        File.read(image_path)
      end
    end
  end
end
