import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Eye, EyeOff, Menu, X } from 'lucide-react';
import './styles.css';
import { ResearchAPI, ResearchResult, LayerSummary, ResearchSource, ProgressUpdate } from './api';
import { JSX } from 'react/jsx-runtime';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); // Default to settings tab
  const [hasSearched, setHasSearched] = useState(false);
  const [currentSearch, setCurrentSearch] = useState('');
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<Date | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [sourcesFound, setSourcesFound] = useState<number>(0);
  const [realtimeSources, setRealtimeSources] = useState<ResearchSource[]>([]);
  
  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // BYOK - API Key Management
  const [exaApiKey, setExaApiKey] = useState('');
  const [cerebrasApiKey, setCerebrasApiKey] = useState('');
  const [showExaKey, setShowExaKey] = useState(false);
  const [showCerebrasKey, setShowCerebrasKey] = useState(false);
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  
  // Activity timeline - each action becomes a tab
  const [activityTabs, setActivityTabs] = useState<Array<{
    id: string;
    title: string;
    content: string;
    timestamp: Date;
    type: 'query' | 'sources' | 'processing' | 'complete' | 'error';
    agentId?: string;
    duration?: number;
    status?: 'active' | 'completed' | 'failed';
    details?: {
      progress?: number;
      sourcesFound?: number;
      currentStep?: string;
      estimatedRemaining?: number;
    };
  }>>([]);
  
  // Last activity time for timer reset
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  
  // Track last added tab type to prevent duplicates
  const lastAddedTabType = useRef<string | null>(null);
  
  // API key notification state
  const [showApiKeyNotification, setShowApiKeyNotification] = useState(false);
  
  // Add new state for enhanced visibility
  const [agentStatuses, setAgentStatuses] = useState<{[key: string]: {
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    currentStep: string;
    sourcesFound: number;
    startTime?: Date;
    endTime?: Date;
  }}>({});
  
  const [overallHealth, setOverallHealth] = useState<{
    exaApi: 'healthy' | 'degraded' | 'failed';
    cerebrasApi: 'healthy' | 'degraded' | 'failed';
    lastUpdate: Date | null;
  }>({
    exaApi: 'healthy',
    cerebrasApi: 'healthy',
    lastUpdate: null
  });
  
  // Research settings - optimized for 40-50+ sources
  const maxLayers = 4;
  const sourcesPerLayer = 20;

  const questions = [
    "What are the most promising approaches to fusion energy?",
    "What are the latest developments in quantum computing?", 
    "How can AI help solve climate change challenges?"
  ];

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedExaKey = localStorage.getItem('exa_api_key');
    const savedCerebrasKey = localStorage.getItem('cerebras_api_key');
    
    if (savedExaKey) {
      setExaApiKey(savedExaKey);
    }
    if (savedCerebrasKey) {
      setCerebrasApiKey(savedCerebrasKey);
    }
    
    const configured = !!(savedExaKey && savedCerebrasKey);
    setApiKeysConfigured(configured);
    
    // Set API keys in the ResearchAPI if both are available
    if (configured) {
      ResearchAPI.setApiKeys(savedExaKey!, savedCerebrasKey!);
    }
  }, []);

  // Save API keys to localStorage when they change
  const handleExaKeyChange = (key: string) => {
    setExaApiKey(key);
    if (key.trim()) {
      localStorage.setItem('exa_api_key', key.trim());
    } else {
      localStorage.removeItem('exa_api_key');
    }
    updateApiKeysConfigured(key, cerebrasApiKey);
  };

  const handleCerebrasKeyChange = (key: string) => {
    setCerebrasApiKey(key);
    if (key.trim()) {
      localStorage.setItem('cerebras_api_key', key.trim());
    } else {
      localStorage.removeItem('cerebras_api_key');
    }
    updateApiKeysConfigured(exaApiKey, key);
  };

  const updateApiKeysConfigured = (exaKey: string, cerebrasKey: string) => {
    const configured = !!(exaKey.trim() && cerebrasKey.trim());
    setApiKeysConfigured(configured);
    
    // Update the ResearchAPI with the new keys
    ResearchAPI.setApiKeys(exaKey.trim(), cerebrasKey.trim());
  };

  const addActivityTab = (
    title: string, 
    content: string, 
    type: 'query' | 'sources' | 'processing' | 'complete' | 'error',
    options?: {
      agentId?: string;
      status?: 'active' | 'completed' | 'failed';
      details?: {
        progress?: number;
        sourcesFound?: number;
        currentStep?: string;
        estimatedRemaining?: number;
      };
    }
  ) => {
    const newTab = {
      id: Date.now().toString(),
      title,
      content,
      timestamp: new Date(),
      type,
      agentId: options?.agentId,
      status: options?.status || 'active',
      details: options?.details
    };
    setActivityTabs(prev => [newTab, ...prev]); // Add to top (newest first)
    setLastActivityTime(new Date());
    setTimeLeft(180); // Reset timer on each activity
    lastAddedTabType.current = type; // Track the type we just added
  };

  const handleSearch = async () => {
    if (searchQuery.trim() && !isResearching) {
      // Check if API keys are configured
      if (!apiKeysConfigured) {
        setResearchError('Please configure your API keys in the Settings tab before starting research.');
        setActiveTab('settings'); // Switch to settings tab
        return;
      }

      const query = searchQuery.trim();
      setCurrentSearch(query);
      setHasSearched(true);
      setProgress(0);
      setTimeLeft(180);
      setShowTimeoutPopup(false);
      setSearchStartTime(new Date());
      setLastActivityTime(new Date());
      setSearchQuery('');
      setIsResearching(true);
      setResearchResult(null);
      setResearchError(null);
      setCurrentStage('');
      setCurrentQuery('');
      setSourcesFound(0);
      setRealtimeSources([]);
      setActivityTabs([]); // Clear previous activity
      lastAddedTabType.current = null; // Reset tracking
      
      // Switch to activity tab when research starts
      setActiveTab('activity');

      // Add initial query tab
      addActivityTab('Starting Research', `"${query}"`, 'query');

      try {
        console.log('🔬 Starting real research for:', query);
        
        const result = await ResearchAPI.performResearch({
          query,
          max_layers: maxLayers,
          sources_per_layer: sourcesPerLayer
        }, (update: ProgressUpdate) => {
          // Reset timer on each update
          setLastActivityTime(new Date());
          setTimeLeft(180);
          
          // Real-time progress updates
          setCurrentStage(update.stage);
          setCurrentQuery(update.query);
          setSourcesFound(update.total_sources);
          setProgress(update.progress_percent);
          
          // Use activity updates from the API if available
          if (update.activity_updates && update.activity_updates.length > 0) {
            // Replace activity tabs with new ones from API (already sorted newest first)
            setActivityTabs(update.activity_updates.map(activity => ({
              id: activity.id,
              title: activity.title,
              content: activity.content,
              timestamp: new Date(activity.timestamp),
              type: activity.type
            })));
          }
          
          // Update sources in real-time from streaming_sources (newest at top)
          if (update.streaming_sources && update.streaming_sources.length > 0) {
            setRealtimeSources(update.streaming_sources.map(source => ({
              url: source.url,
              title: source.title,
              content: source.snippet, // Use snippet as content for now
              word_count: source.snippet.length,
              exa_score: 0.8,
              layer: 1,
              query_used: "",
              relevance_score: 0.8,
              domain: source.domain
            })));
          }
          
          // Also update from final result if available (fallback)
          if (update.final_result?.all_sources && update.final_result.all_sources.length > 0) {
            setRealtimeSources(prev => {
              const newSources = update.final_result!.all_sources.filter(
                newSource => !prev.some(existingSource => existingSource.url === newSource.url)
              );
              return [...newSources, ...prev]; // Add new sources at top
            });
          }
        });

        console.log('✅ Research completed:', result);
        setResearchResult(result);
        setRealtimeSources(result.all_sources);
        setProgress(100);
        setIsResearching(false);
        
      } catch (error) {
        console.error('❌ Research failed:', error);
        setResearchError(error instanceof Error ? error.message : 'Research failed');
        setIsResearching(false);
        setShowTimeoutPopup(true);
        addActivityTab('Error', error instanceof Error ? error.message : 'Research failed', 'error');
      }
    }
  };

  // Helper function to immediately search with a suggested question
  const handleSuggestedSearch = async (question: string) => {
    if (!isResearching) {
      setSearchQuery(question);
      
      // Check if API keys are configured
      if (!apiKeysConfigured) {
        setResearchError('Please configure your API keys in the Settings tab before starting research.');
        setActiveTab('settings'); // Switch to settings tab
        return;
      }

      const query = question.trim();
      setCurrentSearch(query);
      setHasSearched(true);
      setProgress(0);
      setTimeLeft(180);
      setShowTimeoutPopup(false);
      setSearchStartTime(new Date());
      setLastActivityTime(new Date());
      setSearchQuery('');
      setIsResearching(true);
      setResearchResult(null);
      setResearchError(null);
      setCurrentStage('');
      setCurrentQuery('');
      setSourcesFound(0);
      setRealtimeSources([]);
      setActivityTabs([]); // Clear previous activity
      lastAddedTabType.current = null; // Reset tracking
      
      // Switch to activity tab when research starts
      setActiveTab('activity');

      // Add initial query tab
      addActivityTab('Starting Research', `"${query}"`, 'query');

      try {
        console.log('🔬 Starting real research for:', query);
        
        const result = await ResearchAPI.performResearch({
          query,
          max_layers: maxLayers,
          sources_per_layer: sourcesPerLayer
        }, (update: ProgressUpdate) => {
          // Reset timer on each update
          setLastActivityTime(new Date());
          setTimeLeft(180);
          
          // Real-time progress updates
          setCurrentStage(update.stage);
          setCurrentQuery(update.query);
          setSourcesFound(update.total_sources);
          setProgress(update.progress_percent);
          
          // Use activity updates from the API if available
          if (update.activity_updates && update.activity_updates.length > 0) {
            // Replace activity tabs with new ones from API (already sorted newest first)
            setActivityTabs(update.activity_updates.map(activity => ({
              id: activity.id,
              title: activity.title,
              content: activity.content,
              timestamp: new Date(activity.timestamp),
              type: activity.type,
              status: activity.type === 'processing' ? 'active' : activity.type === 'error' ? 'failed' : 'completed',
              details: {
                progress: update.progress_percent,
                sourcesFound: update.sources_found,
                currentStep: update.stage
              }
            })));
          }
          
          // Update overall health based on successful updates
          setOverallHealth(prev => ({
            ...prev,
            exaApi: 'healthy',
            cerebrasApi: 'healthy',
            lastUpdate: new Date()
          }));
          
          // Update sources in real-time from streaming_sources (newest at top)
          if (update.streaming_sources && update.streaming_sources.length > 0) {
            setRealtimeSources(update.streaming_sources.map(source => ({
              url: source.url,
              title: source.title,
              content: source.snippet, // Use snippet as content for now
              word_count: source.snippet.length,
              exa_score: 0.8,
              layer: 1,
              query_used: "",
              relevance_score: 0.8,
              domain: source.domain
            })));
          }
          
          // Also update from final result if available (fallback)
          if (update.final_result?.all_sources && update.final_result.all_sources.length > 0) {
            setRealtimeSources(prev => {
              const newSources = update.final_result!.all_sources.filter(
                newSource => !prev.some(existingSource => existingSource.url === newSource.url)
              );
              return [...newSources, ...prev]; // Add new sources at top
            });
          }
        });

        console.log('✅ Research completed:', result);
        setResearchResult(result);
        setRealtimeSources(result.all_sources);
        setProgress(100);
        setIsResearching(false);
        
      } catch (error) {
        console.error('❌ Research failed:', error);
        setResearchError(error instanceof Error ? error.message : 'Research failed');
        setIsResearching(false);
        setShowTimeoutPopup(true);
        addActivityTab('Error', error instanceof Error ? error.message : 'Research failed', 'error');
      }
    }
  };

  // Check API health on mount and show notification if needed
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthResult = await ResearchAPI.checkHealth();
        setApiHealthy(healthResult.status === 'healthy');
        
        // Update overall health status
        setOverallHealth(prev => ({
          ...prev,
          exaApi: healthResult.status === 'healthy' ? 'healthy' : 'degraded',
          cerebrasApi: healthResult.status === 'healthy' ? 'healthy' : 'degraded',
          lastUpdate: new Date()
        }));
      } catch (error) {
        setApiHealthy(false);
        setOverallHealth(prev => ({
          ...prev,
          exaApi: 'failed',
          cerebrasApi: 'failed',
          lastUpdate: new Date()
        }));
      }
    };
    checkHealth();
    
    // Show API key notification after a brief delay if keys aren't configured
    const timer = setTimeout(() => {
      if (!apiKeysConfigured) {
        setShowApiKeyNotification(true);
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [apiKeysConfigured]);

  // No fake progress animation - progress is updated only via real API updates

  // Enhanced activity monitoring with stuck detection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isResearching && timeLeft > 0 && !showTimeoutPopup && !researchResult) {
      interval = setInterval(() => {
        const now = new Date();
        const lastActivity = lastActivityTime || searchStartTime;
        
        if (lastActivity) {
          const timeSinceActivity = now.getTime() - lastActivity.getTime();
          
          // If no activity for 20+ seconds, add a "waiting" indicator
          if (timeSinceActivity > 20000 && timeSinceActivity < 30000) {
            const waitingTabExists = activityTabs.some(tab => tab.id === 'waiting_indicator');
            if (!waitingTabExists) {
              addActivityTab(
                'System Status',
                'Waiting for API response... This may take a moment.',
                'processing',
                {
                  status: 'active',
                  details: {
                    currentStep: 'Waiting for external API',
                    estimatedRemaining: 60
                  }
                }
              );
            }
          }
          
          // If no activity for 40+ seconds, show potential stuck warning
          if (timeSinceActivity > 40000 && timeSinceActivity < 50000) {
            const stuckTabExists = activityTabs.some(tab => tab.id === 'stuck_warning');
            if (!stuckTabExists) {
              addActivityTab(
                'Extended Wait Time',
                'This is taking longer than usual. The system is still working...',
                'processing',
                {
                  status: 'active',
                  details: {
                    currentStep: 'Processing complex request',
                    estimatedRemaining: 120
                  }
                }
              );
              
              // Update health status to degraded
              setOverallHealth(prev => ({
                ...prev,
                exaApi: 'degraded',
                cerebrasApi: 'degraded',
                lastUpdate: new Date()
              }));
            }
          }
        }
        
        // Only count down if no activity in the last 2 seconds
        if (!lastActivity || now.getTime() - lastActivity.getTime() > 2000) {
          setTimeLeft(prev => {
            if (prev <= 1) {
              setShowTimeoutPopup(true);
              setIsResearching(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isResearching, timeLeft, showTimeoutPopup, researchResult, lastActivityTime, searchStartTime, activityTabs]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatActivityTime = (date: Date | null) => {
    if (!date) return '07:27 PM';
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).replace(/^0/, '');
  };

  const formatMarkdownText = (text: string) => {
    // First handle markdown headings by converting them to proper HTML structure
    const processMarkdown = (input: string) => {
      // Convert markdown to structured content
      const lines = input.split('\n');
      const processedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle headings
        if (line.startsWith('### ')) {
          processedLines.push({
            type: 'h3',
            content: line.substring(4).trim()
          });
        } else if (line.startsWith('## ')) {
          processedLines.push({
            type: 'h2', 
            content: line.substring(3).trim()
          });
        } else if (line.startsWith('# ')) {
          processedLines.push({
            type: 'h1',
            content: line.substring(2).trim()
          });
        } else if (line.trim() === '') {
          processedLines.push({
            type: 'break',
            content: ''
          });
        } else {
          processedLines.push({
            type: 'text',
            content: line
          });
        }
      }
      
      return processedLines;
    };

    const processedContent = processMarkdown(text);
    
    // Convert to JSX elements
    const elements: JSX.Element[] = [];
    let textBuffer: string[] = [];
    let key = 0;
    
    const flushTextBuffer = () => {
      if (textBuffer.length > 0) {
        const textContent = textBuffer.join('\n');
        elements.push(
          <div key={`text-${key++}`} className="mb-4 text-sm font-light font-['Space_Grotesk'] leading-relaxed">
            {formatInlineMarkdown(textContent)}
          </div>
        );
        textBuffer = [];
      }
    };
    
    processedContent.forEach((item, index) => {
      if (item.type === 'h1') {
        flushTextBuffer();
        elements.push(
          <h1 key={`h1-${key++}`} className="text-2xl font-bold font-['Space_Grotesk'] leading-tight mb-6 mt-8 text-white">
            {item.content}
          </h1>
        );
      } else if (item.type === 'h2') {
        flushTextBuffer();
        elements.push(
          <h2 key={`h2-${key++}`} className="text-xl font-semibold font-['Space_Grotesk'] leading-tight mb-4 mt-6 text-white">
            {item.content}
          </h2>
        );
      } else if (item.type === 'h3') {
        flushTextBuffer();
        elements.push(
          <h3 key={`h3-${key++}`} className="text-lg font-medium font-['Space_Grotesk'] leading-tight mb-3 mt-5 text-white">
            {item.content}
          </h3>
        );
      } else if (item.type === 'break') {
        // Don't add breaks to text buffer, just flush if there's content
        if (textBuffer.length > 0) {
          flushTextBuffer();
        }
      } else if (item.type === 'text' && item.content.trim()) {
        textBuffer.push(item.content);
      }
    });
    
    // Flush any remaining text
    flushTextBuffer();
    
    return elements;
  };

  const formatInlineMarkdown = (text: string) => {
    // Handle bold text and other inline formatting
    const parts = [];
    let currentIndex = 0;
    
    // Find all **text** patterns for bold
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(
          <span key={`text-${currentIndex}`}>
            {text.slice(currentIndex, match.index)}
          </span>
        );
      }
      
      // Add the bold text
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(
        <span key={`text-${currentIndex}`}>
          {text.slice(currentIndex)}
        </span>
      );
    }
    
    // Handle line breaks within the text
    return parts.map((part, index) => {
      if (typeof part.props?.children === 'string') {
        return (
          <span key={part.key || index}>
            {part.props.children.split('\n').map((line: string, lineIndex: number) => (
              <span key={lineIndex}>
                {line}
                {lineIndex < part.props.children.split('\n').length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="h-screen w-full relative bg-black overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="w-16 sm:w-24 md:w-32 lg:w-36 h-[400px] sm:h-[600px] md:h-[700px] lg:h-[774.82px] right-[-30px] sm:right-[-100px] md:right-[-150px] lg:right-[-200px] top-[-50px] sm:top-[-70px] absolute origin-top-left rotate-[25.32deg] bg-gradient-to-b from-[#2BFFFF]/25 to-[#1CA3A3]/0 blur-2xl" />
      <div className="w-4 sm:w-6 md:w-8 lg:w-12 h-[400px] sm:h-[600px] md:h-[700px] lg:h-[842.55px] right-[5px] sm:right-[10px] md:right-[-50px] lg:right-[-120px] top-[-100px] sm:top-[-143px] absolute origin-top-left rotate-[25.32deg] bg-gradient-to-b from-[#2BFFFF]/30 to-[#1CA3A3]/0 blur-[20px]" />
      <div className="w-16 sm:w-24 md:w-32 lg:w-36 h-[400px] sm:h-[600px] md:h-[700px] lg:h-[842.55px] right-[100px] sm:right-[150px] md:right-[100px] lg:right-[60px] top-[-150px] sm:top-[-219.39px] absolute origin-top-left rotate-[25.32deg] bg-gradient-to-b from-[#2BFFFF]/25 to-[#1CA3A3]/0 blur-2xl" />
      <div className="w-[300px] sm:w-[400px] md:w-[500px] lg:w-[642.87px] h-[500px] sm:h-[700px] md:h-[800px] lg:h-[895.30px] left-[10%] sm:left-[15%] md:left-[30%] lg:left-[962.30px] top-[-100px] sm:top-[-186px] absolute origin-top-left rotate-[25.32deg] bg-gradient-to-br from-[#2BFFFF]/10 to-[#1CA3A3]/0 blur-3xl" />

      {/* Navigation */}
      <div className="w-full px-4 sm:px-6 md:px-12 lg:px-24 py-3 md:py-4 left-0 top-0 absolute bg-white/0 border-b border-white/10 backdrop-blur-[50px] flex justify-between items-center overflow-hidden z-30">
        <div className="text-white/95 text-lg md:text-xl font-medium font-space-grotesk leading-tight">
          Deep Research
        </div>
        
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
        >
          {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        
        {/* Desktop status indicators */}
        <div className="hidden md:flex justify-start items-center gap-2 lg:gap-4">
          {!apiKeysConfigured && (
            <div className="flex items-center gap-2 px-2 lg:px-3 py-1.5 bg-gradient-to-b from-red-500/20 to-red-600/10 rounded-lg border border-red-500/30">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <div className="text-red-300 text-xs font-medium font-space-grotesk">
                Configure API Keys
              </div>
            </div>
          )}
          {apiKeysConfigured && (
            <div className="flex items-center gap-2 px-2 lg:px-3 py-1.5 bg-gradient-to-b from-green-500/20 to-green-600/10 rounded-lg border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <div className="text-green-300 text-xs font-medium font-space-grotesk">
                API Keys Ready
              </div>
            </div>
          )}
        </div>
        
        {/* Invisible spacer for balance on desktop */}
        <div className="hidden md:block text-white/0 text-lg md:text-xl font-medium font-space-grotesk leading-tight">
          Deep Research
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsMobileSidebarOpen(false)}>
          <div className="fixed right-0 top-0 h-full w-80 bg-gradient-to-br from-[#2BFFFF]/10 via-[#2BFFFF]/0 to-[#1CA3A3]/5 backdrop-blur-[20px] border-l border-white/20 z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col h-full p-4">
              {/* Mobile sidebar header */}
              <div className="flex justify-between items-center mb-6 pt-16">
                <h2 className="text-white text-xl font-medium font-space-grotesk">Menu</h2>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 text-white/70 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Mobile status indicator */}
              <div className="mb-6">
                {!apiKeysConfigured && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-red-500/20 to-red-600/10 rounded-lg border border-red-500/30">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <div className="text-red-300 text-sm font-medium font-space-grotesk">
                      Configure API Keys
                    </div>
                  </div>
                )}
                {apiKeysConfigured && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-green-500/20 to-green-600/10 rounded-lg border border-green-500/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div className="text-green-300 text-sm font-medium font-space-grotesk">
                      API Keys Ready
                    </div>
                  </div>
                )}
              </div>
              
              {/* Mobile tab navigation */}
              <div className="flex flex-col gap-2 mb-6">
                <button
                  onClick={() => {
                    setActiveTab('activity');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === 'activity' 
                      ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium font-space-grotesk">Activity</div>
                  <div className="text-xs opacity-70">Research progress</div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('sources');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === 'sources' 
                      ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium font-space-grotesk">Sources</div>
                  <div className="text-xs opacity-70">Found references</div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === 'settings' 
                      ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium font-space-grotesk">Settings</div>
                  <div className="text-xs opacity-70">API configuration</div>
                </button>
              </div>
              
              {/* Mobile sidebar content */}
              <div className="flex-1 overflow-y-auto">
                {/* Content will be rendered here based on activeTab */}
                {activeTab === 'activity' && (
                  <div className="space-y-3">
                    {activityTabs.map((tab, index) => {
                      const getTabTextColor = (type: string, status?: string) => {
                        if (status === 'failed') return 'text-red-300';
                        switch (type) {
                          case 'error': return 'text-red-300';
                          case 'complete': return 'text-cyan-300';
                          case 'processing': return status === 'active' ? 'text-orange-300' : 'text-white';
                          default: return 'text-white';
                        }
                      };

                      const isActive = tab.status === 'active' && tab.type === 'processing';

                      return (
                        <div key={tab.id} className={`p-3 bg-white/5 rounded-lg border border-white/10 ${isActive ? 'animate-pulse' : ''}`}>
                          <div className={`text-sm font-medium font-space-grotesk ${getTabTextColor(tab.type, tab.status)} flex items-center gap-2`}>
                            {tab.title}
                            {isActive && <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>}
                          </div>
                          <div className="text-xs text-white/60 mt-1 font-light font-space-grotesk">
                            {tab.content}
                          </div>
                          <div className="text-xs text-white/40 mt-2">
                            {formatActivityTime(tab.timestamp)}
                          </div>
                        </div>
                      );
                    })}
                    {activityTabs.length === 0 && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <div className="text-white/60 text-sm font-light font-space-grotesk">
                          No research activity yet
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'sources' && (
                  <div className="space-y-3">
                    {(realtimeSources.length > 0 || (researchResult && researchResult.all_sources && researchResult.all_sources.length > 0)) ? (
                      (realtimeSources.length > 0 ? realtimeSources : researchResult!.all_sources).map((source: ResearchSource, index) => (
                        <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                             onClick={() => window.open(source.url, '_blank')}>
                          <div className="text-white text-sm font-medium font-space-grotesk mb-1 hover:text-cyan-300 transition-colors">
                            {source.title || 'Untitled Source'}
                          </div>
                          <div className="text-white/60 text-xs font-light font-space-grotesk">
                            {source.domain} • Layer {source.layer}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <div className="text-white/60 text-sm font-light font-space-grotesk">
                          {hasSearched && isResearching ? 'Research in progress...' : 'No research performed yet'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'settings' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white text-sm font-medium font-space-grotesk mb-2">Exa API Key</label>
                      <div className="flex">
                        <input
                          type={showExaKey ? "text" : "password"}
                          value={exaApiKey}
                          onChange={(e) => handleExaKeyChange(e.target.value)}
                          placeholder="Enter your Exa API key..."
                          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-l-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          onClick={() => setShowExaKey(!showExaKey)}
                          className="px-3 py-2 bg-white/10 border border-l-0 border-white/20 rounded-r-lg text-white/60 hover:text-white"
                        >
                          {showExaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button 
                        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline"
                        onClick={() => window.open('https://exa.ai/?utm_source=cerebras-research', '_blank')}
                      >
                        Get API Key →
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-white text-sm font-medium font-space-grotesk mb-2">Cerebras API Key</label>
                      <div className="flex">
                        <input
                          type={showCerebrasKey ? "text" : "password"}
                          value={cerebrasApiKey}
                          onChange={(e) => handleCerebrasKeyChange(e.target.value)}
                          placeholder="Enter your Cerebras API key..."
                          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-l-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          onClick={() => setShowCerebrasKey(!showCerebrasKey)}
                          className="px-3 py-2 bg-white/10 border border-l-0 border-white/20 rounded-r-lg text-white/60 hover:text-white"
                        >
                          {showCerebrasKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button 
                        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline"
                        onClick={() => window.open('https://cloud.cerebras.ai?utm_source=deepresearchdemo', '_blank')}
                      >
                        Get API Key →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="h-full flex flex-col pt-16 md:pt-20">
        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
                     {/* Main Content */}
           <div className="flex-1 flex flex-col md:mr-80 lg:mr-96 px-4 sm:px-6">
             {/* Hero Section or Research Status */}
             {!hasSearched ? (
               <div className="flex-1 flex flex-col justify-center items-center gap-8 sm:gap-12 py-8 sm:py-12">
                 <div className="text-center space-y-4 sm:space-y-6">
                   <div className="bg-gradient-to-b from-[#2BFFFF] to-[#1CA3A3] bg-clip-text text-transparent text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-space-grotesk leading-tight">
                     Deep Research
                   </div>
                   <div className="text-white/70 text-base sm:text-lg md:text-xl font-light font-space-grotesk leading-normal max-w-2xl">
                     AI-powered research that goes deeper than search
                   </div>
                 </div>

                 <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                   {questions.map((question, index) => (
                     <div key={index} 
                          className="p-4 sm:p-6 bg-white/5 backdrop-blur-[5.10px] rounded-lg border border-white/10 flex justify-between items-start gap-3 sm:gap-4 hover:bg-white/10 transition-all cursor-pointer group"
                          onClick={() => handleSuggestedSearch(question)}>
                       <div className="flex-1 text-white/95 text-sm sm:text-base font-light font-space-grotesk leading-tight group-hover:text-white transition-colors">
                         {question}
                       </div>
                       <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/10 rounded-full flex justify-center items-center group-hover:bg-gradient-to-b group-hover:from-[#2BFFFF] group-hover:to-[#1CA3A3] transition-all flex-shrink-0">
                         <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-white/80 group-hover:text-black transition-colors" />
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ) : isResearching ? (
               <div className="flex-1 flex flex-col justify-center items-center py-8">
                 <div className="w-full max-w-4xl space-y-6">
                   {/* Progress Bar */}
                   <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                     <div 
                       className="h-full bg-gradient-to-r from-cyan-400 via-teal-500 to-cyan-600 transition-all duration-300 ease-out"
                       style={{ width: `${progress}%` }}
                     />
                   </div>
                   
                   {/* Progress Info */}
                   <div className="text-center space-y-3">
                     <div className="text-cyan-400 text-2xl sm:text-3xl font-bold font-space-grotesk">
                       {progress}%
                     </div>
                     <div className="text-white/80 text-sm sm:text-base font-light font-space-grotesk max-w-2xl mx-auto">
                       {currentQuery 
                         ? `Current query: "${currentQuery.length > 80 ? currentQuery.substring(0, 80) + '...' : currentQuery}"`
                         : `Searching web for: "${currentSearch.length > 80 ? currentSearch.substring(0, 80) + '...' : currentSearch}"`
                       }
                     </div>
                     <div className="text-white/60 text-xs sm:text-sm font-light font-space-grotesk">
                       {currentStage || `Updated ${formatActivityTime(searchStartTime)} • Time until timeout: ${formatTime(timeLeft)}`}
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col py-6 overflow-y-auto">
                 {/* Chat-like results area */}
                 <div className="flex-1 space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full">
                   {/* User query bubble */}
                   <div className="flex justify-end">
                     <div className="bg-gradient-to-b from-[#2BFFFF] to-[#1CA3A3] text-black px-4 sm:px-6 py-3 sm:py-4 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-lg">
                       <div className="text-sm sm:text-base font-medium font-space-grotesk">
                         {currentSearch}
                       </div>
                     </div>
                   </div>

                   {/* AI response bubble */}
                   {researchResult && researchResult.final_synthesis && (
                     <div className="flex justify-start">
                       <div className="bg-white/10 backdrop-blur-md text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl max-w-[95%] sm:max-w-[90%] border border-white/20 shadow-lg">
                         <div className="text-sm sm:text-base font-light font-space-grotesk leading-relaxed">
                           {formatMarkdownText(researchResult.final_synthesis)}
                         </div>
                         <div className="mt-3 sm:mt-4 pt-3 border-t border-white/10 text-xs sm:text-sm text-white/60 font-light font-space-grotesk">
                           Based on {researchResult.total_sources} sources • Research time: {researchResult.research_time.toFixed(1)}s
                           {researchResult.source_utilization && (
                             <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                               <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100 text-sm sm:text-base">Source Utilization Analysis</h4>
                               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                                 <div>
                                   <span className="text-gray-600 dark:text-gray-400">Sources Used:</span>
                                   <div className="font-mono text-sm sm:text-lg">
                                     {researchResult.source_utilization.sourcesUsed}/{researchResult.source_utilization.totalSources}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="text-gray-600 dark:text-gray-400">Utilization:</span>
                                   <div className={`font-mono text-sm sm:text-lg ${
                                     researchResult.source_utilization.utilizationScore > 0.7 ? 'text-green-600 dark:text-green-400' :
                                     researchResult.source_utilization.utilizationScore > 0.5 ? 'text-yellow-600 dark:text-yellow-400' :
                                     'text-red-600 dark:text-red-400'
                                   }`}>
                                     {(researchResult.source_utilization.utilizationScore * 100).toFixed(1)}%
                                   </div>
                                 </div>
                                 <div>
                                   <span className="text-gray-600 dark:text-gray-400">Domains Found:</span>
                                   <div className="font-mono text-xs sm:text-sm">
                                     {researchResult.source_utilization.domainsFound.length}
                                   </div>
                                 </div>
                                 <div>
                                   <span className="text-gray-600 dark:text-gray-400">Citation Check:</span>
                                   <div className={`font-mono text-xs sm:text-sm ${
                                     researchResult.source_utilization.foundCitations ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                   }`}>
                                     {researchResult.source_utilization.foundCitations ? '❌ Found' : '✅ Clean'}
                                   </div>
                                 </div>
                               </div>
                              
                               {/* Detailed verification button */}
                               <button
                                 onClick={() => {
                                   console.log('📋 DETAILED SOURCE VERIFICATION:');
                                   console.log('Open browser console to see detailed verification report');
                                   console.log('This report shows exactly which sources were used and how');
                                 }}
                                 className="mt-3 px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                               >
                                 📋 View Detailed Verification (Console)
                               </button>
                             </div>
                           )}
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Error state */}
                   {researchError && (
                     <div className="flex justify-start">
                       <div className="bg-red-500/10 backdrop-blur-md text-red-300 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl border border-red-500/20 max-w-[95%] sm:max-w-[90%]">
                         <div className="text-sm sm:text-base font-light font-space-grotesk">
                           {researchError}
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             )}
           </div>

           {/* Desktop Sidebar */}
           <div className="hidden md:block fixed right-0 top-16 md:top-20 bottom-0 w-80 lg:w-96 bg-gradient-to-br from-[#2BFFFF]/10 via-[#2BFFFF]/0 to-[#1CA3A3]/5 backdrop-blur-[20px] border-l border-white/20 z-20">
             <div className="flex flex-col h-full p-4 lg:p-6">
               {/* Desktop tab navigation */}
               <div className="flex justify-center items-center mb-6">
                 <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                   <button
                     onClick={() => setActiveTab('activity')}
                     className={`px-3 lg:px-4 py-2 rounded-md text-sm font-medium font-space-grotesk transition-all ${
                       activeTab === 'activity' 
                         ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                         : 'text-white/70 hover:text-white hover:bg-white/5'
                     }`}
                   >
                     Activity
                   </button>
                   <button
                     onClick={() => setActiveTab('sources')}
                     className={`px-3 lg:px-4 py-2 rounded-md text-sm font-medium font-space-grotesk transition-all ${
                       activeTab === 'sources' 
                         ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                         : 'text-white/70 hover:text-white hover:bg-white/5'
                     }`}
                   >
                     Sources
                   </button>
                   <button
                     onClick={() => setActiveTab('settings')}
                     className={`px-3 lg:px-4 py-2 rounded-md text-sm font-medium font-space-grotesk transition-all ${
                       activeTab === 'settings' 
                         ? 'bg-gradient-to-r from-[#2BFFFF]/20 to-[#1CA3A3]/10 text-cyan-300 border border-cyan-500/30' 
                         : 'text-white/70 hover:text-white hover:bg-white/5'
                     }`}
                   >
                     Settings
                   </button>
                 </div>
               </div>

               {/* Desktop sidebar content */}
               <div className="flex-1 overflow-y-auto">
                 {activeTab === 'activity' && (
                   <div className="space-y-3">
                     {activityTabs.map((tab, index) => {
                       const getTabColor = (type: string, status?: string) => {
                         if (status === 'failed') return 'outline-[#EF4444]';
                         switch (type) {
                           case 'query': return 'outline-[#3B82F6]';
                           case 'sources': return 'outline-[#10B981]';
                           case 'processing': return status === 'active' ? 'outline-[#F59E0B]' : 'outline-[#64748B]';
                           case 'complete': return 'outline-[#06B6D4]';
                           case 'error': return 'outline-[#EF4444]';
                           default: return 'outline-white/20';
                         }
                       };

                       const getTabTextColor = (type: string, status?: string) => {
                         if (status === 'failed') return 'text-red-300';
                         switch (type) {
                           case 'error': return 'text-red-300';
                           case 'complete': return 'text-cyan-300';
                           case 'processing': return status === 'active' ? 'text-orange-300' : 'text-white';
                           default: return 'text-white';
                         }
                       };

                       const getElapsedTime = (timestamp: Date) => {
                         const now = new Date();
                         const elapsed = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
                         if (elapsed < 60) return `${elapsed}s`;
                         const minutes = Math.floor(elapsed / 60);
                         const seconds = elapsed % 60;
                         return `${minutes}m ${seconds}s`;
                       };

                       const isActive = tab.status === 'active' && tab.type === 'processing';

                       return (
                         <div key={tab.id} className={`self-stretch px-3.5 py-3 relative bg-gradient-to-b from-white/10 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-start items-start gap-1 overflow-hidden ${isActive ? 'animate-pulse' : ''}`}>
                           <div className="flex-1 inline-flex flex-col justify-start items-start gap-1">
                             <div className={`self-stretch justify-start text-sm font-medium font-['Space_Grotesk'] leading-tight ${getTabTextColor(tab.type, tab.status)} flex items-center gap-2`}>
                               {tab.title}
                               {isActive && (
                                 <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                               )}
                               {tab.status === 'completed' && tab.type === 'processing' && (
                                 <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                               )}
                             </div>
                             <div className={`self-stretch justify-start text-xs font-light font-['Space_Grotesk'] leading-tight ${tab.type === 'error' ? 'text-red-200' : 'text-white/70'}`}>
                               {tab.content}
                             </div>
                             {tab.details && (
                               <div className="self-stretch flex flex-col gap-1 mt-1">
                                 {tab.details.progress !== undefined && tab.status === 'active' && tab.type === 'processing' && (
                                   <div className="flex items-center gap-2">
                                     <div className="flex-1 bg-white/20 rounded-full h-1">
                                       <div 
                                         className="bg-gradient-to-r from-cyan-400 to-blue-400 h-1 rounded-full transition-all duration-300"
                                         style={{ width: `${tab.details.progress}%` }}
                                       ></div>
                                     </div>
                                     <span className="text-xs text-white/60">{Math.round(tab.details.progress)}%</span>
                                   </div>
                                 )}
                                 {tab.details.sourcesFound !== undefined && tab.details.sourcesFound > 0 && tab.status === 'completed' && (
                                   <div className="text-xs text-white/60">
                                     {tab.details.sourcesFound} sources collected
                                   </div>
                                 )}
                                 {tab.details.currentStep && tab.status === 'active' && (
                                   <div className="text-xs text-orange-300 font-medium">
                                     {tab.details.currentStep}
                                   </div>
                                 )}
                               </div>
                             )}
                           </div>
                           <div className="flex flex-col items-end gap-1">
                             <div className="justify-start text-white/70 text-xs font-light font-['Space_Grotesk'] leading-none">
                               {formatActivityTime(tab.timestamp)}
                             </div>
                             {isActive && (
                               <div className="text-xs text-orange-300 font-medium">
                                 {getElapsedTime(tab.timestamp)}
                               </div>
                             )}
                           </div>
                           <div className={`w-0 h-full left-[2px] top-0 absolute outline outline-2 outline-offset-[-1px] ${getTabColor(tab.type, tab.status)} blur-[2px]`}></div>
                         </div>
                       );
                     })}

                     {activityTabs.length === 0 && (
                       <div className="self-stretch px-3.5 py-3 relative bg-gradient-to-b from-white/5 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.16)] outline outline-1 outline-offset-[-1px] outline-white/5 inline-flex justify-start items-start gap-3 overflow-hidden">
                         <div className="flex-1 justify-start text-white/60 text-sm font-light font-['Space_Grotesk'] leading-tight">
                           No research activity yet
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 {activeTab === 'sources' && (
                   <div className="flex flex-col gap-3">
                     {(realtimeSources.length > 0 || (researchResult && researchResult.all_sources && researchResult.all_sources.length > 0)) ? (
                       (realtimeSources.length > 0 ? realtimeSources : researchResult!.all_sources).map((source: ResearchSource, index) => (
                         <div key={index} className="self-stretch px-3 py-2 relative bg-gradient-to-b from-white/10 to-white/0 rounded-lg shadow-[inset_0px_0px_8px_1px_rgba(255,255,255,0.25)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-start items-start gap-2 overflow-hidden hover:from-white/15 transition-all cursor-pointer"
                              onClick={() => window.open(source.url, '_blank')}>
                           <div className="flex-1 inline-flex flex-col justify-start items-start gap-0.5">
                             <div className="self-stretch justify-start text-white text-sm font-medium font-['Space_Grotesk'] leading-tight hover:text-cyan-300 transition-colors">
                               {source.title || 'Untitled Source'}
                             </div>
                             <div className="self-stretch justify-start text-white/60 text-xs font-light font-['Space_Grotesk'] leading-tight">
                               {source.domain} • Layer {source.layer} • {source.word_count} words
                             </div>
                           </div>
                           <ArrowUpRight className="w-3 h-3 text-white/40 mt-0.5 flex-shrink-0" />
                         </div>
                       ))
                     ) : hasSearched && isResearching ? (
                       <div className="self-stretch px-3.5 py-3 relative bg-gradient-to-b from-white/10 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-start items-start gap-3 overflow-hidden">
                         <div className="flex-1 justify-start text-white text-sm font-light font-['Space_Grotesk'] leading-tight">
                           Research in progress...
                         </div>
                       </div>
                     ) : (
                       <>
                         <div className="self-stretch px-3.5 py-3 relative bg-gradient-to-b from-white/5 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.16)] outline outline-1 outline-offset-[-1px] outline-white/5 inline-flex justify-start items-start gap-3 overflow-hidden">
                           <div className="flex-1 justify-start text-white/60 text-sm font-light font-['Space_Grotesk'] leading-tight">
                             No research performed yet
                           </div>
                         </div>
                         <div className="self-stretch px-3.5 py-3 relative bg-gradient-to-b from-white/5 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.16)] outline outline-1 outline-offset-[-1px] outline-white/5 inline-flex justify-start items-start gap-3 overflow-hidden">
                           <div className="flex-1 justify-start text-white/40 text-sm font-light font-['Space_Grotesk'] leading-tight">
                             Start a search to see clickable research sources
                           </div>
                         </div>
                       </>
                     )}
                   </div>
                 )}

                 {activeTab === 'settings' && (
                   <div className="self-stretch inline-flex flex-col justify-start items-start gap-6">
                     {/* API Keys Section */}
                     <div className="self-stretch flex flex-col justify-start items-start gap-4">
                       <div className="w-full justify-start text-white text-base font-medium font-['Space_Grotesk'] leading-tight">API Keys</div>
                       
                       {/* API Keys Status */}
                       <div className={`self-stretch px-3.5 py-3 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-between items-center overflow-hidden ${
                         apiKeysConfigured 
                           ? 'bg-gradient-to-b from-green-500/20 to-green-600/10' 
                           : 'bg-gradient-to-b from-red-500/20 to-red-600/10'
                       }`}>
                         <div className={`justify-start text-sm font-medium font-['Space_Grotesk'] leading-tight ${
                           apiKeysConfigured ? 'text-green-300' : 'text-red-300'
                         }`}>
                           {apiKeysConfigured ? 'API Keys Configured ✓' : 'API Keys Required'}
                         </div>
                       </div>

                       {/* Exa API Key */}
                       <div className="self-stretch flex flex-col justify-start items-start gap-2">
                         <div className="self-stretch inline-flex justify-between items-center">
                           <div className="flex-1 justify-start text-white text-sm font-light font-['Space_Grotesk'] leading-tight">Exa API Key</div>
                           <button 
                             className="px-3 py-1.5 bg-gradient-to-r from-[#2BFFFF] to-[#1CA3A3] hover:from-[#40ffff] hover:to-[#22b5b5] rounded-lg outline outline-1 outline-cyan-400/50 hover:outline-cyan-300 text-black text-xs font-medium font-['Space_Grotesk'] transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25"
                             onClick={() => window.open('https://exa.ai/?utm_source=cerebras-research', '_blank')}
                           >
                             Get API Key →
                           </button>
                         </div>
                         <div className="self-stretch px-3.5 py-3 bg-gradient-to-b from-white/10 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-between items-center overflow-hidden">
                           <input
                             type={showExaKey ? "text" : "password"}
                             value={exaApiKey}
                             onChange={(e) => handleExaKeyChange(e.target.value)}
                             placeholder="Enter your Exa API key..."
                             className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium font-['Space_Grotesk'] leading-tight placeholder:text-white/40"
                           />
                           <button
                             onClick={() => setShowExaKey(!showExaKey)}
                             className="ml-2 p-1 text-white/60 hover:text-white transition-colors"
                           >
                             {showExaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                           </button>
                         </div>
                       </div>

                       {/* Cerebras API Key */}
                       <div className="self-stretch flex flex-col justify-start items-start gap-2">
                         <div className="self-stretch inline-flex justify-between items-center">
                           <div className="flex-1 justify-start text-white text-sm font-light font-['Space_Grotesk'] leading-tight">Cerebras API Key</div>
                           <button 
                             className="px-3 py-1.5 bg-gradient-to-r from-[#2BFFFF] to-[#1CA3A3] hover:from-[#40ffff] hover:to-[#22b5b5] rounded-lg outline outline-1 outline-cyan-400/50 hover:outline-cyan-300 text-black text-xs font-medium font-['Space_Grotesk'] transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25"
                             onClick={() => window.open('https://cloud.cerebras.ai?utm_source=deepresearchdemo', '_blank')}
                           >
                             Get API Key →
                           </button>
                         </div>
                         <div className="self-stretch px-3.5 py-3 bg-gradient-to-b from-white/10 to-white/0 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 inline-flex justify-between items-center overflow-hidden">
                           <input
                             type={showCerebrasKey ? "text" : "password"}
                             value={cerebrasApiKey}
                             onChange={(e) => handleCerebrasKeyChange(e.target.value)}
                             placeholder="Enter your Cerebras API key..."
                             className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium font-['Space_Grotesk'] leading-tight placeholder:text-white/40"
                           />
                           <button
                             onClick={() => setShowCerebrasKey(!showCerebrasKey)}
                             className="ml-2 p-1 text-white/60 hover:text-white transition-colors"
                           >
                             {showCerebrasKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                           </button>
                         </div>
                       </div>
                     </div>

                     {/* Model Usage Info */}
                     <div className="self-stretch flex flex-col justify-start items-start gap-4">
                       <div className="w-full justify-start text-white text-base font-medium font-['Space_Grotesk'] leading-tight">Model Configuration</div>
                       
                       <div className="self-stretch px-3.5 py-3 rounded-xl shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 bg-gradient-to-b from-blue-500/20 to-blue-600/10">
                         <div className="text-blue-300 text-sm font-medium font-['Space_Grotesk'] leading-tight mb-2">
                           Intelligent Model Selection ✨
                         </div>
                         <div className="text-white/80 text-sm font-light font-['Space_Grotesk'] leading-normal">
                           The system automatically uses all available Cerebras models with intelligent cycling, rate limiting, and failover for optimal performance.
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </div>
         </div>

         {/* Search Bar */}
         <div className="px-4 sm:px-6 py-4 border-t border-white/10 md:mr-80 lg:mr-96">
           <div className="flex items-center gap-3 max-w-4xl mx-auto">
             <input
               type="text"
               className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-sm sm:text-base placeholder:text-white/40 focus:outline-none focus:border-cyan-400 transition-colors"
               placeholder="What would you like to research?"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               onKeyPress={handleKeyPress}
             />
             <button 
               className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                 isResearching 
                   ? 'bg-gray-600 cursor-not-allowed text-white' 
                   : 'bg-gradient-to-r from-[#2BFFFF] to-[#1CA3A3] hover:from-[#40ffff] hover:to-[#22b5b5] text-black'
               }`}
               onClick={handleSearch}
               disabled={isResearching}
             >
               {isResearching ? (
                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
               ) : (
                 <ArrowRight className="w-5 h-5" />
               )}
               <span className="hidden sm:inline">
                 {isResearching ? 'Researching...' : 'Research'}
               </span>
             </button>
           </div>
         </div>
               </div>

      {/* API Key Setup Notification */}
      {showApiKeyNotification && !apiKeysConfigured && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-white/15 to-white/5 rounded-2xl shadow-[inset_0px_0px_20px_4px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/20 backdrop-blur-[20px] p-6 sm:p-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="text-white text-xl font-bold font-space-grotesk leading-tight mb-4">
                🚀 Get Started with Deep Research
              </div>
              <div className="text-white/80 text-sm font-light font-space-grotesk leading-normal mb-6">
                To use this AI research system, you'll need API keys from both services. Don't worry - both offer free tiers to get started!
              </div>
              
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-400/30">
                  <div className="text-left">
                    <div className="text-blue-300 text-sm font-medium">Exa Search API</div>
                    <div className="text-white/70 text-xs">Web search & content</div>
                  </div>
                  <button 
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#2BFFFF] to-[#1CA3A3] hover:from-[#40ffff] hover:to-[#22b5b5] rounded-lg text-black text-xs font-medium transition-all hover:scale-105"
                    onClick={() => window.open('https://exa.ai/?utm_source=cerebras-research', '_blank')}
                  >
                    Get Free Key →
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-500/20 to-red-500/10 rounded-lg border border-orange-400/30">
                  <div className="text-left">
                    <div className="text-orange-300 text-sm font-medium">Cerebras Cloud API</div>
                    <div className="text-white/70 text-xs">AI inference & analysis</div>
                  </div>
                  <button 
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#2BFFFF] to-[#1CA3A3] hover:from-[#40ffff] hover:to-[#22b5b5] rounded-lg text-black text-xs font-medium transition-all hover:scale-105"
                    onClick={() => window.open('https://cloud.cerebras.ai?utm_source=deepresearchdemo', '_blank')}
                  >
                    Get Free Key →
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  className="px-4 sm:px-6 py-3 bg-gradient-to-b from-gray-600 to-gray-700 rounded-lg shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)] text-white text-sm font-medium font-space-grotesk leading-tight hover:from-gray-500 hover:to-gray-600 transition-all"
                  onClick={() => setShowApiKeyNotification(false)}
                >
                  I'll Set This Up Later
                </button>
                <button 
                  className="px-4 sm:px-6 py-3 bg-gradient-to-b from-[#2BFFFF] to-[#1CA3A3] rounded-lg shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)] text-black text-sm font-medium font-space-grotesk leading-tight hover:from-[#40ffff] hover:to-[#22b5b5] transition-all"
                  onClick={() => {
                    setActiveTab('settings');
                    setShowApiKeyNotification(false);
                    setIsMobileSidebarOpen(true);
                  }}
                >
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error/Timeout Popup */}
      {(showTimeoutPopup || researchError) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-white/15 to-white/5 rounded-2xl shadow-[inset_0px_0px_20px_4px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/20 backdrop-blur-[20px] p-6 sm:p-8 max-w-lg mx-auto">
            <div className="text-center">
              {/* Header with icon based on error type */}
              <div className="mb-4">
                {researchError?.includes('credits exhausted') ? (
                  <div className="text-6xl mb-2">💳</div>
                ) : researchError?.includes('Cerebras API rate limit exceeded') ? (
                  <div className="text-6xl mb-2">⚡</div>
                ) : researchError?.includes('rate limit') ? (
                  <div className="text-6xl mb-2">🚦</div>
                ) : researchError ? (
                  <div className="text-6xl mb-2">❌</div>
                ) : (
                  <div className="text-6xl mb-2">⏰</div>
                )}
                <div className="text-white text-xl font-bold font-space-grotesk leading-tight">
                  {researchError?.includes('credits exhausted') 
                    ? 'API Credits Exhausted'
                    : researchError?.includes('Cerebras API rate limit exceeded')
                    ? 'AI Models Temporarily Busy'
                    : researchError?.includes('rate limit')
                    ? 'Rate Limit Reached'
                    : researchError ? 'Research Failed' : 'Research Timeout'}
                </div>
              </div>
              
              <div className="text-white/80 text-sm font-light font-space-grotesk leading-normal mb-6">
                {researchError?.includes('credits exhausted') 
                  ? 'Your API credits have been used up. Please check your API provider dashboards and add more credits to continue.'
                  : researchError?.includes('Cerebras API rate limit exceeded')
                  ? 'The AI models are currently experiencing high demand. Please wait a moment and try again.'
                  : researchError?.includes('rate limit')
                  ? 'You\'ve hit the rate limit for API calls. Please wait a moment before trying again.'
                  : researchError
                  ? `Research encountered an error: ${researchError}`
                  : 'The research took longer than expected and was cancelled. You can try again with a more specific query.'}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  className="px-4 sm:px-6 py-3 bg-gradient-to-b from-gray-600 to-gray-700 rounded-lg shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)] text-white text-sm font-medium font-space-grotesk leading-tight hover:from-gray-500 hover:to-gray-600 transition-all"
                  onClick={() => {
                    setShowTimeoutPopup(false);
                    setResearchError(null);
                  }}
                >
                  Close
                </button>
                {!researchError?.includes('credits exhausted') && (
                  <button 
                    className="px-4 sm:px-6 py-3 bg-gradient-to-b from-[#2BFFFF] to-[#1CA3A3] rounded-lg shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)] text-black text-sm font-medium font-space-grotesk leading-tight hover:from-[#40ffff] hover:to-[#22b5b5] transition-all"
                    onClick={() => {
                      setShowTimeoutPopup(false);
                      setResearchError(null);
                      if (currentSearch) {
                        handleSuggestedSearch(currentSearch);
                      }
                    }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;