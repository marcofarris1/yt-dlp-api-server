FROM node:16-alpine

# Install required dependencies
RUN apk add --no-cache python3 py3-pip ffmpeg

# Install yt-dlp via pip
RUN pip3 install yt-dlp

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