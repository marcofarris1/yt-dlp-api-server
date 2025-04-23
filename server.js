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

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to execute yt-dlp with retry logic
async function executeYtDlp(command, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            // Check if error is due to rate limiting
            if (stderr && stderr.includes('429: Too Many Requests')) {
              // Don't reject immediately, let the retry logic handle it
              return reject({ isRateLimit: true, error, stderr });
            }
            return reject({ error, stderr });
          }
          resolve({ stdout, stderr });
        });
      });
    } catch (err) {
      retries++;
      console.log(`Attempt ${retries}/${maxRetries} failed.`);
      
      if (err.isRateLimit) {
        // Exponential backoff - wait longer with each retry
        const waitTime = 2000 * Math.pow(2, retries); // 2s, 4s, 8s
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
      } else if (retries >= maxRetries) {
        // If we've used all retries and it's not a rate limit issue, throw the error
        throw err;
      } else {
        // For other types of errors, wait a bit before retrying
        await sleep(1000);
      }
    }
  }
  
  throw new Error('Maximum retries exceeded');
}

// Function to check if a URL is accessible
function isYouTubeVideo(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

app.post('/extract-audio', async (req, res) => {
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
  
  // Enhanced options for yt-dlp to bypass restrictions
  // These options help avoid region restrictions, age restrictions, and more
  const ytDlpOptions = [
    '-x', 
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--force-ipv4',
    '--no-warnings',
    '--prefer-insecure',
    '--no-check-certificates',
    '--geo-bypass',
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
    '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
    '--extractor-args', 'youtube:player_client=android',
    '--extractor-retries', '10',
    '--socket-timeout', '30'
  ];
  
  if (isYouTubeVideo(videoUrl)) {
    ytDlpOptions.push('--extractor-args');
    ytDlpOptions.push('youtube:skip=dash');
  }
  
  // Join all options into a command string
  const optionsString = ytDlpOptions.join(' ');
  const command = `yt-dlp ${optionsString} -o "${outputPath}" "${videoUrl}"`;
  
  try {
    const { stdout, stderr } = await executeYtDlp(command);
    
    if (stderr) {
      console.warn(`Warnings: ${stderr}`);
    }
    
    console.log(`Success: ${stdout}`);
    
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
  } catch (err) {
    console.error(`Error: ${err.error ? err.error.message : err.message}`);
    console.error(`Details: ${err.stderr || ''}`);
    
    if (err.stderr && err.stderr.includes('content isn\'t available')) {
      return res.status(404).json({ 
        error: 'Video content not available. This video may be private, deleted, or region-restricted.',
        details: err.stderr || '' 
      });
    } else if (err.stderr && err.stderr.includes('429: Too Many Requests')) {
      return res.status(429).json({ 
        error: 'YouTube rate limit exceeded. Please try again later.',
        details: err.stderr || ''
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to extract audio',
        details: err.stderr || err.message
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});