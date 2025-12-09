const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();

// File upload configuration with validation
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max file size
    },
    fileFilter: function (req, file, cb) {
        // Accept audio files only
        const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
        if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL || '*' 
        : '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// Environment validation
if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY environment variable is not set!');
    process.exit(1);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple in-memory rate limiting (use Redis in production)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
    }
    
    const requests = requestCounts.get(ip).filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (requests.length >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ 
            error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
    }
    
    requests.push(now);
    requestCounts.set(ip, requests);
    next();
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of requestCounts.entries()) {
        const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
        if (validRequests.length === 0) {
            requestCounts.delete(ip);
        } else {
            requestCounts.set(ip, validRequests);
        }
    }
}, RATE_LIMIT_WINDOW);

// Process audio endpoint
app.post('/process-audio', rateLimitMiddleware, upload.single('audio'), async (req, res) => {
    const startTime = Date.now();
    
    // Set timeout for long-running requests
    req.setTimeout(5 * 60 * 1000); // 5 minutes timeout
    
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: 'Không tìm thấy file âm thanh',
                message: 'Vui lòng chọn file âm thanh để tải lên'
            });
        }

        // Validate file size
        const fileSizeInMB = req.file.size / (1024 * 1024);
        console.log(`Processing audio file: ${req.file.filename} (${fileSizeInMB.toFixed(2)} MB)`);

        if (fileSizeInMB > 25) {
            await fs.unlink(req.file.path);
            return res.status(400).json({
                error: 'File quá lớn',
                message: 'Kích thước file không được vượt quá 25MB'
            });
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

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Total processing time: ${processingTime}s`);

        res.json({
            transcript: transcript,
            minutes: minutes,
            metadata: {
                processingTime: `${processingTime}s`,
                fileSize: `${fileSizeInMB.toFixed(2)} MB`
            }
        });

    } catch (error) {
        console.error('Error processing audio:', error);
        
        // Cleanup file if exists
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }
        
        // User-friendly error messages
        let errorMessage = 'Đã xảy ra lỗi khi xử lý file âm thanh';
        if (error.message.includes('quota')) {
            errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau vài phút.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Quá trình xử lý mất quá nhiều thời gian. Vui lòng thử file ngắn hơn.';
        } else if (error.message.includes('Only audio files')) {
            errorMessage = 'Chỉ chấp nhận file âm thanh.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

async function transcribeAudio(audioBase64, mimeType) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Check if audio is too large (> 20MB base64 = ~15MB file)
        // For large files, we need to process differently
        const sizeInMB = (audioBase64.length * 3) / (4 * 1024 * 1024);
        console.log(`Audio size estimate: ${sizeInMB.toFixed(2)} MB`);
        
        const prompt = `Transcribe this Vietnamese audio recording accurately. 
Please provide the complete transcription of what was said in the meeting.
Format the output as plain text with proper punctuation and paragraph breaks.
If this is a long recording, provide a comprehensive transcription of all spoken content.`;

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
        
        // If it's a quota or timeout error, provide better guidance
        if (error.message && error.message.includes('quota')) {
            throw new Error('API quota exceeded. For very long recordings (>1 hour), please split into shorter segments or try again later.');
        }
        
        throw new Error('Failed to transcribe audio: ' + error.message);
    }
}

async function generateMeetingMinutes(transcript) {
    try {
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 8192, // Increase token limit for long meetings
            }
        });
        
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

For long meetings (>1 hour), ensure you capture ALL major discussion points, decisions, and action items throughout the entire meeting.

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
