FROM node:16-slim

# Install required dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    ffmpeg \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install yt-dlp directly (more reliable than the script)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Set up environment
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]