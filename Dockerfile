FROM public.ecr.aws/lambda/nodejs:20

# Install packages
COPY package.json package-lock.json ${LAMBDA_TASK_ROOT}
RUN npm install

# Copy function code
COPY index.js satori_renderer.js profile_renderer.js tokenizer.js ${LAMBDA_TASK_ROOT}/
COPY assets ${LAMBDA_TASK_ROOT}/assets
  
# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD ["index.handler"]
