FROM public.ecr.aws/lambda/nodejs:20

# Install packages
COPY package.json package-lock.json ${LAMBDA_TASK_ROOT}
RUN npm install

# Copy function code
COPY index.js ${LAMBDA_TASK_ROOT}
  
# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD ["index.handler"]
