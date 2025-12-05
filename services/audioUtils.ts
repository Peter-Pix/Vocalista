import { NOTES, MIN_VOCAL_FREQ, MAX_VOCAL_FREQ } from '../constants';

export const getNoteFromFrequency = (frequency: number) => {
  // Guard against infinity/NaN/Silence
  if (!frequency || frequency <= 0) return { note: '-', centsOff: 0, octave: 0, frequency: 0, midiNote: 0 };

  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const midiNote = Math.round(noteNum) + 69;
  const noteName = NOTES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  
  // Calculate cents deviation
  const targetFrequency = 440 * Math.pow(2, (midiNote - 69) / 12);
  const centsOff = Math.floor(1200 * Math.log2(frequency / targetFrequency));

  return {
    note: noteName,
    octave,
    centsOff,
    frequency,
    midiNote
  };
};

// --- ROBUST PITCH DETECTION ALGORITHM (Restricted Range) ---
// Uses Normalized Cross-Correlation (NCC) with strict human vocal bounds.
// Scans from High Frequency to Low Frequency to pick first valid peak.

export const autoCorrelate = (buffer: Float32Array, sampleRate: number, threshold: number = 0.01): number => {
  const size = buffer.length;

  // 1. RMS (Volume) Gate
  // Uses dynamic threshold passed from App (Sensitivity settings)
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);
  if (rms < threshold) return -1; 

  // 2. Determine Search Bounds (Lags) based on Vocal Range
  // High Freq (Small Lag) to Low Freq (Large Lag)
  const minLag = Math.floor(sampleRate / MAX_VOCAL_FREQ);
  const maxLag = Math.floor(sampleRate / MIN_VOCAL_FREQ);

  // 3. Normalized Cross-Correlation (NCC) logic
  let bestOffset = -1;
  let bestCorrelation = 0;
  
  // Threshold to consider a peak valid. 
  // Relaxed from 0.92 to 0.90 to be more forgiving of imperfect tones or mic quality
  const CORRELATION_THRESHOLD = 0.90; 

  // We scan from minLag (High Freq) upwards.
  // The first valid peak we encounter is likely the fundamental.
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sumXY = 0; 
    let sumXX = 0; 
    let sumYY = 0; 

    const searchLen = size - lag;
    if (searchLen < minLag) break; 

    for (let i = 0; i < searchLen; i++) {
      const x = buffer[i];
      const y = buffer[i + lag];
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
    }

    const denominator = Math.sqrt(sumXX * sumYY);
    if (denominator === 0) continue;

    const correlation = sumXY / denominator;

    if (correlation > CORRELATION_THRESHOLD) {
        // FOUND CANDIDATE.
        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = lag;
            
            // Optimization: If extremely strong match, break immediately.
            // This prevents skipping to the next harmonic.
            if (correlation > 0.96) {
                break;
            }
        }
    }
  }
  
  // 5. Parabolic Interpolation for Precision
  if (bestOffset !== -1) {
      const lag = bestOffset;
      
      const calcNCC = (l: number) => {
          let sXY=0, sXX=0, sYY=0;
          const len = size - l;
          for(let i=0; i<len; i++) {
              sXY += buffer[i] * buffer[i+l];
              sXX += buffer[i] * buffer[i];
              sYY += buffer[i+l] * buffer[i+l];
          }
          return sXY / Math.sqrt(sXX * sYY);
      };

      const prev = calcNCC(lag - 1);
      const curr = bestCorrelation; 
      const next = calcNCC(lag + 1);
      
      // Ensure it is a local peak
      if (curr >= prev && curr >= next) {
        const shift = (prev - next) / (2 * (prev - 2 * curr + next));
        const adjustedLag = lag + shift;
        const frequency = sampleRate / adjustedLag;
        
        // Final Bounds Check
        if (frequency >= MIN_VOCAL_FREQ && frequency <= MAX_VOCAL_FREQ) {
            return frequency;
        }
      }
  }

  return -1;
};

export const convertRawPCMToAudioBuffer = async (
  ctx: AudioContext,
  base64Data: string,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const int16Data = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(int16Data.length);
  
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }
  
  const audioBuffer = ctx.createBuffer(1, float32Data.length, sampleRate);
  audioBuffer.copyToChannel(float32Data, 0);
  
  return audioBuffer;
};