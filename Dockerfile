FROM amazon/aws-lambda-ruby:2.7

RUN yum install -y make gcc

WORKDIR /var/task

# Pre-install these packages as they are slow to install
# and this way we can leverage Docker layer caching
RUN gem install json -v '2.3.1' && \
    gem install nokogiri -v '1.13.10'

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD [ "lib/image_generator.ImageGenerator.process" ]
