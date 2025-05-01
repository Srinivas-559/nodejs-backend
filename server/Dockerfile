# server/Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire project
COPY . .

# Expose the port
EXPOSE 5001

# Start the app
CMD ["node", "index.js"]
