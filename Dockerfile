FROM node:16-alpine

# Install required dependencies
RUN apk add --no-cache python3 py3-pip ffmpeg curl

# Install the latest yt-dlp directly from GitHub
RUN pip3 uninstall -y yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy only what we need
COPY package.json .
COPY server.js .

# Install Node.js dependencies
RUN npm install --production

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]