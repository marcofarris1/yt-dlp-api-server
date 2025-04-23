FROM node:16

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using pip
RUN pip3 install yt-dlp

WORKDIR /app

# Copy package.json and remove the postinstall script
COPY package.json ./
RUN sed -i '/postinstall/d' package.json

# Install dependencies
RUN npm install

# Copy source code
COPY server.js ./

# Set up environment
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]