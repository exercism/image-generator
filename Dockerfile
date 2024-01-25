FROM amazon/aws-lambda-ruby:3.2

RUN yum install -y make gcc wget unzip libX11 ImageMagick
RUN yum install -y tar xz z pkgconfig libxml2-dev libxslt-dev patch
RUN gem install pkg-config

# RUN GOOGLE_CHROME_VERSION=114.0.5735.198 && \
#     GOOGLE_CHROME_FILENAME=google-chrome-stable-${GOOGLE_CHROME_VERSION}-1.x86_64.rpm && \
#     wget https://dl.google.com/linux/chrome/rpm/stable/x86_64/${GOOGLE_CHROME_FILENAME} && \
#     yum install -y ${GOOGLE_CHROME_FILENAME}

# RUN CHROME_DRIVER_VERSION=`curl -sS https://chromedriver.storage.googleapis.com/LATEST_RELEASE` && \
#     wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/$CHROME_DRIVER_VERSION/chromedriver_linux64.zip && \
#     unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

RUN curl -Lo "/tmp/chromedriver-linux64.zip" "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/121.0.6167.85/linux64/chromedriver-linux64.zip" && \
    curl -Lo "/tmp/chrome-linux64.zip" "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/121.0.6167.85/linux64/chrome-linux64.zip" && \
    unzip /tmp/chromedriver-linux64.zip -d /usr/local/bin && \
    unzip /tmp/chrome-linux64.zip -d /usr/local/bin

WORKDIR /var/task

RUN gem install bundler -v 2.4.17
RUN gem install json -v 2.7.1
RUN gem install nokogiri -v 1.16.0

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD [ "lib/image_generator.ImageGenerator.process" ]
