import { Exercise, UserMode, Note } from './types';

// In Czech music theory, standard B is often called H, and Bb is B. 
// For simplicity in chromatic scale, we usually use H for the 12th semitone.
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

// Strict Vocal Range Limits (Human voice fundamental frequencies)
// Widened to cover Bass (E2 approx 82Hz) to Soprano High D (D6 approx 1175Hz)
// This prevents octave errors (jumping to G1 or G7) but allows full human expression.
export const MIN_VOCAL_FREQ = 75; 
export const MAX_VOCAL_FREQ = 1150;

export const SCALES: Record<string, string[]> = {
  'CHROMATIC': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'],
  'C_MAJOR': ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  'G_MAJOR': ['G', 'A', 'H', 'C', 'D', 'E', 'F#'],
  'A_MINOR': ['A', 'H', 'C', 'D', 'E', 'F', 'G'],
  'F_MAJOR': ['F', 'G', 'A', 'A#', 'C', 'D', 'E'],
};

// Helper to create notes
const n = (name: string, octave: number, frequency: number): Note => ({ name, octave, frequency });

// C Major Scale (C4 to G4 and back)
const SCALE_TARGETS = [
  n('C', 4, 261.63),
  n('D', 4, 293.66),
  n('E', 4, 329.63),
  n('F', 4, 349.23),
  n('G', 4, 392.00),
  n('F', 4, 349.23),
  n('E', 4, 329.63),
  n('D', 4, 293.66),
  n('C', 4, 261.63),
];

// Game Targets (Easy Range C3 - C5)
export const GAME_NOTES = [
  n('C', 3, 130.81), n('D', 3, 146.83), n('E', 3, 164.81), n('F', 3, 174.61), n('G', 3, 196.00), n('A', 3, 220.00), n('H', 3, 246.94),
  n('C', 4, 261.63), n('D', 4, 293.66), n('E', 4, 329.63), n('F', 4, 349.23), n('G', 4, 392.00), n('A', 4, 440.00)
];

export const EXERCISES: Record<UserMode, Exercise[]> = {
  [UserMode.SINGER]: [
    {
      id: 's_pitch_game',
      title: 'Hra: Trefování tónů',
      description: 'Zábavná hra na trénink sluchu a intonace. Aplikace zahraje tón, vy ho musíte trefit.',
      instructions: 'Interaktivní hra pro rozvoj hudebního sluchu.\n\n1. Vyberte režim: "Náhodně" (aplikace vybírá tóny) nebo "Manuálně" (vybíráte vy na klaviatuře).\n2. V manuálním režimu si můžete zvolit stupnici (např. C Dur).\n3. Poslouchejte přehraný tón.\n4. Zpívejte tón do mikrofonu.\n5. Sledujte nápovědu (šipky), zda jste vysoko nebo nízko.\n6. Když se trefíte, ozve se signál a skóre se zvýší.',
      exampleText: 'Poslouchej tón... a teď ho zazpívej přesně stejně.',
      type: 'scale',
      difficulty: 'hard',
      durationSeconds: 180,
    },
    {
      id: 's_freestyle',
      title: 'Volný styl (Freestyle)',
      description: 'Zpívejte libovolně. Aplikace analyzuje vaše tóny a zobrazuje historii posledních 7 tónů na stupnici.',
      instructions: 'V tomto režimu máte naprostou svobodu.\n\n1. Zpívejte libovolnou melodii.\n2. Sledujte vizualizaci a bubliny v dolní části.\n3. Zelená barva značí čistý tón (odchylka < 15 centů).\n4. Snažte se udržet stabilní tón, aby se křivka v grafu co nejméně vlnila.',
      exampleText: 'La la la, zkouším svůj hlas, nahoru a dolů.',
      type: 'scale',
      difficulty: 'medium',
      durationSeconds: 120, // Explicitly 120 seconds (2 minutes)
    },
    {
      id: 's_scale_maj',
      title: 'Přesnost durové stupnice',
      description: 'Zpívejte C-D-E-F-G-F-E-D-C. Aplikace vám přehraje tón do sluchátek. Trefte se do zeleného!',
      instructions: 'Trénink intonační přesnosti na durové stupnici (C4-G4).\n\n1. Aplikace přehraje cílový tón.\n2. Zopakujte tón co nejpřesněji.\n3. Pokud se trefíte (zelená zóna), aplikace se automaticky posune na další tón.\n4. Stupnice jde nahoru a poté zpět dolů.',
      exampleText: 'C, D, E, F, G, F, E, D, C. Do Re Mi Fa Sol Fa Mi Re Do.',
      type: 'scale',
      difficulty: 'medium',
      durationSeconds: 60,
      targetNotes: SCALE_TARGETS
    },
    {
      id: 's_breath_box',
      title: 'Krabicové dýchání',
      description: 'Relaxační technika pro kontrolu dechu. Nádech 4s, zádrž 4s, výdech 4s, zádrž 4s.',
      instructions: 'Technika "Box Breathing" pro rozvoj kapacity a brániční kontroly.\n\n1. **Brániční nádech (4s):** Položte si ruku na břicho. Při nádechu nosem se ruka musí zvedat, ramena zůstávají dole. Vzduch směřujte "do pásu".\n2. **Zádrž (4s):** Udržujte pocit rozšířených žeber, neuzavírejte hrdlo křečovitě.\n3. **Výdech (4s):** Plynule vydechujte ústy přes uvolněné rty. Břicho se pomalu vrací zpět.\n4. **Zádrž (4s):** Krátká relaxace před dalším cyklem.\n\nToto cvičení učí oddělit pohyb bránice od hrudníku, což je nezbytné pro silný tón.',
      exampleText: 'Nádech... dva... tři... čtyři. Drž... dva... tři... čtyři. Výdech...',
      type: 'rhythm',
      difficulty: 'easy',
      durationSeconds: 60,
      bpm: 0
    },
    {
      id: 's_breath_hiss',
      title: 'Syčení na výdrž',
      description: 'Zhluboka se nadechněte a vydechujte na souhlásku "S". Udržujte zvuk co nejdéle a nejrovnoměrněji.',
      instructions: 'Cvičení na "Dechovou oporu" (Appoggio) - základ silného zpěvu.\n\n1. **Příprava:** Stůjte vzpřímeně, hrudník otevřený. Hluboce se nadechněte do břicha a boků (spodní žebra).\n2. **Akce:** Začněte syčet ostré "Sssss". Představte si, že vzduch vychází pod tlakem z úzké trysky.\n3. **Opora:** Břišní svaly pracují proti bránici a udržují konstantní vnitřní tlak. Nesmíte povolit napětí v těle, dokud nedojde vzduch.\n4. **Cíl:** Zvuk musí být naprosto rovný, bez kolísání hlasitosti (tremola). Tím se buduje stabilita tónu.',
      exampleText: 'Nádech... a sssssssssssssssssssssssss.',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 45,
      bpm: 0
    },
    {
      id: 's_warmup_1',
      title: 'Základní trilky rty',
      description: 'Uvolněte rty a zapojte brániční oporu. Klouzejte hlasem nahoru a dolů o kvintu.',
      instructions: 'Základní uvolňovací cvičení (Lip Trill).\n\n1. Uvolněte rty a tváře.\n2. Vyfoukněte vzduch přes sevřené rty, aby se rozkmitaly (zvuk "brrr").\n3. Přidejte hlas a klouzejte po tónech nahoru a dolů.\n4. Udržujte konstantní proud vzduchu z bránice.',
      exampleText: 'Brrr, brrr, uvolni rty a zhluboka se nadechni.',
      type: 'scale',
      difficulty: 'easy',
      durationSeconds: 30,
    },
    {
      id: 's_range_test',
      title: 'Test hlasového rozsahu',
      description: 'Klouzejte (glissando) od nejnižšího pohodlného tónu až po nejvyšší tón ve falzetu.',
      instructions: 'Zjistěte svůj aktuální hlasový rozsah.\n\n1. Začněte hluboko, kam až pohodlně dosáhnete.\n2. Plynule klouzejte hlasem výš a výš (jako siréna).\n3. Pokračujte až do nejvyšších tónů (falzetu).\n4. Nesnažte se jít přes bolest nebo silný tlak.',
      exampleText: 'Ááááááááá... odspodu až nahoru.',
      type: 'range',
      difficulty: 'easy',
      durationSeconds: 20,
    },
  ],
  [UserMode.RAPPER]: [
    {
      id: 'r_boombap',
      title: 'Rovný Boom Bap Flow',
      description: 'Klasický hip-hop rytmus 90. let. Důraz na první dobu a stabilní osminové noty. Držte se přesně na "kick" a "snare".',
      instructions: 'Trénink rytmické stability (90 BPM).\n\n1. Poslouchejte beat (kopák a virbl).\n2. Rapujte nebo rytmicky dýchejte do rytmu.\n3. Důraz dávejte na doby 1, 2, 3, 4.\n4. Představte si, že váš hlas je součástí bicí soupravy.',
      exampleText: 'Raz, dva, tři a čtyři, kopák a virbl, držím ten rytmus, takhle se to dělá, stará škola hraje.',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 60,
      bpm: 90,
    },
    {
      id: 'r_trap_drill',
      title: 'Trap, Drill & Grime',
      description: 'Rychlejší tempo a synkopy. Trénujte trioly (triplets) a sklouzávání mimo dobu (off-beat) s následným návratem.',
      instructions: 'Pokročilá rytmika s rychlejším tempem (140 BPM).\n\n1. Tempo je rychlé, vyžaduje ostrou artikulaci.\n2. Zkoušejte "double-time" (dvojnásobná rychlost) nebo trioly.\n3. Sledujte vizuální pulz beatu.\n4. Udržujte energii vysoko.',
      exampleText: 'Rychle-teď, rychle-teď, triola triola, skáču do beatu a měním flow.',
      type: 'rhythm',
      difficulty: 'hard',
      durationSeconds: 60,
      bpm: 140,
    },
    {
      id: 'r_breath_control',
      title: 'Dechová kontrola ve flow',
      description: 'Trénujte krátké, efektivní nádechy mezi frázemi. Rapujte 4 takty, krátký nádech, 4 takty.',
      instructions: 'Naučte se krást vzduch (Micro-breaths).\n\n1. Rapujte nebo říkejte "ta-ta-ta" v rychlém tempu.\n2. Každé 4 sekundy udělejte bleskový nádech nosem nebo ústy.\n3. Nádech nesmí zpomalit rytmus.\n4. Udržujte hrudník stabilní, dýchejte do břicha.',
      exampleText: 'Jedna dva tři čtyři, pět šest sedm osm (nádech) Jedna dva tři čtyři...',
      type: 'rhythm',
      difficulty: 'hard',
      durationSeconds: 60,
      bpm: 90
    },
    {
      id: 'r_breath_stamina',
      title: 'Dechová výdrž (Stamina)',
      description: 'Rytmické dýchání pro zvýšení kapacity. 2 krátké nádechy, 1 dlouhý výdech.',
      instructions: 'Zvyšte svou kapacitu pro dlouhé sloky.\n\n1. Dvakrát krátce vdechněte nosem (sniff-sniff).\n2. Dlouze a silně vydechněte ústy (shhh).\n3. Opakujte v rytmu.\n4. Cítíte, jak se zapojuje bránice.',
      exampleText: 'Nádech, nádech, výdech... Nádech, nádech, výdech...',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 45,
      bpm: 0
    },
    {
      id: 'r_modern',
      title: 'Moderní Rytmika',
      description: 'Střední tempo populární v moderním pop-rapu. Důraz na čistou artikulaci a melodické frázování.',
      instructions: 'Moderní, melodičtější styl rapu (110 BPM).\n\n1. Kombinujte rytmický přednes s lehkou melodií.\n2. Soustřeďte se na "flow" - plynulost projevu.\n3. Nejde jen o rychlost, ale o výraz a barvu hlasu.',
      exampleText: 'Melodie a slova jdou ruku v ruce, moderní styl, čistý projev.',
      type: 'rhythm',
      difficulty: 'easy',
      durationSeconds: 60,
      bpm: 110,
    },
    {
      id: 'r_breath_1',
      title: 'Brániční pulz (Kick)',
      description: 'Krátké, ostré výdechy na "TS-TS-TS-TS". Udržujte stabilní rytmus bez hudebního podkladu.',
      instructions: 'Izolované cvičení na ovládání bránice.\n\n1. Nadechněte se do břicha.\n2. Dělejte krátké, ostré výdechy na slabiku "TS".\n3. S každým "TS" by se mělo břicho zpevnit/vtáhnout.\n4. Nepohybujte rameny ani hrudníkem.',
      exampleText: 'Ts, ts, ts, ts. Krátce a ostře.',
      type: 'rhythm',
      difficulty: 'easy',
      durationSeconds: 30,
      bpm: 0, 
    },
  ],
  [UserMode.SPEAKER]: [
    {
      id: 'sp_articulation',
      title: 'Artikulace a přednes',
      description: 'Čtěte nahlas libovolný text. Soustřeďte se na jasné vyslovování souhlásek a stabilní hlasitost.',
      instructions: 'Cvičení pro zlepšení srozumitelnosti řeči.\n\n1. Čtěte text přehnaně výrazně.\n2. Otvírejte ústa více než obvykle.\n3. Aktivně používejte rty a jazyk.\n4. Vyslovujte precizně každou hlásku, zejména na koncích slov.',
      exampleText: 'Příliš žluťoučký kůň úpěl ďábelské ódy. Strč prst skrz krk.',
      type: 'articulation',
      difficulty: 'easy',
      durationSeconds: 60,
      bpm: 0,
    },
    {
      id: 'sp_breath_deep',
      title: 'Hluboké brániční dýchání',
      description: 'Základ pro silný hlas. Naučte se dýchat "do břicha", nikoliv do hrudníku.',
      instructions: 'Aktivace hlubokého dechového svalu.\n\n1. Položte si ruku na břicho (oblast pupíku).\n2. Pomalu se nadechujte nosem. Ruka na břiše by se měla zvedat.\n3. Hrudník a ramena se nesmí hýbat.\n4. Pomalu vydechujte ústy, ruka klesá.',
      exampleText: 'Nádech do břicha... ruka se zvedá. Výdech... ruka klesá.',
      type: 'rhythm',
      difficulty: 'easy',
      durationSeconds: 60,
      bpm: 0
    },
    {
      id: 'sp_breath_count',
      title: 'Odpočítávání na jeden dech',
      description: 'Zhluboka se nadechněte a počítejte nahlas co nejdále (1, 2, 3...). Sledujte, kam až dojdete.',
      instructions: 'Trénink hospodaření s dechem při řeči.\n\n1. Hluboký nádech.\n2. Začněte počítat nahlas, zřetelně a ve stejném tempu.\n3. Nevdechujte znovu.\n4. Snažte se dojít alespoň do 30 bez poklesu hlasitosti.',
      exampleText: 'Jedna, dva, tři, čtyři, pět, šest, sedm, osm, devět, deset...',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 45,
      bpm: 0
    },
    {
      id: 'sp_pacing',
      title: 'Klidné tempo řeči',
      description: 'Trénink pomalého, srozumitelného projevu. Snažte se mluvit plynule bez zbytečných pauz nebo zrychlování.',
      instructions: 'Trénink klidného a rozvážného tempa.\n\n1. Mluvte pomalu, nespěchejte.\n2. Dělejte vědomé pauzy na koncích vět.\n3. Soustřeďte se na to, aby posluchač stíhal vstřebávat informace.\n4. Dýchejte klidně a hluboce.',
      exampleText: 'Dobrý den, vítám vás u této prezentace. Dnes budeme mluvit klidně a srozumitelně.',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 90,
      bpm: 0,
    },
    {
      id: 'sp_projection',
      title: 'Projekce hlasu',
      description: 'Mluvte k "zadní řadě v sále". Udržujte vyšší hlasitost bez křiku, používejte bránici.',
      instructions: 'Trénink síly hlasu bez křiku.\n\n1. Představte si posluchače ve velké vzdálenosti (10m).\n2. Mluvte "do dálky" s využitím dechové opory.\n3. Hlas by měl znít plně a rezonovat, neměl by škrábat v krku.\n4. Udržujte vzpřímený postoj.',
      exampleText: 'Haló! Slyšíte mě i vzadu? Mluvím jasně a nahlas.',
      type: 'rhythm',
      difficulty: 'medium',
      durationSeconds: 45,
    }
  ],
};

export const COLOR_PALETTE = {
  primary: '#8b5cf6', // Violet 500
  secondary: '#10b981', // Emerald 500
  tertiary: '#0ea5e9', // Sky 500 (Speaker)
  danger: '#ef4444', // Red 500
  background: '#09090b',
  surface: '#18181b',
};