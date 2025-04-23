#!/bin/bash
# Download yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
# Make it executable
chmod a+rx yt-dlp
# Test that it works
./yt-dlp --version