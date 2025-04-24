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

  const { videoUrl, cookies } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'No video URL provided' });
  }

  // Create unique filename
  const timestamp = Date.now();
  const outputFile = `audio_${timestamp}.mp3`;
  const outputPath = path.join('/tmp', outputFile);
  
  // If cookies are provided, create a cookies file
  let cookieOptions = '';
  let cookieFile = null;
  
  if (cookies) {
    cookieFile = path.join('/tmp', `cookies_${timestamp}.txt`);
    
    try {
      fs.writeFileSync(cookieFile, cookies);
      cookieOptions = `--cookies "${cookieFile}"`;
    } catch (err) {
      console.error(`Failed to write cookies file: ${err.message}`);
    }
  }
  
  console.log(`Processing URL: ${videoUrl}`);
  
  // Add advanced options for bypassing restrictions
  const command = `yt-dlp -x --audio-format mp3 --force-ipv4 --geo-bypass ${cookieOptions} --extractor-args "youtube:player_client=android" -o "${outputPath}" "${videoUrl}"`;
  
  console.log(`Running command: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    // Clean up cookie file if it was created
    if (cookieFile && fs.existsSync(cookieFile)) {
      try {
        fs.unlinkSync(cookieFile);
      } catch (err) {
        console.error(`Failed to delete cookie file: ${err.message}`);
      }
    }
    
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

// Add an endpoint for browser cookie extraction 
app.get('/cookie-extractor', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>YouTube Cookie Extractor</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      textarea { width: 100%; height: 100px; margin: 10px 0; }
      button { padding: 10px 15px; background: #ff0000; color: white; border: none; cursor: pointer; }
      .note { background: #ffffcc; padding: 10px; border-left: 4px solid #ffcc00; }
    </style>
  </head>
  <body>
    <h1>YouTube Cookie Extractor</h1>
    <div class="note">
      <p><strong>Why this is needed:</strong> YouTube restricts access from server IPs. Using your browser cookies helps bypass these restrictions.</p>
      <p><strong>Privacy note:</strong> Your cookies are only sent directly to the API and are not stored permanently.</p>
    </div>
    <p>Click the button below to extract your YouTube cookies, then copy them to use with the API:</p>
    <button id="extractBtn">Extract YouTube Cookies</button>
    <textarea id="cookieOutput" placeholder="Your cookies will appear here" readonly></textarea>
    <h2>How to use:</h2>
    <p>Add these cookies to your API request by including them in the "cookies" field:</p>
    <pre>
{
  "videoUrl": "https://www.youtube.com/watch?v=26U_seo0a1g",
  "cookies": "paste-cookies-here"
}
    </pre>
    <script>
      document.getElementById('extractBtn').addEventListener('click', function() {
        const domain = '.youtube.com';
        let cookieStr = '';
        
        const cookies = document.cookie.split(';').map(cookie => cookie.trim());
        
        // If no cookies found, ask user to visit YouTube first
        if (cookies.length === 0 || !document.cookie.includes('youtube')) {
          document.getElementById('cookieOutput').value = 'No YouTube cookies found. Please visit YouTube.com first, then come back and try again.';
          return;
        }
        
        // Format cookies for yt-dlp
        cookieStr = cookies.map(cookie => {
          const [name, value] = cookie.split('=');
          return \`youtube.com\tTRUE\t/\tFALSE\t0\t\${name}\t\${value}\`;
        }).join('\\n');
        
        document.getElementById('cookieOutput').value = cookieStr;
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});