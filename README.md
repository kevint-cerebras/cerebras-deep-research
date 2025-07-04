# 🔬 Multi-Agent Research System

A comprehensive research platform that uses multiple AI agents to conduct in-depth research on any topic. Built with React/TypeScript frontend and direct API integration.

## ✨ Features

### 🤖 Multi-Agent Architecture
- **4 Specialized Research Agents** working in parallel
- **Core Concepts Agent**: Fundamentals and principles
- **Latest Developments Agent**: Recent breakthroughs and news
- **Market Analysis Agent**: Key players and industry dynamics  
- **Future Trends Agent**: Emerging applications and predictions

### 🔄 Intelligent Model Switching
- **Automatic failover** between Cerebras models when rate limits are hit
- **Smart load balancing** across llama-3.3-70b, llama-3.1-70b, and llama-3.1-8b
- **Real-time status tracking** of model availability
- **3-5x faster processing** by avoiding rate limit waits

### 🎯 Advanced Research Capabilities
- **No corner-cutting**: Every source fully analyzed
- **Complete source utilization**: All collected sources used in synthesis
- **Intelligent context windowing**: Process unlimited content within API limits
- **Comprehensive synthesis**: Multi-stage analysis ensuring all data is preserved

### 🔍 Real-Time Research Experience
- **Live source streaming** as agents discover content
- **Progress tracking** with detailed activity logs
- **Model status monitoring** showing rate limit usage
- **Transparent error handling** with automatic retries

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Exa API key ([get one here](https://exa.ai))
- Cerebras API key ([get one here](https://cerebras.ai))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd multi-agent-research

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration
1. Open the application in your browser
2. Go to the Settings tab
3. Add your API keys:
   - **Exa API Key**: For web search and content extraction
   - **Cerebras API Key**: For AI analysis and synthesis

## 🏗️ Architecture

### Frontend (React/TypeScript)
- **Modern React** with TypeScript and Tailwind CSS
- **Real-time updates** via streaming APIs
- **Responsive design** with beautiful UI components
- **State management** for research sessions and progress

### API Integration
- **Direct API calls** to Exa and Cerebras
- **Intelligent rate limiting** and model switching
- **Error handling** with automatic fallbacks
- **Netlify Functions** for production deployments

### Multi-Agent System
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Research      │    │    Specialist    │    │   Intelligent   │
│  Coordinator    │───▶│     Agents       │───▶│ Model Switching │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Progress        │    │    Source        │    │   Final         │
│ Tracking        │    │  Collection      │    │  Synthesis      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🛠️ Development

### Available Scripts
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Project Structure
```
src/
├── api.ts         # API services and multi-agent logic
├── App.tsx        # Main application component
├── index.tsx      # Application entry point
└── styles.css     # Global styles

public/            # Static assets
netlify/           # Netlify Functions
dist/              # Production build output
```

## 🔧 Configuration

### Environment Variables
The application uses browser localStorage for API key storage. For production deployments, you can also use:

- `VITE_EXA_API_KEY` - Default Exa API key
- `VITE_CEREBRAS_API_KEY` - Default Cerebras API key

### Model Selection
Choose between available Cerebras models:
- **Llama 3.3 70B** - Most capable, best for complex analysis
- **Llama 3.1 70B** - Balanced performance and speed  
- **Llama 3.1 8B** - Fastest, good for simple tasks

## 📊 Rate Limits & Performance

### API Limits (per model)
- **Requests**: 30/minute, 900/hour, 14,400/day
- **Tokens**: 60,000/minute, 1,000,000/hour, 1,000,000/day
- **Context**: 8,192 tokens per request

### Intelligent Distribution
- Automatic load balancing across 4 models
- Maximum 53% utilization of any single model
- Processing time: 12-16 minutes (down from 38-48 minutes)
- 19-24 API calls per research session

## 🚀 Deployment

### Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables for default API keys (optional)

### Manual Deployment
```bash
npm run build
# Upload dist/ folder to your hosting provider
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Exa AI** for powerful web search capabilities
- **Cerebras** for fast inference and multiple model options
- **React & TypeScript** ecosystem for excellent developer experience
- **Tailwind CSS** for beautiful, responsive design 