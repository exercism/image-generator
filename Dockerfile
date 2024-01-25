FROM amazon/aws-lambda-ruby:2.7

RUN yum install -y make gcc wget unzip libX11 ImageMagick

RUN GOOGLE_CHROME_VERSION=114.0.5735.198 && \
    GOOGLE_CHROME_FILENAME=google-chrome-stable-${GOOGLE_CHROME_VERSION}-1.x86_64.rpm && \
    wget https://dl.google.com/linux/chrome/rpm/stable/x86_64/${GOOGLE_CHROME_FILENAME} && \
    yum install -y ${GOOGLE_CHROME_FILENAME}

RUN CHROME_DRIVER_VERSION=`curl -sS https://chromedriver.storage.googleapis.com/LATEST_RELEASE` && \
    wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/$CHROME_DRIVER_VERSION/chromedriver_linux64.zip && \
    unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

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
