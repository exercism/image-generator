# Exercism Image Generator

## Setup
```bash
npm i -g carbon-now-cli
bundle install
```

## Run the tests
```bash
bundle exec rake test
```

## Generate an image locally

Start the webserver:
```bash
./bin/dev
```

Then (with params matching your website setup):
```bash
http://local.exercism.io:3024/generate_image?type=solution&track_slug=ruby&exercise_slug=gigasecond&user_handle=iHiD
```


