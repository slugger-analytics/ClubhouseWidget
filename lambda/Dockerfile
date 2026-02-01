FROM public.ecr.aws/lambda/nodejs:20-arm64

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled JavaScript
COPY dist/ ./dist/

# Copy static frontend files
COPY public/ ./public/

# Set the handler
CMD ["dist/index.handler"]
