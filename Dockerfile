FROM public.ecr.aws/lambda/ruby:3.2

RUN yum install -y make gcc gcc-c++

WORKDIR /var/task

RUN gem install json -v '2.3.1' 

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD ["bin/run.run"]
