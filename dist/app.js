class MultiAgentResearchApp {
    constructor() {
        this.apiKeys = {
            exa: localStorage.getItem('exa_api_key') || '',
            cerebras: localStorage.getItem('cerebras_api_key') || ''
        };
        
        this.currentSession = null;
        this.eventSource = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateConfigStatus();
        this.loadSavedKeys();
    }
    
    initializeElements() {
        this.elements = {
            // Tabs
            settingsTab: document.getElementById('settingsTab'),
            researchTab: document.getElementById('researchTab'),
            settingsPanel: document.getElementById('settingsPanel'),
            researchPanel: document.getElementById('researchPanel'),
            
            // Configuration
            exaApiKey: document.getElementById('exaApiKey'),
            cerebrasApiKey: document.getElementById('cerebrasApiKey'),
            saveConfig: document.getElementById('saveConfig'),
            configStatus: document.getElementById('configStatus'),
            
            // Research
            researchQuery: document.getElementById('researchQuery'),
            startResearch: document.getElementById('startResearch'),
            
            // Progress
            progressSection: document.getElementById('progressSection'),
            progressText: document.getElementById('progressText'),
            progressPercent: document.getElementById('progressPercent'),
            progressBar: document.getElementById('progressBar'),
            agentStatus: document.getElementById('agentStatus'),
            
            // Sources
            sourcesSection: document.getElementById('sourcesSection'),
            sourcesList: document.getElementById('sourcesList'),
            sourceCount: document.getElementById('sourceCount'),
            
            // Results
            resultsSection: document.getElementById('resultsSection'),
            researchResults: document.getElementById('researchResults'),
            totalSources: document.getElementById('totalSources'),
            totalAgents: document.getElementById('totalAgents'),
            researchTime: document.getElementById('researchTime'),
            confidenceScore: document.getElementById('confidenceScore')
        };
    }
    
    setupEventListeners() {
        // Tab switching
        this.elements.settingsTab.addEventListener('click', () => this.switchTab('settings'));
        this.elements.researchTab.addEventListener('click', () => this.switchTab('research'));
        
        this.elements.saveConfig.addEventListener('click', () => this.saveConfiguration());
        this.elements.startResearch.addEventListener('click', () => this.startResearch());
        
        this.elements.researchQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.startResearch();
            }
        });
        
        // Auto-save API keys on input
        this.elements.exaApiKey.addEventListener('input', (e) => {
            this.apiKeys.exa = e.target.value;
            this.updateConfigStatus();
        });
        
        this.elements.cerebrasApiKey.addEventListener('input', (e) => {
            this.apiKeys.cerebras = e.target.value;
            this.updateConfigStatus();
        });
    }
    
    loadSavedKeys() {
        this.elements.exaApiKey.value = this.apiKeys.exa;
        this.elements.cerebrasApiKey.value = this.apiKeys.cerebras;
    }
    
    saveConfiguration() {
        this.apiKeys.exa = this.elements.exaApiKey.value.trim();
        this.apiKeys.cerebras = this.elements.cerebrasApiKey.value.trim();
        
        // Save to localStorage
        localStorage.setItem('exa_api_key', this.apiKeys.exa);
        localStorage.setItem('cerebras_api_key', this.apiKeys.cerebras);
        
        this.updateConfigStatus();
        this.showNotification('API keys saved successfully!', 'success');
        
        // If both keys are configured, show a helpful message
        if (this.apiKeys.exa && this.apiKeys.cerebras) {
            setTimeout(() => {
                this.showNotification('Ready to research! Switch to the Research tab to get started.', 'success');
            }, 1500);
        }
    }
    
    switchTab(tab) {
        // Don't allow switching to research tab if not configured
        if (tab === 'research' && (!this.apiKeys.exa || !this.apiKeys.cerebras)) {
            this.showNotification('Please configure your API keys first', 'error');
            return;
        }
        
        // Update tab buttons
        this.elements.settingsTab.classList.remove('active');
        this.elements.researchTab.classList.remove('active');
        
        // Update tab panels
        this.elements.settingsPanel.classList.remove('active');
        this.elements.researchPanel.classList.remove('active');
        
        if (tab === 'settings') {
            this.elements.settingsTab.classList.add('active');
            this.elements.settingsPanel.classList.add('active');
        } else if (tab === 'research') {
            this.elements.researchTab.classList.add('active');
            this.elements.researchPanel.classList.add('active');
        }
    }
    
    updateConfigStatus() {
        const isConfigured = this.apiKeys.exa && this.apiKeys.cerebras;
        
        this.elements.configStatus.textContent = isConfigured ? 'Configured' : 'Not Configured';
        this.elements.configStatus.className = isConfigured ? 
            'ml-3 text-sm bg-green-500 bg-opacity-30 px-3 py-1 rounded-full' :
            'ml-3 text-sm bg-yellow-500 bg-opacity-30 px-3 py-1 rounded-full';
        
        // Enable/disable research tab and button
        this.elements.researchTab.disabled = !isConfigured;
        this.elements.startResearch.disabled = !isConfigured || !this.elements.researchQuery.value.trim();
        
        if (isConfigured) {
            this.elements.researchTab.classList.remove('opacity-50', 'cursor-not-allowed');
            this.elements.researchTab.classList.add('hover:text-gray-700');
        } else {
            this.elements.researchTab.classList.add('opacity-50', 'cursor-not-allowed');
            this.elements.researchTab.classList.remove('hover:text-gray-700');
        }
    }
    
    async startResearch() {
        const query = this.elements.researchQuery.value.trim();
        
        if (!query) {
            this.showNotification('Please enter a research query', 'error');
            return;
        }
        
        if (!this.apiKeys.exa || !this.apiKeys.cerebras) {
            this.showNotification('Please configure your API keys first', 'error');
            return;
        }
        
        this.resetUI();
        this.elements.startResearch.disabled = true;
        this.elements.startResearch.textContent = 'Researching...';
        this.elements.progressSection.classList.remove('hidden');
        
        try {
            // Generate session ID
            this.currentSession = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Run research directly in the browser
            await this.runClientSideResearch(query);
            
        } catch (error) {
            console.error('Research failed:', error);
            this.showNotification('Research failed: ' + error.message, 'error');
            this.resetResearchButton();
        }
    }
    
    async runClientSideResearch(query) {
        const startTime = Date.now();
        const sources = [];
        
        try {
            // Update progress
            this.updateProgress({
                current_phase: 'Initializing research agents...',
                progress_percentage: 5,
                active_agents: 0
            });
            
            // Generate research tasks
            const tasks = this.generateResearchTasks(query);
            
            this.updateProgress({
                current_phase: `Created ${tasks.length} research tasks`,
                progress_percentage: 10,
                active_agents: tasks.length,
                total_tasks: tasks.length
            });
            
            // Execute searches in parallel
            const searchPromises = tasks.map((task, index) => 
                this.executeSearchTask(task, index + 1, tasks.length)
            );
            
            this.updateProgress({
                current_phase: 'Agents beginning parallel search operations...',
                progress_percentage: 20,
                active_agents: tasks.length,
                total_tasks: tasks.length
            });
            
            const taskResults = await Promise.all(searchPromises);
            
            // Combine all sources
            let allSources = [];
            taskResults.forEach(result => {
                if (result && result.sources) {
                    allSources = allSources.concat(result.sources);
                }
            });
            
            // Remove duplicates and limit sources
            const uniqueSources = this.removeDuplicateSources(allSources);
            const topSources = uniqueSources.slice(0, 30); // Limit to top 30 sources
            
            this.updateProgress({
                current_phase: `Found ${topSources.length} unique sources - generating synthesis...`,
                progress_percentage: 80,
                active_agents: 1,
                completed_tasks: tasks.length,
                total_tasks: tasks.length,
                sources_found: topSources.length
            });
            
            // Generate final synthesis
            const synthesis = await this.generateSynthesis(query, topSources);
            
            this.updateProgress({
                current_phase: 'Research complete!',
                progress_percentage: 100,
                active_agents: 0,
                completed_tasks: tasks.length,
                total_tasks: tasks.length,
                sources_found: topSources.length
            });
            
            // Display results
            const researchTime = (Date.now() - startTime) / 1000;
            const results = {
                final_synthesis: synthesis,
                total_sources: topSources.length,
                total_agents_used: tasks.length,
                research_time: researchTime,
                confidence_assessment: { 
                    overall_confidence: Math.min(0.9, topSources.length / 20) 
                }
            };
            
            this.handleResearchComplete(results);
            
        } catch (error) {
            console.error('Client-side research failed:', error);
            throw error;
        }
    }
    
    generateResearchTasks(query) {
        return [
            {
                id: 1,
                description: `Current facts and information about ${query}`,
                searchQuery: `${query} latest information facts`,
                type: 'fact_finding'
            },
            {
                id: 2,
                description: `Recent developments in ${query}`,
                searchQuery: `${query} recent developments 2024 news`,
                type: 'recent_developments'
            },
            {
                id: 3,
                description: `Expert opinions on ${query}`,
                searchQuery: `${query} expert analysis opinion insights`,
                type: 'expert_opinion'
            },
            {
                id: 4,
                description: `Technical details about ${query}`,
                searchQuery: `${query} technical implementation how it works`,
                type: 'technical_details'
            },
            {
                id: 5,
                description: `Market trends and future outlook for ${query}`,
                searchQuery: `${query} market trends future outlook predictions`,
                type: 'trend_analysis'
            }
        ];
    }
    
    async executeSearchTask(task, taskNum, totalTasks) {
        try {
            this.updateProgress({
                current_phase: `Agent ${taskNum}/${totalTasks}: ${task.description}`,
                progress_percentage: 20 + (taskNum / totalTasks) * 50,
                active_agents: totalTasks - taskNum + 1,
                total_tasks: totalTasks
            });
            
            // Search with Exa
            const searchResults = await this.searchWithExa(task.searchQuery);
            
            // Process and extract content
            const sources = [];
            for (const result of searchResults.slice(0, 10)) {  // Limit per task
                try {
                    const processedSource = await this.processSearchResult(result, task);
                    if (processedSource) {
                        sources.push(processedSource);
                        this.addSourceToFeed(processedSource);
                        // Small delay to show streaming effect
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    console.warn('Failed to process search result:', e);
                }
            }
            
            return { task, sources };
            
        } catch (error) {
            console.error(`Task ${taskNum} failed:`, error);
            return { task, sources: [] };
        }
    }
    
    async searchWithExa(query) {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.exa}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                num_results: 15,
                type: 'neural',
                contents: { text: true },
                exclude_domains: ['reddit.com', 'facebook.com', 'twitter.com', 'instagram.com']
            })
        });
        
        if (!response.ok) {
            throw new Error(`Exa search failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data.results || [];
    }
    
    async processSearchResult(result, task) {
        try {
            const content = result.text || result.snippet || '';
            const title = result.title || 'Untitled';
            const url = result.url;
            const domain = new URL(url).hostname;
            
            if (content.length < 100) {
                return null; // Skip short content
            }
            
            return {
                url: url,
                title: title,
                content: content,
                snippet: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
                domain: domain,
                task_id: task.id,
                relevance_score: this.calculateRelevance(content, task.searchQuery),
                word_count: content.split(' ').length
            };
        } catch (error) {
            console.warn('Failed to process search result:', error);
            return null;
        }
    }
    
    calculateRelevance(content, query) {
        const contentWords = new Set(content.toLowerCase().split(/\W+/));
        const queryWords = new Set(query.toLowerCase().split(/\W+/));
        
        let matches = 0;
        for (const word of queryWords) {
            if (contentWords.has(word)) {
                matches++;
            }
        }
        
        return matches / queryWords.size;
    }
    
    removeDuplicateSources(sources) {
        const seen = new Set();
        return sources.filter(source => {
            const normalized = this.normalizeUrl(source.url);
            if (seen.has(normalized)) {
                return false;
            }
            seen.add(normalized);
            return true;
        });
    }
    
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname + parsed.pathname;
        } catch {
            return url;
        }
    }
    
    async generateSynthesis(query, sources) {
        if (!sources.length) {
            return `# Research Results for: ${query}\n\nNo relevant sources were found for this query.`;
        }
        
        // Create source summaries
        const sourceSummaries = sources.slice(0, 15).map((source, index) => 
            `**Source ${index + 1}**: ${source.title} (${source.domain})\n${source.snippet}\n`
        ).join('\n');
        
        const prompt = `Based on the following research sources, create a comprehensive analysis for the query: "${query}"

Research Sources:
${sourceSummaries}

Please provide a well-structured synthesis that:
1. Directly answers the research question
2. Summarizes key findings from the sources
3. Identifies important trends or patterns
4. Provides actionable insights
5. Notes any limitations or areas needing further research

Format the response with clear headings and organize the information logically.`;
        
        try {
            const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKeys.cerebras}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a research synthesis expert. Create comprehensive, well-structured analyses based on provided sources.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 3000,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) {
                throw new Error(`Cerebras API failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
            
        } catch (error) {
            console.error('Synthesis generation failed:', error);
            // Fallback synthesis
            return `# Research Results for: ${query}

## Overview
Research completed using ${sources.length} sources across multiple domains.

## Key Sources Found
${sources.slice(0, 10).map((s, i) => `${i + 1}. **${s.title}** (${s.domain})\n   ${s.snippet}`).join('\n\n')}

## Summary
The research gathered information from ${sources.length} diverse sources. Due to processing limitations, a detailed synthesis could not be generated, but the sources above provide comprehensive coverage of the topic.

*Note: For a detailed analysis, please try the query again or check the individual sources listed above.*`;
        }
    }
    
    handleProgressUpdate(data) {
        if (data.type === 'progress') {
            this.updateProgress(data);
        } else if (data.type === 'source_found') {
            this.addSourceToFeed(data.source);
        } else if (data.type === 'agent_update') {
            this.updateAgentStatus(data);
        } else if (data.type === 'complete') {
            this.handleResearchComplete(data.results);
        }
    }
    
    updateProgress(progressData) {
        const percentage = Math.round(progressData.progress_percentage || 0);
        
        this.elements.progressText.textContent = progressData.current_phase || 'Processing...';
        this.elements.progressPercent.textContent = `${percentage}%`;
        this.elements.progressBar.style.width = `${percentage}%`;
        
        // Update agent status
        if (progressData.active_agents !== undefined) {
            this.updateAgentStatusBadges(progressData.active_agents, progressData.total_tasks || 0);
        }
    }
    
    updateAgentStatusBadges(activeAgents, totalTasks) {
        this.elements.agentStatus.innerHTML = '';
        
        if (activeAgents > 0) {
            const badge = document.createElement('span');
            badge.className = 'agent-activity text-white px-3 py-1 rounded-full text-sm font-medium';
            badge.textContent = `${activeAgents} agents active`;
            this.elements.agentStatus.appendChild(badge);
        }
        
        if (totalTasks > 0) {
            const taskBadge = document.createElement('span');
            taskBadge.className = 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm';
            taskBadge.textContent = `${totalTasks} tasks`;
            this.elements.agentStatus.appendChild(taskBadge);
        }
    }
    
    addSourceToFeed(source) {
        this.elements.sourcesSection.classList.remove('hidden');
        
        const sourceElement = document.createElement('div');
        sourceElement.className = 'source-card bg-gray-50 p-4 rounded-lg';
        
        const domain = source.domain || 'Unknown';
        const title = source.title || 'Untitled';
        const snippet = source.snippet || 'No preview available';
        
        sourceElement.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-gray-800 flex-1">${this.escapeHtml(title)}</h4>
                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">${this.escapeHtml(domain)}</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">${this.escapeHtml(snippet.substring(0, 200))}...</p>
            <a href="${source.url}" target="_blank" class="text-xs text-blue-600 hover:text-blue-800">View Source →</a>
        `;
        
        this.elements.sourcesList.appendChild(sourceElement);
        
        // Update source count
        const currentCount = parseInt(this.elements.sourceCount.textContent) + 1;
        this.elements.sourceCount.textContent = currentCount;
        
        // Scroll to bottom of sources list
        sourceElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    

    
    handleResearchComplete(results) {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        
        this.elements.progressText.textContent = 'Research complete!';
        this.elements.progressPercent.textContent = '100%';
        this.elements.progressBar.style.width = '100%';
        
        this.displayResults(results);
        this.resetResearchButton();
    }
    
    displayResults(results) {
        this.elements.resultsSection.classList.remove('hidden');
        
        // Display main synthesis
        this.elements.researchResults.innerHTML = this.markdownToHtml(results.final_synthesis || 'No results available');
        
        // Update summary stats
        this.elements.totalSources.textContent = results.total_sources || 0;
        this.elements.totalAgents.textContent = results.total_agents_used || 0;
        this.elements.researchTime.textContent = `${Math.round(results.research_time || 0)}s`;
        
        const confidence = results.confidence_assessment?.overall_confidence || 0;
        this.elements.confidenceScore.textContent = `${Math.round(confidence * 100)}%`;
        
        // Scroll to results
        this.elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    markdownToHtml(markdown) {
        // Simple markdown to HTML conversion
        return markdown
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p class="mb-4">')
            .replace(/^(.+)$/gm, '<p class="mb-4">$1</p>')
            .replace(/<p class="mb-4"><\/p>/g, '');
    }
    
    resetUI() {
        this.elements.progressSection.classList.add('hidden');
        this.elements.sourcesSection.classList.add('hidden');
        this.elements.resultsSection.classList.add('hidden');
        
        this.elements.sourcesList.innerHTML = '';
        this.elements.sourceCount.textContent = '0';
        this.elements.agentStatus.innerHTML = '';
        
        this.elements.progressBar.style.width = '0%';
        this.elements.progressText.textContent = 'Initializing...';
        this.elements.progressPercent.textContent = '0%';
    }
    
    resetResearchButton() {
        this.elements.startResearch.disabled = false;
        this.elements.startResearch.textContent = 'Start Research';
        this.updateConfigStatus();
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MultiAgentResearchApp();
}); 