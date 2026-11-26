/**
 * Voice in and out, using what the phone already has (no servers, no audio leaves
 * the device except through Apple's/Google's own dictation service).
 *
 *  listen()  → speech-to-text via the Web Speech API. On iPhone this works in Safari
 *              and Home Screen apps on recent iOS; when unavailable we fall back to
 *              focusing the text field so the keyboard's 🎤 dictation key can be used.
 *  speak()   → text-to-speech. "Deep" picks a low male system voice and lowers pitch;
 *              "Female" picks a female system voice. Users can pick any installed voice.
 */
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const synth = globalThis.speechSynthesis;

export const VOICE_DEFAULTS = Object.freeze({ replies: 'voice', style: 'deep', voiceURI: null, rate: 1 });
export const voicePrefs = (settings) => ({ ...VOICE_DEFAULTS, ...(settings?.voice ?? {}) });
export const VOICE_STYLES = [
  { id: 'deep', label: 'Deep' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

// Known system voices by character (iOS / macOS / Android / Windows names).
const DEEP = ['Daniel', 'Arthur', 'Gordon', 'Aaron', 'Rocko', 'Ralph', 'Fred', 'Reed', 'Evan', 'Nathan', 'Tom', 'Alex', 'Google UK English Male', 'Microsoft Guy', 'Microsoft David'];
const MALE = ['Aaron', 'Evan', 'Nathan', 'Tom', 'Alex', 'Daniel', 'Reed', 'Google US English', 'Microsoft Guy', 'Microsoft David'];
const FEMALE = ['Samantha', 'Ava', 'Allison', 'Susan', 'Zoe', 'Nicky', 'Karen', 'Moira', 'Tessa', 'Serena', 'Kate', 'Martha', 'Google UK English Female', 'Microsoft Zira', 'Microsoft Aria', 'Microsoft Jenny'];
const STYLE_TUNING = { deep: { pitch: 0.55, rate: 0.92 }, male: { pitch: 0.9, rate: 1 }, female: { pitch: 1.05, rate: 1 } };

export const canSpeak = () => !!synth;
export const canListen = () => !!SR;

let voicesCache = [];
export function voices() {
  if (!synth) return [];
  const v = synth.getVoices().filter((x) => /^en(-|_|$)/i.test(x.lang));
  if (v.length) voicesCache = v;
  return voicesCache;
}
if (synth) synth.addEventListener?.('voiceschanged', voices);

function pickVoice(prefs) {
  const all = voices();
  if (prefs.voiceURI) { const v = all.find((x) => x.voiceURI === prefs.voiceURI); if (v) return v; }
  const wanted = prefs.style === 'female' ? FEMALE : prefs.style === 'male' ? MALE : DEEP;
  for (const name of wanted) {
    const v = all.find((x) => x.name === name || x.name.startsWith(name + ' ')) ?? all.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return all.find((x) => /male/i.test(x.name) === (prefs.style !== 'female')) ?? all[0] ?? null;
}

/** Strip things that sound bad read aloud. */
function speakable(text) {
  return String(text)
    .replace(/[*_#`>]/g, '')
    .replace(/\bkcal\b/g, 'calories').replace(/(\d)\s?g\b/g, '$1 grams').replace(/(\d)\s?oz\b/g, '$1 ounces')
    .replace(/(\d)\s?lb\b/g, '$1 pounds').replace(/·/g, ',').replace(/→/g, 'then').replace(/\s+/g, ' ').trim();
}

export function speak(text, prefs = VOICE_DEFAULTS) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  const v = pickVoice(prefs);
  if (v) { u.voice = v; u.lang = v.lang; }
  const t = STYLE_TUNING[prefs.style] ?? STYLE_TUNING.deep;
  u.pitch = t.pitch; u.rate = t.rate * (prefs.rate ?? 1);
  synth.speak(u);
}
export const stopSpeaking = () => synth?.cancel();

/**
 * Listen once. Returns a controller { stop() } or null when unsupported.
 * onPartial(text) fires while talking; onFinal(text) when done; onError(code).
 */
export function listen({ onPartial, onFinal, onError, onEnd } = {}) {
  if (!SR) return null;
  stopSpeaking();
  const r = new SR();
  r.lang = navigator.language || 'en-US';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript;
    }
    onPartial?.((finalText + interim).trim());
  };
  r.onerror = (e) => onError?.(e.error);
  r.onend = () => { if (finalText.trim()) onFinal?.(finalText.trim()); onEnd?.(); };
  try { r.start(); } catch { onError?.('start'); return null; }
  return { stop: () => { try { r.stop(); } catch { /* already stopped */ } } };
}
