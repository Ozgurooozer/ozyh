import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Sparkles, Upload, RefreshCw, Cpu, Download, 
  PlayCircle, Settings2, LayoutGrid, Square, Grid3X3, 
  Move, ArrowUpCircle, AlertTriangle, Swords, Shield, 
  Ghost, Trophy, Crosshair, Hand, Pause, Play, Scissors,
  Check, ChevronRight, Maximize2, Monitor, Trash2, Terminal,
  Eye, EyeOff, TestTube
} from 'lucide-react';
import { fileToGenerativePart, generateSpriteSheet, refinePromptWithReasoning } from '../services/geminiService';
import { AppStatus, ActionPreset, SpriteStyle, FrameData } from '../types';
import { POSE_TEMPLATES } from '../assets/poses';

// --- DATA CONSTANTS ---

const ACTION_PRESETS: ActionPreset[] = [
  { id: 'IDLE_BREATHE', label: 'Idle', description: 'Breathing Loop', promptLogic: 'Action: BREATHING LOOP (Sine Wave). Frame 1: Neutral. Frame 2: Inhale Start. Frame 3: Inhale Mid. Frame 4: MAX INHALE. Frame 5: Exhale Start. Frame 6: Exhale End.', poseId: 'IDLE_BREATHE' },
  { id: 'WALK_CYCLE', label: 'Walk', description: 'Side Scroll', promptLogic: 'Action: WALK CYCLE (Side View). Frame 1: Contact. Frame 2: Recoil. Frame 3: Passing. Frame 4: High Point. Frame 5: Contact. Frame 6: Recovery.', poseId: 'WALK_CYCLE' },
  { id: 'RUN_CYCLE', label: 'Run', description: 'Fast Sprint', promptLogic: 'Action: RUN CYCLE. Forward lean 45°. Arms pumping. Legs full extension. Dynamic motion lines.', poseId: 'RUN_SIDE' },
  { id: 'JUMP_FULL', label: 'Jump', description: 'Launch/Land', promptLogic: 'Action: JUMP ARC. Frame 1: Squash. Frame 2: Launch. Frame 3: Rise. Frame 4: Apex. Frame 5: Fall. Frame 6: Land.', poseId: 'JUMP_FULL' },
  { id: 'ATTACK_MELEE', label: 'Attack', description: 'Combo Hit', promptLogic: 'Action: MELEE ATTACK. Frame 1: Windup. Frame 2: Step. Frame 3: IMPACT. Frame 4: Follow-thru. Frame 5: Retract. Frame 6: Idle.', poseId: 'ATTACK_MELEE' },
  { id: 'GUARD_BLOCK', label: 'Guard', description: 'Defense', promptLogic: 'Action: GUARD. Frame 1-6: Steady defensive stance. Knees bent. Arms shielding face. Minimal movement.' },
  { id: 'HIT_REACTION', label: 'Hit', description: 'Damage', promptLogic: 'Action: TAKE DAMAGE. Frame 1: Impact. Frame 2: Crunch. Frame 3: Stumble. Frame 4: Slide. Frame 5: Recover. Frame 6: Idle.' },
  { id: 'DASH_SLIDE', label: 'Dash', description: 'Evasion', promptLogic: 'Action: DASH. Low profile slide. Speed lines. Horizontal stretch. One leg lead.' },
  { id: 'CLIMB_LADDER', label: 'Climb', description: 'Vertical', promptLogic: 'Action: LADDER CLIMB. Back view. Frame 1: R-Hand Up. Frame 2: R-Leg Up. Frame 3: Pull. Frame 4: L-Hand Up. Frame 5: L-Leg Up. Frame 6: Pull.' },
  { id: 'CAST_SPELL', label: 'Magic', description: 'Channeling', promptLogic: 'Action: MAGIC CAST. Frame 1: Gather. Frame 2: Charge. Frame 3: RELEASE. Frame 4: Projectile. Frame 5: Recoil. Frame 6: Cool.' },
  { id: 'VICTORY_POSE', label: 'Win', description: 'Celebration', promptLogic: 'Action: VICTORY. Frame 1: Shock. Frame 2: Fist Pump. Frame 3: Jump. Frame 4: Pose High. Frame 5: Hold. Frame 6: Land.' },
  { id: 'DEATH', label: 'Die', description: 'Game Over', promptLogic: 'Action: DEATH. Frame 1: Shock. Frame 2: Buckle. Frame 3: Fall Back. Frame 4: Impact. Frame 5: Bounce. Frame 6: Flat.' },
];

const STYLE_OPTIONS: {id: SpriteStyle, label: string}[] = [
  { id: 'NEO_RETRO', label: 'NEO' },
  { id: 'PIXEL_ART', label: 'PIXEL' },
  { id: 'FLAT_VECTOR', label: 'VECTOR' },
  { id: 'SKETCH', label: 'INK' },
];

// Enhanced negative prompt for anatomy AND identity hallucinations
const DEFAULT_NEGATIVE = "hair, wig, face, eyes, nose, mouth, lips, eyebrows, facial features, makeup, beard, mustache, different clothes, armor, shoes, boots, OVERLAPPING SPRITES, touching sprites, fused bodies, multiple people, background objects, cropped limbs, bad hands, missing fingers, extra fingers, fused fingers, blurry, messy lines, text, watermark, colored background, noise, artifacts.";

const SpriteEditor: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameData[]>([]);
  
  const [selectedAction, setSelectedAction] = useState<ActionPreset>(ACTION_PRESETS[0]);
  const [selectedStyle, setSelectedStyle] = useState<SpriteStyle>('NEO_RETRO');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<'SHEET' | 'PLAYER' | 'INSPECTOR'>('SHEET');
  
  const [customPositive, setCustomPositive] = useState("");
  const [customNegative, setCustomNegative] = useState(DEFAULT_NEGATIVE);
  const [thinkingInput, setThinkingInput] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(8);
  const [showGrid, setShowGrid] = useState(false);
  const [showHitbox, setShowHitbox] = useState(false);
  const [inspectorBg, setInspectorBg] = useState<'CHECKER' | 'BLACK' | 'WHITE'>('CHECKER');

  // Debug/Test State
  const [lastPrompt, setLastPrompt] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationIntervalRef = useRef<number | null>(null);

  // --- LOGIC ---

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedImage(null);
    setFrames([]);
    setStatus(AppStatus.IDLE);
    setError(null);
    setLastPrompt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setGeneratedImage(null);
      setFrames([]);
      setViewMode('SHEET');
    }
  }, []);

  const sliceSpriteSheet = useCallback(async (imageUrl: string) => {
    setStatus(AppStatus.SLICING);
    try {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        
        await new Promise((resolve, reject) => { 
            img.onload = resolve; 
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // Use Math.floor to ensure integer pixel values for clean cuts
        const frameWidth = Math.floor(img.width / 6); 
        const frameHeight = img.height;
        
        canvas.width = frameWidth;
        canvas.height = frameHeight;

        const newFrames: FrameData[] = [];
        for (let i = 0; i < 6; i++) {
        ctx.clearRect(0, 0, frameWidth, frameHeight);
        // Explicitly pull from the calculated x position
        const sourceX = i * frameWidth;
        ctx.drawImage(img, sourceX, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
        newFrames.push({ id: i, dataUrl: canvas.toDataURL('image/png') });
        }

        setFrames(newFrames);
        setStatus(AppStatus.SUCCESS);
        setViewMode('PLAYER');
        setIsPlaying(true);
    } catch (err) {
        console.error("Slicing error", err);
        setError("Failed to slice sprite sheet. Try reloading.");
        setStatus(AppStatus.ERROR);
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedFile) return;
    setStatus(AppStatus.GENERATING);
    setError(null);
    setFrames([]);

    try {
      const base64Data = await fileToGenerativePart(selectedFile);
      
      // Check for Pose Guide
      const poseBase64 = selectedAction.poseId ? POSE_TEMPLATES[selectedAction.poseId] : undefined;

      // Store prompt for debugging purposes (simulated since logic is in service)
      setLastPrompt(`Action: ${selectedAction.promptLogic}\nStyle: ${selectedStyle}\nPoseGuide: ${selectedAction.poseId || 'None'}\nRefined: ${customPositive}`);

      const resultUrl = await generateSpriteSheet(
        base64Data, 
        selectedFile.type, 
        selectedAction.promptLogic,
        selectedStyle,
        customPositive,
        customNegative,
        poseBase64
      );
      setGeneratedImage(resultUrl);
      await sliceSpriteSheet(resultUrl);
    } catch (e: any) {
      setError(e.message || "Failed to generate sprite sheet");
      setStatus(AppStatus.ERROR);
    }
  };

  const generateMockData = async () => {
    // Generate a dummy sprite sheet for testing
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if(ctx) {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0,0,600,100);
        for(let i=0; i<6; i++) {
            const h = 50 + Math.sin(i)*20;
            ctx.fillStyle = `hsl(${i * 60}, 70%, 50%)`;
            ctx.fillRect(i*100 + 25, 100-h, 50, h);
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.fillText(`FRAME ${i+1}`, i*100 + 20, 20);
        }
    }
    const mockUrl = canvas.toDataURL();
    setGeneratedImage(mockUrl);
    setLastPrompt("[DEBUG MODE] Generated Mock Data for Testing");
    await sliceSpriteSheet(mockUrl);
  };

  const handleSmartRefine = async () => {
    if (!thinkingInput.trim()) return;
    setStatus(AppStatus.THINKING);
    try {
      const refined = await refinePromptWithReasoning(thinkingInput);
      setCustomPositive(refined);
      setShowAdvanced(true);
      setStatus(AppStatus.IDLE);
    } catch (e: any) {
      setError("AI refinement failed.");
      setStatus(AppStatus.ERROR);
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      animationIntervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
      }, 1000 / fps); // Use number type
    } else {
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    }
    return () => { if (animationIntervalRef.current) clearInterval(animationIntervalRef.current); };
  }, [isPlaying, frames.length, fps]);

  const getIconForAction = (id: string) => {
    if (id.includes('IDLE')) return <Settings2 size={12} />;
    if (id.includes('WALK')) return <PlayCircle size={12} />;
    if (id.includes('RUN')) return <Move size={12} />;
    if (id.includes('JUMP')) return <ArrowUpCircle size={12} />;
    if (id.includes('ATTACK')) return <Swords size={12} />;
    if (id.includes('GUARD')) return <Shield size={12} />;
    if (id.includes('HIT')) return <AlertTriangle size={12} />;
    if (id.includes('DASH')) return <Crosshair size={12} />;
    if (id.includes('VICTORY')) return <Trophy size={12} />;
    if (id.includes('DEATH')) return <Ghost size={12} />;
    return <PlayCircle size={12} />;
  };

  return (
    <div className="flex w-full h-full">
      
      {/* --- LEFT PANEL: CONTROL DECK --- */}
      <div className="w-[380px] border-r border-white/10 bg-[#0a0a0a] flex flex-col shrink-0 z-20 shadow-2xl">
        
        {/* Panel Header */}
        <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#0F0F0F]">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Settings2 size={10} /> Control Deck
           </span>
           <div className="flex items-center gap-2">
            {selectedFile && (
                <button onClick={handleReset} className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 size={10} /> RESET
                </button>
            )}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {/* 1. Reference Asset */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Input Source</label>
              {previewUrl && <span className="text-[9px] text-green-500 flex items-center gap-1 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30"><Check size={8} /> LINKED</span>}
            </div>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative h-28 w-full rounded border border-dashed transition-all cursor-pointer overflow-hidden group flex items-center justify-center
                ${previewUrl 
                  ? 'border-indigo-500/30 bg-[#0F0F0F]' 
                  : 'border-white/10 hover:border-white/20 hover:bg-white/5 bg-[#0F0F0F]'}
              `}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              {previewUrl ? (
                <div className="flex items-center gap-3 px-3 w-full">
                  <img src={previewUrl} alt="Ref" className="h-20 w-16 object-contain bg-black/50 rounded border border-white/10 p-1" />
                  <div className="flex-1 min-w-0">
                     <p className="text-[11px] font-medium text-white truncate">{selectedFile?.name}</p>
                     <p className="text-[9px] text-slate-500">{(selectedFile?.size || 0) / 1024 > 1024 ? `${((selectedFile?.size || 0) / 1024 / 1024).toFixed(1)} MB` : `${((selectedFile?.size || 0) / 1024).toFixed(0)} KB`}</p>
                     <div className="mt-1.5 flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                       <span className="text-[9px] text-indigo-400 uppercase">Ready</span>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload size={16} className="mx-auto text-slate-500 mb-2 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-[10px] text-slate-500 font-medium">DROP CHARACTER</span>
                </div>
              )}
            </div>
          </section>

          {/* 2. Style Selector */}
          <section>
             <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Render Style</label>
             <div className="grid grid-cols-4 gap-1 p-1 bg-[#151515] rounded border border-white/5">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`
                      py-1.5 text-[9px] font-bold rounded transition-all
                      ${selectedStyle === style.id 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
                    `}
                  >
                    {style.label}
                  </button>
                ))}
             </div>
          </section>

          {/* 3. Action Grid */}
          <section>
             <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Action Library</label>
                <span className="text-[9px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">{ACTION_PRESETS.length} CLIPS</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {ACTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedAction(preset)}
                    className={`
                      text-left px-3 py-2 rounded border transition-all relative overflow-hidden group
                      ${selectedAction.id === preset.id 
                        ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-100' 
                        : 'bg-[#151515] border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                       <span className="text-[10px] font-bold flex items-center gap-1.5">
                         {getIconForAction(preset.id)}
                         {preset.label}
                       </span>
                       {selectedAction.id === preset.id && <div className="w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_5px_rgba(99,102,241,1)]"></div>}
                    </div>
                    <div className="text-[9px] opacity-50 truncate">{preset.description}</div>
                  </button>
                ))}
             </div>
          </section>

          {/* 4. Advanced & Reasoner */}
          <section className="pt-2 border-t border-white/5">
            <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-[10px] text-slate-500 hover:text-white transition-colors py-1"
              >
                <span className="flex items-center gap-1"><Cpu size={10} /> REASONING & DEBUG</span>
                <ChevronRight size={10} className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
            </button>
            
            {showAdvanced && (
               <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1">
                  {/* Debug Tools */}
                  <div className="flex items-center gap-2 mb-2">
                     <button 
                        onClick={generateMockData} 
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] py-1.5 rounded flex items-center justify-center gap-1 border border-white/5"
                     >
                        <TestTube size={10} /> LOAD DEBUG DATA
                     </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={thinkingInput}
                      onChange={(e) => setThinkingInput(e.target.value)}
                      placeholder="AI Prompt Engineer..."
                      className="w-full bg-[#151515] border border-white/10 text-[10px] text-white p-2 pr-8 rounded focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                    />
                    <button 
                       onClick={handleSmartRefine}
                       className="absolute right-1 top-1 p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                       disabled={status === AppStatus.THINKING}
                    >
                       <Sparkles size={10} />
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-[9px] text-slate-600 uppercase mb-1 block">Custom Instructions (Positive)</label>
                    <textarea 
                      value={customPositive}
                      onChange={(e) => setCustomPositive(e.target.value)}
                      className="w-full h-12 bg-[#151515] border border-white/10 rounded p-2 text-[9px] text-slate-400 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div>
                     <label className="text-[9px] text-slate-600 uppercase mb-1 block">Negative Constraints</label>
                     <textarea 
                        value={customNegative}
                        onChange={(e) => setCustomNegative(e.target.value)}
                        className="w-full h-12 bg-[#151515] border border-white/10 rounded p-2 text-[9px] text-red-900/50 font-mono focus:outline-none focus:border-red-500/50 resize-none"
                     />
                  </div>
                  
                  {lastPrompt && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                       <label className="text-[9px] text-slate-500 uppercase flex items-center gap-1 mb-1"><Terminal size={8}/> Last Generated Configuration</label>
                       <pre className="text-[8px] text-slate-500 font-mono bg-black/50 p-2 rounded overflow-x-auto">
                         {lastPrompt}
                       </pre>
                    </div>
                  )}
               </div>
            )}
          </section>

        </div>

        {/* Generate Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0F0F0F]">
           <button 
              onClick={handleGenerate}
              disabled={!selectedFile || status === AppStatus.GENERATING || status === AppStatus.THINKING || status === AppStatus.SLICING}
              className={`
                w-full h-10 rounded font-bold text-[11px] tracking-widest uppercase transition-all
                flex items-center justify-center gap-2 relative overflow-hidden
                ${!selectedFile 
                  ? 'bg-[#1a1a1a] text-slate-600 cursor-not-allowed border border-white/5' 
                  : status === AppStatus.GENERATING || status === AppStatus.SLICING
                    ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/30'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border border-transparent shadow-lg shadow-indigo-500/20'}
              `}
            >
              {status === AppStatus.GENERATING ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> PROCESSING
                </>
              ) : status === AppStatus.SLICING ? (
                 <>
                  <Scissors size={12} className="animate-bounce" /> SLICING
                </>
              ) : (
                <>
                  <Sparkles size={12} /> GENERATE SPRITE
                </>
              )}
            </button>
            {error && <p className="text-red-400 text-[9px] mt-2 text-center bg-red-900/10 py-1 rounded border border-red-900/20">{error}</p>}
        </div>
      </div>

      {/* --- RIGHT PANEL: INFINITE CANVAS --- */}
      <div className="flex-1 bg-[#050505] relative flex flex-col">
        
        {/* Canvas Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/90 backdrop-blur border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl z-40">
           <button 
              onClick={() => setViewMode('PLAYER')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'PLAYER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
           >
             <PlayCircle size={12} /> PLAY
           </button>
           <button 
              onClick={() => setViewMode('SHEET')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'SHEET' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
           >
             <LayoutGrid size={12} /> SHEET
           </button>
           <button 
              onClick={() => setViewMode('INSPECTOR')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'INSPECTOR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
           >
             <Maximize2 size={12} /> INSPECT
           </button>
           
           <div className="w-px h-4 bg-white/10 mx-1"></div>
           
           <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-full hover:bg-white/10 ${showGrid ? 'text-indigo-400' : 'text-slate-500'}`} title="Show Grid">
              <Grid3X3 size={12} />
           </button>
           <button onClick={() => setShowHitbox(!showHitbox)} className={`p-2 rounded-full hover:bg-white/10 ${showHitbox ? 'text-green-400' : 'text-slate-500'}`} title="Show Hitbox">
              <Square size={12} />
           </button>
           
           {viewMode === 'INSPECTOR' && (
             <>
               <div className="w-px h-4 bg-white/10 mx-1"></div>
               <button onClick={() => setInspectorBg('CHECKER')} className={`p-2 rounded-full ${inspectorBg === 'CHECKER' ? 'text-white' : 'text-slate-500'}`} title="Checker"><LayoutGrid size={12} /></button>
               <button onClick={() => setInspectorBg('BLACK')} className={`p-2 rounded-full ${inspectorBg === 'BLACK' ? 'text-white' : 'text-slate-500'}`} title="Black"><EyeOff size={12} /></button>
               <button onClick={() => setInspectorBg('WHITE')} className={`p-2 rounded-full ${inspectorBg === 'WHITE' ? 'text-white' : 'text-slate-500'}`} title="White"><Eye size={12} /></button>
             </>
           )}
        </div>

        {/* Viewport Area */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            
            {/* Dot Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                 style={{
                    backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                 }}>
            </div>

            {/* Content Container */}
            <div className={`relative transition-all duration-500 ${generatedImage ? 'opacity-100 scale-100' : 'opacity-100 scale-100'}`}>
              
              {generatedImage ? (
                <>
                  {viewMode === 'SHEET' && (
                    <div className="relative group">
                       <img 
                          src={generatedImage} 
                          className="max-w-[90vw] max-h-[70vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 bg-[#1a1a1a]" 
                       />
                       {showGrid && (
                         <div className="absolute inset-0 grid grid-cols-6 border border-red-500/30 pointer-events-none">
                           {[...Array(6)].map((_, i) => (
                             <div key={i} className="border-r border-red-500/30 h-full flex justify-center pt-2">
                               <span className="text-[9px] font-mono text-red-500 bg-black/50 px-1 rounded h-fit">{i+1}</span>
                             </div>
                           ))}
                         </div>
                       )}
                       <button 
                          onClick={() => downloadImage(generatedImage, `ORION_SHEET_${selectedAction.id}.png`)}
                          className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-[10px] font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
                        >
                          <Download size={12} /> EXPORT PNG
                       </button>
                    </div>
                  )}

                  {viewMode === 'PLAYER' && (
                    frames.length > 0 ? (
                        <div className="flex flex-col items-center gap-8">
                        <div className="relative bg-[#1a1a1a] border border-white/10 rounded-lg shadow-[0_0_100px_rgba(99,102,241,0.1)] p-12">
                            <img 
                                src={frames[currentFrameIndex].dataUrl} 
                                className="h-64 w-auto object-contain pixelated drop-shadow-2xl"
                                style={{imageRendering: 'pixelated'}}
                            />
                            {showHitbox && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-48 border-2 border-green-500/50 rounded animate-pulse"></div>}
                        </div>
                        
                        {/* Playback Controls */}
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-full px-6 py-2 flex items-center gap-6 shadow-xl">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-indigo-400 hover:scale-110 transition-all">
                                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                            </button>
                            <div className="h-8 w-px bg-white/10"></div>
                            <div className="flex flex-col gap-1 w-32">
                                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                <span>SPEED</span>
                                <span>{fps} FPS</span>
                                </div>
                                <input 
                                    type="range" min="1" max="24" value={fps} onChange={(e) => setFps(parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                        </div>
                        </div>
                    ) : (
                        <div className="text-center opacity-50">
                            <p className="text-xs text-slate-400 mb-2">SPRITE SHEET GENERATED</p>
                            <p className="text-[10px] text-red-400">SLICING DATA MISSING</p>
                            <button onClick={() => sliceSpriteSheet(generatedImage)} className="mt-4 px-4 py-2 bg-indigo-600 rounded text-xs text-white">RETRY SLICING</button>
                        </div>
                    )
                  )}

                  {viewMode === 'INSPECTOR' && (
                    frames.length > 0 ? (
                        <div className="grid grid-cols-6 gap-4 p-8 max-w-[90vw]">
                            {frames.map((frame, idx) => (
                            <div key={idx} className="bg-[#1a1a1a] border border-white/5 rounded p-2 hover:border-indigo-500/50 transition-colors group relative">
                                <div className={`aspect-[2/3] flex items-center justify-center rounded mb-2 ${inspectorBg === 'CHECKER' ? 'bg-[url(https://grainy-gradients.vercel.app/noise.svg)] bg-white/10' : inspectorBg === 'WHITE' ? 'bg-white' : 'bg-black'}`}>
                                    <img src={frame.dataUrl} className="h-full object-contain pixelated" style={{imageRendering: 'pixelated'}} />
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-mono text-slate-500">#{idx+1}</span>
                                    <button onClick={() => downloadImage(frame.dataUrl, `FRAME_${idx+1}.png`)} className="text-slate-600 hover:text-white"><Download size={10} /></button>
                                </div>
                            </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center opacity-50">
                            <p className="text-xs text-slate-400">NO FRAMES FOUND</p>
                        </div>
                    )
                  )}
                </>
              ) : (
                <div className="text-center opacity-30 select-none pointer-events-none">
                   <Monitor size={64} className="mx-auto mb-4 text-slate-600" />
                   <h2 className="text-2xl font-bold text-slate-700 tracking-tight">NO SIGNAL</h2>
                   <p className="text-xs font-mono text-slate-700 mt-2">WAITING FOR INPUT STREAM...</p>
                </div>
              )}
            </div>

            {/* Floating Info */}
            {generatedImage && (
               <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur border border-white/10 px-3 py-1.5 rounded text-[9px] font-mono text-slate-400 flex flex-col gap-0.5">
                  <span>RES: 1920x1080 (RAW)</span>
                  <span>ASPECT: 16:9</span>
                  <span className="text-indigo-400">STATUS: {frames.length > 0 ? 'READY' : 'PENDING_SLICE'}</span>
               </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default SpriteEditor;