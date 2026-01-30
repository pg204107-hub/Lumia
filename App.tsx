
import React, { useState, useEffect, useRef } from 'react';
import { MemoryData, AppState, GenerationResult } from './types';
import * as gemini from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [memory, setMemory] = useState<MemoryData>({
    name: '',
    relationship: '',
    detail: '',
    mood: 'nostalgic'
  });
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loadingStep, setLoadingStep] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startExperience = () => {
    setState(AppState.INPUT);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMemory(prev => ({ ...prev, [name]: value }));
  };

  const generateContent = async () => {
    if (!memory.name || !memory.relationship || !memory.detail) return;
    
    setState(AppState.GENERATING);
    setLoadingStep('Searching for the right words...');
    
    try {
      const letterRes = await gemini.generateEmotionalLetter(memory);
      
      setLoadingStep('Capturing a flickering memory...');
      const imageUrl = await gemini.generateMemoryPortrait(memory, letterRes.text);
      
      setLoadingStep('Giving the memory a voice...');
      const audioData = await gemini.generateLetterVoice(letterRes.text);
      
      setResult({ 
        letter: letterRes.text, 
        imageUrl, 
        audioData,
        citations: letterRes.citations 
      });
      setState(AppState.REVEAL);
    } catch (error) {
      console.error(error);
      setState(AppState.INPUT);
      alert("The connection to the garden was lost. Please try again.");
    }
  };

  const playAudio = async () => {
    if (!result?.audioData) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }

    const buffer = await gemini.decodeAudio(result.audioData, ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    audioSourceRef.current = source;
  };

  const handleShare = async () => {
    if (!result) return;
    const shareData = {
      title: 'Lumina: A Memory Shared',
      text: `A letter from ${memory.name} (${memory.relationship}):\n\n${result.letter.substring(0, 100)}...`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n\nShared from Lumina.`);
        alert("Memory content copied to clipboard.");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const submitFeedback = () => {
    // In a real app, you'd send feedbackText to a server.
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackSubmitted(false);
      setFeedbackText('');
    }, 2000);
  };

  const reset = () => {
    if (audioSourceRef.current) audioSourceRef.current.stop();
    setState(AppState.LANDING);
    setResult(null);
    setMemory({ name: '', relationship: '', detail: '', mood: 'nostalgic' });
    setShowFeedback(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900 blur-[120px] rounded-full"></div>
      </div>

      {state === AppState.LANDING && (
        <div className="max-w-2xl text-center space-y-8 fade-in z-10">
          <h1 className="text-5xl md:text-7xl font-serif font-light tracking-tight text-amber-50">
            Lumina
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed">
            In the garden of unspoken words, nothing is ever truly lost. 
            Bring a memory, a name, or a shadow of a feeling, 
            and let us help you find what was left behind.
          </p>
          <button 
            onClick={startExperience}
            className="px-8 py-3 bg-slate-100 text-slate-950 rounded-full font-medium hover:bg-amber-100 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-white/5"
          >
            Enter the Garden
          </button>
        </div>
      )}

      {state === AppState.INPUT && (
        <div className="w-full max-w-lg space-y-8 fade-in z-10">
          <header className="text-center space-y-2">
            <h2 className="text-3xl font-serif text-amber-50">Who are you thinking of?</h2>
            <p className="text-slate-500">Share a fragment of a memory.</p>
          </header>
          
          <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-slate-500">Their Name</label>
              <input 
                name="name"
                value={memory.name}
                onChange={handleInputChange}
                placeholder="Someone you miss..."
                className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-slate-500">The Relationship</label>
              <input 
                name="relationship"
                value={memory.relationship}
                onChange={handleInputChange}
                placeholder="A grandmother, a childhood friend, a version of you..."
                className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-slate-500">A Small Detail</label>
              <textarea 
                name="detail"
                value={memory.detail}
                onChange={handleInputChange}
                placeholder="The way they smelled of cinnamon, the blue bicycle, a phrase they always said..."
                rows={3}
                className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-slate-500">The Sentiment</label>
              <select 
                name="mood"
                value={memory.mood}
                onChange={handleInputChange}
                className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors appearance-none"
              >
                <option value="nostalgic" className="bg-slate-900">Nostalgic</option>
                <option value="bittersweet" className="bg-slate-900">Bittersweet</option>
                <option value="hopeful" className="bg-slate-900">Hopeful</option>
                <option value="grieving" className="bg-slate-900">Heavy with Loss</option>
              </select>
            </div>

            <button 
              onClick={generateContent}
              disabled={!memory.name || !memory.relationship || !memory.detail}
              className="w-full py-4 bg-amber-600/20 text-amber-200 border border-amber-500/30 rounded-2xl font-medium hover:bg-amber-600/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              Wait for the Echo
            </button>
          </div>
        </div>
      )}

      {state === AppState.GENERATING && (
        <div className="flex flex-col items-center justify-center space-y-6 fade-in">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-amber-100/70 font-serif italic text-xl animate-pulse">
            {loadingStep}
          </p>
        </div>
      )}

      {state === AppState.REVEAL && result && (
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center fade-in z-10">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="relative group">
               <img 
                src={result.imageUrl} 
                alt="Memory Portrait" 
                className="w-full h-auto aspect-[4/3] object-cover rounded-3xl shadow-2xl border border-slate-800 grayscale hover:grayscale-0 transition-all duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 rounded-3xl"></div>
              
              <div className="absolute top-4 right-4 flex space-x-2">
                <button 
                  onClick={handleShare}
                  className="w-10 h-10 bg-slate-900/80 backdrop-blur-md rounded-full flex items-center justify-center border border-slate-700 hover:border-amber-500/50 transition-colors"
                  title="Share memory"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185m0 12.814a2.25 2.25 0 1 0 3.933 2.185 2.25 2.25 0 0 0-3.933-2.185" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4 px-4">
              <div className="flex justify-between items-center">
                <button 
                  onClick={playAudio}
                  className="flex items-center space-x-3 text-amber-200 hover:text-amber-100 transition-colors group"
                >
                  <div className="w-12 h-12 bg-amber-900/30 border border-amber-500/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium tracking-widest uppercase">Hear their voice</span>
                </button>
                
                <button 
                  onClick={() => setShowFeedback(true)}
                  className="flex items-center space-x-2 text-slate-500 hover:text-amber-200/60 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                  </svg>
                  <span className="text-xs uppercase tracking-widest">Leave a reflection</span>
                </button>
              </div>

              {result.citations && result.citations.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Sources discovered from the web:</p>
                  <ul className="space-y-1">
                    {result.citations.map((cite, idx) => (
                      <li key={idx} className="text-xs">
                        <a href={cite.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors underline decoration-blue-900 underline-offset-2">
                          {cite.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-8 max-h-[70vh] overflow-y-auto pr-6 custom-scrollbar">
             <div className="letter-content font-serif text-xl md:text-2xl text-slate-200 italic font-light leading-relaxed whitespace-pre-wrap">
               {result.letter}
             </div>
             <button 
                onClick={reset}
                className="text-slate-500 hover:text-slate-300 transition-colors text-sm uppercase tracking-widest pt-8 block"
              >
                Return to stillness
              </button>
             <div className="h-24"></div> {/* Spacer for scrolling */}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-serif text-amber-50">Was this resonance true?</h3>
            {!feedbackSubmitted ? (
              <>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your reflection helps us nurture the garden. How did this experience feel to you?
                </p>
                <textarea 
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Words left in the silence..."
                  rows={4}
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-amber-500 outline-none transition-colors resize-none"
                />
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setShowFeedback(false)}
                    className="flex-1 py-3 text-slate-500 hover:text-slate-300 transition-colors text-sm uppercase tracking-widest"
                  >
                    Close
                  </button>
                  <button 
                    onClick={submitFeedback}
                    className="flex-1 py-3 bg-amber-600/20 text-amber-200 border border-amber-500/30 rounded-xl font-medium hover:bg-amber-600/30 transition-all text-sm uppercase tracking-widest"
                  >
                    Leave Word
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center space-y-4">
                <div className="text-amber-500 animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-12 h-12 mx-auto">
                    <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z" />
                  </svg>
                </div>
                <p className="text-amber-100 font-serif italic text-lg">Your word is kept.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Audio Controls at bottom if reveal state */}
      {state === AppState.REVEAL && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 opacity-40">
           <p className="text-[10px] text-slate-600 uppercase tracking-widest">A memory by Lumina</p>
        </div>
      )}
    </div>
  );
};

export default App;
