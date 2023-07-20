FROM ruby:3.2

RUN apt update && apt install -y libvips42

# Install the runtime interface client for Ruby
RUN gem install aws_lambda_ric

# Add the runtime interface client to the PATH
ENV PATH="/usr/local/bundle/bin:${PATH}"

ENV RAILS_ENV=production

WORKDIR /var/task

COPY Gemfile Gemfile.lock ./

RUN gem install bundler && \
    bundle install --path vendor/bundle

COPY . .

ENTRYPOINT [ "aws_lambda_ric" ]

CMD [ "lib/image_generator.ImageGenerator.process_request" ]
