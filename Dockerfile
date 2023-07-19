FROM public.ecr.aws/lambda/ruby:3.2

ARG EXERCISM_ENV production
ENV EXERCISM_ENV $EXERCISM_ENV

RUN yum install -y make gcc gcc-c++ && \
    yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm && \
    yum install -y yum-utils && \
    yum install -y http://rpms.remirepo.net/enterprise/remi-release-7.rpm && \
    yum-config-manager --enable remi && \
    yum install -y vips vips-devel vips-tools

RUN gem install json -v '2.3.1' 

WORKDIR /var/task

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD ["bin/run.run"]
