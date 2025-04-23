# yt-dlp-api-server 
# YouTube/Instagram Audio Extractor API

A simple API server that extracts audio from YouTube and Instagram videos using yt-dlp.

## Features

- Extract MP3 audio from YouTube videos and shorts
- Extract MP3 audio from Instagram posts and reels
- Secure API key authentication
- Returns base64-encoded audio data

## Setup

1. Clone this repository
2. Deploy to Render.com or your preferred hosting
3. Set your API_KEY environment variable
4. Use the API in your applications

## API Usage

```bash
curl -X POST \
  https://your-api-url.com/extract-audio \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-api-key' \
  -d '{"videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
  