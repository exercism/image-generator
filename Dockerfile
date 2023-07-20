FROM ubuntu:20.04

RUN apt update && \
    apt install --yes curl sudo gcc g++ make && \
    apt autoremove

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
    apt install --yes nodejs && \
    apt autoremove

RUN npm install --global carbon-now-cli

WORKDIR /opt
RUN curl -OL https://github.com/postmodern/ruby-install/releases/download/v0.9.1/ruby-install-0.9.1.tar.gz && \
    tar -xzvf ruby-install-0.9.1.tar.gz && \
    cd ruby-install-0.9.1/ && \
    sudo make install

ARG RUBY_VERSION=3.2.1
RUN ruby-install "${RUBY_VERSION}"
ENV PATH="/opt/rubies/ruby-${RUBY_VERSION}/bin:${PATH}"

RUN gem install json -v '2.3.1' && \
    gem install aws_lambda_ric

WORKDIR /var/task

ARG EXERCISM_ENV production
ENV EXERCISM_ENV $EXERCISM_ENV

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

ENTRYPOINT [ "aws_lambda_ric" ]

CMD [ "lib/image_generator.ImageGenerator:.process_request" ]
