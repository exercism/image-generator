$stdout.sync = true
$stderr.sync = true

require 'sinatra/base'
require 'sinatra/json'

module ImageGenerator
  class DevServer < Sinatra::Base
    # Ping check for ELBs
    get '/generate_image' do
      event = {
        'rawPath' => "/tracks/#{params[:track_slug]}/exercises/#{params[:exercise_slug]}/solutions/#{params[:user_handle]}.png"
      }
      resp = ProcessRequest.(event, nil)

      resp[:headers].each do |k,v|
        response.headers[k.to_s] = v
      end
      status resp[:statusCode]
      body Base64.decode64(resp[:body])
    end
  end
end
