const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Process audio endpoint
app.post('/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioPath = req.file.path;
        
        // Read the audio file
        const audioBuffer = await fs.readFile(audioPath);
        const audioBase64 = audioBuffer.toString('base64');

        console.log('Processing audio file...');

        // Step 1: Transcribe audio using Gemini 2.0 Flash
        const transcript = await transcribeAudio(audioBase64, req.file.mimetype);
        console.log('Transcription completed');

        // Step 2: Generate meeting minutes with 80/20 signal-to-noise filtering
        const minutes = await generateMeetingMinutes(transcript);
        console.log('Meeting minutes generated');

        // Cleanup: delete uploaded file
        await fs.unlink(audioPath);

        res.json({
            transcript: transcript,
            minutes: minutes
        });

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ 
            error: 'Failed to process audio',
            details: error.message 
        });
    }
});

async function transcribeAudio(audioBase64, mimeType) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Transcribe this Vietnamese audio recording accurately. 
Please provide the complete transcription of what was said in the meeting.
Format the output as plain text with proper punctuation and paragraph breaks.`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: audioBase64,
                    mimeType: mimeType || 'audio/webm'
                }
            },
            prompt
        ]);

        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error('Transcription error:', error);
        throw new Error('Failed to transcribe audio: ' + error.message);
    }
}

async function generateMeetingMinutes(transcript) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `You are an expert meeting minutes generator. Analyze the following Vietnamese meeting transcript and create comprehensive meeting minutes.

Apply the 80/20 principle (Pareto Principle) to filter signal from noise:
- 80% SIGNAL: Focus on the critical 20% of content that delivers 80% of the value:
  * Key decisions made
  * Important action items with owners and deadlines
  * Critical discussions and conclusions
  * Strategic insights and important points
  * Problem statements and solutions agreed upon

- 20% NOISE to FILTER OUT:
  * Small talk and pleasantries
  * Repetitive statements
  * Off-topic discussions
  * Unimportant clarifications
  * Filler words and tangential comments

Create meeting minutes in Vietnamese with the following structure:
1. Meeting title (brief, descriptive)
2. Summary (2-3 sentences capturing the essence)
3. Key Points (80% signal - the most important discussions and topics)
4. Decisions Made (concrete decisions with context)
5. Action Items (specific tasks, owners if mentioned, deadlines if mentioned)

Format your response as a JSON object with this structure:
{
  "title": "Meeting title",
  "summary": "Brief summary",
  "keyPoints": ["point 1", "point 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "actionItems": ["action 1", "action 2", ...]
}

Transcript:
${transcript}

Provide ONLY the JSON object, no additional text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response (handle markdown code blocks)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const minutes = JSON.parse(jsonText);
        return minutes;

    } catch (error) {
        console.error('Meeting minutes generation error:', error);
        throw new Error('Failed to generate meeting minutes: ' + error.message);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Ready to process Vietnamese meeting recordings');
});
