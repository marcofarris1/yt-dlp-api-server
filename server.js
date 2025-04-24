require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Set up CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Set up authentication
const API_KEY = process.env.API_KEY || 'your-default-secret-key';

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('YT-DLP API is running');
});

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

  // Create unique filename
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  console.log(`Processing URL: ${videoUrl}`);
  
  // Simple command - this is closer to what works in the web interface
  // We're skipping cookies for now since they're causing issues
  const command = `yt-dlp -x --audio-format mp3 --force-ipv4 --geo-bypass -o "${outputPath}" "${videoUrl}"`;
  
  console.log(`Running command: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ 
        error: 'Failed to extract audio',
        details: stderr || error.message
      });
    }
    
    // Read the file and send it back
    try {
      const fileData = fs.readFileSync(outputPath);
      const base64Data = fileData.toString('base64');
      
      // Clean up
      fs.unlinkSync(outputPath);
      
      return res.json({ 
        success: true, 
        audioBase64: base64Data,
        filename: `audio_${timestamp}.mp3`,
        message: 'Audio extraction successful'
      });
    } catch (fileError) {
      console.error(`File error: ${fileError.message}`);
      return res.status(500).json({ 
        error: 'Failed to read audio file',
        details: fileError.message
      });
    }
  });
});

// Add an endpoint to try the Archive.org video as a test
app.get('/test-archive', (req, res) => {
  const archiveUrl = 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4';
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  console.log(`Testing with Archive.org URL: ${archiveUrl}`);
  
  const command = `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${archiveUrl}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'Archive.org test failed',
        details: stderr || error.message
      });
    }
    
    try {
      const fileData = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      
      return res.json({
        success: true,
        message: 'Archive.org test successful! Your yt-dlp installation works.'
      });
    } catch (fileError) {
      return res.status(500).json({
        error: 'Failed to read audio file',
        details: fileError.message
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});