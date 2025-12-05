import React, { useEffect, useRef } from 'react';
import { UserMode, AudioAnalysis, AppTheme, MicSensitivity } from '../types';
import { autoCorrelate, getNoteFromFrequency } from '../services/audioUtils';

interface VisualizerProps {
  isRecording: boolean;
  mode: UserMode;
  theme?: AppTheme;
  beatActive?: boolean; 
  targetPitch?: number | null; // For Game Mode
  onAnalysisUpdate: (data: AudioAnalysis) => void;
  className?: string;
  lowGain?: number; // dB (Manual EQ)
  highGain?: number; // dB (Manual EQ)
  sensitivity?: MicSensitivity;
  exerciseId?: string;
}

// Particle System Types
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  color: string;
  size: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  isRecording, 
  mode, 
  theme = 'default',
  beatActive, 
  targetPitch, 
  onAnalysisUpdate, 
  className = "h-64",
  lowGain = 0,
  highGain = 0,
  sensitivity = 'medium',
  exerciseId
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Filters (Manual)
  const manualLowShelfRef = useRef<BiquadFilterNode | null>(null);
  const manualHighShelfRef = useRef<BiquadFilterNode | null>(null);

  const beatStateRef = useRef({ active: false, decay: 0 });
  
  // Visual FX Refs
  const successFlashRef = useRef(0); // 0 to 1 intensity
  const smoothedPitchRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  
  // History for drawing trace
  const historyRef = useRef<{ y: number; color: string }[]>([]);
  
  // Range Tracking for Range Test Exercise
  const rangeRef = useRef<{ min: number; max: number }>({ min: Infinity, max: 0 });

  // Reset Range on recording start
  useEffect(() => {
    if (isRecording) {
        rangeRef.current = { min: Infinity, max: 0 };
    }
  }, [isRecording]);

  // Calculate Threshold based on Sensitivity
  const getThreshold = () => {
    switch (sensitivity) {
        case 'high': return 0.003; // Very sensitive (whisper)
        case 'low': return 0.04;  // Needs loud voice
        case 'medium': 
        default: return 0.01;
    }
  };

  // Update beat state
  useEffect(() => {
    if (beatActive) {
      beatStateRef.current.active = true;
      beatStateRef.current.decay = 1.0; 
    }
  }, [beatActive]);

  // Update Manual EQ Gains in real-time
  useEffect(() => {
    if (manualLowShelfRef.current && audioContextRef.current) {
        manualLowShelfRef.current.gain.setTargetAtTime(lowGain, audioContextRef.current.currentTime, 0.1);
    }
    if (manualHighShelfRef.current && audioContextRef.current) {
        manualHighShelfRef.current.gain.setTargetAtTime(highGain, audioContextRef.current.currentTime, 0.1);
    }
  }, [lowGain, highGain]);

  useEffect(() => {
    if (isRecording) {
      startAudio();
    } else {
      stopAudio();
    }
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioContextRef.current;

      // 1. Source
      sourceRef.current = ctx.createMediaStreamSource(stream);
      
      // 2. FIXED VOCAL CHAIN (Auto EQ & Cleaning)
      // Cut rumble below 100Hz
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 100;

      // Cut hiss above 8500Hz
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 8500;

      // Mud cut around 400Hz
      const mudCut = ctx.createBiquadFilter();
      mudCut.type = 'peaking';
      mudCut.frequency.value = 400;
      mudCut.Q.value = 1.0;
      mudCut.gain.value = -2.5;

      // Presence boost (1450Hz - 3800Hz center approx 2500Hz)
      const presenceBoost = ctx.createBiquadFilter();
      presenceBoost.type = 'peaking';
      presenceBoost.frequency.value = 2500;
      presenceBoost.Q.value = 0.8;
      presenceBoost.gain.value = 3.0;

      // Air/Shine boost at 5000Hz
      const airBoost = ctx.createBiquadFilter();
      airBoost.type = 'peaking'; // or highshelf
      airBoost.frequency.value = 5000;
      airBoost.Q.value = 0.7;
      airBoost.gain.value = 2.0;

      // 3. AUTO GAIN (Compression)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // 4. MANUAL EQ (User Controls)
      manualLowShelfRef.current = ctx.createBiquadFilter();
      manualLowShelfRef.current.type = 'lowshelf';
      manualLowShelfRef.current.frequency.value = 250; 
      manualLowShelfRef.current.gain.value = lowGain;

      manualHighShelfRef.current = ctx.createBiquadFilter();
      manualHighShelfRef.current.type = 'highshelf';
      manualHighShelfRef.current.frequency.value = 4000;
      manualHighShelfRef.current.gain.value = highGain;

      // 5. Analyser
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 2048;
      
      // Connect Graph
      // Source -> HP -> LP -> Mud -> Presence -> Air -> Compressor -> ManualLow -> ManualHigh -> Analyser
      sourceRef.current
        .connect(highPass)
        .connect(lowPass)
        .connect(mudCut)
        .connect(presenceBoost)
        .connect(airBoost)
        .connect(compressor)
        .connect(manualLowShelfRef.current)
        .connect(manualHighShelfRef.current)
        .connect(analyserRef.current);

      draw();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 5; i++) {
        particlesRef.current.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color,
            size: Math.random() * 3 + 1
        });
    }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        
        if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
        }
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
  };

  const draw = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Resize
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width; 
    canvas.height = rect.height;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const timeDomainArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatFrequencyData(dataArray);
    analyserRef.current.getFloatTimeDomainData(timeDomainArray);

    // Calculate Pitch & Volume with Dynamic Threshold
    const threshold = getThreshold();
    const pitch = autoCorrelate(timeDomainArray, audioContextRef.current!.sampleRate, threshold);
    
    // Smooth Pitch Lerp
    if (pitch !== -1) {
        smoothedPitchRef.current = smoothedPitchRef.current + (pitch - smoothedPitchRef.current) * 0.2;
        
        // Update Range if recording
        if (isRecording) {
            rangeRef.current.min = Math.min(rangeRef.current.min, pitch);
            rangeRef.current.max = Math.max(rangeRef.current.max, pitch);
        }
    }

    let rms = 0;
    for (let i = 0; i < timeDomainArray.length; i++) {
      rms += timeDomainArray[i] * timeDomainArray[i];
    }
    rms = Math.sqrt(rms / timeDomainArray.length);

    // Convert pitch to note
    let noteData = { note: '-', centsOff: 0, octave: 0, frequency: 0 };
    if (pitch !== -1) {
      noteData = getNoteFromFrequency(pitch);
    }

    onAnalysisUpdate({
      pitch: pitch === -1 ? 0 : pitch,
      note: noteData.note + (noteData.octave || ''),
      centsOff: noteData.centsOff,
      volume: rms,
      clarity: pitch === -1 ? 0 : 1
    });

    // --- VISUALIZATION DRAWING ---

    // 1. Background
    ctx.fillStyle = theme === 'brutalist' ? '#FFFFFF' : '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Beat Pulse Logic
    if (beatStateRef.current.active) {
       beatStateRef.current.decay -= 0.05;
       if (beatStateRef.current.decay <= 0) {
         beatStateRef.current.active = false;
         beatStateRef.current.decay = 0;
       }
    }

    // 3. Mode Specific Visuals
    if (mode === UserMode.RAPPER) {
      drawRapperVisuals(ctx, canvas, dataArray, rms, theme);
    } else {
      drawSingerVisuals(ctx, canvas, pitch, noteData, targetPitch, theme);
    }

    // Draw Particles
    drawParticles(ctx);

    // 4. Success Flash
    if (targetPitch && pitch !== -1) {
        // Calculate difference
        const ratio = pitch / targetPitch;
        const semitonesDiff = 12 * Math.log2(ratio);
        const centsDiff = semitonesDiff * 100;
        
        if (Math.abs(centsDiff) < 15) {
            successFlashRef.current = 1.0;
        }
    }
    
    if (successFlashRef.current > 0) {
        ctx.fillStyle = theme === 'brutalist' 
            ? `rgba(255, 0, 255, ${successFlashRef.current * 0.3})`
            : `rgba(255, 255, 255, ${successFlashRef.current * 0.2})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        successFlashRef.current -= 0.05;
    }

    // 5. dB Meter Text (Bottom Right)
    const db = 20 * Math.log10(rms);
    const dbDisplay = Math.max(-60, Math.round(db));
    
    const dbText = `${dbDisplay} dB`;
    const textX = canvas.width - 8;
    const textY = canvas.height - 8;
    
    ctx.font = theme === 'brutalist' ? 'bold 12px monospace' : '10px monospace';
    ctx.textAlign = 'right';
    
    // Background box
    const textWidth = ctx.measureText(dbText).width;
    const boxHeight = 16;
    const boxWidth = textWidth + 10;
    
    ctx.fillStyle = theme === 'brutalist' ? '#000000' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(textX - boxWidth, textY - boxHeight + 4, boxWidth, boxHeight);
    
    // Text
    ctx.fillStyle = theme === 'brutalist' ? '#FFFFFF' : '#e4e4e7';
    ctx.fillText(dbText, textX - 5, textY);

    animationRef.current = requestAnimationFrame(draw);
  };

  const drawSingerVisuals = (
      ctx: CanvasRenderingContext2D, 
      canvas: HTMLCanvasElement, 
      pitch: number, 
      noteData: any,
      targetPitch: number | null | undefined,
      theme: AppTheme
    ) => {
    
    const w = canvas.width;
    const h = canvas.height;
    
    const isBrutalist = theme === 'brutalist';

    // Grid config
    const minNote = 40; // E2
    const maxNote = 84; // C6
    const totalNotes = maxNote - minNote;
    const pxPerNote = h / totalNotes;

    // Draw Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = isBrutalist ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
    
    for (let i = 0; i <= totalNotes; i++) {
        const y = h - (i * pxPerNote);
        const midiVal = minNote + i;
        const isC = midiVal % 12 === 0; 
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        
        if (isC) {
            ctx.strokeStyle = isBrutalist ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)'; 
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = isBrutalist ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();

        if (isC) {
            const octave = Math.floor(midiVal / 12) - 1;
            ctx.fillStyle = isBrutalist ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
            ctx.font = '10px Inter';
            ctx.fillText(`C${octave}`, 5, y - 2); 
        }
    }
    
    // --- RANGE TEST VISUALIZATION ---
    if (exerciseId === 's_range_test' && rangeRef.current.min !== Infinity) {
        // Calculate Y for Max Pitch
        if (rangeRef.current.max > 0) {
            const maxNoteNum = 12 * (Math.log(rangeRef.current.max / 440) / Math.log(2)) + 69;
            const maxY = h - ((maxNoteNum - minNote) * pxPerNote);
            
            // Draw Max Line
            ctx.beginPath();
            ctx.moveTo(0, maxY);
            ctx.lineTo(w, maxY);
            ctx.strokeStyle = isBrutalist ? '#FF00FF' : '#a78bfa';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Max Label
            const maxInfo = getNoteFromFrequency(rangeRef.current.max);
            ctx.fillStyle = isBrutalist ? '#FF00FF' : '#a78bfa';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`Max: ${maxInfo.note}${maxInfo.octave}`, w - 10, maxY - 5);
        }

        // Calculate Y for Min Pitch
        if (rangeRef.current.min < Infinity) {
            const minNoteNum = 12 * (Math.log(rangeRef.current.min / 440) / Math.log(2)) + 69;
            const minY = h - ((minNoteNum - minNote) * pxPerNote);
            
            // Draw Min Line
            ctx.beginPath();
            ctx.moveTo(0, minY);
            ctx.lineTo(w, minY);
            ctx.strokeStyle = isBrutalist ? '#0000FF' : '#3b82f6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Min Label
            const minInfo = getNoteFromFrequency(rangeRef.current.min);
            ctx.fillStyle = isBrutalist ? '#0000FF' : '#3b82f6';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`Min: ${minInfo.note}${minInfo.octave}`, w - 10, minY + 15);
            
             // Draw Fill between range if valid
             if (rangeRef.current.max > rangeRef.current.min) {
                 const maxNoteNum = 12 * (Math.log(rangeRef.current.max / 440) / Math.log(2)) + 69;
                 const maxY = h - ((maxNoteNum - minNote) * pxPerNote);
                 const minNoteNum = 12 * (Math.log(rangeRef.current.min / 440) / Math.log(2)) + 69;
                 const minY = h - ((minNoteNum - minNote) * pxPerNote);
                 
                 ctx.fillStyle = isBrutalist ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
                 ctx.fillRect(0, maxY, w, minY - maxY);
             }
        }
    }

    // --- TARGET LANE ---
    if (targetPitch) {
        const targetNoteNum = 12 * (Math.log(targetPitch / 440) / Math.log(2)) + 69;
        const targetY = h - ((targetNoteNum - minNote) * pxPerNote);
        
        // Draw Target "Lane"
        const laneHeight = pxPerNote * 1.5; 
        ctx.fillStyle = isBrutalist ? 'rgba(0, 0, 255, 0.1)' : 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(0, targetY - laneHeight/2, w, laneHeight);

        // Target Line
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(w, targetY);
        ctx.strokeStyle = isBrutalist ? '#0000FF' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        const targetInfo = getNoteFromFrequency(targetPitch);
        const label = `${targetInfo.note}${targetInfo.octave}`;
        ctx.fillStyle = isBrutalist ? '#0000FF' : '#60a5fa';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(label, w - 10, targetY - 8);
    }

    // --- PITCH TRACE ---
    
    if (pitch !== -1 && pitch > 50) {
      const noteNum = 12 * (Math.log(pitch / 440) / Math.log(2)) + 69;
      const y = h - ((noteNum - minNote) * pxPerNote);
      
      const cents = Math.abs(noteData.centsOff);
      const isPerfect = cents < 15;
      const isGood = cents < 35;
      
      let color = '#ef4444'; // Red
      if (isPerfect) color = '#10b981'; // Green
      else if (isGood) color = '#eab308'; // Yellow
      
      if (isBrutalist) {
          if (isPerfect) color = '#00CC00';
          else if (isGood) color = '#FFCC00';
          else color = '#FF0000';
      }

      historyRef.current.push({ y, color });
      
      // Spawn particles on perfect hit
      if (isPerfect && Math.random() > 0.6) {
          const headX = w * 0.8;
          spawnParticles(headX, y, color);
      }
    } else {
      historyRef.current.push({ y: -1, color: 'transparent' });
    }

    if (historyRef.current.length > w * 0.8) {
      historyRef.current.shift();
    }

    // Draw Trace Line
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < historyRef.current.length; i++) {
      const point = historyRef.current[i];
      const prevPoint = historyRef.current[i - 1];
      
      if (point.y !== -1 && prevPoint.y !== -1) {
        ctx.beginPath();
        ctx.moveTo(i - 1, prevPoint.y);
        ctx.lineTo(i, point.y);
        ctx.strokeStyle = point.color;
        ctx.globalAlpha = i / historyRef.current.length;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;

    // --- STARMAKER STYLE: BALL & TUNER ---
    
    if (smoothedPitchRef.current > 50) {
        const smoothNoteNum = 12 * (Math.log(smoothedPitchRef.current / 440) / Math.log(2)) + 69;
        const smoothY = h - ((smoothNoteNum - minNote) * pxPerNote);
        const headX = historyRef.current.length; 

        // Determine Deviation Logic
        // If we have a target pitch, we measure against it.
        // If not, we measure against the nearest semitone (Auto-tune style feedback).
        let centsDev = noteData.centsOff;
        let isPerfect = false;
        
        if (targetPitch) {
            const ratio = smoothedPitchRef.current / targetPitch;
            const semitonesDiff = 12 * Math.log2(ratio);
            centsDev = semitonesDiff * 100;
        }

        const absCents = Math.abs(centsDev);
        isPerfect = absCents < 15;
        const isClose = absCents < 40;

        // Color Logic
        let ballColor = isBrutalist ? '#FF0000' : '#ef4444'; // Red
        if (isPerfect) ballColor = isBrutalist ? '#00CC00' : '#10b981'; // Green
        else if (isClose) ballColor = isBrutalist ? '#FFCC00' : '#eab308'; // Yellow

        // 1. Draw The Ball
        ctx.beginPath();
        ctx.arc(headX, smoothY, 8, 0, Math.PI * 2);
        ctx.fillStyle = ballColor;
        ctx.fill();

        // 2. Draw Glow Ring
        ctx.beginPath();
        ctx.arc(headX, smoothY, 16, 0, Math.PI * 2);
        ctx.fillStyle = ballColor;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 3. Vertical Tuner Gauge (StarMaker style sliding bar)
        // A bar next to the ball that grows Up/Down based on deviation
        // Max height of gauge ~ 40px (approx 50 cents)
        const gaugeMaxH = 40;
        const gaugeH = Math.min(gaugeMaxH, (centsDev / 50) * gaugeMaxH); 
        // Note: Y axis is inverted on canvas (0 is top). 
        // If centsDev is positive (Sharp/High), we want bar to go UP (negative Y direction).
        // So we subtract gaugeH.
        
        const barX = headX + 18;
        const barW = 6;
        
        ctx.fillStyle = ballColor;
        
        // Background track for gauge
        ctx.fillStyle = isBrutalist ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(barX, smoothY - gaugeMaxH, barW, gaugeMaxH * 2);
        
        // Center mark
        ctx.fillStyle = isBrutalist ? '#000' : '#fff';
        ctx.fillRect(barX - 2, smoothY - 1, barW + 4, 2);

        // The Moving Bar
        ctx.fillStyle = ballColor;
        // If gaugeH is positive (Sharp), we draw from smoothY upwards (-gaugeH)
        // If gaugeH is negative (Flat), we draw from smoothY downwards
        // Since rect height must be positive, we handle coords:
        if (centsDev > 0) {
             // Sharp: Draw up
             ctx.fillRect(barX, smoothY - (centsDev/50)*gaugeMaxH, barW, (centsDev/50)*gaugeMaxH);
        } else {
             // Flat: Draw down
             ctx.fillRect(barX, smoothY, barW, Math.abs(centsDev/50)*gaugeMaxH);
        }

        // 4. Text Feedback (Large & Clear)
        const info = getNoteFromFrequency(smoothedPitchRef.current);
        const noteName = `${info.note}${info.octave}`;
        
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ballColor;
        
        // Current Note Name
        ctx.fillText(noteName, headX + 30, smoothY);
        
        // Deviation Text
        ctx.font = '12px Inter';
        const arrow = centsDev > 5 ? '⬆' : centsDev < -5 ? '⬇' : '🎯';
        const sign = centsDev > 0 ? '+' : '';
        const devText = `${arrow} ${sign}${Math.round(centsDev)} ct`;
        
        ctx.fillStyle = isBrutalist ? '#000' : '#e4e4e7';
        ctx.fillText(devText, headX + 30, smoothY + 16);
    }
  };

  const drawRapperVisuals = (
      ctx: CanvasRenderingContext2D, 
      canvas: HTMLCanvasElement, 
      dataArray: Float32Array, 
      rms: number, 
      theme: AppTheme
    ) => {
    
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const isBrutalist = theme === 'brutalist';

    // Beat Pulse Effect
    const beatPulse = beatStateRef.current.active ? beatStateRef.current.decay * 20 : 0;
    
    // Bass Shake (Camera Shake effect based on Volume)
    let shakeX = 0;
    let shakeY = 0;
    if (rms > 0.3) { 
        const intensity = (rms - 0.3) * 20;
        shakeX = (Math.random() - 0.5) * intensity;
        shakeY = (Math.random() - 0.5) * intensity;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Mirrored Spectrum Bars
    const bars = 64; 
    const barWidth = w / bars / 2;
    
    for (let i = 0; i < bars; i++) {
        const val = dataArray[i * 2]; 
        let percent = (val + 80) / 60; 
        percent = Math.max(0, Math.min(1, percent));
        
        const barHeight = percent * (h / 2);
        
        let hue = i * 4 + (rms * 100);
        
        if (isBrutalist) {
            ctx.fillStyle = '#000000';
        } else {
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        }

        ctx.fillRect(cx + (i * barWidth), cy - barHeight - beatPulse, barWidth - 1, barHeight);
        ctx.fillRect(cx + (i * barWidth), cy + beatPulse, barWidth - 1, barHeight);
        ctx.fillRect(cx - ((i + 1) * barWidth), cy - barHeight - beatPulse, barWidth - 1, barHeight);
        ctx.fillRect(cx - ((i + 1) * barWidth), cy + beatPulse, barWidth - 1, barHeight);
    }

    const radius = 50 + (rms * 200) + beatPulse;
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = isBrutalist ? '#FF00FF' : `rgba(139, 92, 246, ${0.5 + rms})`; 
    ctx.lineWidth = isBrutalist ? 4 : 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, 2 * Math.PI);
    if (isBrutalist) {
        ctx.fillStyle = rms > 0.2 ? '#FF00FF' : '#000000';
    } else {
        const coreHue = rms > 0.2 ? 140 : 260; 
        ctx.fillStyle = `hsla(${coreHue}, 100%, 50%, 0.8)`;
    }
    ctx.fill();

    ctx.restore();
  };

  return <canvas ref={canvasRef} className={`${className} block touch-none`} />;
};

export default Visualizer;