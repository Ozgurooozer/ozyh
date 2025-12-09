import React from 'react';
import SpriteEditor from './components/SpriteEditor';
import { Layers, Command, Zap } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-[#050505] text-slate-300 overflow-hidden flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* Professional Top Bar */}
      <header className="h-12 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="text-white" size={14} />
            </div>
            <span className="font-bold tracking-tight text-sm">ORION <span className="opacity-50 font-light">STUDIO</span></span>
          </div>
          
          <div className="h-4 w-px bg-white/10"></div>
          
          <nav className="flex items-center gap-1">
            <button className="px-3 py-1 rounded-sm text-[10px] font-medium hover:bg-white/5 transition-colors text-slate-400 hover:text-white">FILE</button>
            <button className="px-3 py-1 rounded-sm text-[10px] font-medium hover:bg-white/5 transition-colors text-slate-400 hover:text-white">EDIT</button>
            <button className="px-3 py-1 rounded-sm text-[10px] font-medium hover:bg-white/5 transition-colors text-slate-400 hover:text-white">VIEW</button>
            <button className="px-3 py-1 rounded-sm text-[10px] font-medium hover:bg-white/5 transition-colors text-slate-400 hover:text-white">WINDOW</button>
            <button className="px-3 py-1 rounded-sm text-[10px] font-medium hover:bg-white/5 transition-colors text-slate-400 hover:text-white">HELP</button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
              <Zap size={10} className="text-yellow-500" />
              <span className="text-[10px] font-mono text-slate-400">GEMINI 2.5 FLASH</span>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
              <Command size={10} className="text-purple-500" />
              <span className="text-[10px] font-mono text-slate-400">GEMINI 3 PRO</span>
           </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        <SpriteEditor />
      </main>

      {/* StatusBar */}
      <footer className="h-6 border-t border-white/10 bg-[#080808] flex items-center justify-between px-3 shrink-0 text-[10px] font-mono text-slate-500 select-none">
        <div className="flex gap-4">
          <span>READY</span>
          <span>GPU: ACTIVE</span>
          <span>LATENCY: 42ms</span>
        </div>
        <div className="flex gap-4">
          <span>GRID: 64px</span>
          <span>ZOOM: 100%</span>
          <span>v2.4.0-build.892</span>
        </div>
      </footer>
    </div>
  );
};

export default App;