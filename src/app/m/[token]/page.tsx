"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Mic, MicOff, Send, Loader2, CheckCircle2, AlertCircle, Stethoscope, ArrowLeft, Shield, MessageCircle } from "lucide-react";
import { ServiceIcon } from "@/components/ServiceIcon";

interface Message { role: "bot" | "patient"; text: string; timestamp: string; options?: string[]; }

const SERVICE_PROMPTS: Record<string, string> = {
  pre_visit_intake: "You are conducting a pre-visit clinical intake. Follow the standard 10-phase protocol: consent, verify info, confirm appointment, chief complaint, symptom details (OLDCARTS), review of systems, medications, wellness screening (PHQ-2/GAD-2), additional concerns, review & submit.",
  referral_coordinator: "You are helping a patient with a referral. Ask about: which specialty they need, reason for referral, urgency level, symptoms, preferred location, insurance requirements. Generate a referral summary.",
  refill_manager: "You are processing a medication refill request. Ask about: which medication, current dose, pharmacy preference, remaining supply, any side effects, compliance. Check for safety concerns.",
  schedule_assistant: "You are helping a patient schedule, reschedule, or cancel an appointment. Ask about: what they need (new/reschedule/cancel), preferred dates and times, which provider, reason for visit.",
  new_patient_onboarding: "You are onboarding a new patient. Collect: demographics, full medical history, surgical history, family history, social history, medications, allergies, immunizations, insurance info.",
  chronic_disease_checkin: "You are doing a monthly chronic disease check-in. Ask about: current symptoms, vitals (blood sugar, BP if applicable), medication compliance, diet/exercise, any concerns. Compare with previous check-ins.",
  lab_results_review: "You are discussing lab results with a patient. Explain results in simple language, highlight any abnormal values, discuss what they mean, recommend follow-up if needed.",
  post_visit_followup: "You are conducting a post-visit follow-up. Ask about: symptom changes since visit, medication compliance, any side effects, any new concerns, whether they understood the care plan.",
  appointment_reminder: "You are confirming an upcoming appointment. Verify: date/time, provider, location. Ask if they plan to attend, need to reschedule, or have questions. Offer to start pre-visit intake.",
  appointment_scheduler: "You are helping schedule an appointment. Ask about: type of visit needed, urgency, preferred provider, preferred dates/times, reason for visit. Confirm the booking.",
};

export default function MobileLandingPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<any>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [state, setState] = useState<any>(null);
  const [complete, setComplete] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "validate", token }) })
      .then(r => r.json()).then(data => {
        if (data.valid) { setLinkData(data); startConversation(data); }
        else setError(data.error || "Invalid link");
      }).catch(() => setError("Unable to verify link"))
      .finally(() => setLoading(false));

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) { setVoiceSupported(true); const r = new SR(); r.continuous = false; r.interimResults = true; r.lang = "en-US"; r.onresult = (e: any) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); }; r.onend = () => setListening(false); recognitionRef.current = r; }
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  async function startConversation(data: any) {
    const serviceType = data.serviceType;
    const greeting = getGreeting(serviceType, data.patient?.firstName);
    addBotMsg(greeting.text, greeting.options);
    setState({ phase: "start", phaseStep: 0, data: { serviceType }, consentGiven: false, complete: false });
  }

  function getGreeting(serviceType: string, firstName: string) {
    const name = firstName || "there";
    const greetings: Record<string, { text: string; options?: string[] }> = {
      pre_visit_intake: { text: `Hi ${name}! 👋 I'm your MyAIDoctor assistant. Let's get you ready for your upcoming appointment. This takes about 8-12 minutes.\n\nYour responses will be shared with your provider under HIPAA protection. Do you agree to proceed?`, options: ["Yes, I agree", "Tell me more"] },
      referral_coordinator: { text: `Hi ${name}! I'm here to help with your referral request. I'll gather some information to connect you with the right specialist.\n\nDo you consent to sharing this information with your care team?`, options: ["Yes, let's go", "What's this about?"] },
      refill_manager: { text: `Hi ${name}! 💊 Need a medication refill? I can help with that. I'll ask a few questions and route your request to your provider.\n\nReady to start?`, options: ["Yes, I need a refill", "I have questions first"] },
      schedule_assistant: { text: `Hi ${name}! 📅 I can help you schedule, reschedule, or cancel an appointment. What would you like to do?`, options: ["Schedule new", "Reschedule", "Cancel appointment"] },
      new_patient_onboarding: { text: `Welcome ${name}! 👋 We're excited to have you as a new patient. I'll help collect your medical history and information. This takes about 15-20 minutes.\n\nReady to begin?`, options: ["Yes, let's start", "How long will this take?"] },
      chronic_disease_checkin: { text: `Hi ${name}! ❤️ Time for your monthly health check-in. I'll ask about how you've been feeling, your vitals, and medications.\n\nReady?`, options: ["Yes, let's check in", "Can we do this later?"] },
      lab_results_review: { text: `Hi ${name}! 🔬 Your lab results are in. I'll walk you through what they mean in simple terms.\n\nWould you like to review them now?`, options: ["Yes, show me", "I'll review later"] },
      post_visit_followup: { text: `Hi ${name}! 🩺 Checking in after your recent visit. How are you feeling? Any changes since your appointment?`, options: ["Feeling better", "About the same", "Feeling worse"] },
      appointment_reminder: { text: `Hi ${name}! ⏰ Just a reminder about your upcoming appointment. Can you confirm you'll be there?`, options: ["Yes, I'll be there", "I need to reschedule", "Cancel it"] },
      appointment_scheduler: { text: `Hi ${name}! 📆 Let's get you scheduled. What type of appointment do you need?`, options: ["Check-up", "Follow-up", "Urgent concern", "Something else"] },
    };
    return greetings[serviceType] || { text: `Hi ${name}! How can I help you today?`, options: ["Let's start"] };
  }

  function addBotMsg(text: string, options?: string[]) {
    setTyping(true);
    setTimeout(() => { setMessages(prev => [...prev, { role: "bot", text, timestamp: new Date().toISOString(), options }]); setTyping(false); }, Math.min(1500, text.length * 12));
  }

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || sending) return;
    setInput("");
    setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "bot" ? { ...m, options: undefined } : m));
    setMessages(prev => [...prev, { role: "patient", text: msg, timestamp: new Date().toISOString() }]);
    setSending(true);

    // Build service-specific system prompt
    const servicePrompt = SERVICE_PROMPTS[linkData.serviceType] || "";
    const res = await fetch("/api/patient/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "message", appointmentId: linkData.appointmentId || "",
        message: msg,
        history: [...messages, { role: "patient", text: msg, timestamp: new Date().toISOString() }],
        state: { ...state, servicePrompt },
      }),
    });
    const data = await res.json();
    setState(data.state);

    if (data.state?.complete) {
      addBotMsg(data.reply);
      setTimeout(async () => {
        if (linkData.appointmentId) {
          const submitRes = await fetch("/api/patient/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", appointmentId: linkData.appointmentId, history: messages }) });
          const submitData = await submitRes.json();
          setResult(submitData);
        }
        await fetch("/api/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", token }) });
        setComplete(true);
      }, 2000);
    } else if (data.exited) {
      addBotMsg(data.reply);
      setTimeout(() => setComplete(true), 2000);
    } else {
      addBotMsg(data.reply, data.options);
    }
    setSending(false);
  }

  if (loading) return <div className="min-h-screen bg-midnight-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  if (error) return (
    <div className="min-h-screen bg-midnight-950 flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">{error}</h1>
        <p className="text-sm text-slate-400">This link may have expired or already been used. Contact your clinic for a new link.</p>
      </div>
    </div>
  );

  if (complete) return (
    <div className="min-h-screen bg-midnight-950 flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <CheckCircle2 className="w-16 h-16 text-brand-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">All Done!</h1>
        <p className="text-sm text-slate-400">Your information has been securely submitted. Your care team will review it.</p>
        {result?.brief && <div className="card p-3 text-xs text-left space-y-1"><div className="flex justify-between"><span className="text-slate-500">Completion</span><span className="text-brand-300">{result.brief.completionRate}%</span></div></div>}
        <p className="text-xs text-slate-500">You can close this window.</p>
      </div>
    </div>
  );

  // ── Chat Interface ────────────────────────────────
  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-midnight-800/40 bg-midnight-950/90 backdrop-blur sticky top-0 z-10">
        <ServiceIcon type={linkData?.serviceType || "pre_visit_intake"} size="md" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">MyAIDoctor</p>
          <p className="text-[11px] text-slate-400">{linkData?.serviceLabel}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Shield className="w-3 h-3" />HIPAA Secure
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {messages.map((msg, i) => {
          const isBot = msg.role === "bot";
          const showAv = isBot && (i === 0 || messages[i - 1]?.role !== "bot");
          return (
            <div key={i} className={`flex items-end gap-1.5 ${isBot ? "justify-start" : "justify-end"}`}>
              {isBot && <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${showAv ? "bg-gradient-to-br from-brand-500 to-brand-700" : "invisible"}`}><Stethoscope className="w-3.5 h-3.5 text-white" /></div>}
              <div className={`max-w-[80%]`}>
                <div className={`px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm ${isBot ? "bg-midnight-800 text-slate-100 rounded-2xl rounded-bl-sm border border-midnight-700/40" : "bg-brand-600 text-white rounded-2xl rounded-br-sm"}`}>{msg.text}</div>
                {isBot && msg.options?.length && i === messages.length - 1 && !typing && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {msg.options.map(opt => <button key={opt} onClick={() => sendMessage(opt)} className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-brand-600/60 text-brand-300 bg-brand-950/40 hover:bg-brand-900/60 active:scale-95 transition-all">{opt}</button>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex items-end gap-1.5"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><Stethoscope className="w-3.5 h-3.5 text-white" /></div>
            <div className="bg-midnight-800 border border-midnight-700/40 rounded-2xl rounded-bl-sm px-4 py-3"><div className="flex gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" /><span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "200ms" }} /><span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "400ms" }} /></div></div></div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-2 py-2 border-t border-midnight-800/40 bg-midnight-950/90 backdrop-blur">
        <div className="flex items-end gap-1.5">
          {voiceSupported && <button onClick={() => { if (listening) { recognitionRef.current?.stop(); setListening(false); } else { setInput(""); recognitionRef.current?.start(); setListening(true); } }} className={`p-2 rounded-full flex-shrink-0 ${listening ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>{listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>}
          <div className="flex-1 bg-midnight-800 border border-midnight-700 rounded-3xl overflow-hidden">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMessage(); }} placeholder={listening ? "🎤 Listening..." : "Message..."} className="w-full px-4 py-2.5 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none" />
          </div>
          <button onClick={() => sendMessage()} disabled={!input.trim() || sending} className={`p-2 rounded-full flex-shrink-0 ${input.trim() ? "bg-brand-600 text-white" : "text-slate-600"}`}>{sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
        </div>
      </div>
    </div>
  );
}
