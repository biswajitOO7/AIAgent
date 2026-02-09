# Use official Node.js image
FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy package dependencies
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Expose port (Hugging Face Spaces uses 7860 by default)
EXPOSE 7860

# Init environment variable for port
ENV PORT=7860

# Start the application
CMD [ "node", "src/server.js" ]
