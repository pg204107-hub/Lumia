
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
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startExperience = () => {
    setErrorMsg(null);
    setState(AppState.INPUT);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMemory(prev => ({ ...prev, [name]: value }));
  };

  const generateContent = async () => {
    if (!memory.name || !memory.relationship || !memory.detail) return;
    
    setErrorMsg(null);
    setState(AppState.GENERATING);
    
    try {
      // Step 1: Letter is the priority
      const letterRes = await gemini.generateEmotionalLetter(memory);
      
      // Immediately reveal the letter
      setResult({ 
        letter: letterRes.text, 
        imageUrl: '', 
        citations: letterRes.citations 
      });
      setState(AppState.REVEAL);

      // Step 2: Background tasks (don't block the UI)
      loadMultimedia(letterRes.text);

    } catch (error: any) {
      console.error(error);
      const isQuota = error?.message?.includes("429") || error?.message?.toLowerCase().includes("exhausted");
      setErrorMsg(isQuota 
        ? "The garden is very crowded right now. I'm trying to find a path through..." 
        : `The connection was interrupted: ${error?.message}`
      );
      setState(AppState.INPUT);
    }
  };

  const loadMultimedia = async (letterText: string) => {
    setIsImageLoading(true);
    setIsAudioLoading(true);

    // Load Portrait
    try {
      const url = await gemini.generateMemoryPortrait(memory, letterText);
      setResult(prev => prev ? { ...prev, imageUrl: url } : null);
    } catch (e) {
      console.warn("Portrait failed to load", e);
    } finally {
      setIsImageLoading(false);
    }

    // Load Voice
    try {
      const audio = await gemini.generateLetterVoice(letterText);
      setResult(prev => prev ? { ...prev, audioData: audio } : null);
    } catch (e) {
      console.warn("Voice failed to load", e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const playAudio = async () => {
    if (!result?.audioData) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    if (audioSourceRef.current) audioSourceRef.current.stop();

    const buffer = await gemini.decodeAudio(result.audioData, ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    audioSourceRef.current = source;
  };

  const reset = () => {
    if (audioSourceRef.current) audioSourceRef.current.stop();
    setState(AppState.LANDING);
    setResult(null);
    setMemory({ name: '', relationship: '', detail: '', mood: 'nostalgic' });
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden relative">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900 blur-[120px] rounded-full"></div>
      </div>

      {state === AppState.LANDING && (
        <div className="max-w-2xl text-center space-y-8 fade-in z-10">
          <h1 className="text-5xl md:text-7xl font-serif font-light tracking-tight text-amber-50">Lumina</h1>
          <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed">
            In the garden of unspoken words, nothing is ever truly lost. 
            Share a fragment of a memory, and let us find the echo.
          </p>
          <button onClick={startExperience} className="px-8 py-3 bg-slate-100 text-slate-950 rounded-full font-medium hover:bg-amber-100 transition-all shadow-lg shadow-white/5">
            Enter the Garden
          </button>
        </div>
      )}

      {state === AppState.INPUT && (
        <div className="w-full max-w-lg space-y-8 fade-in z-10">
          <header className="text-center">
            <h2 className="text-3xl font-serif text-amber-50">Who are you thinking of?</h2>
          </header>
          
          <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl">
            {errorMsg && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm animate-pulse">
                {errorMsg}
              </div>
            )}
            <div className="space-y-4">
              <input name="name" value={memory.name} onChange={handleInputChange} placeholder="Their Name" className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors" />
              <input name="relationship" value={memory.relationship} onChange={handleInputChange} placeholder="Your relationship" className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors" />
              <textarea name="detail" value={memory.detail} onChange={handleInputChange} placeholder="A small detail (the blue bicycle, their laugh...)" rows={3} className="w-full bg-transparent border-b border-slate-700 py-2 focus:border-amber-400 outline-none transition-colors resize-none" />
            </div>
            <button onClick={generateContent} disabled={!memory.name || !memory.relationship || !memory.detail} className="w-full py-4 bg-amber-600/20 text-amber-200 border border-amber-500/30 rounded-2xl font-medium hover:bg-amber-600/30 transition-all disabled:opacity-30">
              Listen for the Echo
            </button>
          </div>
        </div>
      )}

      {state === AppState.GENERATING && (
        <div className="flex flex-col items-center space-y-6 fade-in text-center px-6">
          <div className="w-24 h-24 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <p className="text-amber-100/70 font-serif italic text-xl animate-pulse">Finding the right words...</p>
        </div>
      )}

      {state === AppState.REVEAL && result && (
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-start fade-in z-10 px-4 md:px-0">
          <div className="space-y-6 sticky top-12">
            <div className="relative group bg-slate-900 aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
              {result.imageUrl ? (
                <img src={result.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" alt="Memory" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs uppercase tracking-widest">
                  {isImageLoading ? "Capturing memory..." : "The image remains in shadow"}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-6">
              {result.audioData ? (
                <button onClick={playAudio} className="flex items-center space-x-3 text-amber-200 hover:text-amber-100">
                  <div className="w-12 h-12 bg-amber-900/30 border border-amber-500/30 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                  </div>
                  <span className="text-xs uppercase tracking-widest">Hear the Voice</span>
                </button>
              ) : isAudioLoading ? (
                <span className="text-xs text-slate-600 uppercase tracking-widest animate-pulse">Wait for the voice...</span>
              ) : null}
            </div>
          </div>

          <div className="space-y-8">
            <div className="letter-content font-serif text-xl md:text-2xl text-slate-200 italic font-light leading-relaxed">
              {result.letter}
            </div>
            <div className="flex space-x-4 pt-8 border-t border-slate-900">
              <button onClick={reset} className="text-slate-600 hover:text-slate-400 text-xs uppercase tracking-widest">Return to silence</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
