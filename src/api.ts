/**
 * Real Multi-Agent Research System
 * Uses actual Exa and Cerebras APIs with parallel agent execution
 * Follows Anthropic's multi-agent research framework
 */

const API_BASE_URL = '/api'; // Keep for compatibility but won't be used

export interface ResearchRequest {
  query: string;
  max_layers?: number;
  sources_per_layer?: number;
}

export interface ResearchSource {
  url: string;
  title: string;
  content: string;
  word_count: number;
  exa_score: number;
  layer: number;
  query_used: string;
  relevance_score: number;
  domain: string;
}

export interface LayerSummary {
  layer: number;
  description: string;
  sources_found: number;
  key_findings: string;
  confidence_gaps: string[];
  queries_used: string[];
}

export interface ResearchResult {
  original_query: string;
  topic_type: string;
  layer_summaries: LayerSummary[];
  all_sources: ResearchSource[];
  final_synthesis: string;
  total_sources: number;
  research_time: number;
  timestamp: string;
  status: string;
  source_utilization?: {
    utilizationScore: number;
    sourcesUsed: number;
    totalSources: number;
    domainsFound: string[];
    missingDomains: string[];
    entitiesFound: string[];
    missingEntities: string[];
    foundCitations?: boolean;
    sourceDetails?: Array<{
      title: string;
      domain: string;
      used: boolean;
      matchedTerms: string[];
      confidence: number;
    }>;
    verificationReport?: string;
  };
}

export interface ProgressUpdate {
  stage: string;
  query: string;
  layer: number;
  sources_found: number;
  total_sources: number;
  progress_percent: number;
  completed: boolean;
  error: string | null;
  final_result: ResearchResult | null;
  activity_updates?: Array<{
    id: string;
    title: string;
    content: string;
    timestamp: string;
    type: 'query' | 'sources' | 'processing' | 'complete' | 'error';
    progress?: number; // Individual progress for this activity
    status?: 'pending' | 'active' | 'completed' | 'failed';
  }>;
  streaming_sources?: Array<{
    title: string;
    domain: string;
    url: string;
    snippet: string;
    task_id: string;
    agent_id: string;
    timestamp: string;
  }>;
}

// Real API Services
class ExaAPIService {
  private apiKey: string = '';
  private lastRequestTime: number = 0;
  private minDelay: number = 200; // 5 requests per second = 200ms minimum delay
  private requestCount: number = 0;
  private requestWindow: number = Date.now();

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getApiUrl(endpoint: string): string {
    // Check if we're in production (deployed) vs development
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    if (isProduction) {
      // Use proxy endpoint in production
      return `/api/exa/${endpoint}`;
    } else {
      // Direct API call in development
      return `https://api.exa.ai/${endpoint}`;
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset request count every second (5 requests per second limit)
    if (now - this.requestWindow > 1000) {
      this.requestCount = 0;
      this.requestWindow = now;
    }
    
    // If we've hit the 5 requests per second limit, wait
    if (this.requestCount >= 5) {
      const waitTime = 1000 - (now - this.requestWindow) + 50; // Wait until next second + small buffer
      if (waitTime > 0) {
        console.log(`⏳ Exa rate limit: waiting ${Math.round(waitTime)}ms (${this.requestCount}/5 requests this second)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.requestWindow = Date.now();
      }
    }
    
    // Ensure minimum delay between requests (200ms for 5/sec)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async search(query: string, numResults: number = 10): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Exa API key not configured');
    }

    // Respect rate limits before making request
    await this.waitForRateLimit();

    console.log('🔑 API Key check:', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET');

    try {
      const apiUrl = this.getApiUrl('search');
      
      const requestBody = {
        query: query,
        num_results: numResults,
        type: 'neural',
        use_autoprompt: true,
        contents: {
          text: true
        }
      };

      console.log('🔍 Exa search request:', { url: apiUrl, body: requestBody });
      
      // Check if we're in production and try different approaches
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      
      let response;
      if (isProduction) {
        // Try with query parameter for production (in case headers aren't working)
        const urlWithKey = `${apiUrl}?api_key=${encodeURIComponent(this.apiKey)}`;
        response = await fetch(urlWithKey, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          },
          body: JSON.stringify(requestBody)
        });
      }
      
      console.log('📡 Exa search response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Exa API error details:', errorText);
        
        // Handle specific error codes
        if (response.status === 429) {
          throw new Error('Exa API rate limit exceeded. Please wait a moment and try again.');
        }
        
        if (response.status === 402) {
          throw new Error('Exa API credits exhausted. Please top up your account at dashboard.exa.ai to continue using the service.');
        }
        
        if (response.status === 401) {
          throw new Error('Exa API authentication failed. Please check your API key.');
        }
        
        if (response.status === 403) {
          throw new Error('Exa API access forbidden. Please check your API key permissions.');
        }
        
        // If production fails, try direct API call as fallback
        if (isProduction && response.status === 400) {
          console.log('🔄 Trying direct API call as fallback...');
          const directResponse = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey
            },
            body: JSON.stringify(requestBody)
          });
          
          if (directResponse.ok) {
            const data = await directResponse.json();
            console.log('✅ Direct API call succeeded');
            return data.results || [];
          }
          
          if (directResponse.status === 429) {
            throw new Error('Exa API rate limit exceeded. Please wait a moment and try again.');
          }
        }
        
        throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Exa search data:', data);
      return data.results || [];
    } catch (error) {
      console.error('Exa search failed:', error);
      
      // Re-throw critical errors that should halt research
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('credits exhausted') || errorMessage.includes('402')) {
        throw error;
      }
      
      // For other errors, return empty array to continue research
      return [];
    }
  }

  async getContents(urls: string[]): Promise<any[]> {
    if (!this.apiKey || urls.length === 0) {
      return [];
    }

    // Respect rate limits before making request
    await this.waitForRateLimit();

    try {
      const apiUrl = this.getApiUrl('contents');
      
      const requestBody = {
        ids: urls,
        contents: {
          text: true
        }
      };

      console.log('📄 Exa contents request:', { url: apiUrl, body: requestBody });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Exa contents response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Exa contents API error details:', errorText);
        
        // Handle specific error codes for contents API
        if (response.status === 402) {
          throw new Error('Exa API credits exhausted. Please top up your account at dashboard.exa.ai to continue using the service.');
        }
        
        if (response.status === 429) {
          throw new Error('Exa API rate limit exceeded. Please wait a moment and try again.');
        }
        
        return [];
      }

      const data = await response.json();
      console.log('✅ Exa contents data:', data);
      return data.results || [];
    } catch (error) {
      console.error('Exa contents failed:', error);
      
      // Re-throw critical errors that should halt research
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('credits exhausted') || errorMessage.includes('402')) {
        throw error;
      }
      
      // For other errors, return empty array to continue research
      return [];
    }
  }
}

class CerebrasAPIService {
  private apiKey: string = '';
  private lastRequestTime: number = 0;
  private minDelay: number = 3000; // Increased to 3 seconds for rate limit compliance
  private requestCount: number = 0;
  private requestWindow: number = Date.now();
  
  // Available models for intelligent switching (4 distinct models now)
  private availableModels = [
    'llama-3.3-70b',
    'llama-3.1-8b',
    'llama-4-scout-17b-16e-instruct',
    'qwen-3-32b'
  ];
  
  // Model fallback chains for rate limit handling
  private modelChains: { [key: string]: string[] } = {
    'llama-3.3-70b': ['qwen-3-32b', 'llama-4-scout-17b-16e-instruct', 'llama-3.1-8b'],
    'llama-3.1-8b': ['qwen-3-32b', 'llama-3.3-70b', 'llama-4-scout-17b-16e-instruct'],
    'llama-4-scout-17b-16e-instruct': ['qwen-3-32b', 'llama-3.3-70b', 'llama-3.1-8b'],
    'qwen-3-32b': ['llama-3.3-70b', 'llama-4-scout-17b-16e-instruct', 'llama-3.1-8b']
  };
  
  // Track individual model rate limits and health
  private modelRequestCounts: { [key: string]: number } = {};
  private modelRequestWindows: { [key: string]: number } = {};
  private modelHealth: { [key: string]: boolean } = {};
  private modelFailureCount: { [key: string]: number } = {};
  private modelLastFailure: { [key: string]: number } = {};
  private currentModelIndex: number = 0;
  private lastCycleTime: number = 0;
  
  // Model cycling for 3x speedup
  private modelCycleIndex: number = 0;
  private healthyModels: string[] = [...this.availableModels];
  private lastHealthCheck: number = 0;

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    // Initialize all models as healthy
    this.availableModels.forEach(model => {
      this.modelHealth[model] = true;
      this.modelFailureCount[model] = 0;
      this.modelLastFailure[model] = 0;
    });
  }

  private getSelectedModel(): string {
    return localStorage.getItem('cerebras_model') || 'llama-3.3-70b';
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset request count every minute
    if (now - this.requestWindow > 60000) {
      this.requestCount = 0;
      this.requestWindow = now;
    }
    
    // If approaching rate limit, add extra delay
    if (this.requestCount >= 20) { // More conservative - stay well under 30/minute limit
      const waitTime = 60000 - (now - this.requestWindow) + 2000; // Wait until next minute + larger buffer
      if (waitTime > 0) {
        console.log(`⏳ Rate limit approached, waiting ${Math.round(waitTime/1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.requestWindow = Date.now();
      }
    }
    
    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
  
  private canUseModel(model: string): boolean {
    const now = Date.now();
    
    // Initialize tracking for new models
    if (!this.modelRequestCounts[model]) {
      this.modelRequestCounts[model] = 0;
      this.modelRequestWindows[model] = now;
    }
    
    // Reset if window expired
    if (now - this.modelRequestWindows[model] > 60000) {
      this.modelRequestCounts[model] = 0;
      this.modelRequestWindows[model] = now;
    }
    
    // Check if model is available (under 15 requests per minute per model)
    return this.modelRequestCounts[model] < 15;
  }
  
  private selectBestAvailableModel(preferredModel: string): string {
    // Check if preferred model is available
    if (this.canUseModel(preferredModel)) {
      return preferredModel;
    }
    
    console.log(`🔄 Model ${preferredModel} at rate limit, checking alternatives...`);
    
    // Try alternatives from chain
    const alternatives = this.modelChains[preferredModel] || [];
    for (const altModel of alternatives) {
      if (this.canUseModel(altModel)) {
        console.log(`   ✅ Switching to ${altModel}`);
        return altModel;
      }
    }
    
    // If all models are rate limited, return preferred and wait
    console.log(`   ⏳ All models busy, will wait for ${preferredModel}`);
    return preferredModel;
  }
  
  private registerModelUsage(model: string): void {
    if (!this.modelRequestCounts[model]) {
      this.modelRequestCounts[model] = 0;
      this.modelRequestWindows[model] = Date.now();
    }
    this.modelRequestCounts[model]++;
  }
  
  private updateHealthyModels(): void {
    const now = Date.now();
    
    // Check health every 10 seconds
    if (now - this.lastHealthCheck < 10000) return;
    this.lastHealthCheck = now;
    
    // Update healthy models list
    this.healthyModels = this.availableModels.filter(model => {
      // Check if model is in cooldown (2 minutes after 3 failures)
      const failures = this.modelFailureCount[model] || 0;
      const lastFailure = this.modelLastFailure[model] || 0;
      const cooldownTime = 120000; // 2 minutes
      
      if (failures >= 3 && (now - lastFailure) < cooldownTime) {
        const remainingCooldown = Math.ceil((cooldownTime - (now - lastFailure)) / 1000);
        if (this.modelHealth[model]) {
          console.log(`❄️ ${model} in cooldown for ${remainingCooldown}s (${failures} failures)`);
          this.modelHealth[model] = false;
        }
        return false;
      }
      
      // Reset failures after cooldown
      if (failures >= 3 && (now - lastFailure) >= cooldownTime) {
        console.log(`🔄 ${model} cooldown expired, resetting failure count`);
        this.modelFailureCount[model] = 0;
        this.modelHealth[model] = true;
      }
      
      // Check rate limits
      const canUse = this.canUseModel(model);
      if (!canUse && this.modelHealth[model]) {
        console.log(`⏳ ${model} temporarily rate limited`);
        // Don't mark as unhealthy for rate limits, just skip this cycle
        return false;
      }
      
      return this.modelHealth[model];
    });
    
    // If all models are unhealthy, reset failure counts (emergency recovery)
    if (this.healthyModels.length === 0) {
      console.log('🆘 All models unhealthy, emergency reset');
      this.availableModels.forEach(model => {
        this.modelHealth[model] = true;
        this.modelFailureCount[model] = 0;
      });
      this.healthyModels = [...this.availableModels];
    }
  }
  
  private recordModelFailure(model: string, errorType: string): void {
    this.modelFailureCount[model] = (this.modelFailureCount[model] || 0) + 1;
    this.modelLastFailure[model] = Date.now();
    
    const failures = this.modelFailureCount[model];
    console.log(`❌ ${model} failure #${failures} (${errorType})`);
    
    if (failures >= 3) {
      console.log(`🚫 ${model} marked unhealthy after 3 failures, entering 2min cooldown`);
      this.modelHealth[model] = false;
    }
  }
  
  private getNextModelInCycle(): string {
    this.updateHealthyModels();
    
    if (this.healthyModels.length === 0) {
      return this.availableModels[0]; // Fallback
    }
    
    // Cycle through healthy models
    const model = this.healthyModels[this.currentModelIndex % this.healthyModels.length];
    this.currentModelIndex++;
    
    return model;
  }
  
  private async waitForCycleTime(): Promise<void> {
    const now = Date.now();
    const cycleInterval = Math.max(250, 1000 / this.healthyModels.length); // Faster cycling: 1 second distributed across models
    
    const timeSinceLastCycle = now - this.lastCycleTime;
    if (timeSinceLastCycle < cycleInterval) {
      const waitTime = cycleInterval - timeSinceLastCycle;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCycleTime = Date.now();
  }

  private printModelStatus(): void {
    console.log('\n📊 Model Cycle Status:');
    const now = Date.now();
    
    for (const model of this.availableModels) {
      const count = this.modelRequestCounts[model] || 0;
      const failures = this.modelFailureCount[model] || 0;
      const lastFailure = this.modelLastFailure[model] || 0;
      const isHealthy = this.modelHealth[model];
      const canUse = this.canUseModel(model);
      
      let status = '🟢 In Cycle';
      let details = `${count}/15 requests`;
      
      if (failures >= 3) {
        const cooldownRemaining = Math.max(0, 120000 - (now - lastFailure));
        if (cooldownRemaining > 0) {
          status = '❄️ Cooldown';
          details = `${Math.ceil(cooldownRemaining / 1000)}s remaining`;
        } else {
          status = '🔄 Recovering';
        }
      } else if (!canUse) {
        status = '⏳ Rate Limited';
      } else if (!isHealthy) {
        status = '🔴 Unhealthy';
        details = `${failures}/3 failures`;
      } else if (failures > 0) {
        details = `${count}/15 requests, ${failures}/3 failures`;
      }
      
      const displayName = model.length > 20 ? model.substring(0, 20) + '...' : model;
      console.log(`   ${displayName}: ${status} (${details})`);
    }
    console.log(`   Active models: ${this.healthyModels.length}/${this.availableModels.length}`);
    const cycleTime = this.healthyModels.length > 0 ? Math.round(1000 / this.healthyModels.length) : 'N/A';
    console.log(`   Cycle interval: ${cycleTime}ms per model`);
    console.log();
  }
  
  private async chatWithModelSwitching(prompt: string, systemPrompt?: string, attemptedModels: Set<string> = new Set()): Promise<string> {
    const preferredModel = this.getSelectedModel();
    const selectedModel = this.selectBestAvailableModel(preferredModel);
    
    // Avoid infinite loops
    if (attemptedModels.has(selectedModel)) {
      throw new Error(`All model alternatives exhausted for ${preferredModel}`);
    }
    attemptedModels.add(selectedModel);
    
    try {
      // Register usage for rate limiting
      this.registerModelUsage(selectedModel);
      
      // Check if we're in production for API URL
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      const apiUrl = isProduction 
        ? '/api/cerebras/v1/chat/completions'
        : 'https://api.cerebras.ai/v1/chat/completions';

      const messages = systemPrompt 
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: this.preparePromptWithNoThink(prompt, selectedModel) }
          ]
        : [{ role: 'user', content: this.preparePromptWithNoThink(prompt, selectedModel) }];

      console.log('🧠 Cerebras request:', { url: apiUrl, model: selectedModel });

      let response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          max_tokens: 4000,
          temperature: 0.1,
          top_p: 0.95,
        }),
      });

      console.log('📡 Cerebras response:', response.status, response.statusText);

      if (response.status === 429) {
        console.log(`❌ Rate limit hit on ${selectedModel} during API call`);
        this.recordModelFailure(selectedModel, 'rate_limit');
        
        // Try model switching again with remaining alternatives
        const alternatives = this.modelChains[selectedModel] || [];
        for (const altModel of alternatives) {
          if (!attemptedModels.has(altModel)) {
            console.log(`🔄 Switching to ${altModel} after 429 error`);
            return await this.chatWithModelSwitching(prompt, systemPrompt, attemptedModels);
          }
        }
        
        // If no alternatives, throw specific rate limit error
        throw new Error('Cerebras API rate limit exceeded on all available models. Please wait a moment and try again.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cerebras API error on ${selectedModel}:`, response.status, errorText);
        
        // Try model switching on other errors too
        const alternatives = this.modelChains[selectedModel] || [];
        for (const altModel of alternatives) {
          if (!attemptedModels.has(altModel)) {
            console.log(`🔄 API error on ${selectedModel}, trying ${altModel}: ${response.status}`);
            return await this.chatWithModelSwitching(prompt, systemPrompt, attemptedModels);
          }
        }
        
        // Try direct API call as fallback if production fails
        if (isProduction && (response.status === 401 || response.status === 400)) {
          console.log('🔄 Trying direct Cerebras API call as fallback...');
          const directResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: selectedModel,
              messages,
              max_tokens: 4000,
              temperature: 0.1,
              top_p: 0.95,
            }),
          });
          
          if (directResponse.ok) {
            const data = await directResponse.json();
            console.log('✅ Direct Cerebras API call succeeded');
            let content = data.choices?.[0]?.message?.content || 'No response generated';
            // Remove thinking tags if present
            content = this.removeThinkingTags(content);
            return content;
          }
        }
        
        return 'API request failed';
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || 'No response generated';
      console.log(`✅ Successful API call on ${selectedModel}`);
      
      // Remove thinking tags if present (especially for qwen model)
      content = this.removeThinkingTags(content);
      
      return content;
      
    } catch (error) {
      console.error(`API error on ${selectedModel}:`, error);
      
      // Try alternative models before giving up
      const alternatives = this.modelChains[selectedModel] || [];
      for (const altModel of alternatives) {
        if (!attemptedModels.has(altModel)) {
          console.log(`🔄 Exception on ${selectedModel}, trying ${altModel}: ${error}`);
          return await this.chatWithModelSwitching(prompt, systemPrompt, attemptedModels);
        }
      }
      
      throw new Error(`All models failed for request: ${error}`);
    }
  }

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Cerebras API key not configured');
    }



    console.log('🔑 Cerebras API Key check:', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET');
    
    // Show current model status
    this.printModelStatus();

    // Use cycling approach for 3x speedup
    return await this.chatWithCycling(prompt, systemPrompt);
  }

  private async chatWithCycling(prompt: string, systemPrompt?: string, attemptCount: number = 0): Promise<string> {
    // Prevent infinite recursion
    if (attemptCount > 10) {
      console.log('🚫 Maximum retry attempts reached, all models failed');
      throw new Error('Cerebras API rate limit exceeded on all available models. Please wait a moment and try again.');
    }
    
    // Wait for our turn in the cycle (maintains 2-second total cycle time)
    await this.waitForCycleTime();
    
    // Get next model in cycle
    const selectedModel = this.getNextModelInCycle();
    
    try {
      // Register usage for tracking
      this.registerModelUsage(selectedModel);
      
      // Check if we're in production for API URL
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      const apiUrl = isProduction 
        ? '/api/cerebras/v1/chat/completions'
        : 'https://api.cerebras.ai/v1/chat/completions';

      // Estimate token count and truncate if needed
      const estimatedTokens = (prompt.length + (systemPrompt?.length || 0)) / 3.5; // Rough estimate
      let adjustedPrompt = this.preparePromptWithNoThink(prompt, selectedModel); // Add /no_think for qwen
      let adjustedSystemPrompt = systemPrompt;
      
      if (estimatedTokens > 7000) { // Leave room for response
        console.log(`⚠️ Content too long (${Math.round(estimatedTokens)} tokens), truncating for ${selectedModel}`);
        const maxPromptChars = Math.floor(7000 * 3.5 * 0.8); // 80% for user prompt
        const maxSystemChars = Math.floor(7000 * 3.5 * 0.2); // 20% for system prompt
        
        if (systemPrompt && systemPrompt.length > maxSystemChars) {
          adjustedSystemPrompt = systemPrompt.substring(0, maxSystemChars) + '...';
        }
        // Note: adjustedPrompt already has /no_think added, so we need to preserve that
        const basePrompt = selectedModel === 'qwen-3-32b' ? prompt : adjustedPrompt; 
        if (basePrompt.length > maxPromptChars) {
          const truncatedBase = basePrompt.substring(0, maxPromptChars) + '...';
          adjustedPrompt = selectedModel === 'qwen-3-32b' ? `/no_think\n\n${truncatedBase}` : truncatedBase;
        }
      }

      const adjustedMessages = adjustedSystemPrompt 
        ? [
            { role: 'system', content: adjustedSystemPrompt },
            { role: 'user', content: adjustedPrompt }
          ]
        : [{ role: 'user', content: adjustedPrompt }];

      console.log('🧠 Cerebras request:', { url: apiUrl, model: selectedModel });

      let response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: adjustedMessages,
          max_tokens: 4000,
          temperature: 0.1,
          top_p: 0.95,
        }),
      });

      console.log('📡 Cerebras response:', response.status, response.statusText);

      if (response.status === 429) {
        this.recordModelFailure(selectedModel, 'rate_limit');
        console.log(`❌ Rate limit hit on ${selectedModel}, trying next model in cycle`);
        
        // Check if we have healthy alternatives before recursing
        this.updateHealthyModels();
        if (this.healthyModels.length === 0) {
          console.log('🚫 All Cerebras models exhausted, escalating to research level');
          throw new Error('Cerebras API rate limit exceeded on all available models. Please wait a moment and try again.');
        }
        
        // Try next model in cycle immediately
        return await this.chatWithCycling(prompt, systemPrompt, attemptCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cerebras API error on ${selectedModel}:`, response.status, errorText);
        
        // Handle different error types
        if (response.status === 400 && errorText.includes('context_length_exceeded')) {
          this.recordModelFailure(selectedModel, 'context_length');
        } else if (response.status === 404) {
          this.recordModelFailure(selectedModel, 'model_not_found');
        } else if (response.status === 401) {
          this.recordModelFailure(selectedModel, 'auth_error');
        } else {
          this.recordModelFailure(selectedModel, `error_${response.status}`);
        }
        
        // Try next model in cycle
        return await this.chatWithCycling(prompt, systemPrompt, attemptCount + 1);
      }

      const data = await response.json();
      console.log(`✅ Successful API call on ${selectedModel}`);
      
      // Reset failure count on success
      if (this.modelFailureCount[selectedModel] > 0) {
        console.log(`🔄 ${selectedModel} success, resetting failure count`);
        this.modelFailureCount[selectedModel] = 0;
      }
      
      let content = data.choices[0]?.message?.content || 'No response generated';
      
      // Remove thinking tags if present (especially for qwen model)
      content = this.removeThinkingTags(content);
      
      return content;
      
    } catch (error) {
      console.error(`Exception on ${selectedModel}:`, error);
      this.recordModelFailure(selectedModel, 'exception');
      
      // Try next model in cycle
      return await this.chatWithCycling(prompt, systemPrompt, attemptCount + 1);
    }
  }

  private removeThinkingTags(content: string): string {
    // Remove <think>...</think> tags and their content
    return content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
  }

  private preparePromptWithNoThink(prompt: string, model: string): string {
    // Add /no_think instruction for qwen model to prevent thinking tags
    if (model === 'qwen-3-32b') {
      return `/no_think\n\n${prompt}`;
    }
    return prompt;
  }
}

// Specialist Research Agent
class SpecialistAgent {
  constructor(
    public agentId: string,
    public agentName: string,
    public specialization: string,
    private exaService: ExaAPIService,
    private cerebrasService: CerebrasAPIService,
    private globalSeenUrls: Set<string>
  ) {}

  async executeTask(
    originalQuery: string,
    task: string,
    onProgress: (update: any) => void
  ): Promise<{
    sources: ResearchSource[];
    findings: string;
    confidence_gaps: string[];
  }> {
    console.log(`🔍 ${this.agentName} starting task: ${task}`);
    
    const allSources: ResearchSource[] = [];
    const streamingSources: any[] = [];
    
    // Generate search queries for this task
    const queries = await this.generateSearchQueries(originalQuery, task);
    console.log(`Generated ${queries.length} search queries:`, queries);
    
    // Execute searches and collect sources
    for (const query of queries) {
      try {
        const targetCount = this.getSourceCountForQuery(originalQuery, task);
        console.log(`🔍 Searching for "${query}" (target: ${targetCount} sources)`);
        
        const results = await this.exaService.search(query, targetCount + 5); // Get extra for deduplication
        console.log(`Found ${results.length} search results`);
        
        // Process each result
        for (const result of results) {
          // Check if URL already seen globally
          if (this.globalSeenUrls.has(result.url)) {
            console.log(`🔄 Skipping duplicate: ${result.title.substring(0, 40)}... (already collected)`);
            continue;
          }
          
          // Mark URL as seen
          this.globalSeenUrls.add(result.url);
          
          // Get full content
          const contents = await this.exaService.getContents([result.url]);
          if (contents.length > 0) {
            const content = contents[0];
            const contentLength = (content.text || '').length;
            const wordCount = (content.text || '').split(/\s+/).length;
            
            const source: ResearchSource = {
              url: result.url,
              title: result.title,
              content: content.text || '',
              word_count: wordCount,
              exa_score: result.score || 0.5,
              layer: 1,
              query_used: query,
              relevance_score: result.score || 0.5,
              domain: this.extractDomain(result.url)
            };
            
            allSources.push(source);
            console.log(`📄 NEW Source: ${source.title.substring(0, 50)}... | ${contentLength} chars | ${wordCount} words | ${source.domain}`);
            
            // Add to streaming sources for real-time updates
            streamingSources.push({
              title: source.title,
              domain: source.domain,
              url: source.url,
              snippet: (source.content || '').substring(0, 300) + '...'
            });
            
            // Send real-time update
            onProgress({
              streaming_sources: [...streamingSources]
            });
            
            // Stop if we have enough sources
            if (allSources.length >= targetCount) {
              console.log(`✅ Reached target of ${targetCount} sources`);
              break;
            }
          }
        }
        
        // If still need more sources, try broader search
        if (allSources.length < targetCount) {
          console.log(`⚠️ Only found ${allSources.length}/${targetCount} sources, trying broader search...`);
          const broaderResults = await this.exaService.search(originalQuery, targetCount * 2);
          
          for (const result of broaderResults) {
            if (this.globalSeenUrls.has(result.url)) continue;
            
            this.globalSeenUrls.add(result.url);
            const contents = await this.exaService.getContents([result.url]);
            
            if (contents.length > 0) {
              const content = contents[0];
              const wordCount = (content.text || '').split(/\s+/).length;
              
              const source: ResearchSource = {
                url: result.url,
                title: result.title,
                content: content.text || '',
                word_count: wordCount,
                exa_score: result.score || 0.5,
                layer: 1,
                query_used: `${originalQuery} (broader)`,
                relevance_score: result.score || 0.5,
                domain: this.extractDomain(result.url)
              };
              
              allSources.push(source);
              console.log(`📄 BROADER Source: ${source.title.substring(0, 50)}... | ${source.domain}`);
              
              // Add to streaming sources
              streamingSources.push({
                title: source.title,
                domain: source.domain,
                url: source.url,
                snippet: (source.content || '').substring(0, 300) + '...'
              });
              
              // Send real-time update
              onProgress({
                streaming_sources: [...streamingSources]
              });
              
              if (allSources.length >= targetCount) break;
            }
          }
        }
        
        // Faster delay between queries for speed
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`Search failed for query "${query}":`, error);
        
        // Check if this is a critical error that should halt research
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('credits exhausted') || errorMessage.includes('402')) {
          // Re-throw critical errors like credit exhaustion
          throw error;
        }
        
        // For other errors, continue with next query
        continue;
      }
    }
    
    console.log(`🎯 ${this.agentName} collected ${allSources.length} unique sources`);
    
    // Analyze findings
    const findings = await this.analyzeFindings(allSources, originalQuery, task);
    const confidence_gaps = await this.identifyGaps(allSources, originalQuery, task);
    
    return {
      sources: allSources,
      findings,
      confidence_gaps
    };
  }

  private async generateSearchQueries(originalQuery: string, task: string): Promise<string[]> {
    // Use smart static templates instead of LLM generation to reduce API calls
    const templates = {
      'Core concepts and fundamental principles': [
        `${originalQuery} fundamentals basics principles`,
        `${originalQuery} core concepts theory`,
        `what is ${originalQuery} definition explanation`
      ],
      'Latest developments and recent breakthroughs': [
        `${originalQuery} latest news 2024 2023`,
        `${originalQuery} recent breakthroughs developments`,
        `${originalQuery} new research advances`
      ],
      'Key players, companies, and market dynamics': [
        `${originalQuery} companies startups industry`,
        `${originalQuery} market leaders key players`,
        `${originalQuery} investment funding commercial`
      ],
      'Future implications and emerging trends': [
        `${originalQuery} future trends predictions`,
        `${originalQuery} emerging applications potential`,
        `${originalQuery} roadmap timeline prospects`
      ]
    };

    // Find matching template or create generic queries
    const matchingTemplate = Object.keys(templates).find(key => 
      task.toLowerCase().includes(key.toLowerCase().split(' ')[0])
    );

    if (matchingTemplate) {
      return templates[matchingTemplate as keyof typeof templates];
    }

    // Fallback for custom tasks
    return [
      `${originalQuery} ${task.toLowerCase()}`,
      `${originalQuery} ${task.split(' ').slice(-3).join(' ')}`,
      `${originalQuery} research analysis`
    ];
  }

  private async analyzeFindings(sources: ResearchSource[], originalQuery: string, task: string): Promise<string> {
    if (sources.length === 0) {
      return `No sources found for task: ${task}`;
    }

    // Skip expensive individual source analysis - just summarize what we collected
    const totalWords = sources.reduce((sum, s) => sum + (s.word_count || 0), 0);
    const domains = [...new Set(sources.map(s => s.domain))];
    
    console.log(`📊 Collected ${sources.length} sources (${totalWords} words) from ${domains.length} domains for: ${task}`);
    
    // Create a simple summary without additional LLM calls
    const sourceSummary = sources.map(s => 
      `${s.title} (${s.domain}, ${s.word_count} words)`
    ).join('\n');
    
    return `SOURCES COLLECTED FOR "${task}" (${totalWords} words total):

${sourceSummary}

Content will be processed in comprehensive synthesis phase.`;
  }

  private async identifyGaps(sources: ResearchSource[], originalQuery: string, task: string): Promise<string[]> {
    return []; // Simplified - no gap analysis to reduce complexity
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private getSourceCountForQuery(originalQuery: string, task: string): number {
    // Fixed source count per agent to target exactly 50 total sources
    // 4 agents × 12-13 sources each = 48-52 sources total
    const baseCount = 12; // Fixed base count
    
    // Add slight randomization (±1 source) for variety
    const randomFactor = Math.floor(Math.random() * 3) - 1; // -1 to +1
    const finalCount = baseCount + randomFactor;
    
    // Ensure bounds (11-13 sources per agent = 44-52 total for 4 agents)
    return Math.max(11, Math.min(13, finalCount));
  }
}

// Lead Researcher - Orchestrates the multi-agent system
class LeadResearcher {
  private exaService = new ExaAPIService();
  private cerebrasService = new CerebrasAPIService();
  private globalSeenUrls = new Set<string>(); // Track URLs across all agents

  setApiKeys(exaKey: string, cerebrasKey: string) {
    this.exaService.setApiKey(exaKey);
    this.cerebrasService.setApiKey(cerebrasKey);
  }
  
  private logModelUsage(stage: string) {
    console.log(`\n🔬 ${stage} - Model Status Check:`);
    // Access the private method via type assertion for logging
    (this.cerebrasService as any).printModelStatus();
  }

  private cleanReportTitle(query: string): string {
    // Remove common question prefixes and clean up the title
    let cleaned = query
      .replace(/^(what are the|how can|what is the|latest developments in|developments in)/gi, '')
      .replace(/\?$/, '')
      .trim();
    
    // Capitalize first letter and make it a proper title
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
    // Add appropriate prefix based on query type
    if (query.toLowerCase().includes('how can') || query.toLowerCase().includes('how does')) {
      return cleaned.startsWith('AI') ? cleaned : `How ${cleaned}`;
    } else if (query.toLowerCase().includes('what are') || query.toLowerCase().includes('latest developments')) {
      return `Latest Developments in ${cleaned}`;
    } else {
      return cleaned;
    }
  }

  async orchestrateResearch(
    query: string,
    onProgress: (update: ProgressUpdate) => void
  ): Promise<ResearchResult> {
    const startTime = Date.now();
    this.globalSeenUrls.clear();
    
    // Pre-flight check: Test API connectivity before starting research
    console.log('🔍 Pre-flight API check...');
    try {
      // Quick test search to verify Exa API is working
      await this.exaService.search('test connectivity', 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('credits exhausted') || errorMessage.includes('402')) {
        // Immediately fail if credits are exhausted
        throw new Error('Research cannot start: Exa API credits have been exhausted. Please top up your account at dashboard.exa.ai to continue using the service.');
      }
      // For other errors, log but continue (might be transient)
      console.warn('⚠️ Pre-flight API check failed, but continuing:', errorMessage);
    }
    
    // Show initial model status
    this.logModelUsage('Research Starting'); // Reset for new research session
    
    // Send initial progress update
    onProgress({
      stage: 'Initializing Research',
      query: query,
      layer: 1,
      sources_found: 0,
      total_sources: 0,
      progress_percent: 0,
      completed: false,
      error: null,
      final_result: null,
      activity_updates: [{
        id: 'init',
        title: 'Research Initialized',
        content: `Starting comprehensive research on: "${query}"`,
        timestamp: new Date().toISOString(),
        type: 'query'
      }],
      streaming_sources: []
    });

    // Create 4 specialist agents with different focus areas
    const tasks = [
      'Core concepts and fundamental principles',
      'Latest developments and recent breakthroughs', 
      'Key players, companies, and market dynamics',
      'Future implications and emerging trends'
    ];

    const agents = tasks.map((task, index) => new SpecialistAgent(
      `agent_${index + 1}`,
      `Research Agent ${index + 1}`,
      task,
      this.exaService,
      this.cerebrasService,
      this.globalSeenUrls
    ));

    const agentResults: any[] = [];
    const allStreamingSources: any[] = [];
    const activityUpdates: any[] = [{
      id: 'init',
      title: 'Research Initialized', 
      content: `Starting comprehensive research on: "${query}"`,
      timestamp: new Date().toISOString(),
      type: 'query'
    }];

    // Set up clean activity tracking
    let completedAgents = 0;
    
    // Initialize all agent activities as pending
    agents.forEach((_, i) => {
      activityUpdates.push({
        id: `agent_${i + 1}`,
        title: `Agent ${i + 1}: ${tasks[i]}`,
        content: `Waiting to start...`,
        timestamp: new Date().toISOString(),
        type: 'processing',
        progress: 0,
        status: 'pending'
      });
      });

    // Send initial setup with all pending agents
      onProgress({
      stage: 'Initializing Research Agents',
      query: query,
      layer: 1,
      sources_found: 0,
      total_sources: 0,
      progress_percent: 0,
      completed: false,
      error: null,
      final_result: null,
      activity_updates: [...activityUpdates],
      streaming_sources: []
    });

    // Execute agents in parallel for speed (they have independent search spaces)
    console.log('🚀 Starting parallel agent execution...');
    
    const agentPromises = agents.map(async (agent, i) => {
      const task = tasks[i];
      
      // Mark this agent as active and start its progress
      const agentActivityIndex = activityUpdates.findIndex(activity => activity.id === `agent_${i + 1}`);
      if (agentActivityIndex !== -1) {
        activityUpdates[agentActivityIndex] = {
          ...activityUpdates[agentActivityIndex],
          content: `Searching for sources...`,
          status: 'active',
          progress: 0
        };
      }

      // Send progress update when agent starts with overall status
      const activeAgents = activityUpdates.filter(a => a.status === 'active' && a.id.startsWith('agent_')).length;
      onProgress({
        stage: `Agents Researching (${activeAgents} active)`,
        query: query,
        layer: 1,
        sources_found: allStreamingSources.length,
        total_sources: allStreamingSources.length,
        progress_percent: Math.round((completedAgents / agents.length) * 80), // Clean progress based on completed agents
        completed: false,
        error: null,
        final_result: null,
        activity_updates: [...activityUpdates],
        streaming_sources: [...allStreamingSources]
      });

      try {
        const result = await agent.executeTask(query, task, (agentUpdate) => {
          // Update individual agent progress bar during execution
          const agentActivityIndex = activityUpdates.findIndex(activity => activity.id === `agent_${i + 1}`);
          
          // Handle real-time source updates from agents
          if (agentUpdate.streaming_sources) {
            agentUpdate.streaming_sources.forEach((source: any) => {
              // Check for duplicates
              if (!allStreamingSources.some(existing => existing.url === source.url)) {
                allStreamingSources.unshift({
                  title: source.title,
                  domain: source.domain,
                  url: source.url,
                  snippet: source.snippet,
                  task_id: `agent_${i + 1}`,
                  agent_id: `agent_${i + 1}`,
                  timestamp: new Date().toISOString()
                });
              }
            });

            // Update THIS agent's individual progress and content
            const agentSources = allStreamingSources.filter(s => s.agent_id === `agent_${i + 1}`);
            if (agentActivityIndex !== -1) {
              activityUpdates[agentActivityIndex] = {
                ...activityUpdates[agentActivityIndex],
                content: `Found ${agentSources.length} sources`,
                progress: Math.min(95, 20 + (agentSources.length * 15)), // Individual agent progress based on sources
                status: 'active'
              };
            }

            // Send real-time updates with overall "Agents Researching" status
            const activeAgents = activityUpdates.filter(a => a.status === 'active' && a.id.startsWith('agent_')).length;
            onProgress({
              stage: `Agents Researching (${activeAgents} active)`,
              query: query,
              layer: 1,
              sources_found: allStreamingSources.length,
              total_sources: allStreamingSources.length,
              progress_percent: Math.round((completedAgents / agents.length) * 80), // Keep main progress steady
              completed: false,
              error: null,
              final_result: null,
              activity_updates: [...activityUpdates],
              streaming_sources: [...allStreamingSources]
            });
          }
        });
        
        // Mark agent as completed and increment counter
        completedAgents++;
        const agentActivityIndex = activityUpdates.findIndex(activity => activity.id === `agent_${i + 1}`);
        if (agentActivityIndex !== -1) {
          activityUpdates[agentActivityIndex] = {
            ...activityUpdates[agentActivityIndex],
            content: `✓ Found ${result.sources.length} sources`,
            type: 'complete',
            progress: 100,
            status: 'completed'
          };
        }

        // Send clean progress update when agent completes
        const remainingActive = activityUpdates.filter(a => a.status === 'active' && a.id.startsWith('agent_')).length;
        onProgress({
          stage: completedAgents === agents.length ? 'Agent Research Complete' : `Agents Researching (${remainingActive} active)`,
          query: query,
          layer: 1,
          sources_found: allStreamingSources.length,
          total_sources: allStreamingSources.length,
          progress_percent: Math.round((completedAgents / agents.length) * 80), // Clean step-wise progress
          completed: false,
          error: null,
          final_result: null,
          activity_updates: [...activityUpdates],
          streaming_sources: [...allStreamingSources]
        });

        console.log(`Agent ${i + 1} completed with ${result.sources.length} sources`);
        return result;
        
      } catch (error) {
        console.error(`Agent ${i + 1} failed:`, error);
        
        // Check for specific error types for better user feedback
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429');
        const isCreditsExhausted = errorMessage.includes('credits exhausted') || errorMessage.includes('402');
        
        const errorResult = {
          sources: [],
          findings: `Agent ${i + 1} failed: ${errorMessage}`,
          confidence_gaps: ['Agent execution failed']
        };

        // Mark agent as failed and increment counter (failed agents still count toward completion)
        completedAgents++;
        const agentActivityIndex = activityUpdates.findIndex(activity => activity.id === `agent_${i + 1}`);
        if (agentActivityIndex !== -1) {
          activityUpdates[agentActivityIndex] = {
            ...activityUpdates[agentActivityIndex],
            content: isCreditsExhausted ? '💳 API credits exhausted' : isRateLimit ? '⚠ Rate limit exceeded' : `✗ Error: ${errorMessage}`,
            type: 'error',
            progress: 100,
            status: 'failed'
          };
        }

        // Send clean progress update when agent fails
        const remainingActive = activityUpdates.filter(a => a.status === 'active' && a.id.startsWith('agent_')).length;
        onProgress({
          stage: completedAgents === agents.length ? 'Agent Research Complete (with errors)' : `Agents Researching (${remainingActive} active)`,
          query: query,
          layer: 1,
          sources_found: allStreamingSources.length,
          total_sources: allStreamingSources.length,
          progress_percent: Math.round((completedAgents / agents.length) * 80), // Still advance progress
          completed: false,
          error: null,
          final_result: null,
          activity_updates: [...activityUpdates],
          streaming_sources: [...allStreamingSources]
        });
        
        return errorResult;
      }
    });

    // Wait for all agents to complete in parallel
    agentResults.push(...await Promise.all(agentPromises));

    // Collect all sources
    const allSources = agentResults.flatMap(result => result.sources);
    console.log(`Total sources collected: ${allSources.length}`);

    // Check if research should be halted due to critical errors
    const failedAgents = agentResults.filter(result => result.sources.length === 0);
    const criticalErrors = agentResults.filter(result => 
      result.findings.includes('credits exhausted') || result.findings.includes('402')
    );
    
    // If all agents failed due to credit exhaustion, don't proceed with synthesis
    if (criticalErrors.length === agentResults.length && allSources.length === 0) {
      const errorMessage = 'Research cannot continue: Exa API credits have been exhausted. Please top up your account at dashboard.exa.ai to continue using the service.';
      
      // Send error update
      onProgress({
        stage: 'Research Failed',
        query: query,
        layer: 1,
        sources_found: 0,
        total_sources: 0,
        progress_percent: 100,
        completed: true,
        error: errorMessage,
        final_result: null,
        activity_updates: [...activityUpdates],
        streaming_sources: [...allStreamingSources]
      });
      
      throw new Error(errorMessage);
    }

    // Add synthesis task at TOP (newest first) ONLY after all agents complete
    activityUpdates.unshift({
      id: 'synthesis',
      title: 'Report Generation',
      content: `Analyzing ${allSources.length} sources`,
      timestamp: new Date().toISOString(),
      type: 'processing',
      progress: 0,
      status: 'active'
    });

    onProgress({
      stage: 'Starting Report Generation',
      query: query,
      layer: 1,
      sources_found: allSources.length,
      total_sources: allSources.length,
      progress_percent: 80, // Agents complete = 80%, now starting synthesis
      completed: false,
      error: null,
      final_result: null,
      activity_updates: [...activityUpdates],
      streaming_sources: [...allStreamingSources]
    });

    // Create synthesis with progress updates
    const synthesisIndex = activityUpdates.findIndex(activity => activity.id === 'synthesis');
    
    // Update progress during synthesis
    if (synthesisIndex !== -1) {
      activityUpdates[synthesisIndex] = {
        ...activityUpdates[synthesisIndex],
        content: `Processing research data...`,
        progress: 25,
        status: 'active'
      };
    }

    onProgress({
      stage: 'Processing Research Data',
      query: query,
      layer: 1,
      sources_found: allSources.length,
      total_sources: allSources.length,
      progress_percent: 85,
      completed: false,
      error: null,
      final_result: null,
      activity_updates: [...activityUpdates],
      streaming_sources: [...allStreamingSources]
    });

    const { summary } = await this.synthesizeFindings(query, agentResults);

    // Mark synthesis as completed
    if (synthesisIndex !== -1) {
      activityUpdates[synthesisIndex] = {
        ...activityUpdates[synthesisIndex],
        content: `✓ Report generated successfully`,
        type: 'complete',
        progress: 100,
        status: 'completed'
      };
    }

    const researchTime = (Date.now() - startTime) / 1000;
    
    // Show final model usage status
    console.log(`\n🏁 Research completed in ${researchTime.toFixed(1)}s`);
    this.logModelUsage('Research Complete');

    const result: ResearchResult = {
      original_query: query,
      topic_type: 'general',
      layer_summaries: [{
        layer: 1,
        description: 'Multi-agent research',
        sources_found: allSources.length,
        key_findings: summary.substring(0, 500),
        confidence_gaps: [],
        queries_used: tasks
      }],
      all_sources: allSources,
      final_synthesis: summary,
      total_sources: allSources.length,
      research_time: researchTime,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };

    // Send final completion update
    onProgress({
      stage: 'Complete',
      query: query,
      layer: 1,
      sources_found: allSources.length,
      total_sources: allSources.length,
      progress_percent: 100,
      completed: true,
      error: null,
      final_result: result,
      activity_updates: [...activityUpdates],
      streaming_sources: [...allStreamingSources]
    });

    return result;
  }

  private async synthesizeFindings(query: string, agentResults: any[]): Promise<{
    summary: string;
    sources: any[];
    total_sources: number;
    total_words: number;
    processing_calls: number;
    compression_ratio: string;
  }> {
    const allSources = agentResults.flatMap(result => result.sources);
    const totalWords = allSources.reduce((sum, source) => sum + source.word_count, 0);
    let callCount = 0;

    console.log(`🔬 Starting STRUCTURED synthesis for ${allSources.length} sources`);

    try {
      // STEP 1: Master Planning LLM creates the report structure
      callCount++;
      const structurePlan = await this.cerebrasService.chat(
        `You are a Master Research Architect. Your job is to create a detailed, NON-OVERLAPPING report structure.

Query: "${query}"

Available research data:
- Agent 1 (Core concepts & fundamentals): ${agentResults[0]?.sources?.length || 0} sources
- Agent 2 (Latest developments & breakthroughs): ${agentResults[1]?.sources?.length || 0} sources  
- Agent 3 (Key players, companies & market): ${agentResults[2]?.sources?.length || 0} sources
- Agent 4 (Future implications & trends): ${agentResults[3]?.sources?.length || 0} sources

Create a JSON structure for a comprehensive report with EXACTLY this format:
{
  "reportTitle": "Specific, compelling title",
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary", 
      "purpose": "Brief high-level overview of key findings only",
      "mustInclude": ["3-4 most important findings", "key numbers/metrics", "main conclusion"],
      "mustAvoid": ["detailed explanations", "repetition of other sections"],
      "agentDataToUse": [1, 2, 3, 4],
      "wordTarget": 200
    },
    {
      "id": "current_state",
      "title": "Current State & Recent Developments",
      "purpose": "What's happening NOW - latest breakthroughs and developments",
      "mustInclude": ["specific recent developments", "breakthrough technologies", "current research"],
      "mustAvoid": ["background concepts", "future predictions", "market analysis"],
      "agentDataToUse": [2],
      "wordTarget": 400
    },
    {
      "id": "technical_deep_dive", 
      "title": "Technical Analysis & Core Concepts",
      "purpose": "Deep technical understanding of HOW things work",
      "mustInclude": ["technical mechanisms", "scientific principles", "methodologies"],
      "mustAvoid": ["market info", "company names", "future speculation"],
      "agentDataToUse": [1],
      "wordTarget": 350
    },
    {
      "id": "market_players",
      "title": "Industry Landscape & Key Players", 
      "purpose": "WHO is involved and market dynamics",
      "mustInclude": ["specific companies", "investments", "partnerships", "market size"],
      "mustAvoid": ["technical details", "how technology works", "future trends"],
      "agentDataToUse": [3],
      "wordTarget": 350
    },
    {
      "id": "future_implications",
      "title": "Future Outlook & Strategic Implications",
      "purpose": "WHERE this is heading and what it means",
      "mustInclude": ["future applications", "timeline predictions", "strategic implications"],
      "mustAvoid": ["current state info", "technical explanations", "company details"],
      "agentDataToUse": [4],
      "wordTarget": 350
    },
    {
      "id": "conclusion",
      "title": "Key Insights & Recommendations",
      "purpose": "SYNTHESIS - what does it all mean together",
      "mustInclude": ["synthesized insights", "actionable recommendations", "strategic takeaways"],
      "mustAvoid": ["repeating previous sections", "new information"],
      "agentDataToUse": [1, 2, 3, 4],
      "wordTarget": 250
    }
  ]
}

CRITICAL: Each section must have a DISTINCT purpose with NO overlap. Each focuses on different aspects (WHAT/HOW/WHO/WHERE/WHY).`,
        `You are a Master Research Architect who creates detailed, non-overlapping report structures. Respond with valid JSON only.`
      );

      let reportPlan;
      try {
        reportPlan = JSON.parse(structurePlan);
      } catch (e) {
        console.error('❌ Failed to parse structure plan, using fallback');
        // Robust fallback structure
        reportPlan = {
          reportTitle: '',
          sections: [
            {
              id: "executive_summary",
              title: "Executive Summary",
              purpose: "Brief overview of key findings",
              mustInclude: ["Top 3 findings", "Key metrics", "Main insight"],
              mustAvoid: ["Details", "Repetition"],
              agentDataToUse: [1, 2, 3, 4],
              wordTarget: 200
            },
            {
              id: "recent_breakthroughs", 
              title: "Recent Breakthroughs & Developments",
              purpose: "Latest advances and innovations",
              mustInclude: ["Specific breakthroughs", "New technologies", "Recent research"],
              mustAvoid: ["Background", "Market info", "Future predictions"],
              agentDataToUse: [2],
              wordTarget: 400
            },
            {
              id: "technical_analysis",
              title: "Technical Analysis & Methodologies",
              purpose: "How the technology works",
              mustInclude: ["Technical mechanisms", "Scientific methods", "Core principles"],
              mustAvoid: ["Companies", "Markets", "Timeline predictions"],
              agentDataToUse: [1],
              wordTarget: 350
            },
            {
              id: "industry_landscape",
              title: "Industry Players & Market Dynamics", 
              purpose: "Key companies and market forces",
              mustInclude: ["Leading companies", "Investments", "Market trends"],
              mustAvoid: ["Technical details", "Future speculation"],
              agentDataToUse: [3],
              wordTarget: 350
            },
            {
              id: "future_outlook",
              title: "Future Implications & Strategic Outlook",
              purpose: "Where this is heading",
              mustInclude: ["Future applications", "Strategic implications", "Timeline"],
              mustAvoid: ["Current developments", "Company details"],
              agentDataToUse: [4],
              wordTarget: 350
            },
            {
              id: "strategic_insights",
              title: "Strategic Insights & Recommendations", 
              purpose: "Actionable business recommendations and investment strategies",
              mustInclude: ["Specific investment recommendations", "Market timing insights", "Partnership opportunities", "Risk mitigation strategies", "Competitive positioning advice"],
              mustAvoid: ["Technical explanations", "Restating previous content", "Generic business advice"],
              agentDataToUse: [2, 3, 4],
              wordTarget: 350
            }
          ]
        };
      }

      console.log(`📋 Report structure planned: "${reportPlan.reportTitle}" with ${reportPlan.sections.length} sections`);

      // STEP 2: Generate each section with specialized writers
      const generatedSections: string[] = [];
      const previousSections: string[] = []; // Track what's been written to avoid repetition
      const mentionedFacts: Set<string> = new Set(); // Track specific facts/companies/stats mentioned
      
      for (let i = 0; i < reportPlan.sections.length; i++) {
        const section = reportPlan.sections[i];
        callCount++;
        
        // Prepare relevant agent data for this section (optimized for context limits)
        const relevantData = section.agentDataToUse.map((agentIndex: number) => {
          const agentResult = agentResults[agentIndex - 1];
          if (!agentResult) return null;
          
          return {
            agentNumber: agentIndex,
            specialization: agentResult.specialization || `Agent ${agentIndex}`,
            findings: agentResult.findings?.substring(0, 600) || '', // Reduced from 1000
            topSources: agentResult.sources?.slice(0, 4).map((s: any) => ({ // Reduced from 8 to 4
              title: s.title,
              domain: s.domain,
              snippet: s.content?.substring(0, 200) || '' // Reduced from 300 to 200
            })) || []
          };
        }).filter((data: null): data is NonNullable<typeof data> => data !== null);

        // Create section with specific constraints
        const sectionContent = await this.cerebrasService.chat(
          `You are a SPECIALIZED SECTION WRITER for "${section.title}".

STRICT REQUIREMENTS:
- Write ONLY the "${section.title}" section content
- Purpose: ${section.purpose}
- Target: EXACTLY ${section.wordTarget} words
- Must include: ${section.mustInclude.join(', ')}
- Must NEVER include: ${section.mustAvoid.join(', ')}

CONTEXT:
Query: "${query}"
Section ${i + 1} of ${reportPlan.sections.length}

AVAILABLE DATA:
${relevantData.map((data: {agentNumber: number, specialization: string, findings: string, topSources: Array<{title: string, domain: string, snippet: string}>}) => `
Agent ${data.agentNumber} (${data.specialization}):
${data.findings}

Key sources:
${data.topSources.map((s: {title: string, domain: string, snippet: string}) => `• ${s.title} (${s.domain}): ${s.snippet}`).join('\n')}
`).join('\n')}

PREVIOUS SECTIONS WRITTEN (DO NOT REPEAT ANY OF THIS):
${previousSections.length > 0 ? previousSections.map((sec, idx) => `Section ${idx + 1} (first 400 chars): ${sec.substring(0, 400)}...`).join('\n\n') : 'Nothing yet - this is the first section'}

FACTS/COMPANIES/STATS ALREADY MENTIONED (NEVER REPEAT THESE):
${mentionedFacts.size > 0 ? Array.from(mentionedFacts).slice(0, 25).join(', ') + (mentionedFacts.size > 25 ? `... and ${mentionedFacts.size - 25} more` : '') : 'None yet'}

CRITICAL ANTI-REPETITION RULES:
1. DO NOT repeat the same specific facts, statistics, or claims from previous sections
2. Company names can be repeated ONLY when introducing genuinely NEW aspects of their work
3. If describing the same breakthrough/development mentioned before, reference it briefly rather than re-explaining
4. Look for paraphrased versions of the same information and avoid those
5. Focus on NEW angles, different implications, or fresh insights
6. Use phrases like "building on this development" when connecting to previous mentions
7. Statistics and specific numbers should only appear once unless in a different context

WRITING RULES:
1. Start writing immediately - NO section headers, titles, or headings of any kind
2. Focus ONLY on this section's purpose: ${section.purpose}
3. Use specific facts, data, and examples from the research
4. Write in a professional, analytical tone
5. DO NOT repeat ANY information from previous sections
6. Target EXACTLY ${section.wordTarget} words
7. Include specific numbers, dates, and company names where relevant
8. ANALYZE TENSIONS: Where applicable, discuss competing approaches, tradeoffs, or strategic conflicts
9. End naturally - no "in conclusion" phrases

Write the complete section content:`,
          `You are a specialized section writer. You write ONLY the assigned section with no overlap or repetition and NO headers.`
        );

        // Clean and validate content for redundancy
        let cleanContent = sectionContent.trim();
        
        // Remove any redundant headings that might match the section title
        const headingPatterns = [
          new RegExp(`^#{1,6}\\s*${section.title}\\s*$`, 'gmi'),
          new RegExp(`^${section.title}\\s*$`, 'gmi'),
          new RegExp(`^#{1,6}\\s*${section.title.replace(/[^a-zA-Z0-9\s]/g, '')}\\s*$`, 'gmi')
        ];
        
        headingPatterns.forEach(pattern => {
          cleanContent = cleanContent.replace(pattern, '').trim();
        });
        
        // Remove any standalone markdown headings at the start
        cleanContent = cleanContent.replace(/^#{1,6}\s+[^\n]*\n\n?/gm, '').trim();
        
        // Pre-validation redundancy filter
        if (previousSections.length > 0 && mentionedFacts.size > 5) {
          callCount++;
          const contentValidation = await this.cerebrasService.chat(
            `Clean this section content by removing redundant information, then return ONLY the cleaned content with NO explanations:

SECTION CONTENT:
"${cleanContent}"

FACTS ALREADY MENTIONED (avoid repeating):
${Array.from(mentionedFacts).slice(0, 30).join(', ')}

CRITICAL: Return ONLY the cleaned section content. NO explanations about what was removed or changed. NO meta-commentary. Just the final clean content that users will read.`,
            `You return only cleaned content with no explanations about the cleaning process.`
          );
          
          cleanContent = contentValidation.trim();
          console.log(`🧹 Content cleaned: ${sectionContent.length} → ${cleanContent.length} chars`);
        }
        
        generatedSections.push(`## ${section.title}\n\n${cleanContent}`);
        previousSections.push(cleanContent);

        // Extract key facts to prevent repetition in future sections
        callCount++;
        const extractedFacts = await this.cerebrasService.chat(
          `Extract SPECIFIC claims that should NOT be repeated in future sections. Be comprehensive and include variations:

"${cleanContent}"

Extract SPECIFIC claims that should not be repeated:
SPECIFIC_CLAIMS: [exact breakthroughs, achievements, specific developments with company context]
STATISTICS: [all numbers, percentages, dollar amounts, dates, quantities with context]
TECHNOLOGIES: [specific product names, system names, technical terms]
KEY_FACTS: [important statements, findings, claims that are factual]

Example format: SPECIFIC_CLAIMS: IBM building 10,000-qubit computer by 2029, D-Wave's Advantage2 general availability | STATISTICS: 10,000 qubits, 2029 timeline, £500mn investment | TECHNOLOGIES: Advantage2, Zuchongzhi-3, Enchilada Trap | KEY_FACTS: fault-tolerant quantum computing achieved, quantum supremacy record broken`,
          `You extract comprehensive facts to prevent any repetition. List variations and synonyms.`
        );

        // Add extracted facts to the tracking set
        if (extractedFacts.trim()) {
          extractedFacts.split(/[|,]/).forEach(fact => {
            const cleanFact = fact.trim().toLowerCase();
            if (cleanFact.length > 3) {
              mentionedFacts.add(cleanFact);
            }
          });
        }

        console.log(`✅ Generated: ${section.title} (${cleanContent.length} chars, ${mentionedFacts.size} facts tracked)`);
        
        // Minimal delay for faster synthesis
        if (i < reportPlan.sections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

             // STEP 3: Assemble final report
       const finalReport = `${generatedSections.join('\n\n')}`;

      console.log(`🎯 STRUCTURED synthesis complete: ${finalReport.length} chars, ${callCount} calls`);

      return {
        summary: finalReport,
        sources: allSources,
        total_sources: allSources.length,
        total_words: totalWords,
        processing_calls: callCount,
        compression_ratio: `${Math.round((totalWords / finalReport.length) * 100) / 100}:1`
      };
        
      } catch (error) {
      console.error('❌ Structured synthesis failed:', error);
      return await this.attemptSimpleSynthesis(query, allSources);
      }
  }

  private async attemptSimpleSynthesis(query: string, allSources: any[]): Promise<{
    summary: string;
    sources: any[];
    total_sources: number;
    total_words: number;
    processing_calls: number;
    compression_ratio: string;
  }> {
    // Create source summaries for single API call - respecting context limits
    let sourceSummaries = allSources.map((source, index) => {
      const content = source.content || 'No content available';
      return `${index + 1}. **${source.title}** (${source.domain})\nCONTENT: ${content}`;
    }).join('\n\n---\n\n');
    
    // Validate context size for simple synthesis
    const summariesTokens = Math.ceil(sourceSummaries.length / 3.5);
    const simplePromptOverhead = 1800; // Estimated tokens for simple synthesis prompt
    const simpleTotalTokens = summariesTokens + simplePromptOverhead;
    
    if (simpleTotalTokens > 7500) {
      console.log(`⚠️ Simple synthesis context too large: ${simpleTotalTokens} tokens, using per-source limits...`);
      const maxContentPerSource = Math.floor((7500 - simplePromptOverhead) * 3.5 / allSources.length);
      sourceSummaries = allSources.map((source, index) => {
        const content = (source.content || '').substring(0, maxContentPerSource);
        const truncated = content.length < (source.content || '').length;
        return `${index + 1}. **${source.title}** (${source.domain})\nCONTENT: ${content}${truncated ? '...[TRUNCATED for context limits]' : ''}`;
      }).join('\n\n---\n\n');
    }

    const totalWords = allSources.reduce((sum, s) => sum + (s.word_count || 0), 0);

    // Use Multi-LLM approach for simple synthesis too
    console.log('🚀 Using Multi-LLM approach for comprehensive synthesis...');
    return this.createMultiLLMSynthesis(query, allSources, [], [], 0, totalWords);
  }

  private async createMultiLLMSynthesis(
    query: string, 
    allSources: any[], 
    batchSyntheses: string[], 
    doNotExplain: string[], 
    callCount: number, 
    totalWords: number
  ): Promise<{
    summary: string;
    sources: any[];
    total_sources: number;
    total_words: number;
    processing_calls: number;
    compression_ratio: string;
  }> {
    const allCoveredTerms = doNotExplain.join(', ');
    const sectionsContent = batchSyntheses.join('\n\n');
    
    // Create condensed source list for each section
    const sourcesList = allSources.map((source, index) => {
      const content = (source.content || '').substring(0, 2000); // 2k chars per source for sections
      return `${index + 1}. **${source.title}** (${source.domain})\n${content}...`;
    }).join('\n\n');

    console.log('🚀 Starting Multi-LLM Parallel Synthesis...');

    // Define section prompts for parallel processing
    const sectionPrompts = [
      {
        name: 'Executive Summary',
        model: 'llama-3.3-70b',
        prompt: `Write a comprehensive Executive Summary for: "${query}"

**RESEARCH SECTIONS:**
${sectionsContent}

**DO NOT RE-EXPLAIN:** ${allCoveredTerms || 'None'}

**REQUIREMENTS:**
- Write 1200-1500 words executive summary
- Synthesize key findings from all research sections
- Include major technical breakthroughs, market dynamics, and future outlook
- **MANDATORY SOURCE CITATIONS**: Reference specific sources by title (e.g., "According to [Source Title]...")
- Professional executive tone with strategic insights
- DO NOT re-explain terms in the "DO NOT RE-EXPLAIN" list

Write executive summary:`
      },
      {
        name: 'Technical Deep Dive',
        model: 'llama-3.1-8b',
        prompt: `Write a comprehensive Technical Analysis for: "${query}"

**SOURCE DATA:**
${sourcesList}

**RESEARCH CONTEXT:**
${sectionsContent}

**DO NOT RE-EXPLAIN:** ${allCoveredTerms || 'None'}

**REQUIREMENTS:**
- Write 4000-5000 words technical deep dive
- Focus on technical specifications, performance metrics, architectural details
- Include specific numbers, benchmarks, and quantitative analysis
- **MANDATORY SOURCE CITATIONS**: Reference specific sources by title throughout
- Extract ALL technical details from sources
- Advanced technical analysis since basics are established

Write technical analysis:`
      },
      {
        name: 'Market & Industry Analysis',
        model: 'llama-4-scout-17b-16e-instruct',
        prompt: `Write a comprehensive Market Analysis for: "${query}"

**SOURCE DATA:**
${sourcesList}

**RESEARCH CONTEXT:**
${sectionsContent}

**DO NOT RE-EXPLAIN:** ${allCoveredTerms || 'None'}

**REQUIREMENTS:**
- Write 3500-4500 words market and industry analysis
- Focus on competitive landscape, market dynamics, business strategies
- Include funding, partnerships, acquisitions, and market positioning
- **MANDATORY SOURCE CITATIONS**: Reference specific sources by title throughout
- Extract ALL business insights from sources
- Professional market analysis tone

Write market analysis:`
      },
      {
        name: 'Future Implications & Strategic Outlook',
        model: 'llama-3.3-70b',
        prompt: `Write a comprehensive Future Analysis for: "${query}"

**SOURCE DATA:**
${sourcesList}

**RESEARCH CONTEXT:**
${sectionsContent}

**DO NOT RE-EXPLAIN:** ${allCoveredTerms || 'None'}

**REQUIREMENTS:**
- Write 3000-4000 words future implications analysis
- Focus on timeline predictions, roadmaps, strategic implications
- Include challenges, opportunities, and long-term outlook
- **MANDATORY SOURCE CITATIONS**: Reference specific sources by title throughout
- Extract ALL future-oriented insights from sources
- Strategic advisory tone with actionable insights

Write future analysis:`
      },
      {
        name: 'Comprehensive Source Analysis',
        model: 'llama-3.1-8b',
        prompt: `Create a comprehensive Source Analysis for: "${query}"

**ALL SOURCES:**
${allSources.map((source, index) => `${index + 1}. **${source.title}** (${source.domain}) - ${source.word_count || 'N/A'} words`).join('\n')}

**REQUIREMENTS:**
- Write 2000-2500 words source analysis
- Analyze the quality, relevance, and credibility of each source
- Group sources by domain and discuss their contributions
- Include methodology assessment and source diversity analysis
- Create comprehensive "Sources Referenced" section with detailed descriptions
- Academic tone with critical source evaluation

Write source analysis:`
      }
    ];

    // Execute all sections in parallel
    const sectionPromises = sectionPrompts.map(async (section) => {
      try {
        console.log(`📝 Writing ${section.name} with ${section.model}...`);
        const result = await this.cerebrasService.chat(section.prompt);
        callCount++;
        return {
          name: section.name,
          content: result,
          model: section.model
        };
      } catch (error) {
        console.error(`❌ Failed to write ${section.name}:`, error);
        return {
          name: section.name,
          content: `# ${section.name}\n\n[Section failed to generate due to API issues. Please retry.]`,
          model: section.model
        };
      }
    });

    // Wait for all sections to complete
    const completedSections = await Promise.all(sectionPromises);
    
    // Combine all sections into final report - let each LLM create their own headings
    const finalReport = `${completedSections.map(section => section.content).join('\n\n---\n\n')}`;

    // Validate source utilization across all sections
    const sourceUtilization = this.validateSourceUtilization(finalReport, allSources);
    
    console.log('✅ Multi-LLM Synthesis Complete!');
    console.log(`📊 Final report: ~${Math.round(finalReport.length / 5)} words across ${completedSections.length} sections`);
    
    return {
      summary: finalReport,
      sources: allSources,
      total_sources: allSources.length,
      total_words: totalWords,
      processing_calls: callCount + completedSections.length,
      compression_ratio: `Multi-LLM synthesis: ${completedSections.length} sections, ${doNotExplain.length} terms established. Source utilization: ${sourceUtilization.utilizationScore}% (${sourceUtilization.sourcesUsed}/${allSources.length} sources referenced)`
    };
  }

  private validateSourceUtilization(synthesis: string, allSources: any[]): {
    utilizationScore: number;
    sourcesUsed: number;
    totalSources: number;
    unusedSources: string[];
  } {
    let sourcesUsed = 0;
    const unusedSources: string[] = [];
    
    for (const source of allSources) {
      const title = source.title || '';
      const domain = source.domain || '';
      
      // Check if source is referenced by title or domain in the synthesis
      const titleReferenced = title && synthesis.toLowerCase().includes(title.toLowerCase().substring(0, 20));
      const domainReferenced = domain && synthesis.toLowerCase().includes(domain.toLowerCase());
      
      if (titleReferenced || domainReferenced) {
        sourcesUsed++;
      } else {
        unusedSources.push(`${title} (${domain})`);
      }
    }
    
    const utilizationScore = Math.round((sourcesUsed / allSources.length) * 100);
    
    if (utilizationScore < 60) {
      console.log(`⚠️ LOW SOURCE UTILIZATION: Only ${utilizationScore}% of sources referenced`);
      console.log(`Unused sources: ${unusedSources.slice(0, 5).join(', ')}${unusedSources.length > 5 ? '...' : ''}`);
    }
    
    return {
      utilizationScore,
      sourcesUsed,
      totalSources: allSources.length,
      unusedSources
    };
  }
}

// ResearchAPI - Main interface for the research system
class ResearchAPI {
  private static leadResearcher = new LeadResearcher();

  static setApiKeys(exaKey: string, cerebrasKey: string) {
    this.leadResearcher.setApiKeys(exaKey, cerebrasKey);
  }

  static async checkHealth(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: 'Research system is operational with full content processing'
    };
  }

  static async performResearch(
    request: ResearchRequest,
    onProgress: (update: ProgressUpdate) => void
  ): Promise<ResearchResult> {
    return this.leadResearcher.orchestrateResearch(request.query, onProgress);
  }
}

export { ResearchAPI }; 