FROM public.ecr.aws/lambda/nodejs:20

# Install packages
COPY package.json package-lock.json ${LAMBDA_TASK_ROOT}
RUN npm install

# Copy function code. A glob rather than a list of modules: twice now, adding a
# module and forgetting to name it here has shipped a container that fails on
# every invocation. .dockerignore keeps the tests and dev scripts out.
COPY *.js ${LAMBDA_TASK_ROOT}/
COPY assets ${LAMBDA_TASK_ROOT}/assets
  
# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD ["index.handler"]
