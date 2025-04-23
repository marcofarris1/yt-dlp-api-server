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

// Health check endpoint that also shows yt-dlp version
app.get('/', (req, res) => {
  exec('yt-dlp --version', (error, stdout, stderr) => {
    if (error) {
      return res.send(`YT-DLP API is running, but yt-dlp check failed: ${error.message}`);
    }
    return res.send(`YT-DLP API is running. yt-dlp version: ${stdout.trim()}`);
  });
});

// Endpoint to test basic yt-dlp functionality
app.get('/test-ytdlp', (req, res) => {
  exec('yt-dlp --help', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'yt-dlp test failed',
        details: error.message
      });
    }
    return res.json({
      success: true,
      message: 'yt-dlp is working',
      help_excerpt: stdout.substring(0, 500) + '...'
    });
  });
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

  // Log the request details for debugging
  console.log(`Processing URL: ${videoUrl}`);
  
  // Create unique filename
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  // Let's first test with a simple command that doesn't do extraction
  // We just want to get info about the video to verify connectivity
  const infoCommand = `yt-dlp --dump-json "${videoUrl}"`;
  
  console.log(`Running info command: ${infoCommand}`);
  
  exec(infoCommand, (infoError, infoStdout, infoStderr) => {
    if (infoError) {
      console.error(`Info error: ${infoError.message}`);
      console.error(`Info stderr: ${infoStderr}`);
      return res.status(500).json({ 
        error: 'Failed to get video info',
        details: infoStderr || infoError.message
      });
    }
    
    console.log(`Info succeeded, now extracting audio`);
    
    // Now attempt the actual extraction
    const extractCommand = `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${videoUrl}"`;
    console.log(`Running extract command: ${extractCommand}`);
    
    exec(extractCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Extract error: ${error.message}`);
        console.error(`Extract stderr: ${stderr}`);
        return res.status(500).json({ 
          error: 'Failed to extract audio',
          details: stderr || error.message
        });
      }
      
      console.log(`Extract stdout: ${stdout}`);
      
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
        console.error(`File error: ${fileError}`);
        return res.status(500).json({ error: 'Failed to read audio file' });
      }
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});