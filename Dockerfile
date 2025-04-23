FROM node:16-slim

# Install required dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Make install script executable
RUN chmod +x ./install-yt-dlp.sh
RUN ./install-yt-dlp.sh

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]