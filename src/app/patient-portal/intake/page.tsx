"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Send, Loader2, Phone, MessageCircle, CheckCircle2, AlertCircle, ArrowLeft, Stethoscope, Check, Volume2, VolumeX } from "lucide-react";

interface Message {
  role: "bot" | "patient";
  text: string;
  timestamp: string;
  options?: string[];
  status?: "sent" | "delivered" | "read";
}

export default function IntakePage() {
  return <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>}><IntakeChat /></Suspense>;
}

function IntakeChat() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") || "";

  const [mode, setMode] = useState<"choose" | "chat" | "call" | "calling" | "complete">("choose");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<any>(null);
  const [stateHistory, setStateHistory] = useState<{ state: any; messages: Message[] }[]>([]);
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const resultRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ active: boolean; provider: string; model?: string; message?: string } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<any>(null);
  const [callPhone, setCallPhone] = useState("");
  const [callResult, setCallResult] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<"female" | "male">("female");
  const [ttsSupported, setTtsSupported] = useState(false);
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [language, setLanguage] = useState("en");
  const [showLangPicker, setShowLangPicker] = useState(false);

  const LANGUAGES = [
    { code: "en", label: "English", flag: "🇺🇸", srLang: "en-US", ttsLang: "en-US" },
    { code: "es", label: "Español", flag: "🇪🇸", srLang: "es-ES", ttsLang: "es-ES" },
    { code: "fr", label: "Français", flag: "🇫🇷", srLang: "fr-FR", ttsLang: "fr-FR" },
    { code: "de", label: "Deutsch", flag: "🇩🇪", srLang: "de-DE", ttsLang: "de-DE" },
    { code: "hi", label: "हिन्दी", flag: "🇮🇳", srLang: "hi-IN", ttsLang: "hi-IN" },
    { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳", srLang: "pa-IN", ttsLang: "pa-IN" },
    { code: "zh", label: "中文", flag: "🇨🇳", srLang: "zh-CN", ttsLang: "zh-CN" },
    { code: "ar", label: "العربية", flag: "🇸🇦", srLang: "ar-SA", ttsLang: "ar-SA" },
    { code: "pt", label: "Português", flag: "🇧🇷", srLang: "pt-BR", ttsLang: "pt-BR" },
    { code: "ko", label: "한국어", flag: "🇰🇷", srLang: "ko-KR", ttsLang: "ko-KR" },
    { code: "ja", label: "日本語", flag: "🇯🇵", srLang: "ja-JP", ttsLang: "ja-JP" },
    { code: "vi", label: "Tiếng Việt", flag: "🇻🇳", srLang: "vi-VN", ttsLang: "vi-VN" },
    { code: "tl", label: "Tagalog", flag: "🇵🇭", srLang: "fil-PH", ttsLang: "fil-PH" },
    { code: "ru", label: "Русский", flag: "🇷🇺", srLang: "ru-RU", ttsLang: "ru-RU" },
    { code: "ur", label: "اردو", flag: "🇵🇰", srLang: "ur-PK", ttsLang: "ur-PK" },
  ];

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const r = new SR();
      r.continuous = false;
      r.interimResults = true;
      r.lang = currentLang.srLang;
      r.onresult = (e: any) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
      r.onend = () => setListening(false);
      recognitionRef.current = r;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) setTtsSupported(true);
  }, [language]);

  function speakText(text: string) {
    if (!ttsEnabled || !ttsSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.08;     // slightly quick — professional pace
    utterance.pitch = ttsVoice === "female" ? 1.0 : 0.9;  // natural pitch
    utterance.volume = 0.85;   // soft, not blaring
    utterance.lang = currentLang.ttsLang;

    const voices = window.speechSynthesis.getVoices();

    if (currentLang.code === "en" || currentLang.ttsLang.startsWith("en")) {
      // Prefer American English voices — ranked by quality
      const usVoices = voices.filter(v => v.lang === "en-US" || v.lang === "en_US");
      const femaleRank = ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Ava", "Allison", "Susan", "Karen"];
      const maleRank = ["Aaron", "Google US English Male", "Microsoft Guy", "Microsoft Davis", "Alex", "Tom", "Daniel", "Fred"];
      const ranking = ttsVoice === "female" ? femaleRank : maleRank;

      let picked: SpeechSynthesisVoice | null = null;
      for (const name of ranking) {
        const found = usVoices.find(v => v.name.includes(name));
        if (found) { picked = found; break; }
      }
      if (!picked && usVoices.length > 0) {
        // fallback: pick by gender heuristic on US voices
        picked = usVoices.find(v =>
          ttsVoice === "female"
            ? /female|woman|girl|samantha|ava|allison|susan|jenny|aria|zira/i.test(v.name)
            : /male|man|guy|aaron|tom|david|daniel|alex|davis|fred/i.test(v.name)
        ) || usVoices[0];
      }
      if (!picked) {
        // broader English fallback
        const enVoices = voices.filter(v => v.lang.startsWith("en"));
        picked = enVoices.find(v =>
          ttsVoice === "female"
            ? /female|samantha|victoria|karen|ava|moira/i.test(v.name)
            : /male|daniel|james|thomas|lee|oliver/i.test(v.name)
        ) || enVoices[0] || null;
      }
      if (picked) utterance.voice = picked;
    } else {
      // Non-English: find voices matching the language
      const langVoices = voices.filter(v => v.lang.startsWith(currentLang.code) || v.lang.startsWith(currentLang.ttsLang.split("-")[0]));
      const match = langVoices.find(v => ttsVoice === "female" ? /female|woman/i.test(v.name) : /male|man/i.test(v.name));
      if (match) utterance.voice = match;
      else if (langVoices.length > 0) utterance.voice = langVoices[0];
    }

    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  // Check AI status on mount
  useEffect(() => {
    fetch("/api/patient/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check_ai" }) })
      .then(r => r.json()).then(setAiStatus).catch(() => setAiStatus({ active: false, provider: "scripted" }));
    fetch("/api/voice-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) })
      .then(r => r.json()).then(setVoiceStatus).catch(() => {});
  }, []);

  async function startChat() {
    setMode("chat"); setLoading(true);
    const res = await fetch("/api/patient/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", appointmentId, language }) });
    const data = await res.json();
    setState(data.state);
    addBotMsg(data.reply, data.options);
    setLoading(false);
  }

  function addBotMsg(text: string, options?: string[]) {
    setTyping(true);
    const delay = Math.min(2000, Math.max(800, text.length * 12));
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "bot", text, timestamp: new Date().toISOString(), options }]);
      setTyping(false);
      speakText(text);
    }, delay);
  }

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;

    // ── Handle special bubbles (never sent to API) ───
    if (msg === "← Back") {
      if (stateHistory.length > 0) {
        const prev = stateHistory[stateHistory.length - 1];
        setStateHistory(h => h.slice(0, -1));
        setState(prev.state);
        setMessages(prev.messages);
      }
      return;
    }

    if (msg === "Bye 👋") {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "bot" ? { ...m, options: undefined } : m));
      const r = resultRef.current || result;
      if (r) {
        setResult(r);
        setMode("complete");
      } else {
        // Result not ready yet — redirect to portal
        window.location.href = "/patient-portal";
      }
      return;
    }

    if (msg === "← Wait, add something") {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "bot" ? { ...m, options: undefined } : m));
      setMessages(prev => [...prev, { role: "patient", text: "Wait, I want to add something", timestamp: new Date().toISOString(), status: "read" }]);
      const newState = { ...state, complete: false, phase: "additional", phaseStep: 0 };
      setState(newState);
      addBotMsg("Of course! What else would you like to add or update?", ["That's everything now", "← Back"]);
      return;
    }

    // ── Save snapshot for back navigation ────────────
    // Save a deep copy of current messages (with options intact) and state
    setStateHistory(h => [...h, {
      state: JSON.parse(JSON.stringify(state || {})),
      messages: JSON.parse(JSON.stringify(messages)),
    }]);

    // ── Build clean message history for API ──────────
    // Strip "← Back" from previous options to keep API history clean
    const cleanHistory = messages
      .filter(m => m.text !== "← Back")
      .map(m => ({ role: m.role, text: m.text, timestamp: m.timestamp }));
    cleanHistory.push({ role: "patient", text: msg, timestamp: new Date().toISOString() });

    // ── Update UI ────────────────────────────────────
    setInput("");
    setMessages(prev => {
      const updated = prev.map((m, i) => i === prev.length - 1 && m.role === "bot" ? { ...m, options: undefined } : m);
      return [...updated, { role: "patient", text: msg, timestamp: new Date().toISOString(), status: "sent" }];
    });

    // ── Call API ─────────────────────────────────────
    setLoading(true);
    try {
      const res = await fetch("/api/patient/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", appointmentId, message: msg, language, history: cleanHistory, state }),
      });
      const data = await res.json();
      setState(data.state);

      // Mark patient message as read
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "patient" ? { ...m, status: "read" } : m));

      if (data.state?.complete) {
        // Submit intake immediately in background (SOAP generation happens now)
        addBotMsg("Generating your clinical summary and submitting to your provider... 📋");
        // Save clean conversation history BEFORE adding system messages
        const cleanMsgs = [...messages, { role: "patient", text: msg, timestamp: new Date().toISOString() }]
          .filter((m: any) => m.text !== "← Back" && !m.text.includes("Generating your clinical"));
        try {
          const submitRes = await fetch("/api/patient/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "submit", appointmentId, history: cleanMsgs }),
          });
          const submitData = await submitRes.json();
          resultRef.current = submitData;
          setResult(submitData);
        } catch (e) { console.error("Submit error:", e); }
        // Now show the final message with Bye bubble
        setTimeout(() => {
          addBotMsg("Your provider will review everything before your appointment. You can view your responses anytime in **My Records** on your Patient Portal.\n\nTake care and see you soon! 😊", ["Bye 👋"]);
        }, 1500);
      } else if (data.exited) {
        addBotMsg(data.reply);
        fetch("/api/patient/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_progress", appointmentId, intake: { partialMessages: messages.length } }) }).catch(() => {});
        setTimeout(() => { window.location.href = "/patient-portal"; }, 3000);
      } else {
        // Add "← Back" to options if we have history to go back to
        const opts = data.options || [];
        const withBack = stateHistory.length > 0 && !opts.includes("← Back") ? [...opts, "← Back"] : opts;
        addBotMsg(data.reply, withBack);
      }
    } catch (e) {
      console.error("Chat error:", e);
      addBotMsg("I'm sorry, something went wrong. Please try again.", ["← Back"]);
    }
    setLoading(false);
  }

  async function submitIntake() {
    setLoading(true);
    const res = await fetch("/api/patient/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", appointmentId, history: messages }) });
    const data = await res.json();
    if (data.success) { setResult(data); setMode("complete"); }
    setLoading(false);
  }

  function toggleVoice() { if (listening) { recognitionRef.current?.stop(); setListening(false); } else { setInput(""); recognitionRef.current?.start(); setListening(true); } }

  function shouldShowAvatar(i: number) { return i === 0 || messages[i - 1]?.role !== "bot"; }
  function shouldShowTime(i: number) { return i === messages.length - 1 || messages[i + 1]?.role !== messages[i].role; }

  // ── Choose Mode ───────────────────────────────────
  if (mode === "choose") {
    return (
      <div className="max-w-sm w-full mx-auto space-y-5 py-10">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-400 to-teal-600 flex items-center justify-center mx-auto shadow-xl shadow-brand-900/40 ring-4 ring-brand-500/20">
            <Stethoscope className="w-9 h-9 text-white drop-shadow-sm" />
          </div>
          <h1 className="text-xl font-display font-bold text-white">Pre-Visit Check-In</h1>
          <p className="text-sm text-slate-400">Choose how you'd like to complete your intake</p>
          <p className="text-xs text-slate-600">About 8-12 minutes</p>
        </div>

        {/* Language Selector — compact dropdown */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-slate-500">Language:</span>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="input-field w-auto py-1.5 px-3 text-sm pr-8 rounded-lg">
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>
        <button onClick={startChat} className="w-full card-hover p-4 flex items-center gap-4 text-left">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 ring-2 ring-brand-500/20 flex items-center justify-center shadow-lg"><MessageCircle className="w-5 h-5 text-white drop-shadow-sm" /></div>
          <div><p className="font-medium text-white text-sm">Chat</p><p className="text-[11px] text-slate-400">Type or speak with AI assistant</p></div>
        </button>
        <button onClick={() => setMode("call")} className="w-full card-hover p-4 flex items-center gap-4 text-left">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-blue-500/20 flex items-center justify-center shadow-lg"><Phone className="w-5 h-5 text-white drop-shadow-sm" /></div>
          <div className="flex-1"><p className="font-medium text-white text-sm">Phone Call</p><p className="text-[11px] text-slate-400">AI calls you at your number</p></div>
          {voiceStatus?.configured && <span className="text-[10px] text-slate-500">{voiceStatus.costPerMin}/min</span>}
        </button>
        <a href="/patient-portal" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 justify-center pt-2"><ArrowLeft className="w-3 h-3" />Back</a>
      </div>
    );
  }

  // ── Call Mode — enter phone ───────────────────────
  if (mode === "call") {
    return (
      <div className="max-w-sm w-full mx-auto space-y-5 py-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-blue-500/20 flex items-center justify-center mx-auto shadow-xl"><Phone className="w-7 h-7 text-white drop-shadow-sm" /></div>
          <h2 className="text-lg font-display font-bold text-white">Receive a Call</h2>
          <p className="text-xs text-slate-400">Our AI assistant will call and walk you through the pre-visit questions.</p>
        </div>
        {voiceStatus?.configured ? (
          <div className="card p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Your phone number</label>
              <input value={callPhone} onChange={e => setCallPhone(e.target.value)} placeholder="(248) 555-1234" className="input-field text-center text-lg" />
            </div>
            <p className="text-[10px] text-slate-500 text-center">Powered by {voiceStatus.provider} · {voiceStatus.costPerMin}/min · ~10 min call</p>
            <button onClick={async () => {
              if (!callPhone) return; setMode("calling"); setLoading(true);
              const res = await fetch("/api/voice-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "call", appointmentId, phoneNumber: callPhone }) });
              setCallResult(await res.json()); setLoading(false);
            }} disabled={!callPhone} className="btn-primary w-full justify-center py-3 disabled:opacity-40"><Phone className="w-4 h-4" />Call Me Now</button>
          </div>
        ) : (
          <div className="card p-5 space-y-3 text-center">
            <p className="text-sm text-amber-300">Phone service not configured</p>
            <p className="text-xs text-slate-400">Admin needs to configure a voice provider in Settings → Voice AI.</p>
            <p className="text-[10px] text-slate-500">Recommended: Vapi.ai ($0.05/min) — cheapest option</p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={() => setMode("choose")} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Back</button>
          <button onClick={startChat} className="text-xs text-brand-400 hover:text-brand-300">Chat instead</button>
        </div>
      </div>
    );
  }

  // ── Calling — waiting for connection ──────────────
  if (mode === "calling") {
    return (
      <div className="max-w-sm w-full mx-auto space-y-5 py-10 text-center">
        {loading ? (
          <><Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto" /><h2 className="text-lg font-bold text-white">Placing your call...</h2><p className="text-sm text-slate-400">You should receive a call at {callPhone} shortly.</p></>
        ) : callResult?.success ? (
          <><Phone className="w-12 h-12 text-brand-400 mx-auto animate-pulse" /><h2 className="text-lg font-bold text-white">Call in Progress</h2><p className="text-sm text-slate-400">Answer your phone to begin the pre-visit intake.</p>
          <div className="card p-4 text-xs text-slate-500 space-y-1"><p>Provider: {callResult.provider}</p></div>
          <p className="text-[11px] text-slate-500">Your intake will be automatically saved when the call ends.</p><a href="/patient-portal" className="btn-primary inline-flex mt-4">Back to Portal</a></>
        ) : (
          <><AlertCircle className="w-12 h-12 text-red-400 mx-auto" /><h2 className="text-lg font-bold text-white">Could not place call</h2><p className="text-sm text-red-300">{callResult?.error}</p>
          {callResult?.setup && <div className="card p-4 text-xs text-slate-400 text-left space-y-2"><p className="font-semibold text-white">Setup Guide:</p>{Object.entries(callResult.setup).map(([p, info]: [string, any]) => <div key={p}><p className="text-brand-300">{p}</p><ol className="list-decimal ml-4 space-y-0.5">{info.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>)}</div>}
          <button onClick={() => setMode("call")} className="btn-secondary inline-flex mt-2"><ArrowLeft className="w-4 h-4" />Try again</button></>
        )}
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────
  if (mode === "complete" && result) {
    return (
      <div className="max-w-sm w-full mx-auto space-y-5 py-10 text-center">
        <CheckCircle2 className="w-16 h-16 text-brand-400 mx-auto" />
        <h1 className="text-xl font-display font-bold text-white">All Done!</h1>
        <p className="text-sm text-slate-400">Your intake has been submitted and a SOAP note has been generated for your provider.</p>
        <div className="card p-4 space-y-2 text-sm text-left">
          <div className="flex justify-between"><span className="text-slate-500">Completion</span><span className="text-brand-300 font-semibold">{result.brief?.completionRate}%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Risk</span><span className="text-white">{result.brief?.riskScore}/10</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Engine</span><span className="text-slate-300">{result.soapPreview?.generatedBy === "claude" ? "AI" : "Template"}</span></div>
          {result.emrSync && <div className="flex justify-between"><span className="text-slate-500">EMR Sync</span><span className={result.emrSync.synced ? "text-emerald-400" : "text-amber-400"}>{result.emrSync.synced ? "✓ Synced" : result.emrSync.mode === "mock" ? "Mock mode" : "Pending"}</span></div>}
          {result.brief?.redFlagCount > 0 && <div className="flex items-center gap-1.5 p-2 rounded bg-red-950/50 text-red-300 text-xs"><AlertCircle className="w-3.5 h-3.5" />{result.brief.redFlagCount} flag(s) — provider will be alerted</div>}
        </div>
        {result.soapPreview && (
          <div className="card p-4 space-y-1.5 text-left text-[11px] font-mono">
            <p className="text-[10px] text-slate-500 font-sans font-semibold uppercase">SOAP Note Sent to Provider</p>
            <p><span className="text-brand-400 font-bold">S:</span> <span className="text-slate-300">{result.soapPreview.subjective?.slice(0, 150)}...</span></p>
            <p><span className="text-brand-400 font-bold">A:</span> <span className="text-slate-300">{result.soapPreview.assessment?.slice(0, 100)}...</span></p>
          </div>
        )}
        <p className="text-xs text-slate-500">You can review your answers anytime in <span className="text-brand-400">My Records</span> on your Patient Portal.</p>
        <div className="flex gap-2 justify-center">
          <a href="/patient-portal" className="btn-primary">Back to Portal</a>
          <a href="/patient-portal/my-records" className="btn-secondary">View My Records</a>
        </div>
      </div>
    );
  }

  // ── Chat ──────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-lg mx-auto">
      {/* Header — WhatsApp-style */}
      <div className="flex items-center gap-3 px-2 py-2.5 border-b border-midnight-800/40 bg-midnight-950/90 backdrop-blur sticky top-0 z-10">
        <a href="/patient-portal" className="p-1 text-slate-500 hover:text-slate-300"><ArrowLeft className="w-5 h-5" /></a>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-teal-600 ring-2 ring-brand-500/20 flex items-center justify-center shadow-lg">
          <Stethoscope className="w-5 h-5 text-white drop-shadow-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">MyAIDoctor</p>
          <p className="text-[11px] text-brand-400 leading-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 inline-block" />
            {typing ? "typing..." : state?.phase?.replace(/_/g, " ") || "online"}
          </p>
        </div>
        {/* Language Picker */}
        <div className="relative">
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-midnight-700/50 text-slate-400 hover:text-white hover:border-brand-500/50 transition-colors"
            title="Change language">
            <span>{currentLang.flag}</span>
            <span className="hidden sm:inline">{currentLang.label}</span>
          </button>
          {showLangPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLangPicker(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 max-h-64 overflow-y-auto bg-midnight-900 border border-midnight-700 rounded-xl shadow-2xl z-50 p-1">
                <p className="px-2 py-1 text-[9px] text-slate-500 font-semibold uppercase">Select Language</p>
                {LANGUAGES.map(lang => (
                  <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${language === lang.code ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-midnight-800"}`}>
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {lang.code !== "en" && <span className="text-[9px] text-slate-500 ml-auto">{lang.code.toUpperCase()}</span>}
                  </button>
                ))}
                <div className="px-2 py-1.5 border-t border-midnight-700/50 mt-1">
                  <p className="text-[9px] text-slate-600">Mix languages freely. SOAP notes always in English.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* TTS Controls */}
        {ttsSupported && (
          <div className="flex items-center gap-1.5 relative">
            <button onClick={() => { setTtsEnabled(!ttsEnabled); if (ttsEnabled) window.speechSynthesis.cancel(); }}
              className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-midnight-800/60"}`}
              title={ttsEnabled ? "Voice on — click to mute" : "Voice off — click to enable"}>
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {ttsEnabled && (
              <button onClick={() => setTtsVoice(ttsVoice === "female" ? "male" : "female")}
                className="px-1.5 py-0.5 rounded text-[9px] font-medium border border-midnight-700/50 text-slate-400 hover:text-white hover:border-brand-500/50 transition-colors"
                title="Toggle voice gender">
                {ttsVoice === "female" ? "♀" : "♂"}
              </button>
            )}
          </div>
        )}
        {/* AI Status — green dot, hover for details */}
        {aiStatus && (
          <div className="relative group">
            <div className={`w-3 h-3 rounded-full cursor-help ${aiStatus.active ? "bg-brand-400 animate-pulse shadow-sm shadow-brand-400/50" : "bg-amber-400"}`} 
              title={aiStatus.active ? `AI: ${aiStatus.provider}` : "Scripted mode"} />
            <div className="absolute right-0 top-full mt-2 w-52 p-3 bg-midnight-900 border border-midnight-700 rounded-lg shadow-xl text-[10px] text-slate-400 hidden group-hover:block z-50 space-y-1">
              <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${aiStatus.active ? "bg-brand-400" : "bg-amber-400"}`} />
                {aiStatus.active ? "AI Connected" : "Scripted Mode"}
              </p>
              {aiStatus.provider && <p>Provider: <span className="text-slate-200">{aiStatus.provider}</span></p>}
              {aiStatus.model && <p>Model: <span className="text-slate-200 font-mono">{aiStatus.model}</span></p>}
              {aiStatus.message && <p className="text-amber-300">{aiStatus.message}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Messages — WhatsApp/iMessage style */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.02) 0%, transparent 70%)" }}>
        {messages.map((msg, i) => {
          const isBot = msg.role === "bot";
          const showAv = isBot && shouldShowAvatar(i);
          const showTime = shouldShowTime(i);

          return (
            <div key={i} className={`flex items-end gap-1.5 ${isBot ? "justify-start" : "justify-end"}`}>
              {/* Bot avatar */}
              {isBot && (
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${showAv ? "bg-gradient-to-br from-brand-500 to-teal-600 ring-1 ring-brand-500/20 shadow-md" : "invisible"}`}>
                  <Stethoscope className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              <div className={`max-w-[78%] ${isBot ? "" : "order-1"}`}>
                {/* Bubble */}
                <div className={`px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm ${
                  isBot
                    ? "bg-midnight-800 text-slate-100 rounded-2xl rounded-bl-sm border border-midnight-700/40"
                    : "bg-brand-600 text-white rounded-2xl rounded-br-sm"
                }`} style={{ wordBreak: "break-word" }}>
                  {msg.text}
                </div>

                {/* Time + read receipt */}
                {showTime && (
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${isBot ? "" : "justify-end"}`}>
                    <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    {!isBot && msg.status && (
                      <span className="flex">
                        <Check className={`w-3 h-3 ${msg.status === "read" ? "text-brand-400" : "text-slate-600"}`} />
                        {(msg.status === "delivered" || msg.status === "read") && <Check className={`w-3 h-3 -ml-1.5 ${msg.status === "read" ? "text-brand-400" : "text-slate-600"}`} />}
                      </span>
                    )}
                  </div>
                )}

                {/* Quick replies */}
                {isBot && msg.options && msg.options.length > 0 && i === messages.length - 1 && !typing && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {msg.options.map((opt, oi) => {
                      const isBack = opt === "← Back";
                      const isBye = opt === "Bye 👋";
                      const isAddMore = opt === "← Wait, add something";
                      return (
                        <button key={`${opt}-${oi}`} onClick={() => sendMessage(opt)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-medium border active:scale-95 transition-all ${
                            isBack ? "border-slate-600/40 text-slate-400 bg-slate-800/30 hover:bg-slate-700/40 hover:text-slate-200" :
                            isBye ? "border-emerald-600/60 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60" :
                            isAddMore ? "border-amber-600/60 text-amber-300 bg-amber-950/40 hover:bg-amber-900/60" :
                            "border-brand-600/60 text-brand-300 bg-brand-950/40 hover:bg-brand-900/60"
                          }`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-end gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-600 ring-1 ring-brand-500/20 shadow-md flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-midnight-800 border border-midnight-700/40 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "200ms" }} />
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — iMessage/WhatsApp style */}
      <div className="px-2 py-2 border-t border-midnight-800/40 bg-midnight-950/90 backdrop-blur">
        <div className="flex items-end gap-1.5">
          {voiceSupported && (
            <button onClick={toggleVoice}
              className={`p-2 rounded-full flex-shrink-0 transition-all ${listening ? "bg-red-600 text-white scale-110" : "text-slate-400 hover:text-white"}`}>
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <div className="flex-1 bg-midnight-800 border border-midnight-700 rounded-3xl flex items-end overflow-hidden">
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={listening ? "🎤 Listening..." : "Message..."}
              rows={1}
              className="flex-1 px-4 py-2.5 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none"
              style={{ minHeight: "40px", maxHeight: "120px" }} />
          </div>
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className={`p-2 rounded-full flex-shrink-0 transition-all ${input.trim() ? "bg-brand-600 text-white hover:bg-brand-500 scale-100" : "text-slate-600 scale-90"}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {listening && <p className="text-[11px] text-red-400 text-center mt-1 animate-pulse">🎤 Listening...</p>}
      </div>
    </div>
  );
}
