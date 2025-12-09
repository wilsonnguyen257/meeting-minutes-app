# Deploying to Vercel

## Prerequisites
- A Vercel account (sign up at https://vercel.com)
- Vercel CLI installed globally

## Step 1: Install Vercel CLI
```powershell
npm install -g vercel
```

## Step 2: Login to Vercel
```powershell
vercel login
```

## Step 3: Deploy
```powershell
vercel
```

During deployment, you'll be asked:
1. **Set up and deploy**: Press `Y`
2. **Which scope**: Select your account
3. **Link to existing project**: Press `N` (first time)
4. **Project name**: Press Enter (or customize)
5. **Directory**: Press Enter (current directory)
6. **Override settings**: Press `N`

## Step 4: Add Environment Variable

After the first deployment, add your Gemini API key:

### Option A: Via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

### Option B: Via CLI
```powershell
vercel env add GEMINI_API_KEY
```
Then paste your API key when prompted.

## Step 5: Redeploy
```powershell
vercel --prod
```

## Important Notes

⚠️ **Limitations on Vercel Free Tier:**
- Serverless functions have a 10-second timeout
- File uploads are limited to 4.5MB
- For longer recordings, consider upgrading or using a different platform

## Your App URLs
- **Preview**: Shown after running `vercel`
- **Production**: Shown after running `vercel --prod`

## Troubleshooting

### Timeout Issues
If recordings are too long and timeout, you can:
1. Upgrade to Vercel Pro for 60-second timeouts
2. Use a different platform (Railway, Render, etc.)
3. Split longer recordings into smaller chunks

### CORS Issues
The app is configured to handle CORS properly. If you encounter issues:
- Make sure the frontend URL matches your Vercel domain
- Check browser console for specific CORS errors

## Alternative: Deploy to Railway (Better for long recordings)

If you need longer processing times:
1. Go to https://railway.app
2. Click "Start a New Project"
3. Connect your GitHub repo
4. Add `GEMINI_API_KEY` environment variable
5. Railway will auto-deploy

Railway offers better timeout limits for audio processing.
