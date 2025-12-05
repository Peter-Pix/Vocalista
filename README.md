# 🎤 Vokalista

**Vokalista** je moderní webová aplikace pro trénink hlasu, která kombinuje analýzu zvuku v reálném čase s umělou inteligencí (Google Gemini). Aplikace slouží zpěvákům, rapperům i mluvčím ke zlepšení intonace, rytmiky a artikulace.

## ✨ Klíčové Funkce

*   **3 Režimy tréninku:**
    *   🎵 **Zpěvák:** Trénink intonace, stupnic a hlasového rozsahu.
    *   🎤 **Rapper:** Cvičení na flow, rytmickou přesnost a dech.
    *   🗣️ **Mluvčí:** Rétorika, artikulace a tempo řeči.
*   **Real-time Visualizer:** Okamžitá vizuální zpětná vazba (spektrogram, pitch detection).
*   **AI Kouč (Gemini 2.5):** Po každém cvičení obdržíte personalizovanou zpětnou vazbu na základě vašeho výkonu.
*   **Audio Nástroje:** Integrovaný metronom, referenční tóny a TTS (Text-to-Speech) ukázky cvičení.
*   **Statistiky:** Sledování pokroku v čase pomocí grafů.
*   **Mobile-First Design:** Aplikace se chová jako nativní appka na iOS i Androidu.

## 🛠️ Použité Technologie

*   **Frontend:** React 19, TypeScript
*   **Styling:** Tailwind CSS, Lucide Icons
*   **Audio:** Web Audio API (Oscillators, AnalyserNode, AudioContext)
*   **AI:** Google Gemini API (`@google/genai`)
*   **Vizualizace dat:** Recharts, HTML5 Canvas

## 🚀 Instalace a Spuštění

1.  **Klonování repozitáře:**
    ```bash
    git clone https://github.com/Peter-Pix/vokalista.git
    cd vokalista
    ```

2.  **Instalace závislostí:**
    ```bash
    npm install
    ```

3.  **Konfigurace prostředí:**
    Vytvořte soubor `.env` v kořenovém adresáři a přidejte svůj API klíč pro Google Gemini:
    ```env
    API_KEY=vás_google_gemini_api_klic
    ```

4.  **Spuštění:**
    ```bash
    npm start
    ```
    Aplikace poběží na `http://localhost:3000` (nebo jiném portu dle vašeho bundleru).

## 📱 Použití na mobilu

Aplikace je optimalizovaná pro PWA (Progressive Web App) zážitek.
*   Otevřete v prohlížeči na mobilu.
*   Přidejte na plochu ("Add to Home Screen").
*   Aplikace se spustí v celoobrazovkovém režimu bez adresního řádku.

## 🤝 Přispívání

Pull requesty jsou vítány. Pro větší změny prosím nejprve otevřete issue k diskuzi o tom, co byste rádi změnili.

## 📄 Licence

[MIT](https://choosealicense.com/licenses/mit/)
