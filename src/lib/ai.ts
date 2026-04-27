import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'grok' | 'openrouter' | 'deepseek';

export interface AIResponse {
  text: string;
}

export interface GenerationOptions {
  responseType?: 'json' | 'text';
  providerOverride?: AIProvider;
}

export async function generateContent(prompt: string, options?: GenerationOptions, retries = 2, backoffMs = 2000): Promise<AIResponse> {
  const provider = (options?.providerOverride || localStorage.getItem('ACTIVE_AI_PROVIDER') || 'gemini') as AIProvider;
  
  try {
    if (provider === 'gemini') {
      // Prefer localStorage if explicitly set, otherwise use the environment variable
      let apiKey = localStorage.getItem('GEMINI_API_KEY');
      
      try {
        if (!apiKey && typeof process !== 'undefined' && process.env) {
          apiKey = process.env.GEMINI_API_KEY || null;
        }
      } catch (e) {
        // process might not be defined in some browser environments
      }
      
      // Fallback to Vite env if process wasn't available
      try {
        if (!apiKey && typeof import.meta.env !== 'undefined') {
          apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
        }
      } catch (e) { }

      if (!apiKey) throw new Error('Gemini API key is required');
      
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({ 
        model: "gemini-2.0-flash",
        contents: prompt,
        config: options?.responseType === 'json' ? { responseMimeType: "application/json" } : undefined
      });
      return { text: response.text || '' };
    }

    if (provider === 'openai' || provider === 'grok' || provider === 'openrouter' || provider === 'deepseek') {
      let apiKeyName = 'OPENAI_API_KEY';
      if (provider === 'grok') apiKeyName = 'GROK_API_KEY';
      if (provider === 'openrouter') apiKeyName = 'OPENROUTER_API_KEY';
      if (provider === 'deepseek') apiKeyName = 'DEEPSEEK_API_KEY';
      
      const apiKey = localStorage.getItem(apiKeyName);
      if (!apiKey) throw new Error(`${provider.toUpperCase()} API key is required`);
      
      let baseURL: string | undefined = undefined;
      if (provider === 'grok') baseURL = 'https://api.x.ai/v1';
      if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';
      if (provider === 'deepseek') baseURL = 'https://api.deepseek.com';

      const client = new OpenAI({ 
        apiKey, 
        dangerouslyAllowBrowser: true,
        baseURL
      });
      
      let model = 'gpt-4o-mini';
      if (provider === 'grok') model = 'grok-beta';
      if (provider === 'openrouter') model = 'google/gemini-2.0-flash-lite-001';
      if (provider === 'deepseek') model = 'deepseek-chat';

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: options?.responseType === 'json' ? { type: "json_object" } : undefined
      });
      
      return { text: response.choices[0].message.content || '' };
    }

    if (provider === 'claude') {
      const apiKey = localStorage.getItem('CLAUDE_API_KEY');
      if (!apiKey) throw new Error('Claude API key is required');
      
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      
      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      
      // @ts-ignore - Handle different content types if necessary
      const text = response.content[0].text;
      return { text };
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  } catch (error: any) {
    // Extract error message from various possible shapes
    let errorMsg = '';
    if (typeof error === 'string') {
      errorMsg = error;
    } else if (error?.message) {
      errorMsg = error.message;
    } else if (error?.error?.message) {
      errorMsg = error.error.message;
    } else {
      errorMsg = JSON.stringify(error);
    }
    
    const lowerMsg = errorMsg.toLowerCase();
    
    if (lowerMsg.includes('high demand') || lowerMsg.includes('temporary') || lowerMsg.includes('spikes in demand') || lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('exhausted')) {
      if (retries > 0) {
        console.warn(`[AI] Encountered 429/High Demand. Retrying in ${backoffMs}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return generateContent(prompt, options, retries - 1, backoffMs * 2);
      }
    }

    console.error(`AI Generation Error (${provider}):`, errorMsg);

    if (lowerMsg.includes('api key is required')) {
      throw new Error(`${provider.toUpperCase()} API key is required. Please set it in Settings.`);
    }
    
    if (lowerMsg.includes('401') || lowerMsg.includes('incorrect api key') || lowerMsg.includes('invalid api key')) {
      throw new Error(`Invalid API Key: The API key provided for ${provider.toUpperCase()} is incorrect. Please check your Settings.`);
    }
    
    if (lowerMsg.includes('connection error') || lowerMsg.includes('network error') || lowerMsg.includes('fetch failed')) {
      throw new Error(`Connection Error: Failed to connect to ${provider.toUpperCase()} API. Please check your internet connection or try again.`);
    }

    if (lowerMsg.includes('high demand') || lowerMsg.includes('temporary') || lowerMsg.includes('spikes in demand')) {
      throw new Error(`High Demand (429): The ${provider.toUpperCase()} model is currently experiencing high demand. Spikes are temporary, please try again later.`);
    }

    // Check for rate limit / quota errors
    if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('exhausted')) {
      throw new Error(`AI Quota or Rate Limit Exceeded (429): The ${provider.toUpperCase()} API limit was reached. Please check your billing/plan or try switching to another AI provider in Settings.`);
    }
    
    throw new Error(errorMsg);
  }
}
