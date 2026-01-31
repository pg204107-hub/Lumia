
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
  const [quotaWait, setQuotaWait] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const generateContent = async () => {
    if (!memory.name || !memory.relationship || !memory.detail) return;
    
    setErrorMsg(null);
    setQuotaWait(false);
    setState(AppState.GENERATING);
    
    try {
      // Priority 1: Text & Metadata
      const unified = await gemini.generateUnifiedContent(memory);
      
      setResult({ 
        letter: unified.letter, 
        imageUrl: '', 
      });
      setState(AppState.REVEAL);

      // Trigger background loads
      loadMultimedia(unified.letter, unified.imagePrompt);

    } catch (error: any) {
      console.error(error);
      const isQuota = error?.message?.includes("429") || error?.message?.toLowerCase().includes("exhausted");
      if (isQuota) {
        setQuotaWait(true);
        setErrorMsg("The garden's echoes are too loud right now. Let's wait for a moment of silence.");
      } else {
        setErrorMsg(`The connection was lost: ${error?.message}`);
      }
      setState(AppState.INPUT);
    }
  };

  const loadMultimedia = async (letterText: string, imagePrompt: string) => {
    setIsImageLoading(true);
    setIsAudioLoading(true);

    // Portrait
    try {
      const url = await gemini.generateMemoryPortrait(imagePrompt);
      setResult(prev => prev ? { ...prev, imageUrl: url } : null);
    } catch (e) {
      console.warn("Portrait skipped due to quota");
    } finally {
      setIsImageLoading(false);
    }

    // Voice
    try {
      const audio = await gemini.generateLetterVoice(letterText);
      setResult(prev => prev ? { ...prev, audioData: audio } : null);
    } catch (e) {
      console.warn("Voice skipped due to quota");
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
    setQuotaWait(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden relative">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-amber-900/30 blur-[150px] rounded-full"></div>
      </div>

      {state === AppState.LANDING && (
        <div className="max-w-2xl text-center space-y-12 fade-in z-10">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-serif font-extralight tracking-tighter text-amber-50/90">Lumina</h1>
            <p className="text-amber-200/40 text-xs uppercase tracking-[0.4em]">The Garden of Unspoken Words</p>
          </div>
          <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed max-w-lg mx-auto">
            Bring a name, a fragment of a memory, or a shadow of a feeling. Let us find what was left behind.
          </p>
          <button onClick={() => setState(AppState.INPUT)} className="group relative px-10 py-4 bg-transparent border border-white/10 rounded-full font-light tracking-widest text-white/80 hover:text-white hover:border-white/40 transition-all">
            <span className="relative z-10">Step Into the Silence</span>
            <div className="absolute inset-0 bg-white/5 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      )}

      {state === AppState.INPUT && (
        <div className="w-full max-w-lg space-y-10 fade-in z-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-serif text-amber-50/90">Who are you holding space for?</h2>
            {quotaWait && (
              <div className="flex flex-col items-center space-y-3 pt-4">
                <div className="w-12 h-12 rounded-full border border-amber-500/20 breathe"></div>
                <p className="text-amber-500/70 text-xs uppercase tracking-widest animate-pulse">Take a deep breath. The garden is crowded.</p>
              </div>
            )}
          </div>
          
          <div className="space-y-8 bg-slate-900/30 p-10 rounded-[3rem] border border-white/5 backdrop-blur-2xl shadow-2xl">
            {errorMsg && !quotaWait && (
              <p className="text-red-400/80 text-center text-xs tracking-wide">{errorMsg}</p>
            )}
            <div className="space-y-6">
              <div className="group border-b border-white/10 focus-within:border-amber-400/50 transition-colors">
                <label className="text-[10px] uppercase tracking-widest text-slate-600 group-focus-within:text-amber-500/50 transition-colors">A Name</label>
                <input name="name" value={memory.name} onChange={(e) => setMemory({...memory, name: e.target.value})} placeholder="Someone you miss..." className="w-full bg-transparent py-2 outline-none text-slate-200 placeholder:text-slate-700" />
              </div>
              <div className="group border-b border-white/10 focus-within:border-amber-400/50 transition-colors">
                <label className="text-[10px] uppercase tracking-widest text-slate-600 group-focus-within:text-amber-500/50 transition-colors">The Relationship</label>
                <input name="relationship" value={memory.relationship} onChange={(e) => setMemory({...memory, relationship: e.target.value})} placeholder="Grandfather, old friend..." className="w-full bg-transparent py-2 outline-none text-slate-200 placeholder:text-slate-700" />
              </div>
              <div className="group border-b border-white/10 focus-within:border-amber-400/50 transition-colors">
                <label className="text-[10px] uppercase tracking-widest text-slate-600 group-focus-within:text-amber-500/50 transition-colors">A Fragment of Memory</label>
                <textarea name="detail" value={memory.detail} onChange={(e) => setMemory({...memory, detail: e.target.value})} placeholder="The smell of rain, their blue bicycle..." rows={3} className="w-full bg-transparent py-2 outline-none text-slate-200 placeholder:text-slate-700 resize-none" />
              </div>
            </div>
            <button 
              onClick={generateContent} 
              disabled={!memory.name || !memory.relationship || !memory.detail} 
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 rounded-3xl font-light tracking-[0.2em] uppercase text-xs transition-all disabled:opacity-20"
            >
              Listen for the Echo
            </button>
          </div>
        </div>
      )}

      {state === AppState.GENERATING && (
        <div className="flex flex-col items-center space-y-12 fade-in z-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border border-amber-500/10 breathe"></div>
            <div className="absolute inset-0 w-32 h-32 rounded-full border-t border-amber-500/40 animate-spin"></div>
          </div>
          <p className="text-amber-100/40 font-serif italic text-2xl tracking-wide animate-pulse">Finding the words...</p>
        </div>
      )}

      {state === AppState.REVEAL && result && (
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20 items-start fade-in z-10 px-6">
          <div className="space-y-10 lg:sticky lg:top-20">
            <div className="relative group bg-slate-900/40 aspect-[4/3] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              {result.imageUrl ? (
                <img src={result.imageUrl} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-3000 ease-in-out" alt="Memory" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <div className={`w-20 h-20 rounded-full border border-white/5 ${isImageLoading ? 'breathe' : 'opacity-20'}`}></div>
                  <p className="text-[10px] text-slate-700 uppercase tracking-[0.3em] font-light">
                    {isImageLoading ? "Developing memory..." : "The image remains a shadow"}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between px-4">
              {result.audioData ? (
                <button onClick={playAudio} className="flex items-center space-x-4 text-amber-200/60 hover:text-amber-200 transition-all group">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.4em] font-light">Hear their voice</span>
                </button>
              ) : isAudioLoading ? (
                <span className="text-[10px] text-slate-700 uppercase tracking-[0.4em] animate-pulse">Waiting for an echo...</span>
              ) : null}
            </div>
          </div>

          <div className="space-y-12 py-10">
            <div className="letter-content font-serif text-2xl md:text-3xl text-slate-200 italic font-extralight leading-relaxed space-y-6">
              {result.letter.split('\n').map((para, i) => (
                <p key={i} className="fade-in" style={{ animationDelay: `${i * 0.5}s` }}>{para}</p>
              ))}
            </div>
            <div className="pt-12 border-t border-white/5">
              <button onClick={reset} className="text-slate-600 hover:text-amber-500/50 transition-colors text-[10px] uppercase tracking-[0.5em] font-light">Return to the Garden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
