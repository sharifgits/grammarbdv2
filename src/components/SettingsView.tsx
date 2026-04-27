import React, { useState } from 'react';
import { Settings, Shield, Bell, Moon, Sun, Globe, HelpCircle, ChevronRight, User, Palette, Zap, Sparkles, Cpu, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { PdfManager } from './PdfManager';

interface SettingsViewProps {
  onNavigateToAI: (text: string) => void;
}

export function SettingsView({ onNavigateToAI }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'resources'>('activeTab' in localStorage ? (localStorage.getItem('activeTab') as any) : 'general');
  const [keys, setKeys] = useState({
    gemini: localStorage.getItem('GEMINI_API_KEY') || '',
    openai: localStorage.getItem('OPENAI_API_KEY') || '',
    claude: localStorage.getItem('CLAUDE_API_KEY') || '',
    grok: localStorage.getItem('GROK_API_KEY') || '',
    openrouter: localStorage.getItem('OPENROUTER_API_KEY') || '',
    deepseek: localStorage.getItem('DEEPSEEK_API_KEY') || ''
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return document.documentElement.classList.contains('dark');
  });
  const [activeProvider, setActiveProvider] = useState(() => localStorage.getItem('ACTIVE_AI_PROVIDER') || 'gemini');
  const [saveStatus, setSaveStatus] = useState<null | 'saved'>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'testing' | 'success' | 'error' | null>>({});
  const [testErrorMessage, setTestErrorMessage] = useState<Record<string, string>>({});
  
  const handleSaveKeys = () => {
    localStorage.setItem('GEMINI_API_KEY', keys.gemini);
    localStorage.setItem('OPENAI_API_KEY', keys.openai);
    localStorage.setItem('CLAUDE_API_KEY', keys.claude);
    localStorage.setItem('GROK_API_KEY', keys.grok);
    localStorage.setItem('OPENROUTER_API_KEY', keys.openrouter);
    localStorage.setItem('DEEPSEEK_API_KEY', keys.deepseek);
    localStorage.setItem('ACTIVE_AI_PROVIDER', activeProvider);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleTestKey = async (provider: string) => {
    const apiKey = (keys as any)[provider];
    if (!apiKey) {
      setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
      setTestErrorMessage(prev => ({ ...prev, [provider]: 'Please enter an API key first' }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: null })), 3000);
      return;
    }

    setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
    try {
      if (provider === 'gemini') {
        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey });
        await client.models.generateContent({
          model: "gemini-2.0-flash",
          contents: "ping"
        });
      } else if (provider === 'openai' || provider === 'grok' || provider === 'openrouter' || provider === 'deepseek') {
        const { OpenAI } = await import('openai');
        let baseURL = undefined;
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

        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        });
      } else if (provider === 'claude') {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        });
      }
      
      setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: null })), 3000);
    } catch (err: any) {
      console.error(err);
      setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
      setTestErrorMessage(prev => ({ ...prev, [provider]: err.message || 'Verification failed' }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: null })), 5000);
    }
  };

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const toggleDarkMode = (dark: boolean) => {
    setIsDarkMode(dark);
  };

  return (
    <div className="w-full max-w-6xl mx-auto min-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
             <Settings size={24} />
          </div>
          <div>
             <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Settings & Resources</h2>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manage your experience</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleSaveKeys}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              saveStatus === 'saved' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20'
            }`}
          >
            {saveStatus === 'saved' ? 'All Settings Saved' : 'Save Changes'}
          </button>
          
          <button className="px-5 py-2.5 border-2 border-rose-100 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all">
            Log Out
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar Nav */}
        <div className="w-full md:w-56 border-r border-slate-100 dark:border-slate-800 p-4 bg-slate-50/30 dark:bg-slate-800/20">
          <div className="space-y-1">
            <button 
              onClick={() => { setActiveTab('general'); localStorage.setItem('activeTab', 'general'); }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <User size={16} /> General
            </button>
            <button 
              onClick={() => { setActiveTab('ai'); localStorage.setItem('activeTab', 'ai'); }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'ai' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Cpu size={16} /> AI Providers
            </button>
            <button 
              onClick={() => { setActiveTab('resources'); localStorage.setItem('activeTab', 'resources'); }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'resources' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Zap size={16} /> Resources
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'general' ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-xl">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Appearance</h4>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Dark Mode</p>
                      <p className="text-[10px] font-bold text-slate-400">Switch between light and dark themes</p>
                    </div>
                    <button 
                      onClick={() => toggleDarkMode(!isDarkMode)}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Preferences</h4>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Auto-Save Progress</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Save learning data automatically</p>
                      </div>
                      <button className="w-12 h-6 rounded-full p-1 bg-indigo-500">
                        <div className="w-4 h-4 rounded-full bg-white translate-x-6" />
                      </button>
                    </div>
                  </div>
               </div>
            </motion.div>
          ) : activeTab === 'ai' ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 max-w-2xl">
               <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                  <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    <Sparkles size={18} /> Choose Your Brain
                  </h4>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-6">Select which AI will power your language learning journey</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    {[
                      { id: 'gemini', name: 'Gemini', color: 'bg-white text-indigo-600', icon: 'G' },
                      { id: 'openai', name: 'ChatGPT', color: 'bg-emerald-500 text-white', icon: 'C' },
                      { id: 'claude', name: 'Claude', color: 'bg-orange-500 text-white', icon: 'A' },
                      { id: 'grok', name: 'Grok', color: 'bg-slate-900 text-white', icon: 'X' },
                      { id: 'openrouter', name: 'OpenRouter', color: 'bg-white/80 text-blue-600', icon: 'O' },
                      { id: 'deepseek', name: 'DeepSeek', color: 'bg-indigo-900 text-indigo-100', icon: 'D' }
                    ].map((p) => (
                      <button 
                        key={p.id}
                        onClick={() => setActiveProvider(p.id)}
                        className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95 border-2 ${activeProvider === p.id ? 'border-white bg-white/20' : 'border-transparent bg-black/10 hover:bg-black/20'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${p.color}`}>
                          {p.icon}
                        </div>
                        <span className="font-black text-[10px] uppercase tracking-tighter">{p.name}</span>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-4">
                 {[
                   { id: 'gemini', label: 'Gemini API Key', placeholder: 'Enter Gemini API Key', type: 'gemini' },
                   { id: 'openai', label: 'OpenAI (ChatGPT) API Key', placeholder: 'sk-...', type: 'openai' },
                   { id: 'claude', label: 'Anthropic (Claude) API Key', placeholder: 'sk-ant-...', type: 'claude' },
                   { id: 'grok', label: 'xAI (Grok) API Key', placeholder: 'xai-...', type: 'grok' },
                   { id: 'openrouter', label: 'OpenRouter API Key', placeholder: 'sk-or-v1-...', type: 'openrouter' },
                   { id: 'deepseek', label: 'DeepSeek API Key', placeholder: 'sk-...', type: 'deepseek' }
                 ].map((config) => (
                   <div key={config.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{config.label}</label>
                        <div className="flex gap-2">
                          {testStatus[config.id] === 'success' && <span className="text-[9px] font-black text-emerald-500 uppercase">Valid Key</span>}
                          {testStatus[config.id] === 'error' && <span className="text-[9px] font-black text-rose-500 uppercase truncate max-w-[150px]">{testErrorMessage[config.id]}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="password"
                          value={(keys as any)[config.id]}
                          onChange={(e) => setKeys({...keys, [config.id]: e.target.value.trim()})}
                          placeholder={config.placeholder}
                          className="flex-1 px-4 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-slate-800 dark:text-white transition-all"
                        />
                        <button 
                          onClick={() => handleTestKey(config.id)}
                          disabled={testStatus[config.id] === 'testing'}
                          className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${
                            testStatus[config.id] === 'success' ? 'bg-emerald-500 text-white' : 
                            testStatus[config.id] === 'error' ? 'bg-rose-500 text-white' :
                            'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {testStatus[config.id] === 'testing' ? <Loader2 size={12} className="animate-spin" /> : 'Test'}
                        </button>
                      </div>
                   </div>
                 ))}
               </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
               <PdfManager 
                 onExtractText={(text) => {
                   onNavigateToAI(text);
                 }} 
               />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
