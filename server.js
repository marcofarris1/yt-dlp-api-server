require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const app = express();
const port = process.env.PORT || 3000;

// Set up CORS and JSON parsing
app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({extended: true, limit: '50mb'}));

// Set up authentication
const API_KEY = process.env.API_KEY || 'your-default-secret-key';

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('YT-DLP API is running');
});

// Endpoint to provide instructions for workaround
app.get('/instructions', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>YouTube Audio Extraction Workaround</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .step { margin-bottom: 20px; }
        .note { background: #ffffcc; padding: 10px; border-left: 4px solid #ffcc00; }
      </style>
    </head>
    <body>
      <h1>YouTube Audio Extraction Workaround</h1>
      
      <div class="note">
        <p><strong>Why this is needed:</strong> YouTube blocks server-based extraction attempts, but allows browser-based extraction.</p>
      </div>
      
      <h2>How to Extract Audio from YouTube:</h2>
      
      <div class="step">
        <h3>Step 1: Visit the yt-dlp Web Interface</h3>
        <p>Go to <a href="https://www.yt-dlp.org/browsers/" target="_blank">https://www.yt-dlp.org/browsers/</a></p>
      </div>
      
      <div class="step">
        <h3>Step 2: Extract Audio</h3>
        <p>Enter your YouTube URL followed by command options:</p>
        <pre>https://www.youtube.com/watch?v=YOUR_VIDEO_ID -x --audio-format mp3</pre>
        <p>Click "Run" and wait for the download to complete</p>
      </div>
      
      <div class="step">
        <h3>Step 3: Upload the MP3 to this API</h3>
        <p>After downloading the MP3, send it to this API:</p>
        <pre>POST https://yt-dlp-api-server.onrender.com/upload-audio
Headers:
  X-API-Key: ${API_KEY}
  Content-Type: multipart/form-data

Form data:
  file: [your downloaded MP3 file]</pre>
      </div>
      
      <div class="step">
        <h3>Step 4: Get Base64 Audio Data</h3>
        <p>The API will return the base64-encoded audio data that you can use in your workflow.</p>
      </div>
      
      <h2>Alternative: Direct Base64 Upload</h2>
      <p>If you already have the audio file as base64, you can send it directly:</p>
      <pre>POST https://yt-dlp-api-server.onrender.com/base64-audio
Headers:
  X-API-Key: ${API_KEY}
  Content-Type: application/json

Body:
{
  "filename": "audio.mp3",
  "base64Data": "YOUR_BASE64_ENCODED_AUDIO"
}</pre>
    </body>
    </html>
  `;
  res.send(html);
});

// Endpoint to receive file uploads
app.post('/upload-audio', (req, res) => {
  // Verify API key
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if we have a file
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  
  const uploadedFile = req.files.file;
  const base64Data = uploadedFile.data.toString('base64');
  
  return res.json({
    success: true,
    filename: uploadedFile.name,
    audioBase64: base64Data,
    message: 'Audio upload successful'
  });
});

// Endpoint to receive base64 data directly
app.post('/base64-audio', (req, res) => {
  // Verify API key
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { filename, base64Data } = req.body;
  
  if (!filename || !base64Data) {
    return res.status(400).json({ error: 'Missing filename or base64Data' });
  }
  
  return res.json({
    success: true,
    filename: filename,
    audioBase64: base64Data,
    message: 'Base64 audio received successfully'
  });
});

// Keep the extract-audio endpoint for backwards compatibility
// but now it provides helpful error message
app.post('/extract-audio', (req, res) => {
  // Verify API key
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'No video URL provided' });
  }

  // Check if it's a YouTube URL
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    return res.status(400).json({ 
      error: 'Direct YouTube extraction blocked',
      message: 'YouTube blocks server-side extraction. Please use the workaround described at: https://yt-dlp-api-server.onrender.com/instructions'
    });
  }
  
  // For non-YouTube URLs, let's still try
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  const command = `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${videoUrl}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ 
        error: 'Failed to extract audio',
        details: stderr || error.message,
        workaround: 'For YouTube videos, please use the workaround described at: https://yt-dlp-api-server.onrender.com/instructions'
      });
    }
    
    try {
      const fileData = fs.readFileSync(outputPath);
      const base64Data = fileData.toString('base64');
      
      fs.unlinkSync(outputPath);
      
      return res.json({ 
        success: true, 
        audioBase64: base64Data,
        filename: `audio_${timestamp}.mp3`,
        message: 'Audio extraction successful'
      });
    } catch (fileError) {
      console.error(`File error: ${fileError.message}`);
      return res.status(500).json({ error: 'Failed to read audio file' });
    }
  });
});

// Add file upload middleware
const fileUpload = require('express-fileupload');
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
}));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});