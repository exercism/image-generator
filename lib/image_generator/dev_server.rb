$stdout.sync = true
$stderr.sync = true

require 'sinatra/base'
require 'sinatra/json'

module ImageGenerator
  class DevServer < Sinatra::Base
    # Ping check for ELBs
    get '/solutions/:track_slug/:exercise_slug/:user_handle' do
      event = {
        'body' => {
          track_slug: params[:track_slug],
          exercise_slug: params[:exercise_slug],
          user_handle: params[:user_handle]
        }.to_json
      }
      resp = ProcessRequest.(event, nil)

      resp[:headers].each do |k,v|
        response.headers[k.to_s] = v
      end
      status resp[:statusCode]
      body resp[:body]
    end
  end
end
