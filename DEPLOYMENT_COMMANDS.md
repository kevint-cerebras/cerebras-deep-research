# Netlify CLI Deployment Commands

# 1. Install Netlify CLI globally
npm install -g netlify-cli

# 2. Login to Netlify
netlify login

# 3. Initialize site (from your project directory)
netlify init

# 4. Set environment variables
netlify env:set VITE_EXA_API_KEY your_actual_exa_api_key_here

# 5. Deploy to production
netlify deploy --prod

# Optional: Preview deployment first
netlify deploy --dir=dist
