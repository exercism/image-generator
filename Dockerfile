FROM amazon/aws-lambda-ruby

RUN yum install -y make gcc

WORKDIR /var/task

RUN gem install json -v '2.3.1' 

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD ["bin/run.run"]
