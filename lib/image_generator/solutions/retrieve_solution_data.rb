module ImageGenerator
  module Solutions
    class RetrieveSolutionData
      include Mandate

      initialize_with :track_slug, :exercise_slug, :user_handle

      def call
        p "Retrieving"
        p url
        resp = RestClient.get(url)
        body = JSON.parse(resp.body, symbolize_names: true)
        p "Retrieved"
        p body
        body[:solution]

        # TODO: Rescue a 404 or 500 and raise a custom exception
        # TODO: Raise a 404 if the solution is blank
        # TODO: Raise a 404 if the snippet is blank
      end

      memoize
      def url = "http://#{spi_url}/spi/solution_image_data/#{track_slug}/#{exercise_slug}/#{user_handle}"

      def spi_url = ENV.fetch('SPI_URL', Exercism.config.spi_url)
    end
  end
end

