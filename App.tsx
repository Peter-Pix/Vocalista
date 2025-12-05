import React, { useState, useEffect, useRef } from 'react';
import { Mic, BarChart2, Music, Zap, Play, Square, Save, RotateCcw, Activity, Trash2, Clock, CheckCircle2, Infinity, Settings, Volume2, VolumeX, MessageSquare, HelpCircle, ArrowLeft, ChevronRight, X, Info, Gamepad2, Shuffle, HandMetal, ListMusic, Sliders, Palette, ExternalLink, Gauge, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import { EXERCISES, COLOR_PALETTE, GAME_NOTES, SCALES } from './constants';
import { UserMode, Exercise, AudioAnalysis, SessionResult, AppTheme, MicSensitivity } from './types';
import Visualizer from './components/Visualizer';
import { generateSessionFeedback, generateAudioExample, generateMotivationalFeedback } from './services/geminiService';
import { audioPlayer, OscillatorType } from './services/audioPlayer';
import { convertRawPCMToAudioBuffer } from './services/audioUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// --- THEME ENGINE ---

const THEME = {
  default: {
    layout: "bg-black text-zinc-100 font-sans selection:bg-violet-500/30",
    card: "bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-xl",
    button: {
      base: "rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-95 touch-none select-none",
      primary: "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/30 disabled:bg-zinc-800 disabled:text-zinc-500",
      secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50 backdrop-blur-sm",
      danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-900/30",
      ghost: "text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-800/50"
    },
    accentText: {
      primary: "text-violet-400",
      secondary: "text-emerald-400",
      tertiary: "text-sky-400"
    },
    modal: "bg-zinc-900 border border-zinc-800 rounded-3xl",
    input: "bg-zinc-600 rounded-lg"
  },
  brutalist: {
    layout: "bg-[#FFD700] text-black font-sans selection:bg-black selection:text-white", // Yellow 4RAP background
    card: "bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none",
    button: {
      base: "rounded-none font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none touch-none select-none border-2 border-black",
      primary: "bg-[#FF00FF] hover:bg-[#d900d9] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:bg-gray-400 disabled:shadow-none",
      secondary: "bg-white hover:bg-gray-100 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
      danger: "bg-red-600 hover:bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
      ghost: "text-black hover:bg-black/10 bg-transparent border-transparent shadow-none"
    },
    accentText: {
      primary: "text-black",
      secondary: "text-black",
      tertiary: "text-black"
    },
    modal: "bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-none",
    input: "bg-black rounded-none border border-black"
  }
};

// --- Helper Components ---

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, size = 'md', theme = 'default', title }: any) => {
  const t = THEME[theme as AppTheme].button;
  const baseClass = t.base;
  
  const sizes: any = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-3 text-sm md:text-base",
    lg: "px-8 py-4 text-base md:text-lg",
    icon: "p-3"
  };

  const variantClass = t[variant as keyof typeof t];
  
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${baseClass} ${sizes[size] || sizes.md} ${variantClass} ${className} ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '', theme = 'default' }: any) => {
  const t = THEME[theme as AppTheme].card;
  return (
    <div className={`${t} p-5 ${className}`}>
      {children}
    </div>
  );
};

// --- Statistics Helpers ---

const calculateStandardDeviation = (array: number[]) => {
  if (array.length === 0) return 0;
  const n = array.length;
  const mean = array.reduce((a, b) => a + b) / n;
  const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return Math.sqrt(variance);
};

// --- Short Summary Helper ---
const getShortSummary = (score: number) => {
  if (score >= 90) return "Profesionální výkon 🌟";
  if (score >= 75) return "Velmi dobrá práce ✅";
  if (score >= 50) return "Průměrný výkon ⚠️";
  return "Začátečnický pokus 📉";
};

// --- Constants Map for UI ---
const SCALE_LABELS: Record<string, string> = {
  'CHROMATIC': 'Chromatická',
  'C_MAJOR': 'C Dur',
  'G_MAJOR': 'G Dur',
  'A_MINOR': 'A Moll',
  'F_MAJOR': 'F Dur',
};

// --- Main App ---

export default function App() {
  // Navigation State
  const [view, setView] = useState<'home' | 'list' | 'session' | 'stats'>('home');
  const [mode, setMode] = useState<UserMode>(UserMode.SINGER);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutTab, setAboutTab] = useState<'about' | 'guide'>('about');
  
  // Theme State
  const [appTheme, setAppTheme] = useState<AppTheme>('default');

  // Session State
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [infiniteMode, setInfiniteMode] = useState(false);
  const [analysisData, setAnalysisData] = useState<AudioAnalysis | null>(null);
  
  // Settings & Feedback State
  const [autoFeedbackInterval, setAutoFeedbackInterval] = useState<number>(15); // Minutes
  const [accumulatedTime, setAccumulatedTime] = useState<number>(0); // Minutes
  const [sessionCounter, setSessionCounter] = useState(0);

  // Pitch Smoothing Buffer
  const pitchBufferRef = useRef<number[]>([]);
  const SMOOTHING_WINDOW = 5; 

  // Game Mode State
  const [gameMode, setGameMode] = useState<'random' | 'manual'>('random');
  const [selectedScale, setSelectedScale] = useState<string>('CHROMATIC');
  const [gameTarget, setGameTarget] = useState<number | null>(null);
  const [gameScore, setGameScore] = useState(0);
  const hitAccumulatorRef = useRef(0); 
  
  // Audio Settings
  const [volume, setVolume] = useState(0.5);
  const [micEq, setMicEq] = useState({ low: 0, high: 0 }); 
  const [micSensitivity, setMicSensitivity] = useState<MicSensitivity>('medium');
  const [waveType, setWaveType] = useState<OscillatorType>('sine');
  const [showSettings, setShowSettings] = useState(false);
  
  // Example Audio State
  const [isPlayingExample, setIsPlayingExample] = useState(false);
  const [exampleLoading, setExampleLoading] = useState(false);

  // Data Collection
  const [sessionStats, setSessionStats] = useState<{
    pitches: number[]; 
    deviations: number[]; 
    volumes: number[];
  }>({ pitches: [], deviations: [], volumes: [] });
  
  const [singingTimeMs, setSingingTimeMs] = useState(0);

  const [finalResult, setFinalResult] = useState<SessionResult | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [history, setHistory] = useState<SessionResult[]>([]);
  
  // Freestyle Note History State
  const [noteHistory, setNoteHistory] = useState<{note: string, cents: number}[]>([]);
  const lastNoteRef = useRef<string>('');
  const lastNoteTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Scale Exercise State
  const [scaleProgress, setScaleProgress] = useState(0);

  // Rhythm/Metronome State
  const [beatActive, setBeatActive] = useState(false); 
  const nextNoteTimeRef = useRef(0);
  const beatCountRef = useRef(0);
  const metronomeTimerRef = useRef<number | null>(null);

  // Timer Ref
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('vokalista_history');
    if (saved) setHistory(JSON.parse(saved));
    const savedTheme = localStorage.getItem('vokalista_theme');
    if (savedTheme) setAppTheme(savedTheme as AppTheme);
    const savedInterval = localStorage.getItem('vokalista_feedback_interval');
    if (savedInterval !== null) setAutoFeedbackInterval(parseInt(savedInterval));
    const savedAccumulated = localStorage.getItem('vokalista_accumulated_time');
    if (savedAccumulated) setAccumulatedTime(parseFloat(savedAccumulated));
    const savedSessionCount = localStorage.getItem('vokalista_session_count');
    if (savedSessionCount) setSessionCounter(parseInt(savedSessionCount));
    
    // Load Audio Settings
    const savedEq = localStorage.getItem('vokalista_mic_eq');
    if (savedEq) setMicEq(JSON.parse(savedEq));
    const savedSens = localStorage.getItem('vokalista_mic_sensitivity');
    if (savedSens) setMicSensitivity(savedSens as MicSensitivity);
  }, []);
  
  // Persist Audio Settings
  useEffect(() => {
      localStorage.setItem('vokalista_mic_eq', JSON.stringify(micEq));
  }, [micEq]);

  useEffect(() => {
      localStorage.setItem('vokalista_mic_sensitivity', micSensitivity);
  }, [micSensitivity]);

  useEffect(() => {
    audioPlayer.setVolume(volume);
    audioPlayer.setWaveType(waveType);
  }, [volume, waveType]);

  useEffect(() => {
    if (isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && selectedExercise?.bpm && selectedExercise.bpm > 0) {
      const ctx = audioPlayer.getContext();
      if (!ctx) return;
      audioPlayer.resume();

      const lookahead = 25.0; 
      const scheduleAheadTime = 0.1; 
      const secondsPerBeat = 60.0 / selectedExercise.bpm;

      beatCountRef.current = 0;
      nextNoteTimeRef.current = ctx.currentTime + 0.1;

      const scheduler = () => {
        while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
          scheduleNote(nextNoteTimeRef.current);
          nextNote();
        }
      };

      const scheduleNote = (time: number) => {
        const beat = beatCountRef.current;
        const isDownbeat = beat % 4 === 0; 

        audioPlayer.playMetronomeClick(time, isDownbeat);

        const delay = (time - ctx.currentTime) * 1000;
        setTimeout(() => {
           setBeatActive(true);
           setTimeout(() => setBeatActive(false), 150);
        }, Math.max(0, delay));
      }

      const nextNote = () => {
        const secondsPerBeat = 60.0 / (selectedExercise?.bpm || 120);
        nextNoteTimeRef.current += secondsPerBeat;
        beatCountRef.current++;
      }

      metronomeTimerRef.current = window.setInterval(scheduler, lookahead);
    } else {
      if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current);
    }

    return () => { if (metronomeTimerRef.current) clearInterval(metronomeTimerRef.current); }
  }, [isRecording, selectedExercise?.bpm]);


  const handleStart = async () => {
    setElapsedTime(0);
    setSingingTimeMs(0);
    setSessionStats({ pitches: [], deviations: [], volumes: [] });
    setNoteHistory([]);
    setScaleProgress(0);
    setGameScore(0);
    hitAccumulatorRef.current = 0;
    lastNoteRef.current = '';
    pitchBufferRef.current = [];
    
    if (selectedExercise?.id === 's_scale_maj' && selectedExercise.targetNotes) {
        setGameTarget(selectedExercise.targetNotes[0].frequency);
    } 
    else if (selectedExercise?.id === 's_pitch_game' && gameMode === 'random') {
        pickRandomGameNote();
    } 
    else if (selectedExercise?.id === 's_pitch_game' && gameMode === 'manual') {
        setGameTarget(null); 
    }
    else {
        setGameTarget(null);
    }

    setIsRecording(true);
  };

  const pickRandomGameNote = () => {
      const r = GAME_NOTES[Math.floor(Math.random() * GAME_NOTES.length)];
      setGameTarget(r.frequency);
      audioPlayer.playTone(r.frequency, 0.5);
  };

  const handleStop = async () => {
    setIsRecording(false);
    
    const finalTime = elapsedTime; 
    const participationScore = finalTime > 0 ? (singingTimeMs / 1000 / finalTime) * 100 : 0;
    
    let finalScore = 0;
    let avgPitchDev = 0;
    let rhythmCons = 0;
    
    if (sessionStats.pitches.length > 0) {
        avgPitchDev = Math.round(sessionStats.deviations.reduce((a, b) => a + b, 0) / sessionStats.deviations.length);
    }
    
    const volStdDev = calculateStandardDeviation(sessionStats.volumes);
    const stabilityScore = Math.max(0, 100 - (volStdDev * 300));

    const avgVol = sessionStats.volumes.length > 0 
        ? sessionStats.volumes.reduce((a,b)=>a+b,0) / sessionStats.volumes.length 
        : 0;
    const energyScore = Math.min(100, avgVol * 200); 

    switch (mode) {
        case UserMode.SINGER:
            const pitchScore = Math.max(0, 100 - (Math.abs(avgPitchDev) * 2));
            finalScore = (pitchScore * 0.7) + (stabilityScore * 0.3);
            rhythmCons = stabilityScore;
            break;
            
        case UserMode.RAPPER:
            const participationFactor = Math.min(100, participationScore * 1.2); 
            finalScore = (participationFactor * 0.6) + (energyScore * 0.4);
            rhythmCons = stabilityScore; 
            break;
            
        case UserMode.SPEAKER:
            let pacingScore = participationScore;
            if (participationScore > 90) pacingScore = 70; 
            
            finalScore = (pacingScore * 0.5) + (energyScore * 0.5);
            rhythmCons = stabilityScore;
            break;
    }

    if (participationScore < 15) {
        finalScore = 0;
    }

    const result: SessionResult = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      exerciseId: selectedExercise!.id,
      mode: mode,
      score: Math.round(finalScore),
      feedbackText: '',
      stats: {
        avgPitchDeviation: avgPitchDev,
        rhythmConsistency: rhythmCons,
        participationPct: participationScore,
        singingDurationSeconds: singingTimeMs / 1000
      }
    };

    setFinalResult(result);
    setLoadingFeedback(true);
    setView('session'); 

    // --- LOGIC FOR AUTOMATIC FEEDBACK ---
    const MIN_SESSION_DURATION = 10; // Seconds
    let feedback = "";
    
    const activeSingingMinutes = (singingTimeMs / 1000) / 60;
    const newAccumulatedTime = accumulatedTime + activeSingingMinutes;
    
    if (elapsedTime < MIN_SESSION_DURATION) {
        // CASE 1: Session too short (Mic check)
        feedback = "Krátká nahrávka (Mic Check) - bez hodnocení.";
        setLoadingFeedback(false);
        setFinalResult({ ...result, feedbackText: feedback });
    } 
    else {
        // Check if we should trigger AI based on interval
        const shouldTriggerAI = autoFeedbackInterval > 0 && newAccumulatedTime >= autoFeedbackInterval;
        
        if (shouldTriggerAI) {
            // CASE 2: Automatic Trigger Reached
            feedback = await generateSessionFeedback(
              mode, 
              selectedExercise!.id,
              selectedExercise!.title,
              selectedExercise!.description,
              result.stats
            );
            setAccumulatedTime(0); // Reset timer
            localStorage.setItem('vokalista_accumulated_time', '0');
        } else {
             // CASE 3: Not yet time for AI, or AI disabled
             setAccumulatedTime(newAccumulatedTime);
             localStorage.setItem('vokalista_accumulated_time', newAccumulatedTime.toString());
             
             // Check intermittent positive reinforcement (modulo 5) if not regular interval
             // But only if interval is not set to '0' (Disabled completely)
             if (autoFeedbackInterval > 0) {
                 feedback = "Cvičení uloženo. AI analýza se vygeneruje po " + autoFeedbackInterval + " minutách zpěvu.";
             } else {
                 // Completely disabled
                 const newCount = sessionCounter + 1;
                 setSessionCounter(newCount);
                 localStorage.setItem('vokalista_session_count', newCount.toString());
                 
                 if (newCount % 5 === 0) {
                      setLoadingFeedback(true);
                      feedback = await generateMotivationalFeedback(mode);
                 } else {
                      feedback = "Cvičení uloženo.";
                 }
             }
        }
        
        setLoadingFeedback(false);
        setFinalResult(prev => prev ? { ...prev, feedbackText: feedback } : null);
    }

    const savedResult = { ...result, feedbackText: feedback };
    const newHistory = [savedResult, ...history];
    setHistory(newHistory);
    localStorage.setItem('vokalista_history', JSON.stringify(newHistory));
  };
  
  const handleManualFeedback = async () => {
      if (!finalResult || !selectedExercise) return;
      setLoadingFeedback(true);
      
      const feedback = await generateSessionFeedback(
          mode,
          selectedExercise.id,
          selectedExercise.title,
          selectedExercise.description,
          finalResult.stats
      );
      
      const updatedResult = { ...finalResult, feedbackText: feedback };
      setFinalResult(updatedResult);
      setLoadingFeedback(false);
      
      // Update history
      const newHistory = history.map(h => h.id === updatedResult.id ? updatedResult : h);
      setHistory(newHistory);
      localStorage.setItem('vokalista_history', JSON.stringify(newHistory));
      
      // Reset accumulator since user got feedback manually
      setAccumulatedTime(0);
      localStorage.setItem('vokalista_accumulated_time', '0');
  };

  const handleClearHistory = () => {
    if (confirm('Opravdu smazat historii?')) {
        setHistory([]); 
        localStorage.removeItem('vokalista_history');
    }
  };

  const handleAnalysisUpdate = (data: AudioAnalysis) => {
    let smoothedPitch = data.pitch;
    
    if (data.pitch !== 0) {
        pitchBufferRef.current.push(data.pitch);
        if (pitchBufferRef.current.length > SMOOTHING_WINDOW) {
            pitchBufferRef.current.shift();
        }
        
        const sorted = [...pitchBufferRef.current].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        smoothedPitch = sorted[mid];
    } else {
        pitchBufferRef.current = [];
    }
    
    const smoothedData = { ...data, pitch: smoothedPitch };
    
    setAnalysisData(smoothedData);
    
    if (smoothedData.volume > 0.01) {
        setSingingTimeMs(prev => prev + (performance.now() - (lastFrameTimeRef.current || performance.now())));
    }
    lastFrameTimeRef.current = performance.now();

    if (smoothedData.clarity > 0.8 && smoothedData.pitch > 0) {
      setSessionStats(prev => ({
        pitches: [...prev.pitches, smoothedData.pitch],
        deviations: [...prev.deviations, smoothedData.centsOff],
        volumes: [...prev.volumes, smoothedData.volume]
      }));

      const now = Date.now();
      if (smoothedData.note !== lastNoteRef.current || (now - lastNoteTimeRef.current > 1000)) {
        setNoteHistory(prev => {
           const newHist = [...prev, { note: smoothedData.note, cents: smoothedData.centsOff }];
           return newHist.slice(-7); 
        });
        lastNoteRef.current = smoothedData.note;
        lastNoteTimeRef.current = now;
      }
      
      if (selectedExercise?.id === 's_scale_maj' && selectedExercise.targetNotes) {
         const target = selectedExercise.targetNotes[scaleProgress];
         if (target) {
             const noteMatch = smoothedData.note === (target.name + target.octave);
             const centsGood = Math.abs(smoothedData.centsOff) < 50;
             if (noteMatch && centsGood) {
                 if (scaleProgress < selectedExercise.targetNotes.length - 1) {
                     const nextIdx = scaleProgress + 1;
                     setScaleProgress(nextIdx);
                     audioPlayer.playTone(selectedExercise.targetNotes[nextIdx].frequency, 0.3);
                 } else {
                     handleStop();
                 }
             }
         }
      }
      
      if (selectedExercise?.id === 's_pitch_game' && gameTarget) {
          const ratio = smoothedData.pitch / gameTarget;
          const semitonesDiff = 12 * Math.log2(ratio);
          if (Math.abs(semitonesDiff) < 0.3) { 
              hitAccumulatorRef.current += 16; 
              if (hitAccumulatorRef.current > 400) { 
                  setGameScore(s => s + 10);
                  audioPlayer.playSuccess();
                  hitAccumulatorRef.current = 0;
                  
                  if (gameMode === 'random') {
                      setTimeout(pickRandomGameNote, 500);
                  } 
              }
          } else {
              hitAccumulatorRef.current = 0;
          }
      }
    }
    
    if (!infiniteMode && selectedExercise && elapsedTime >= selectedExercise.durationSeconds) {
      handleStop();
    }
  };

  const handlePlayExample = async () => {
    if (!selectedExercise?.exampleText) return;
    
    setIsPlayingExample(true);
    setExampleLoading(true);
    
    const base64Audio = await generateAudioExample(mode, selectedExercise.exampleText);
    
    if (base64Audio) {
        try {
            const ctx = audioPlayer.getContext();
            if (ctx) {
                const buffer = await convertRawPCMToAudioBuffer(ctx, base64Audio);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start();
                source.onended = () => setIsPlayingExample(false);
            }
        } catch (e) {
            console.error("Audio decode error", e);
            setIsPlayingExample(false);
        }
    } else {
        setIsPlayingExample(false);
    }
    setExampleLoading(false);
  };
  
  const toggleTheme = (newTheme: AppTheme) => {
    setAppTheme(newTheme);
    localStorage.setItem('vokalista_theme', newTheme);
  };
  
  const setFeedbackInterval = (minutes: number) => {
      setAutoFeedbackInterval(minutes);
      localStorage.setItem('vokalista_feedback_interval', minutes.toString());
  };

  const renderHome = () => {
    const t = THEME[appTheme];
    const isBrutalist = appTheme === 'brutalist';

    if (isBrutalist) {
        return (
            <div className={`min-h-dvh flex flex-col ${t.layout}`}>
                <header className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black">
                   <div className="font-black text-xl tracking-widest uppercase">4RAP.CZ</div>
                   <div className="flex gap-4">
                       <button className="font-bold hover:underline hidden sm:block">NOVINKY</button>
                       <button className="font-bold hover:underline hidden sm:block">RAPEŘI</button>
                       <button className="font-bold hover:underline hidden sm:block">AKCE</button>
                   </div>
                </header>

                <div className="p-4 md:p-8 flex justify-center">
                    <div className="relative inline-block rotate-1 transform">
                        <div className="bg-white border-4 border-black p-4 px-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                             <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">VOKALISTA</h1>
                        </div>
                    </div>
                </div>

                 <button 
                  onClick={() => { setAboutTab('about'); setShowAboutModal(true); }}
                  className="absolute top-20 right-4 p-2 bg-black text-white border-2 border-white rounded-full hover:scale-110 transition-transform z-10"
                >
                  <Info size={24} />
                </button>

                <div className="flex-1 p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full items-start">
                    
                    <button 
                        onClick={() => { setMode(UserMode.SINGER); setView('list'); }}
                        className="group relative h-full w-full text-left transition-transform active:scale-95 touch-none select-none"
                    >
                        <div className="bg-[#a855f7] border-4 border-black p-6 h-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between min-h-[250px]">
                            <div>
                                <div className="bg-white border-2 border-black w-12 h-12 flex items-center justify-center mb-4">
                                    <Music className="text-black" size={24} />
                                </div>
                                <h2 className="text-3xl font-black uppercase mb-2 text-black">ZPĚVÁK</h2>
                                <p className="font-bold text-black/80">Trénink intonace a rozsahu</p>
                            </div>
                            <div className="mt-4 bg-black text-white py-2 px-4 font-bold text-sm inline-flex items-center gap-2 self-start group-hover:bg-white group-hover:text-black transition-colors border-2 border-black">
                                ZOBRAZIT VŠE <ChevronRight size={16} />
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => { setMode(UserMode.RAPPER); setView('list'); }}
                        className="group relative h-full w-full text-left transition-transform active:scale-95 touch-none select-none"
                    >
                        <div className="bg-[#22c55e] border-4 border-black p-6 h-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between min-h-[250px]">
                            <div>
                                <div className="bg-white border-2 border-black w-12 h-12 flex items-center justify-center mb-4">
                                    <Mic className="text-black" size={24} />
                                </div>
                                <h2 className="text-3xl font-black uppercase mb-2 text-black">RAPPER</h2>
                                <p className="font-bold text-black/80">Flow, rytmus a dech</p>
                            </div>
                            <div className="mt-4 bg-black text-white py-2 px-4 font-bold text-sm inline-flex items-center gap-2 self-start group-hover:bg-white group-hover:text-black transition-colors border-2 border-black">
                                ZOBRAZIT VŠE <ChevronRight size={16} />
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => { setMode(UserMode.SPEAKER); setView('list'); }}
                        className="group relative h-full w-full text-left transition-transform active:scale-95 touch-none select-none"
                    >
                        <div className="bg-[#3b82f6] border-4 border-black p-6 h-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between min-h-[250px]">
                            <div>
                                <div className="bg-white border-2 border-black w-12 h-12 flex items-center justify-center mb-4">
                                    <MessageSquare className="text-black" size={24} />
                                </div>
                                <h2 className="text-3xl font-black uppercase mb-2 text-black">MLUVČÍ</h2>
                                <p className="font-bold text-black/80">Rétorika a artikulace</p>
                            </div>
                            <div className="mt-4 bg-black text-white py-2 px-4 font-bold text-sm inline-flex items-center gap-2 self-start group-hover:bg-white group-hover:text-black transition-colors border-2 border-black">
                                ZOBRAZIT VŠE <ChevronRight size={16} />
                            </div>
                        </div>
                    </button>

                </div>

                <footer className="bg-[#22c55e] border-t-4 border-black p-6 text-center font-bold">
                    <a href="https://www.4rap.cz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-black hover:underline uppercase tracking-wider">
                       WWW.4RAP.CZ <ExternalLink size={16} />
                    </a>
                </footer>
            </div>
        );
    }

    return (
      <div className={`min-h-dvh flex flex-col items-center justify-center p-6 ${t.layout} overflow-y-auto`}>
        <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={() => { setAboutTab('about'); setShowAboutModal(true); }}
              className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <Info size={24} />
            </button>
        </div>

        <div className="max-w-md w-full space-y-8 pb-10">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-full bg-violet-500/10 mb-4 ring-1 ring-violet-500/30">
              <Mic size={40} className="text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Vokalista</h1>
            <p className="text-zinc-400 text-lg">Vyberte si režim tréninku</p>
          </div>

          <div className="grid gap-4">
            <button
              onClick={() => { setMode(UserMode.SINGER); setView('list'); }}
              className={`${t.card} hover:scale-[1.02] transition-all group text-left flex items-center gap-4`}
            >
              <div className="p-3 rounded-xl bg-violet-500/20 group-hover:bg-violet-500/30 transition-colors">
                <Music className="text-violet-400" size={28} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Zpěvák</h3>
                <p className="text-zinc-400 text-sm">Intonace, stupnice, rozsah</p>
              </div>
              <ChevronRight className="ml-auto text-zinc-600 group-hover:text-violet-400" />
            </button>

            <button
              onClick={() => { setMode(UserMode.RAPPER); setView('list'); }}
              className={`${t.card} hover:scale-[1.02] transition-all group text-left flex items-center gap-4`}
            >
              <div className="p-3 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                <Mic className="text-emerald-400" size={28} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Rapper</h3>
                <p className="text-zinc-400 text-sm">Flow, rytmus, dech</p>
              </div>
              <ChevronRight className="ml-auto text-zinc-600 group-hover:text-emerald-400" />
            </button>

            <button
              onClick={() => { setMode(UserMode.SPEAKER); setView('list'); }}
              className={`${t.card} hover:scale-[1.02] transition-all group text-left flex items-center gap-4`}
            >
              <div className="p-3 rounded-xl bg-sky-500/20 group-hover:bg-sky-500/30 transition-colors">
                <MessageSquare className="text-sky-400" size={28} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Mluvčí</h3>
                <p className="text-zinc-400 text-sm">Artikulace, přednes</p>
              </div>
              <ChevronRight className="ml-auto text-zinc-600 group-hover:text-sky-400" />
            </button>
          </div>

           <Button variant="secondary" onClick={() => setView('stats')} className="w-full justify-between">
              <span className="flex items-center gap-2"><BarChart2 size={18} /> Moje statistiky</span>
              <ChevronRight size={16} />
           </Button>
        </div>
      </div>
    );
  };

  const renderExerciseList = () => {
    const list = EXERCISES[mode];
    const t = THEME[appTheme];
    const isBrutalist = appTheme === 'brutalist';
    
    return (
      <div className={`min-h-dvh flex flex-col ${t.layout}`}>
        <div className={`p-4 flex items-center justify-between sticky top-0 z-10 ${isBrutalist ? 'bg-[#FFD700] border-b-4 border-black' : 'bg-black/80 backdrop-blur-xl border-b border-zinc-800'}`}>
          <button 
             onClick={() => setView('home')} 
             className={`p-2 rounded-xl transition-all ${isBrutalist ? 'bg-black text-white hover:-rotate-12 hover:scale-110' : 'hover:bg-zinc-800'}`}
          >
             <ArrowLeft />
          </button>
          <h2 className={`text-lg font-bold ${isBrutalist ? 'uppercase tracking-wider' : ''}`}>
             {mode === UserMode.SINGER ? 'Zpěvák' : mode === UserMode.RAPPER ? 'Rapper' : 'Mluvčí'}
          </h2>
          <button 
             onClick={() => setShowSettings(true)}
             className={`p-2 rounded-xl transition-colors ${isBrutalist ? 'bg-black text-white hover:bg-gray-800' : 'hover:bg-zinc-800'}`}
          >
             <Settings size={20} />
          </button>
        </div>

        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min overflow-y-auto">
          {list.map(ex => {
              if (isBrutalist) {
                  return (
                    <div 
                        key={ex.id}
                        onClick={() => { setSelectedExercise(ex); setView('session'); }}
                        className="relative bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all duration-150 flex flex-col h-full cursor-pointer overflow-hidden"
                    >
                        <div className="absolute -top-3 -right-8 bg-black text-white font-bold text-[10px] px-8 py-1 rotate-[35deg] border-y-2 border-white shadow-lg z-10">
                            {ex.difficulty === 'easy' ? 'LEHKÉ' : ex.difficulty === 'medium' ? 'STŘEDNÍ' : 'TĚŽKÉ'}
                        </div>

                        <div className="mb-4 mt-2">
                            <h3 className="text-3xl font-black uppercase leading-none break-words tracking-tight">{ex.title}</h3>
                        </div>
                        
                        <div className="flex-1 border-l-4 border-black pl-4 py-2 mb-6">
                            <p className="font-bold text-sm leading-tight">{ex.description}</p>
                        </div>
                        
                        <div className="flex justify-between items-end mt-auto pt-4 border-t-2 border-dashed border-gray-300">
                            <div className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 border border-black inline-flex items-center gap-1">
                                <Clock size={12}/> {ex.durationSeconds} SEC
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setInfoExercise(ex); }} 
                                className="hover:scale-110 transition-transform p-2 border-2 border-transparent hover:border-black rounded-full"
                            >
                                <HelpCircle size={24} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                  );
              } else {
                  return (
                    <div 
                        key={ex.id}
                        onClick={() => { setSelectedExercise(ex); setView('session'); }}
                        className="relative group overflow-hidden rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-violet-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-900/10 cursor-pointer flex flex-col h-full backdrop-blur-sm"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div className="p-6 relative z-10 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full border ${
                                    ex.difficulty === 'easy' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' :
                                    ex.difficulty === 'medium' ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5' :
                                    'border-red-500/20 text-red-400 bg-red-500/5'
                                }`}>
                                    {ex.difficulty === 'easy' ? 'Lehké' : ex.difficulty === 'medium' ? 'Střední' : 'Těžké'}
                                </span>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-violet-300 transition-colors leading-tight">{ex.title}</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-1">{ex.description}</p>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                 <span className="text-xs text-zinc-500 font-mono flex items-center gap-2 group-hover:text-zinc-300 transition-colors">
                                    <Clock size={12} /> {ex.durationSeconds}s
                                 </span>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); setInfoExercise(ex); }} 
                                    className="text-zinc-600 hover:text-white transition-colors p-1"
                                 >
                                    <HelpCircle size={18} />
                                 </button>
                            </div>
                        </div>
                    </div>
                  );
              }
          })}
        </div>
      </div>
    );
  };

  const renderResultView = () => {
    if (!finalResult) return null;
    const t = THEME[appTheme];
    const isBrutalist = appTheme === 'brutalist';

    return (
      <div className={`min-h-dvh flex flex-col items-center justify-center p-6 ${t.layout} overflow-y-auto`}>
         <div className="max-w-2xl w-full space-y-6">
            <div className={`text-center space-y-2 ${isBrutalist ? 'bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]' : ''}`}>
               <h2 className={`text-3xl font-bold ${isBrutalist ? 'uppercase' : 'text-white'}`}>Výsledek Tréninku</h2>
               <div className={`text-6xl font-black ${isBrutalist ? 'text-[#FF00FF]' : 'text-violet-400'}`}>
                  {finalResult.score}/100
               </div>
               <p className={isBrutalist ? 'font-bold' : 'text-zinc-400'}>{getShortSummary(finalResult.score)}</p>
            </div>

            <div className={`${t.card} p-6`}>
               <h3 className={`text-lg font-bold mb-4 ${isBrutalist ? 'uppercase' : 'text-white'}`}>AI Zpětná vazba</h3>
               {loadingFeedback ? (
                  <div className="flex items-center gap-3 text-zinc-500 animate-pulse">
                     <Sparkles size={20} /> Generuji analýzu...
                  </div>
               ) : (
                   <div className="prose prose-invert max-w-none">
                     <p className={`${isBrutalist ? 'font-mono text-sm text-black' : 'text-zinc-300 leading-relaxed'}`}>
                        {finalResult.feedbackText}
                     </p>
                   </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className={`${t.card} p-4 text-center`}>
                  <div className={`text-xs uppercase ${isBrutalist ? 'text-black/60' : 'text-zinc-500'}`}>Stabilita</div>
                  <div className={`text-2xl font-bold ${isBrutalist ? 'text-black' : 'text-white'}`}>{finalResult.stats.rhythmConsistency ? Math.round(finalResult.stats.rhythmConsistency) : 0}%</div>
               </div>
               <div className={`${t.card} p-4 text-center`}>
                  <div className={`text-xs uppercase ${isBrutalist ? 'text-black/60' : 'text-zinc-500'}`}>Aktivita</div>
                  <div className={`text-2xl font-bold ${isBrutalist ? 'text-black' : 'text-white'}`}>{Math.round(finalResult.stats.participationPct || 0)}%</div>
               </div>
            </div>

            <div className="flex gap-4">
                <Button onClick={() => { setFinalResult(null); handleStart(); }} theme={appTheme} className="flex-1">
                   <RotateCcw size={18} /> Zkusit znovu
                </Button>
                <Button onClick={() => { setFinalResult(null); setView('list'); }} variant="secondary" theme={appTheme} className="flex-1">
                   <ListMusic size={18} /> Zpět na seznam
                </Button>
            </div>
         </div>
      </div>
    );
  };

  const renderSession = () => {
    if (!selectedExercise) return null;
    const t = THEME[appTheme];
    const isBrutalist = appTheme === 'brutalist';
    
    if (finalResult && !isRecording) {
        return renderResultView();
    }

    return (
      <div className={`h-dvh flex flex-col ${t.layout} overflow-hidden`}>
        <div className={`flex-none p-4 flex items-center justify-between ${isBrutalist ? 'border-b-4 border-black bg-white' : 'bg-black/20 backdrop-blur-sm'}`}>
          <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className={`p-2 rounded-xl ${isBrutalist ? 'bg-black text-white hover:-rotate-12 hover:scale-110 transition-transform' : 'hover:bg-zinc-800'}`}>
                <ArrowLeft />
              </button>
              <div>
                <h2 className={`font-bold leading-tight ${isBrutalist ? 'uppercase text-lg' : 'text-white'}`}>{selectedExercise.title}</h2>
                <div className={`text-xs ${isBrutalist ? 'text-black font-bold' : 'text-zinc-400'} flex items-center gap-2`}>
                   {isRecording ? <span className="text-red-500 flex items-center gap-1"><Activity size={12} className="animate-pulse"/> Nahrávání</span> : 'Připraveno'}
                   {selectedExercise.bpm && <span>• {selectedExercise.bpm} BPM</span>}
                </div>
              </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setInfoExercise(selectedExercise)} className={`p-2 ${isBrutalist ? 'bg-black text-white' : 'hover:bg-zinc-800 text-zinc-400'} rounded-lg`}>
                <HelpCircle size={20} />
             </button>
             <button onClick={() => setShowSettings(true)} className={`p-2 ${isBrutalist ? 'bg-black text-white' : 'hover:bg-zinc-800 text-zinc-400'} rounded-lg`}>
                <Settings size={20} />
             </button>
          </div>
        </div>

        <div className="flex-1 relative w-full bg-black/50 overflow-hidden flex flex-col">
            <Visualizer 
                isRecording={isRecording} 
                mode={mode} 
                theme={appTheme}
                beatActive={beatActive}
                targetPitch={gameTarget || (selectedExercise.targetNotes ? selectedExercise.targetNotes[scaleProgress]?.frequency : null)}
                onAnalysisUpdate={handleAnalysisUpdate}
                className="w-full h-full absolute inset-0"
                lowGain={micEq.low}
                highGain={micEq.high}
                sensitivity={micSensitivity}
                exerciseId={selectedExercise.id}
            />
            
            {selectedExercise.bpm && (
                <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center`}>
                    <div className={`absolute w-full h-full rounded-full border-2 border-white transition-all duration-300 ${beatActive ? 'scale-150 opacity-0' : 'scale-100 opacity-0'}`} />

                    <div className={`relative px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-100 ${beatActive ? 'bg-white text-black scale-110 shadow-[0_0_20px_rgba(255,255,255,0.6)]' : 'bg-black/60 text-white backdrop-blur border border-white/20'}`}>
                        <div className={`w-3 h-3 rounded-full ${beatActive ? 'bg-red-600' : 'bg-zinc-500'}`} />
                        <span className="font-mono font-bold text-sm tracking-wider">{selectedExercise.bpm} BPM</span>
                    </div>
                </div>
            )}
            
            {selectedExercise.id === 's_scale_maj' && (
                <div className="absolute top-4 left-0 w-full flex justify-center pointer-events-none">
                    <div className={`${isBrutalist ? 'bg-white border-2 border-black text-black' : 'bg-black/60 backdrop-blur-md border border-zinc-700 text-white'} rounded-full px-6 py-2 flex gap-4`}>
                        {selectedExercise.targetNotes?.map((n, i) => (
                            <div key={i} className={`flex flex-col items-center transition-all ${i === scaleProgress ? 'scale-125 opacity-100 font-bold text-violet-400' : (i < scaleProgress ? 'opacity-30 text-emerald-500' : 'opacity-50')}`}>
                                <span className="text-sm">{n.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {selectedExercise.id === 's_freestyle' && (
               <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-hidden items-end pointer-events-none">
                  {noteHistory.map((h, i) => {
                      const isGood = Math.abs(h.cents) < 15;
                      const isLast = i === noteHistory.length - 1;
                      return (
                        <div 
                          key={i} 
                          className={`
                             rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300
                             ${isBrutalist ? 'border border-black' : ''}
                             ${isGood ? (isBrutalist ? 'bg-[#10b981] text-black' : 'bg-emerald-500 text-black') : (isBrutalist ? 'bg-[#ef4444] text-white' : 'bg-zinc-700 text-white')}
                             ${isLast ? 'w-10 h-10 text-sm shadow-lg scale-110 animate-pulse ring-2 ring-white/50' : 'w-8 h-8 opacity-70'}
                          `}
                        >
                           {h.note}
                        </div>
                      );
                  })}
                  {noteHistory.length > 0 && (
                      <button onClick={() => setNoteHistory([])} className="ml-auto p-2 bg-black/50 rounded-full text-white pointer-events-auto hover:bg-red-500/80">
                          <Trash2 size={16} />
                      </button>
                  )}
               </div>
            )}
            
            {selectedExercise.id === 's_pitch_game' && (
                <div className={`absolute top-0 left-0 w-full p-2 flex justify-between items-start pointer-events-none`}>
                   <div className={`${isBrutalist ? 'bg-white border-2 border-black text-black' : 'bg-black/60 backdrop-blur text-white'} px-4 py-2 rounded-xl pointer-events-auto`}>
                       <div className="text-xs uppercase opacity-70 mb-1">Skóre</div>
                       <div className="text-2xl font-black font-mono">{gameScore}</div>
                   </div>
                   
                   <div className={`${isBrutalist ? 'bg-white border-2 border-black' : 'bg-black/60 backdrop-blur'} p-2 rounded-xl pointer-events-auto flex gap-2`}>
                       <Button size="sm" variant={gameMode === 'random' ? 'primary' : 'secondary'} theme={appTheme} onClick={() => { setGameMode('random'); setGameTarget(null); }}>
                          <Shuffle size={14} /> Náhodně
                       </Button>
                       <Button size="sm" variant={gameMode === 'manual' ? 'primary' : 'secondary'} theme={appTheme} onClick={() => { setGameMode('manual'); setGameTarget(null); }}>
                          <HandMetal size={14} /> Manuálně
                       </Button>
                   </div>
                </div>
            )}
            
            <div className={`absolute top-4 right-4 flex items-center gap-2 pointer-events-none ${analysisData && analysisData.volume > 0.01 ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-3 h-3 rounded-full ${isBrutalist ? 'bg-green-600' : 'bg-emerald-500'} shadow-[0_0_10px_rgba(16,185,129,0.5)]`} />
                <span className={`text-xs font-bold ${isBrutalist ? 'text-black bg-white px-1' : 'text-white shadow-black drop-shadow-md'}`}>
                   {analysisData && analysisData.volume > 0.01 ? 'HLAS DETEKOVÁN' : 'TICHO'}
                </span>
            </div>
        </div>

        <div className={`flex-none p-6 ${isBrutalist ? 'bg-white border-t-4 border-black' : 'bg-zinc-900 border-t border-zinc-800'} relative z-20`}>
           
           {selectedExercise.id === 's_pitch_game' && gameMode === 'manual' && (
               <div className="mb-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
                     {Object.entries(SCALES).map(([key, notes]) => (
                         <button
                           key={key}
                           onClick={() => setSelectedScale(key)}
                           className={`
                             px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                             ${selectedScale === key 
                               ? (isBrutalist ? 'bg-black text-white' : 'bg-violet-600 text-white') 
                               : (isBrutalist ? 'bg-gray-200 text-black border border-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}
                           `}
                         >
                           {SCALE_LABELS[key]}
                         </button>
                     ))}
                  </div>

                  <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
                      {GAME_NOTES.filter(n => {
                          return SCALES[selectedScale].includes(n.name);
                      }).map((n, i) => (
                          <button
                             key={i}
                             onClick={() => { setGameTarget(n.frequency); audioPlayer.playTone(n.frequency, 0.5); }}
                             className={`
                                h-16 w-10 flex-shrink-0 flex items-end justify-center pb-2 rounded-b-lg font-bold text-xs border border-b-4 active:scale-95 transition-all
                                ${gameTarget === n.frequency 
                                   ? (isBrutalist ? 'bg-[#FF00FF] border-black text-white' : 'bg-violet-500 border-violet-700 text-white')
                                   : (n.name.includes('#') 
                                      ? (isBrutalist ? 'bg-black text-white border-gray-800' : 'bg-zinc-800 text-zinc-500 border-zinc-950')
                                      : (isBrutalist ? 'bg-white text-black border-black' : 'bg-white text-black border-zinc-300')
                                   )
                                }
                             `}
                          >
                             {n.name}
                          </button>
                      ))}
                  </div>
               </div>
           )}

           <div className="flex items-center justify-between gap-4 max-w-lg mx-auto w-full">
              <div className={`hidden md:flex flex-col ${isBrutalist ? 'text-black' : 'text-zinc-400'} text-xs font-mono`}>
                 <div className="flex items-center gap-1"><Clock size={12}/> ČAS</div>
                 <div className="text-lg font-bold">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</div>
              </div>

              {!isRecording ? (
                 <Button onClick={handleStart} theme={appTheme} size="lg" className="flex-1 max-w-[200px] shadow-xl">
                    <Mic /> START
                 </Button>
              ) : (
                 <Button onClick={handleStop} theme={appTheme} variant="danger" size="lg" className="flex-1 max-w-[200px] shadow-xl animate-pulse">
                    <Square fill="currentColor" /> STOP
                 </Button>
              )}

              {selectedExercise.exampleText && (
                  <Button 
                    variant="secondary" 
                    theme={appTheme}
                    onClick={handlePlayExample} 
                    disabled={isRecording || exampleLoading}
                    className="aspect-square p-0 w-14 flex items-center justify-center"
                    title="Přehrát ukázku"
                  >
                     {exampleLoading ? <Activity className="animate-spin" /> : <Play fill={isPlayingExample ? "currentColor" : "none"} />}
                  </Button>
              )}
           </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
      const t = THEME[appTheme];
      const isBrutalist = appTheme === 'brutalist';

      return (
          <div className={`min-h-dvh flex flex-col ${t.layout}`}>
              <div className={`p-4 flex items-center justify-between ${isBrutalist ? 'border-b-4 border-black bg-white' : 'border-b border-zinc-800'}`}>
                  <button onClick={() => setView('home')} className={`p-2 rounded-xl ${isBrutalist ? 'hover:bg-black hover:text-white transition-colors' : 'hover:bg-zinc-800'}`}>
                      <ArrowLeft />
                  </button>
                  <h2 className={`font-bold uppercase ${isBrutalist ? 'text-black' : 'text-white'}`}>Statistiky</h2>
                  <div className="w-10"></div>
              </div>

              <div className="p-6 max-w-4xl mx-auto w-full space-y-8 overflow-y-auto">
                  <div className={`${t.card} p-6 h-64`}>
                      <h3 className={`mb-4 font-bold ${isBrutalist ? 'text-black' : 'text-white'}`}>Historie Skóre</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[...history].reverse().slice(-10)}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isBrutalist ? '#00000020' : '#333'} />
                              <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })} stroke={isBrutalist ? '#000' : '#666'} fontSize={12} />
                              <YAxis stroke={isBrutalist ? '#000' : '#666'} fontSize={12} />
                              <Tooltip
                                  contentStyle={{ backgroundColor: isBrutalist ? '#fff' : '#18181b', border: isBrutalist ? '2px solid black' : '1px solid #333' }}
                                  labelStyle={{ color: isBrutalist ? '#000' : '#888' }}
                                  itemStyle={{ color: isBrutalist ? '#000' : '#fff' }}
                              />
                              <Bar dataKey="score" fill={isBrutalist ? '#000' : '#8b5cf6'} radius={isBrutalist ? 0 : [4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className={`font-bold text-xl ${isBrutalist ? 'text-black' : 'text-white'}`}>Nedávné tréninky</h3>
                          {history.length > 0 && (
                              <button onClick={handleClearHistory} className="text-red-500 text-sm hover:underline flex items-center gap-1 font-bold">
                                  <Trash2 size={14} /> SMAZAT HISTORII
                              </button>
                          )}
                      </div>

                      {history.length === 0 ? (
                          <div className="text-center py-10 text-zinc-500">Zatím žádná historie.</div>
                      ) : (
                          history.map((sess) => (
                              <div key={sess.id} className={`${t.card} p-4 flex justify-between items-center`}>
                                  <div>
                                      <div className={`font-bold ${isBrutalist ? 'text-black' : 'text-white'}`}>{new Date(sess.timestamp).toLocaleDateString()} <span className="text-xs font-normal opacity-60">{new Date(sess.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                      <div className={`text-sm ${isBrutalist ? 'text-black/70' : 'text-zinc-400'}`}>{sess.feedbackText?.substring(0, 50)}...</div>
                                  </div>
                                  <div className={`text-xl font-bold ${sess.score >= 80 ? 'text-green-500' : sess.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                      {sess.score}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      );
  };

  const renderSettingsModal = () => {
      const t = THEME[appTheme];
      const isBrutalist = appTheme === 'brutalist';
      
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`${t.modal} max-w-md w-full p-6 relative`}>
                <button onClick={() => setShowSettings(false)} className={`absolute top-4 right-4 p-1 ${isBrutalist ? 'hover:bg-black hover:text-white' : 'hover:bg-zinc-800 rounded-full'}`}>
                    <X size={24} />
                </button>
                
                <h2 className={`text-2xl font-bold mb-6 ${isBrutalist ? 'text-black uppercase' : 'text-white'}`}>Nastavení</h2>
                
                <div className="space-y-6">
                    <div>
                        <label className={`block text-sm font-bold mb-2 ${isBrutalist ? 'text-black' : 'text-zinc-400'}`}>Téma aplikace</label>
                        <div className="flex gap-2">
                             <Button size="sm" variant={appTheme === 'default' ? 'primary' : 'secondary'} theme={appTheme} onClick={() => toggleTheme('default')}>Dark</Button>
                             <Button size="sm" variant={appTheme === 'brutalist' ? 'primary' : 'secondary'} theme={appTheme} onClick={() => toggleTheme('brutalist')}>Brutalist</Button>
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-bold mb-2 ${isBrutalist ? 'text-black' : 'text-zinc-400'}`}>Citlivost mikrofonu</label>
                        <div className="flex gap-2">
                             {(['low', 'medium', 'high'] as MicSensitivity[]).map(s => (
                                 <Button 
                                    key={s} 
                                    size="sm" 
                                    variant={micSensitivity === s ? 'primary' : 'secondary'} 
                                    theme={appTheme} 
                                    onClick={() => setMicSensitivity(s)}
                                    className="capitalize"
                                 >
                                    {s === 'low' ? 'Nízká' : s === 'medium' ? 'Střední' : 'Vysoká'}
                                 </Button>
                             ))}
                        </div>
                    </div>

                    <div>
                         <label className={`block text-sm font-bold mb-2 ${isBrutalist ? 'text-black' : 'text-zinc-400'}`}>Frekvence AI Analýzy (minuty)</label>
                         <input 
                            type="range" 
                            min="0" 
                            max="60" 
                            step="5" 
                            value={autoFeedbackInterval} 
                            onChange={(e) => setFeedbackInterval(parseInt(e.target.value))}
                            className="w-full"
                         />
                         <div className={`text-right text-sm font-bold ${isBrutalist ? 'text-black' : 'text-zinc-400'}`}>
                             {autoFeedbackInterval === 0 ? 'Vypnuto' : `${autoFeedbackInterval} min`}
                         </div>
                    </div>

                    <div>
                         <label className={`block text-sm font-bold mb-2 ${isBrutalist ? 'text-black' : 'text-zinc-400'}`}>EQ Mikrofonu (Low/High)</label>
                         <div className="flex gap-4">
                             <div className="flex-1">
                                 <span className="text-xs">Low Shelf</span>
                                 <input 
                                    type="range" min="-10" max="10" value={micEq.low} 
                                    onChange={(e) => setMicEq({...micEq, low: parseInt(e.target.value)})}
                                    className="w-full"
                                 />
                             </div>
                             <div className="flex-1">
                                 <span className="text-xs">High Shelf</span>
                                 <input 
                                    type="range" min="-10" max="10" value={micEq.high} 
                                    onChange={(e) => setMicEq({...micEq, high: parseInt(e.target.value)})}
                                    className="w-full"
                                 />
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
      );
  };

  const renderAboutModal = () => {
      const t = THEME[appTheme];
      const isBrutalist = appTheme === 'brutalist';
      
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className={`${t.modal} max-w-lg w-full h-[600px] flex flex-col relative`}>
                 <button onClick={() => setShowAboutModal(false)} className={`absolute top-4 right-4 z-10 p-1 ${isBrutalist ? 'hover:bg-black hover:text-white' : 'hover:bg-zinc-800 rounded-full'}`}>
                    <X size={24} />
                 </button>

                 <div className={`p-6 border-b ${isBrutalist ? 'border-black' : 'border-zinc-800'} flex gap-4`}>
                     <button onClick={() => setAboutTab('about')} className={`font-bold pb-2 border-b-2 ${aboutTab === 'about' ? (isBrutalist ? 'border-black text-black' : 'border-violet-500 text-white') : 'border-transparent text-zinc-500'}`}>O aplikaci</button>
                     <button onClick={() => setAboutTab('guide')} className={`font-bold pb-2 border-b-2 ${aboutTab === 'guide' ? (isBrutalist ? 'border-black text-black' : 'border-violet-500 text-white') : 'border-transparent text-zinc-500'}`}>Nápověda</button>
                 </div>

                 <div className="p-6 overflow-y-auto flex-1">
                     {aboutTab === 'about' ? (
                         <div className="space-y-4">
                             <h2 className="text-2xl font-bold">Vokalista 2.0</h2>
                             <p className={isBrutalist ? 'font-bold' : 'text-zinc-400'}>
                                 Pokročilý nástroj pro diagnostiku a trénink hlasu. Využívá Google Gemini AI pro analýzu zpětné vazby.
                             </p>
                             <div className={`p-4 ${isBrutalist ? 'bg-yellow-200 border-2 border-black' : 'bg-zinc-800/50 rounded-lg'}`}>
                                 <h3 className="font-bold mb-2">Vyvinuto pro 4RAP.CZ</h3>
                                 <p className="text-sm">Profesionální nástroje pro rappery, zpěváky a speakery.</p>
                             </div>
                         </div>
                     ) : (
                         <div className="space-y-4">
                             <h3 className="font-bold text-lg">Jak používat</h3>
                             <ul className="list-disc pl-5 space-y-2 text-sm">
                                 <li><strong>Zpěvák:</strong> Sledujte intonaci na grafu. Červená čára = historie vašeho hlasu. Zelená tečka = trefený tón.</li>
                                 <li><strong>Rapper:</strong> Udržujte "Participation" (Flow) vysoko. Graf ukazuje spektrum a rytmus.</li>
                                 <li><strong>Mluvčí:</strong> Trénujte plynulost a čistotu. Graf ukazuje hlasitost v čase.</li>
                             </ul>
                             <h3 className="font-bold text-lg mt-4">Tipy</h3>
                             <ul className="list-disc pl-5 space-y-2 text-sm">
                                 <li>Pro nejlepší výsledky použijte sluchátka.</li>
                                 <li>Nastavte citlivost mikrofonu v nastavení, pokud graf nereaguje nebo je příliš citlivý.</li>
                             </ul>
                         </div>
                     )}
                 </div>
             </div>
        </div>
      );
  };

  return (
      <>
        {view === 'home' && renderHome()}
        {view === 'list' && renderExerciseList()}
        {view === 'session' && renderSession()}
        {view === 'stats' && renderStats()}
        
        {showSettings && renderSettingsModal()}
        {showAboutModal && renderAboutModal()}
      </>
  );
}
