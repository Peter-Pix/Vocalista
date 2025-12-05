import { GoogleGenAI, Modality } from "@google/genai";
import { UserMode, SessionResult } from "../types";

// CIRCUIT BREAKER STATE
// If the AI fails once (or key is missing), we disable it for the session to prevent errors.
let aiCircuitBreakerOpen = false;

const initGenAI = () => {
  if (aiCircuitBreakerOpen) return null;

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY missing. AI features disabled.");
    aiCircuitBreakerOpen = true;
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// FALLBACK FEEDBACK GENERATOR (Offline Mode)
const getFallbackFeedback = (score: number, mode: UserMode): string => {
  if (score >= 90) {
    return "Fantastický výkon! Tvoje technika je na profesionální úrovni. Udržuj tuto kvalitu.";
  } else if (score >= 75) {
    return "Velmi dobrá práce. Jsi na správné cestě, jen tak dál. Soustřeď se na detaily.";
  } else if (score >= 50) {
    return "Dobrá snaha. Je tam prostor pro zlepšení, zejména v konzistenci. Zkus to znovu a uvolněně.";
  } else if (score >= 25) {
    return "Nevzdávej to. Začátky jsou těžké. Soustřeď se na základní techniku a dýchání.";
  } else {
    return "Zkus to znovu. Ujisti se, že jsi v klidném prostředí a mikrofon je správně nastaven.";
  }
};

export const generateAudioExample = async (
  mode: UserMode,
  text: string
): Promise<string | null> => {
  // Silent fail if AI is down
  if (aiCircuitBreakerOpen) return null;

  try {
    const ai = initGenAI();
    if (!ai) return null;
    
    // Select voice based on mode
    let voiceName = 'Fenrir'; // Default Deep/Male
    if (mode === UserMode.SINGER) voiceName = 'Kore'; // Soprano-ish/Female
    if (mode === UserMode.SPEAKER) voiceName = 'Puck'; // Clear/Neutral

    let instruction = "";
    if (mode === UserMode.RAPPER) instruction = "Rapuj tento text s důrazem na rytmus: ";
    if (mode === UserMode.SINGER) instruction = "Zazpívej tento text melodicky: ";
    if (mode === UserMode.SPEAKER) instruction = "Přečti tento text s jasnou a profesionální artikulací: ";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: instruction + text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.warn("Gemini TTS Failed. Switching to offline mode.", error);
    aiCircuitBreakerOpen = true; // Trip the breaker
    return null;
  }
};

// Map of specific goals for each exercise ID to guide the AI
const SPECIFIC_GOALS: Record<string, string> = {
    // SINGER
    's_pitch_game': 'KRITICKÉ: Analyzuj poměr trefených tónů. Pokud je skóre < 60, uživatel nemá vycvičený sluch - doporuč zpomalit. Pokud je skóre > 90, pochval rychlost reakce.',
    's_freestyle': 'Sleduj stabilitu tónu v čase. Pokud křivka kolísá (Stability < 60), tón není opřený o dech. Křivka by měla být hladká. Pokud je intonace (avgPitchDeviation) blízko 0, chval sluch.',
    's_scale_maj': 'Zaměř se na čistotu intervalů. Pokud je odchylka > 15 centů, upozorni, že stupnice "plave". Pokud je < 10 centů, je to studiová kvalita.',
    's_breath_box': 'Relaxace. Zde nehodnoť přísně. Pokud mikrofon zachytil hluk (Participation > 20%), upozorni uživatele, že při zádrži má být ticho.',
    's_breath_hiss': 'ANALÝZA PROUDU VZDUCHU: Klíčová je "Stabilita" (RhythmConsistency). Pokud je Doba (Duration) dlouhá (>30s), ale Stabilita nízká (<70), je to ŠPATNĚ - znamená to, že syčení kolísá a dechová opora selhává. Chval pouze kombinaci Dlouhý čas + Vysoká stabilita.',
    's_warmup_1': 'Uvolnění rtů. Pokud je stabilita nízká, rty se lepí nebo dochází dech. Zvuk musí být kontinuální "brrr".',
    's_range_test': 'Povzbuzení. Pokud byl rozsah malý, doporuč uvolnit krk. Pokud byl velký, chval odvahu jít do výšek.',

    // RAPPER
    'r_boombap': 'Strike on beat! Sleduj "Participation" (Flow) - pokud je nízká (<60%), rapper vynechává doby. Rytmická stabilita musí být > 80, jinak vypadává z rytmu.',
    'r_trap_drill': 'Kadence a artikulace. Pokud Participation klesá v čase, nestíhá tempo. Energie (Hlasitost) musí být agresivní a konzistentní.',
    'r_breath_control': 'Efektivita nádechu. Pokud jsou "díry" v grafu delší než zlomek vteřiny, nádech je pomalý. Musí to být bleskové.',
    'r_breath_stamina': 'Konzistence energie. Pokud ke konci (posledních 10s) klesá hlasitost, dochází "stamina". Upozorni na to.',
    'r_modern': 'Melodický rap. Kombinace rytmu a lehké intonace.',

    // SPEAKER
    'sp_articulation': 'Srozumitelnost. Pokud je Energie nízká, uživatel mumlá. Musí otvírat ústa. Stabilita < 60 znamená, že polyká koncovky slov.',
    'sp_breath_deep': 'Klid. Dýchání do břicha. Zde nehodnoť hlasitost, ale pravidelnost.',
    'sp_breath_count': 'DŮLEŽITÉ: Cílem je mluvit NA JEDEN NÁDECH. Pokud "Active Time" skončí dříve než časovač (např. po 20s), uživateli došel dech - TO JE CHYBA. Hlasitost (Energie) nesmí klesat s vyššími čísly.',
    'sp_pacing': 'Pomalé tempo. Zde je nižší "Participation" (cca 60-70%) ZNAKEM ÚSPĚCHU, protože to znamená, že uživatel dělá pauzy. Pokud je 100%, mluví moc rychle!',
    'sp_projection': 'Hlasitost bez křiku. Energie pod 60 je málo. Hlas musí nést prostorem. Stabilita musí být vysoká (nekolísat).',
};

export const generateMotivationalFeedback = async (mode: UserMode): Promise<string> => {
   if (aiCircuitBreakerOpen) return "Dobrá práce! Konzistence je klíčem k úspěchu.";

   try {
     const ai = initGenAI();
     if (!ai) return "Skvělé, že trénuješ! Jen tak dál.";

     const prompt = `
     Jsi Vokalista, podporující hlasový kouč.
     Uživatel trénuje pravidelně, ale momentálně nevyžaduje detailní analýzu.
     
     Tvým úkolem je:
     1. POCHVÁLIT KONZISTENCI a odhodlání.
     2. NEHODNOTIT konkrétní výkon (nevíš detaily).
     3. Být krátký, pozitivní a energický.
     4. Použít oslovení pro ${mode === UserMode.RAPPER ? 'Rappera' : mode === UserMode.SINGER ? 'Zpěváka' : 'Řečníka'}.
     
     Odpověz česky, maximálně 2 věty.
     `;

     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
     });
     
     return response.text || "Skvělá série! Konzistence je to nejdůležitější.";
   } catch (e) {
     return "Jen tak dál! Trénink dělá mistra.";
   }
};

export const generateSessionFeedback = async (
  mode: UserMode,
  exerciseId: string,
  exerciseName: string,
  exerciseDescription: string,
  stats: SessionResult['stats'] & { participationPct?: number, singingDurationSeconds?: number }
): Promise<string> => {
  
  // Calculate a rough score to determine fallback message if AI fails
  const consistencyScore = stats.rhythmConsistency || 0;
  const participationScore = stats.participationPct || 0;
  // A rough approximation of the final score logic from App.tsx to select the right fallback message
  const approximateScore = (consistencyScore + participationScore) / 2;

  // 1. Check Circuit Breaker
  if (aiCircuitBreakerOpen) {
    return getFallbackFeedback(approximateScore, mode);
  }

  try {
    const ai = initGenAI();
    if (!ai) {
        // If init fails (e.g. no key), open breaker and fallback
        aiCircuitBreakerOpen = true;
        return getFallbackFeedback(approximateScore, mode);
    }

    // Specific context override
    const specificContext = SPECIFIC_GOALS[exerciseId] || "Cílem je zlepšení techniky dle popisu cvičení.";

    // Handle silence case specifically depending on exercise type
    if (stats.participationPct !== undefined && stats.participationPct < 10) {
       // Exception for breathing exercises where silence might be part of instruction (though usually not for the active part)
       if (!exerciseId.includes('breath_box')) {
           return "Nebyl detekován téměř žádný hlas. Zkontroluj mikrofon, nebo se do toho příště víc opři! Bez zvuku nelze hodnotit.";
       }
    }

    // Determine Pitch Tendency (Only relevant for Singer usually)
    let pitchTendency = "N/A";
    if (stats.avgPitchDeviation && mode === UserMode.SINGER) {
        if (stats.avgPitchDeviation < -15) pitchTendency = "Tendence být pod tónem (FLAT). Více dechové opory!";
        else if (stats.avgPitchDeviation > 15) pitchTendency = "Tendence být nad tónem (SHARP). Uvolni krk.";
        else pitchTendency = "Intonace je skvělá, držíš se středu.";
    }

    // Determine Metric Labels based on Mode
    let consistencyLabel = "Stabilita tónu";
    let pitchInfo = `Intonace: ${stats.avgPitchDeviation || 0} centů. (${pitchTendency})`;
    
    if (mode === UserMode.RAPPER) {
        consistencyLabel = "Rytmická přesnost (Flow Consistency)";
        pitchInfo = "Intonace: Není relevantní pro Rap (Soustřeď se na rytmus).";
    } else if (mode === UserMode.SPEAKER) {
        consistencyLabel = "Konzistence tempa (Pacing Stability)";
        pitchInfo = "Intonace: Není relevantní (Soustřeď se na melodii řeči a důraz).";
    }

    let prompt = `
    Jsi Vokalista, upřímný, ale motivační hlasový kouč. Tvým úkolem je dát uživateli zpětnou vazbu na právě dokončené cvičení.
    
    KONTEXT CVIČENÍ:
    - Název: "${exerciseName}"
    - Popis pro uživatele: "${exerciseDescription}"
    - Režim: ${mode}
    - SPECIFICKÁ KRITÉRIA ÚSPĚCHU: ${specificContext}

    NAMĚŘENÁ DATA:
    1. Aktivní čas projevu (Duration): ${stats.singingDurationSeconds?.toFixed(1)} sekund.
    2. Účast (Participation): ${stats.participationPct?.toFixed(1)}% (Poměr času zpěvu vs. celkový čas).
    3. ${consistencyLabel} (Score 0-100): ${stats.rhythmConsistency ? stats.rhythmConsistency.toFixed(1) : 0}.
       * U 's_breath_hiss' toto znamená stabilitu proudu vzduchu. Pokud je číslo nízké, dech kolísá.
       * U RAPPERA/SPEAKERA toto číslo ukazuje, jak stabilní je jejich projev. Pokud je < 50, znamená to výpadky v rytmu nebo kolísání energie.
    4. ${pitchInfo}

    INSTRUKCE PRO ODPOVĚĎ:
    - Zaměř se na SPECIFICKÝ CÍL cvičení (viz výše). 
    - Analyzuj VZTAH mezi metrikami (např. "Máš dlouhý výdech, ALE kolísá ti stabilita" = musíš zapracovat na opoře).
    - PRO RAPPERY: Důrazně hodnoť Flow a Rytmus. 
    - PRO SPEAKERY: Důrazně hodnoť Plynulost a Srozumitelnost.
    - Buď upřímný. Pokud data ukazují chybu (např. krátký čas u cvičení na výdrž), řekni to narovinu.
    - Použij "sendvičovou metodu": (1. Ocenění snahy/energie -> 2. Konkrétní kritika chyby -> 3. Motivační výzva).
    - Mluv přímo k uživateli (přátelské tykání).
    - Maximálně 3-4 věty. Stručně a úderně.
    - Odpovídej česky.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || getFallbackFeedback(approximateScore, mode);
  } catch (error) {
    console.warn("Gemini API Error (Circuit Breaker Triggered):", error);
    aiCircuitBreakerOpen = true; // Open the breaker for future calls
    return getFallbackFeedback(approximateScore, mode);
  }
};