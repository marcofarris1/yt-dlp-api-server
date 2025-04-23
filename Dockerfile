FROM node:16-bullseye

# Install required dependencies with Python 3.9+
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Verify Python version
RUN python3 --version

WORKDIR /app

# Install yt-dlp using pip (more reliable method)
RUN pip3 install yt-dlp

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Update the server.js to use the correct yt-dlp path
RUN sed -i 's/\.\/yt-dlp/yt-dlp/g' server.js

# Set up environment
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]