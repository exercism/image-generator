module ImageGenerator
  module Solutions
    class RetrieveSolutionData
      include Mandate

      initialize_with :track_slug, :exercise_slug, :user_handle

      def call
        resp = RestClient.get(url)
        body = JSON.parse(resp.body, symbolize_names: true)
        body[:solution]

        # TODO: Rescue a 404 or 500 and raise a custom exception
        # TODO: Raise a 404 if the solution is blank
        # TODO: Raise a 404 if the snippet is blank
      end

      memoize
      def url = "http://host.docker.internal:3020/spi/solution_image_data/#{track_slug}/#{exercise_slug}/#{user_handle}"

      def spi_url = Exercism.config.spi_url
    end
  end
end

