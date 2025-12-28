
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ThreeCanvas, { ThreeCanvasHandle } from './components/ThreeCanvas';
import HandTracker from './components/HandTracker';
import { SceneMode } from './types';
import { generateHolidayWish } from './services/geminiService';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [currentWish, setCurrentWish] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<ThreeCanvasHandle>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        console.log("Toggle UI:", !uiVisible);
        setUiVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiVisible]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && canvasRef.current) {
          canvasRef.current.addPhoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const onMagicWish = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const wish = await generateHolidayWish();
    setCurrentWish(wish);
    setIsGenerating(false);
    setTimeout(() => setCurrentWish(""), 8000);
  };

  const onHandUpdate = useCallback((x: number, y: number, detected: boolean, mode: SceneMode) => {
    canvasRef.current?.updateHand(x, y, detected, mode);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Loading Screen */}
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-1000">
          <div className="w-12 h-12 border-2 border-amber-200/20 border-t-amber-400 rounded-full animate-spin mb-6"></div>
          <p className="text-amber-400 uppercase tracking-[0.4em] text-xs font-cinzel">Summoning Particles</p>
        </div>
      )}

      {/* 3D Scene */}
      <ThreeCanvas ref={canvasRef} />

      {/* Hand Tracker */}
      <HandTracker onUpdate={onHandUpdate} />

      {/* UI Overlay */}
      <div className={`absolute inset-0 z-10 pointer-events-none flex flex-col items-center pt-20 px-8 transition-all duration-500 ${uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        
        <h1 className="text-6xl md:text-8xl font-cinzel text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.3)] mb-4">
          NOEL
        </h1>
        
        <p className="text-amber-200/40 uppercase tracking-[0.5em] text-[10px] mb-8">Gestural Holiday Magic</p>

        {currentWish && (
          <div className="max-w-md text-center bg-black/40 backdrop-blur-md border border-amber-400/20 p-6 rounded-lg animate-fade-in mb-8">
            <p className="text-amber-100 font-cinzel italic text-lg leading-relaxed">
              "{currentWish}"
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-6 pointer-events-auto">
          <div className="flex flex-wrap justify-center gap-4">
            <label className="group relative overflow-hidden bg-black/60 hover:bg-amber-400 transition-colors duration-500 border border-amber-400/30 px-8 py-3 cursor-pointer backdrop-blur-sm">
              <span className="relative z-10 text-amber-400 group-hover:text-black uppercase tracking-[0.3em] text-[11px] font-semibold">
                Add Memories
              </span>
              <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
            </label>

            <button 
              onClick={onMagicWish}
              disabled={isGenerating}
              className="group relative overflow-hidden bg-amber-400/10 hover:bg-amber-400 transition-colors duration-500 border border-amber-400/30 px-8 py-3 backdrop-blur-sm disabled:opacity-50"
            >
              <span className="relative z-10 text-amber-400 group-hover:text-black uppercase tracking-[0.3em] text-[11px] font-semibold">
                {isGenerating ? 'Summoning...' : 'Magic Wish'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-4">
            <div className="p-3 border border-white/5 bg-white/5 rounded backdrop-blur-sm">
              <span className="text-amber-400 text-lg font-cinzel block">1</span>
              <span className="text-[9px] uppercase tracking-widest text-white/50">Je t'aime</span>
            </div>
            <div className="p-3 border border-white/5 bg-white/5 rounded backdrop-blur-sm">
              <span className="text-amber-400 text-lg font-cinzel block">2</span>
              <span className="text-[9px] uppercase tracking-widest text-white/50">Année 2026</span>
            </div>
            <div className="p-3 border border-white/5 bg-white/5 rounded backdrop-blur-sm">
              <span className="text-amber-400 text-lg font-cinzel block">3</span>
              <span className="text-[9px] uppercase tracking-widest text-white/50">Cœur</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-amber-200/20 uppercase tracking-[0.1em] text-[8px] max-w-[250px]">
              Fist: Tree • Pinch: Focus • Open Palm: Scatter • Fingers: Messages • [H] Hide UI
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-5" />
    </div>
  );
};

export default App;
