# Meeting Minutes App

A web-based application that records Vietnamese audio and automatically generates meeting minutes using Google's Gemini 2.5 Flash AI with intelligent 80/20 signal-to-noise filtering.

## Features

- **Audio Recording**: Browser-based audio recording with real-time visualization
- **Vietnamese Support**: Optimized for Vietnamese language transcription
- **AI-Powered**: Uses Gemini 2.5 Flash for accurate transcription and analysis
- **80/20 Filtering**: Applies Pareto Principle to extract key information (80% signal, filter 20% noise)
- **Long Recording Support**: Handles meetings up to 2 hours
- **Smart Minutes**: Automatically generates structured meeting minutes with:
  - Key discussion points
  - Decisions made
  - Action items
  - Summary
- **Export Options**: Download or copy meeting minutes
- **Modern UI**: Beautiful, responsive interface with dark theme
- **Mobile Friendly**: Fully responsive design for mobile devices
- **Audio Preview**: Listen to your recording before processing
- **Session Persistence**: Auto-saves last meeting (24h)

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Install Dependencies**
   ```powershell
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   ```powershell
   Copy-Item .env.example .env
   ```
   - Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Create Uploads Directory**
   ```powershell
   New-Item -ItemType Directory -Path uploads -Force
   ```

### Running the Application

1. **Start the Server**
   ```powershell
   npm start
   ```
   
   Or for development with auto-reload:
   ```powershell
   npm run dev
   ```

2. **Open the Application**
   - Open your browser and navigate to: `http://localhost:3000`
   - Or open `index.html` directly in your browser

3. **Allow Microphone Access**
   - When prompted, allow the browser to access your microphone

## Usage

1. Click **"Bắt đầu ghi âm"** (Start Recording) to begin recording
2. Speak in Vietnamese during your meeting
3. Click **"Dừng ghi âm"** (Stop Recording) when finished
4. Wait for the AI to process the audio
5. View the transcript and generated meeting minutes in the tabs
6. Download or copy the meeting minutes as needed

## How the 80/20 Filtering Works

The app applies the Pareto Principle to filter meeting content:

**80% Signal (What's Kept):**
- Key decisions made
- Important action items with owners and deadlines
- Critical discussions and conclusions
- Strategic insights
- Problem statements and solutions

**20% Noise (What's Filtered Out):**
- Small talk and pleasantries
- Repetitive statements
- Off-topic discussions
- Filler words
- Tangential comments

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **AI**: Google Gemini 2.5 Flash
- **Audio**: Web Audio API, MediaRecorder API

## Project Structure

```
meeting-minutes/
├── index.html          # Main HTML file
├── app.js             # Frontend JavaScript
├── styles.css         # Styling
├── server.js          # Backend server
├── package.json       # Dependencies
├── .env.example       # Environment variables template
├── .env              # Your API keys (not in git)
└── uploads/          # Temporary audio storage
```

## Troubleshooting

### Very Long Recordings (>1 hour)
- Processing may take 5-10 minutes
- Ensure stable internet connection
- Don't close browser during processing
- If timeout occurs, try splitting into shorter segments

### Microphone Not Working
- Check browser permissions for microphone access
- Ensure you're using HTTPS or localhost
- Try a different browser (Chrome/Edge recommended)

### API Errors
- Verify your Gemini API key is correct in `.env`
- Check your API quota hasn't been exceeded
- Ensure you have internet connectivity

### Audio Processing Fails
- Check server logs for detailed error messages
- Verify the audio file was recorded properly
- Try recording a shorter clip first

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ⚠️ Safari (limited Web Audio API support)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
