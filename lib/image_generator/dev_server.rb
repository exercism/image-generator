$stdout.sync = true
$stderr.sync = true

require 'sinatra/base'
require 'sinatra/json'

module ImageGenerator
  class DevServer < Sinatra::Base
    # http://localhost:3024/generate_image?track_slug=ruby&exercise_slug=two-fer&user_handle=erikschierboom
    get '/generate_image' do
      event = {
        'rawPath' => "/tracks/#{params[:track_slug]}/exercises/#{params[:exercise_slug]}/solutions/#{params[:user_handle]}.jpg"
      }
      resp = ProcessRequest.(event, nil)

      resp[:headers].each do |k, v|
        response.headers[k.to_s] = v
      end
      status resp[:statusCode]
      body Base64.decode64(resp[:body])
    end
  end
end
