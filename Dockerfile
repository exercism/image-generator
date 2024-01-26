FROM amazon/aws-lambda-ruby:2.7

RUN yum install -y make gcc wget unzip libX11 ImageMagick
RUN yum install -y tar xz z pkgconfig libxml2-dev libxslt-dev patch
RUN gem install pkg-config

RUN GOOGLE_CHROME_VERSION=113.0.5672.63 && \
    GOOGLE_CHROME_FILENAME=google-chrome-stable-${GOOGLE_CHROME_VERSION}-1.x86_64.rpm && \
    wget https://dl.google.com/linux/chrome/rpm/stable/x86_64/${GOOGLE_CHROME_FILENAME} && \
    yum install -y ${GOOGLE_CHROME_FILENAME}

RUN GOOGLE_CHROME_VERSION=113.0.5672.63 && \
    wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/$GOOGLE_CHROME_VERSION/chromedriver_linux64.zip && \
    unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

WORKDIR /var/task

RUN gem install bundler -v 2.4.17
RUN gem install json -v 2.3.1
RUN gem install nokogiri -v 1.13.10

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD [ "lib/image_generator.ImageGenerator.process" ]
