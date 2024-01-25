FROM amazon/aws-lambda-ruby:3.2

RUN yum install -y make gcc wget unzip libX11 ImageMagick

RUN GOOGLE_CHROME_VERSION=114.0.5735.198 && \
    GOOGLE_CHROME_FILENAME=google-chrome-stable-${GOOGLE_CHROME_VERSION}-1.x86_64.rpm && \
    wget https://dl.google.com/linux/chrome/rpm/stable/x86_64/${GOOGLE_CHROME_FILENAME} && \
    yum install -y ${GOOGLE_CHROME_FILENAME}

RUN CHROME_DRIVER_VERSION=`curl -sS https://chromedriver.storage.googleapis.com/LATEST_RELEASE` && \
    wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/$CHROME_DRIVER_VERSION/chromedriver_linux64.zip && \
    unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

WORKDIR /var/task

# Pre-install JSON as it is slow to install
RUN gem install json -v '2.3.1'

# Pre-install nokogiri and all its dependencies
RUN yum install -y tar xz z pkgconfig libxml2-dev libxslt-dev patch
RUN gem install pkg-config
RUN gem install nokogiri -v '1.13.10'
  #-- \
  # --with-xml2-dir=/usr/include/libxml2 \
  # --with-xslt-dir=/usr/include/libxslt

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

CMD [ "lib/image_generator.ImageGenerator.process" ]
