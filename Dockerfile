FROM ruby:3.2

# Install the runtime interface client for Ruby
RUN gem install aws_lambda_ric

# Add the runtime interface client to the PATH
ENV PATH="/usr/local/bundle/bin:${PATH}"

WORKDIR /var/task

COPY Gemfile Gemfile.lock ./

RUN gem install bundler && \
    bundle install --path vendor/bundle

COPY . .

ENTRYPOINT [ "aws_lambda_ric" ]

CMD [ "lib/lambda_function.LambdaFunction::Handler.process" ]
