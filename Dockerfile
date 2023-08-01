FROM ubuntu:22.04

RUN apt update && \
    apt install --yes curl sudo gcc g++ make && \
    apt autoremove

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
    apt install --yes nodejs && \
    apt autoremove

RUN apt remove libvips42
RUN apt-get install -y software-properties-common
# RUN add-apt-repository ppa:lovell/cgif
# RUN apt-get install -y libcgif-dev

RUN apt install -y \
    build-essential \
    ninja-build \
    python3-pip \
    bc \
    wget
RUN pip3 install meson

RUN apt install -y \
    libfftw3-dev \
    libopenexr-dev \
    libgsf-1-dev \
    libglib2.0-dev \
    liborc-dev \
    libopenslide-dev \
    libmatio-dev \
    libwebp-dev \
    libjpeg-turbo8-dev \
    libexpat1-dev \
    libexif-dev \
    libtiff5-dev \
    libcfitsio-dev \
    libpoppler-glib-dev \
    librsvg2-dev \
    libpango1.0-dev \
    libopenjp2-7-dev \
    libimagequant-dev

RUN wget https://github.com/libvips/libvips/releases/download/v8.13.3/vips-8.13.3.tar.gz && \
    tar xf vips-8.13.3.tar.gz && \
    cd vips-8.13.3 && \
    meson build --libdir=lib --buildtype=release -Dintrospection=false && \
    cd build && \
    meson compile && \
    meson test && \
    sudo meson install

RUN npm install --global carbon-now-cli

WORKDIR /opt
RUN curl -OL https://github.com/postmodern/ruby-install/releases/download/v0.9.1/ruby-install-0.9.1.tar.gz && \
    tar -xzvf ruby-install-0.9.1.tar.gz && \
    cd ruby-install-0.9.1/ && \
    sudo make install

ARG RUBY_VERSION=3.2.1
ENV RAILS_ENV=production
RUN ruby-install "${RUBY_VERSION}"
ENV PATH="/opt/rubies/ruby-${RUBY_VERSION}/bin:${PATH}"

RUN gem install bundler && \
    gem install aws_lambda_ric
ENV PATH="/usr/local/bundle/bin:${PATH}"

WORKDIR /var/task

COPY Gemfile Gemfile.lock ./

RUN bundle config set deployment 'true' && \
    bundle config set without 'development test' && \
    bundle install

COPY . .

ENV EXERCISM_ENV=production

ENTRYPOINT ["aws_lambda_ric"]

CMD ["lib/image_generator.ImageGenerator.process_request"]
