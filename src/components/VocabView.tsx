import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, BookmarkPlus, BookmarkCheck, Search, RefreshCw, Bookmark, Trash2, Library, Copy, Check, Download, Heart } from 'lucide-react';
import { classNames } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { generateContent } from '../lib/ai';
import { toPng } from 'html-to-image';

interface VocabWord {
  word: string;
  meaning: string;
  synonyms: string[];
  sentence?: string;
  sentenceMeaning?: string;
}

interface VocabStory {
  id: string;
  title: string;
  story: string;
  vocabulary: {
    word: string;
    pronunciation: string;
    meaning: string;
  }[];
}

interface VocabViewProps {
  onSearchSynonym: (word: string) => void;
}

export function VocabView({ onSearchSynonym }: VocabViewProps) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [currentStory, setCurrentStory] = useState<VocabStory | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Saved words and stories
  const [savedWords, setSavedWords] = useState<VocabWord[]>([]);
  const [savedStories, setSavedStories] = useState<VocabStory[]>([]);
  
  const [viewMode, setViewMode] = useState<'discover' | 'story' | 'saved'>('discover');
  const [savedSubTab, setSavedSubTab] = useState<'words' | 'stories'>('words');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [savingWords, setSavingWords] = useState<Set<string>>(new Set());
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());
  const [searchCache, setSearchCache] = useState<Record<string, VocabWord[]>>({});
  
  // Pooling for instant experience
  const [wordPool, setWordPool] = useState<VocabWord[]>([]);
  const [storyPool, setStoryPool] = useState<VocabStory[]>([]);
  const [isPreFetching, setIsPreFetching] = useState(false);

  // Flag to ensure we only load initially once
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  
  useEffect(() => {
    const savedW = localStorage.getItem('vocab_saved_words_v2');
    if (savedW) {
      try { setSavedWords(JSON.parse(savedW)); } catch (e) { }
    }
    const savedS = localStorage.getItem('vocab_saved_stories_v1');
    if (savedS) {
      try { setSavedStories(JSON.parse(savedS)); } catch (e) { }
    }
  }, []);

  // Pre-fetch pool on startup
  useEffect(() => {
    if (!hasStartedLoading) {
      setHasStartedLoading(true);
      refillPools();
    }
  }, [hasStartedLoading]);

  const refillPools = async () => {
    if (isPreFetching || isRateLimited) return;
    
    // Cooldown check: don't refill more than once every 10 seconds to save quota
    const lastAttempt = parseInt(localStorage.getItem('last_refill_attempt') || '0');
    const now = Date.now();
    if (now - lastAttempt < 10000) return;
    localStorage.setItem('last_refill_attempt', now.toString());

    setIsPreFetching(true);
    
    try {
      // Fetch some words if pool is low
      if (wordPool.length < 5) {
        const wordPrompt = `Pool 20 random English vocab words (intermediate/advanced). 
Return JSON array with objects: word, meaning(Bengali), synonyms(5), sentence(English), sentenceMeaning(Bengali).`;
        const wordResp = await generateContent(wordPrompt, { responseType: 'json' });
        const wordsData = JSON.parse(wordResp.text || "[]");
        setWordPool(prev => [...prev, ...wordsData]);
        
        // If we have no words showing, show some immediately
        if (words.length === 0 && wordsData.length > 0) {
          setWords(wordsData.slice(0, 10));
          setWordPool(wordsData.slice(10));
        }
      }

      // Fetch a story if pool is low
      if (storyPool.length < 2) {
        const storyPrompt = `Bengali story (5-6 sentences) with at least 10 ADVANCED/SOPHISTICATED English vocab words (GRE/IELTS level) embedded naturally. 
Format: Every advanced English word must be written in parentheses, like (Word).
Exclude any markdown bolding like **.
Title: A short Bengali title.
Extract vocab list: word, pronunciation(Bengali), meaning(Bengali). JSON.`;
        const storyResp = await generateContent(storyPrompt, { responseType: 'json' });
        const storyData = JSON.parse(storyResp.text || "{}");
        storyData.id = crypto.randomUUID();
        setStoryPool(prev => [...prev, storyData]);
        
        if (!currentStory) {
          setCurrentStory(storyData);
        }
      }
    } catch (e: any) {
      if (e.message?.includes('429')) {
        console.warn("Pool refill paused due to rate limiting.");
        setIsRateLimited(true);
        // Do not call setError here to avoid UI interruption for background tasks
        setTimeout(() => setIsRateLimited(false), 60000);
      } else {
        console.error("Pool refill failed:", e);
      }
    } finally {
      setIsPreFetching(false);
    }
  };

  const generateWords = async () => {
    setError(null);
    setSearchQuery('');
    
    if (wordPool.length >= 10) {
      const nextBatch = wordPool.slice(0, 10);
      setWords(nextBatch);
      setWordPool(prev => prev.slice(10));
      // Non-blocking refill
      if (wordPool.length < 15) refillPools();
      return;
    }

    setLoading(true);
    try {
      const prompt = `Generate 10 random English vocab words. 
JSON: word, meaning(Bengali), synonyms(5), sentence(English), sentenceMeaning(Bengali).`;

      const response = await generateContent(prompt, { responseType: 'json' });
      
      const data = JSON.parse(response.text || "[]");
      setWords(data);
      refillPools(); // Refill other items
    } catch (err: any) {
      if (err.message?.includes('429')) {
        console.warn("AI Rate limit reached (Words).");
        setIsRateLimited(true);
        setError(err.message || "AI Rate limit reached. Please wait a minute before trying again.");
        setTimeout(() => setIsRateLimited(false), 60000);
      } else {
        console.error("AI Error:", err);
        setError(err.message || 'Failed to generate words.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateStory = async () => {
    setError(null);
    setViewMode('story');
    
    if (storyPool.length > 0) {
      const nextStory = storyPool[0];
      setCurrentStory(nextStory);
      setStoryPool(prev => prev.slice(1));
      // Non-blocking refill
      if (storyPool.length < 2) refillPools();
      return;
    }

    setLoading(true);
    try {
      const prompt = `Bengali story (5-6 sentences) with at least 10 ADVANCED/SOPHISTICATED English vocab words (GRE/IELTS level) embedded naturally. 
Format: Every advanced English word must be written in parentheses, like (Word).
Exclude any markdown bolding like **.
Title: A short Bengali title.
Extract vocab list: word, pronunciation(Bengali), meaning(Bengali). JSON.`;

      const response = await generateContent(prompt, { responseType: 'json' });
      
      const data = JSON.parse(response.text || "{}");
      data.id = crypto.randomUUID();
      setCurrentStory(data);
      refillPools();
    } catch (err: any) {
      if (err.message?.includes('429')) {
        console.warn("AI Rate limit reached (Story).");
        setIsRateLimited(true);
        setError(err.message || "AI Rate limit reached. Please wait a minute before trying again.");
        setTimeout(() => setIsRateLimited(false), 60000);
      } else {
        console.error("AI Error:", err);
        setError(err.message || 'Failed to generate story.');
      }
    } finally {
      setLoading(false);
    }
  };

  const searchWordDirect = async (query: string) => {
    const q = query.trim().toLowerCase();
    if (searchCache[q]) {
      setWords(searchCache[q]);
      setViewMode('discover');
      setSearchQuery(query);
      return;
    }

    setViewMode('discover');
    setSearchQuery(query);
    setLoading(true);
    setError(null);
    try {
      const prompt = `Details for: "${q}". 
Provide exactly one English vocab word matching.
JSON format:
{
  "word": "English",
  "meaning": "Bengali",
  "synonyms": ["syn1", "syn2", "syn3", "syn4", "syn5"],
  "sentence": "English example",
  "sentenceMeaning": "Bengali translation"
}

Return JSON array with one object.`;

      const response = await generateContent(prompt, { responseType: 'json' });
      
      const responseText = response.text || "[]";
      let data: VocabWord[] = [];
      try { 
        const parsed = JSON.parse(responseText);
        data = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) { throw new Error("Invalid format received from AI."); }
      
      if (data.length > 0) {
        setWords(data);
        setSearchCache(prev => ({ ...prev, [q]: data }));
      } else {
        setError("No word found for your search.");
      }
    } catch (err: any) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const searchWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await searchWordDirect(searchQuery);
  };

  const handleSaveWord = (wordObj: VocabWord) => {
    const isSaved = savedWords.some(s => s.word.toLowerCase() === wordObj.word.toLowerCase());
    if (!isSaved) {
      const updatedSaved = [...savedWords, wordObj];
      setSavedWords(updatedSaved);
      localStorage.setItem('vocab_saved_words_v2', JSON.stringify(updatedSaved));
    }
    
    setSavingWords(prev => new Set(prev).add(wordObj.word.toLowerCase()));
    
    setTimeout(() => {
        setWords(prev => prev.filter(w => w.word.toLowerCase() !== wordObj.word.toLowerCase()));
        setSavingWords(prev => {
            const next = new Set(prev);
            next.delete(wordObj.word.toLowerCase());
            return next;
        });
    }, 800);
  };
  
  const handleRemoveSavedWord = (wordStr: string) => {
      const updatedSaved = savedWords.filter(s => s.word.toLowerCase() !== wordStr.toLowerCase());
      setSavedWords(updatedSaved);
      localStorage.setItem('vocab_saved_words_v2', JSON.stringify(updatedSaved));
  };

  const handleSaveStory = (storyObj: VocabStory) => {
    const isSaved = savedStories.some(s => s.id === storyObj.id);
    if (!isSaved) {
      const updatedSaved = [...savedStories, storyObj];
      setSavedStories(updatedSaved);
      localStorage.setItem('vocab_saved_stories_v1', JSON.stringify(updatedSaved));
      // Feedback to user
      setSavedSubTab('stories');
    }
  };

  const handleRemoveSavedStory = (id: string) => {
      const updatedSaved = savedStories.filter(s => s.id !== id);
      setSavedStories(updatedSaved);
      localStorage.setItem('vocab_saved_stories_v1', JSON.stringify(updatedSaved));
  };

  const handleCopyStory = (storyObj: VocabStory) => {
        const vocabListStr = (storyObj.vocabulary || []).map(v => `${v.word} (${v.pronunciation}): ${v.meaning}`).join('\n');
    const fullText = `${storyObj.title}\n\n${storyObj.story}\n\nশব্দার্থ তালিকা:\n${vocabListStr}`;
    
    navigator.clipboard.writeText(fullText).then(() => {
        setCopyingId(storyObj.id);
        setTimeout(() => setCopyingId(null), 2000);
    });
  };

  const handleDownloadImage = async (storyId: string, title: string) => {
    const node = document.getElementById(`story-card-${storyId}`);
    if (!node) return;

    setIsDownloading(storyId);
    try {
        // Detect current theme
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#0f172a' : '#ffffff'; // slate-900 or white

        const dataUrl = await toPng(node, {
            backgroundColor: bgColor,
            style: {
                borderRadius: '16px',
                margin: '0',
            },
            pixelRatio: 3, // Higher quality for sharing
            cacheBust: true,
        });
        const link = document.createElement('a');
        link.download = `${(title || 'story').replace(/\s+/g, '_')}_story.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Image generation failed:', err);
    } finally {
        setIsDownloading(null);
    }
  };

  // Highlighting English words in the story
  const renderStoryText = (text: string, vocabList: {word:string}[]) => {
    if (!text) return null;
    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
    const wordsInStory = cleanText.split(/(\s+)/);
    const safeVocabList = vocabList || [];
    const vocabLower = safeVocabList.map(v => v.word.toLowerCase());
    
    return wordsInStory.map((wordObj, i) => {
        if (!wordObj.trim()) return wordObj;
        // Strip punctuation and parentheses for matching
        const cleanWord = wordObj.replace(/[,.!?;:()]/g, '').toLowerCase();
        if (vocabLower.includes(cleanWord)) {
            return (
              <span key={i} className="text-red-600 dark:text-red-500 font-extrabold px-1 mx-0.5 rounded transition-colors italic decoration-red-200 underline-offset-4 decoration-2">
                {wordObj}
              </span>
            );
        }
        return <span key={i}>{wordObj}</span>;
    });
  };

  const renderWordCard = (item: VocabWord, isSaved: boolean) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      key={item.word}
      className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between"
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 capitalize">{item.word}</h3>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{item.meaning}</p>
            {item.sentence && (
              <div className="mt-2 mb-2 border-l-4 border-indigo-200 dark:border-indigo-800 pl-3 py-0.5">
                <p className="text-slate-600 dark:text-slate-300 italic text-xs sm:text-sm font-bold">
                  "{item.sentence}"
                </p>
                {item.sentenceMeaning && (
                  <p className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] sm:text-xs mt-0.5">
                    {item.sentenceMeaning}
                  </p>
                )}
              </div>
            )}
          </div>
          {!isSaved ? (
            <button 
                onClick={() => handleSaveWord(item)}
                disabled={savingWords.has(item.word.toLowerCase())}
                className={`px-2 py-1.5 rounded-lg transition-all flex items-center justify-center shrink-0 border ${
                    savingWords.has(item.word.toLowerCase()) 
                    ? 'bg-emerald-500 text-white border-emerald-500' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-slate-200 dark:border-slate-700'
                }`}
                title="Save word"
            >
                {savingWords.has(item.word.toLowerCase()) ? (
                    <BookmarkCheck size={14} className="sm:mr-1" />
                ) : (
                    <BookmarkPlus size={14} className="sm:mr-1" />
                )}
                <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">
                    {savingWords.has(item.word.toLowerCase()) ? "Saved" : "Save"}
                </span>
            </button>
          ) : (
             <button 
                onClick={() => handleRemoveSavedWord(item.word)}
                className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all shrink-0"
                title="Remove saved word"
            >
                <Trash2 size={14} />
            </button> 
          )}
        </div>
        
        <div className="mb-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">Synonyms</span>
          <div className="flex flex-wrap gap-1.5 text-left">
            {(item.synonyms || []).map((syn, sIdx) => (
              <button
                key={sIdx}
                onClick={() => { searchWordDirect(syn); }}
                className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase tracking-wider"
                title="Search this synonym"
              >
                {syn.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStoryCard = (story: VocabStory, isSaved: boolean) => (
      <div id={`story-card-${story.id}`} key={story.id} className="bg-transparent dark:bg-transparent rounded-none p-0 overflow-hidden min-h-[450px] flex flex-col">
        <div className="relative mb-4 flex justify-end">
            {isSaved && (
                <button onClick={() => handleRemoveSavedStory(story.id)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors">
                    <Trash2 size={18} />
                </button>
            )}
        </div>
        
        <div className="text-slate-800 dark:text-slate-100 text-lg md:text-xl leading-[1.7] mb-12 border-b border-indigo-100 dark:border-slate-800 pb-10 font-medium text-justify px-2 drop-shadow-sm">
            {renderStoryText(story.story, story.vocabulary)}
        </div>

        <h4 className="font-black text-indigo-600 dark:text-indigo-400 mb-6 text-xs uppercase tracking-[0.25em] flex items-center gap-2">
           <Library size={14} />
           নতুন শব্দসমূহ
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3 mb-8">
            {(story.vocabulary || []).map((v, i) => (
                <div key={i} className="flex flex-col gap-0.5 py-1 border-b border-indigo-50/30 dark:border-slate-800/20">
                    <div className="flex items-baseline gap-2">
                      <span className="text-slate-300 font-black text-[10px] w-4">{i + 1}.</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-black text-base">{v.word}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold italic">({v.pronunciation})</span>
                    </div>
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium pl-6">{v.meaning}</span>
                </div>
            ))}
        </div>
        
        {!isSaved && (
            <div className="mt-auto pt-8 flex justify-end gap-3 flex-wrap border-t border-indigo-50 dark:border-slate-800/10">
                 <button 
                    onClick={() => {
                        handleDownloadImage(story.id, story.title);
                        setLikedStories(prev => new Set(prev).add(story.id));
                        setTimeout(() => {
                            setLikedStories(prev => {
                                const next = new Set(prev);
                                next.delete(story.id);
                                return next;
                            });
                        }, 2000);
                    }}
                    disabled={isDownloading === story.id}
                    className="px-5 py-2.5 border-2 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-300 hover:bg-white dark:hover:bg-slate-800 font-black rounded-xl transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50 relative overflow-hidden"
                >
                    <AnimatePresence>
                        {likedStories.has(story.id) && (
                            <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.5 }}
                                animate={{ y: -20, opacity: 1, scale: 1.5 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <Heart size={24} className="text-rose-500 fill-rose-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {isDownloading === story.id ? <Loader2 size={14} className="animate-spin" /> : (
                        likedStories.has(story.id) ? <Heart size={14} className="text-rose-500 fill-rose-500" /> : <Download size={14} />
                    )}
                    {isDownloading === story.id ? "Working" : "Image"}
                </button>

                 <button 
                    onClick={() => handleCopyStory(story)}
                    className="px-5 py-2.5 border-2 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-300 hover:bg-white dark:hover:bg-slate-800 font-black rounded-xl transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"
                >
                    {copyingId === story.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copyingId === story.id ? "Copied" : "Copy"}
                </button>

                 <button 
                    onClick={() => handleSaveStory(story)}
                    disabled={savedStories.some(s => s.id === story.id)}
                    className={classNames(
                        "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
                        savedStories.some(s => s.id === story.id) 
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default" 
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none"
                    )}
                >
                    {savedStories.some(s => s.id === story.id) ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
                    {savedStories.some(s => s.id === story.id) ? "Saved" : "Save"}
                </button>
            </div>
        )}
        
        {isSaved && (
            <div className="mt-auto pt-8 flex justify-end gap-3 flex-wrap border-t border-indigo-50 dark:border-slate-800/10">
                <button 
                    onClick={() => {
                        handleDownloadImage(story.id, story.title);
                        setLikedStories(prev => new Set(prev).add(story.id));
                        setTimeout(() => {
                            setLikedStories(prev => {
                                const next = new Set(prev);
                                next.delete(story.id);
                                return next;
                            });
                        }, 2000);
                    }}
                    disabled={isDownloading === story.id}
                    className="px-5 py-2.5 border-2 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-300 hover:bg-white dark:hover:bg-slate-800 font-black rounded-xl transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50 relative overflow-hidden"
                >
                    <AnimatePresence>
                        {likedStories.has(story.id) && (
                            <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.5 }}
                                animate={{ y: -20, opacity: 1, scale: 1.5 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <Heart size={24} className="text-rose-500 fill-rose-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {isDownloading === story.id ? <Loader2 size={14} className="animate-spin" /> : (
                        likedStories.has(story.id) ? <Heart size={14} className="text-rose-500 fill-rose-500" /> : <Download size={14} />
                    )}
                    {isDownloading === story.id ? "Working" : "Image"}
                </button>

                <button 
                    onClick={() => handleCopyStory(story)}
                    className="px-5 py-2.5 border-2 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-300 hover:bg-white dark:hover:bg-slate-800 font-black rounded-xl transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"
                >
                    {copyingId === story.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copyingId === story.id ? "Copied" : "Copy"}
                </button>
            </div>
        )}
      </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 pb-16">
      
      {/* Header Tabs Section */}
      <div className="bg-indigo-500 sm:rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden shadow-sm mx-0 sm:mx-4 md:mx-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full translate-x-8 -translate-y-6" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center mb-1">
            <div className="w-full md:w-auto text-left">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-0.5">Vocabulary</h2>
                <p className="text-indigo-100 font-bold text-xs">Learn words personally or through AI stories.</p>
            </div>
            
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                <button
                    onClick={() => setViewMode('discover')}
                    className={classNames(
                        "flex-1 md:flex-none px-3 py-1.5 font-black rounded-lg transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest",
                        viewMode === 'discover' ? "bg-white text-indigo-600 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                    )}
                >
                    <Search size={14} />
                    <span>Discover</span>
                </button>
                <button
                    onClick={() => {
                        if (!currentStory && viewMode !== 'story') {
                            generateStory();
                        } else {
                            setViewMode('story');
                        }
                    }}
                    className={classNames(
                        "flex-1 md:flex-none px-3 py-1.5 font-black rounded-lg transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest",
                        viewMode === 'story' ? "bg-white text-rose-500 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                    )}
                >
                    <Library size={14} />
                    <span>Story</span>
                </button>
                <button
                    onClick={() => setViewMode('saved')}
                    className={classNames(
                        "flex-1 md:flex-none px-3 py-1.5 font-black rounded-lg transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest",
                        viewMode === 'saved' ? "bg-white text-sky-500 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                    )}
                >
                    <Bookmark size={14} />
                    <span>Saved ({savedWords.length + savedStories.length})</span>
                </button>
            </div>
        </div>

        {/* Search Bar only visible in Discover */}
        {viewMode === 'discover' && (
            <div className="relative z-10 mt-3 pt-3 border-t border-indigo-400/20">
                <form onSubmit={searchWord} className="flex gap-2 relative">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Type a word..."
                            className="w-full h-full pl-4 pr-10 py-2 rounded-xl text-slate-800 placeholder-slate-400 font-bold text-sm outline-none focus:ring-4 focus:ring-white/20 shadow-md bg-white/95"
                        />
                        {loading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 size={18} className="animate-spin text-indigo-500" />
                            </div>
                        )}
                    </div>
                    <button 
                      type="submit" 
                      disabled={loading || !searchQuery.trim()}
                      className="bg-indigo-600 text-white sm:bg-white sm:text-indigo-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                        <Search size={16} strokeWidth={3} />
                        <span className="hidden sm:inline">Search</span>
                    </button>
                </form>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="px-4 sm:px-0 min-h-[300px]">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  {viewMode === 'discover' && 'Explore'}
                  {viewMode === 'story' && 'AI Story'}
                  {viewMode === 'saved' && 'Collections'}
              </h3>
              
              {/* Contextual Refresh Buttons */}
              {viewMode === 'discover' && (
                  <button onClick={generateWords} disabled={loading} title="Random Words" 
                    className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-black py-1.5 px-4 rounded-xl transition-all shadow-sm text-[10px] uppercase tracking-widest disabled:opacity-70 flex items-center gap-2">
                      <RefreshCw size={14} className={classNames(loading && "animate-spin")} strokeWidth={4} />
                      <span className="hidden sm:inline">Refresh</span>
                  </button>
              )}
              {viewMode === 'story' && !loading && (
                  <button onClick={generateStory} title="New Story"
                     className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-black py-1.5 px-4 rounded-xl transition-all shadow-sm text-[10px] uppercase tracking-widest flex items-center gap-2">
                       <RefreshCw size={14} strokeWidth={4} />
                       <span className="hidden sm:inline">New Story</span>
                  </button>
              )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl font-medium border border-red-200 mb-4 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {(loading || (isPreFetching && words.length === 0)) ? (
             <div className="w-full flex flex-col items-center justify-center py-24 text-indigo-500">
                <Loader2 size={40} className="animate-spin mb-4" />
                <p className="font-medium text-slate-500 animate-pulse">
                    {viewMode === 'story' ? 'Writing a new story...' : (isPreFetching && words.length === 0) ? 'Loading vocabulary...' : 'AI is generating...'}
                </p>
             </div>
          ) : viewMode === 'discover' ? (
              words.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {words.map((item) => renderWordCard(item, false))}
                    </AnimatePresence>
                  </div>
              ) : (
                  <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Search size={28} />
                    </div>
                    <p className="text-slate-500 font-medium mb-4">No words available right now.</p>
                    <button 
                      onClick={generateWords} 
                      className="px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold rounded-xl shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                    >
                      Generate Words
                    </button>
                  </div>
              )
          ) : viewMode === 'story' ? (
              currentStory ? (
                  renderStoryCard(currentStory, false)
              ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-slate-500 mb-4 font-medium">No story found.</p>
                    <button 
                      onClick={generateStory} 
                      className="px-6 py-2 bg-rose-600 dark:bg-rose-500 text-white font-bold rounded-xl shadow-sm hover:bg-rose-700 dark:hover:bg-rose-400 transition-colors"
                    >
                      Generate Story
                    </button>
                  </div>
              )
          ) : (
              // Saved view
              <div>
                  <div className="flex gap-2 mb-6 border-b-2 border-slate-200 dark:border-slate-800 pb-4">
                      <button 
                        onClick={() => setSavedSubTab('words')}
                        className={classNames("px-4 py-2 font-bold rounded-lg transition-colors", savedSubTab === 'words' ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
                      >
                          Words ({savedWords.length})
                      </button>
                      <button 
                        onClick={() => setSavedSubTab('stories')}
                         className={classNames("px-4 py-2 font-bold rounded-lg transition-colors", savedSubTab === 'stories' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
                      >
                          Stories ({savedStories.length})
                      </button>
                  </div>

                  {savedSubTab === 'words' && (
                      savedWords.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence>
                              {savedWords.map((item) => renderWordCard(item, true))}
                            </AnimatePresence>
                          </div>
                      ) : (
                          <div className="w-full flex justify-center py-12"><p className="text-slate-500 font-medium">No saved words.</p></div>
                      )
                  )}

                  {savedSubTab === 'stories' && (
                      savedStories.length > 0 ? (
                          <div className="space-y-6">
                              {savedStories.map(s => renderStoryCard(s, true))}
                          </div>
                      ) : (
                           <div className="w-full flex justify-center py-12"><p className="text-slate-500 font-medium">No saved stories.</p></div>
                      )
                  )}
              </div>
          )}
      </div>
    </div>
  );
}