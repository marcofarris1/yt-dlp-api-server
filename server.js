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

// Health check endpoint
app.get('/', (req, res) => {
  res.send('YT-DLP API is running');
});

app.post('/extract-audio', (req, res) => {
  // Verify API key
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { videoUrl, platform } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'No video URL provided' });
  }

  // Create unique filename
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  console.log(`Processing ${platform || 'unknown'} URL: ${videoUrl}`);
  
  // Execute yt-dlp command
  const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${videoUrl}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
    
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    
    console.log(`stdout: ${stdout}`);
    
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});