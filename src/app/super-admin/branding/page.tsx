"use client";

import { useState, useEffect } from "react";
import { Palette, Image, Type, Save, Loader2, Upload, Link as LinkIcon } from "lucide-react";

export default function BrandingPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [logoMode, setLogoMode] = useState<"url" | "base64">("url");
  const [faviconMode, setFaviconMode] = useState<"url" | "base64">("url");

  useEffect(() => {
    fetch("/api/super-admin/settings").then(r => r.json()).then(data => {
      setSettings(data.settings || {});
      if (data.settings?.logo_base64) setLogoMode("base64");
      if (data.settings?.favicon_base64) setFaviconMode("base64");
    }).finally(() => setLoading(false));
  }, []);

  function update(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  function handleFileUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { update(key, reader.result as string); };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/super-admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setMsg(res.ok ? "Branding saved successfully" : "Failed to save");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-xl sm:text-2xl font-display font-bold text-white">Branding & Theme</h1>
      <p className="text-sm text-slate-400 mt-1">Customize the look and feel of your application</p></div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      {/* App Identity */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Type className="w-4 h-4 text-brand-400" />Application Identity</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Application Name</label>
          <input value={settings.app_name || ""} onChange={e => update("app_name", e.target.value)} placeholder="MyAIDoctor.io" className="input-field" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Tagline</label>
          <input value={settings.app_tagline || ""} onChange={e => update("app_tagline", e.target.value)} placeholder="Clinical Context Engine" className="input-field" /></div>
        </div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Description</label>
        <textarea value={settings.app_description || ""} onChange={e => update("app_description", e.target.value)} rows={2}
          placeholder="AI-powered pre-visit preparation and clinic operations" className="input-field" /></div>
      </div>

      {/* Logo */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Image className="w-4 h-4 text-brand-400" />Logo</div>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setLogoMode("url")} className={`px-3 py-1 text-xs rounded-md ${logoMode === "url" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white bg-midnight-800"}`}>
            <LinkIcon className="w-3 h-3 inline mr-1" />URL
          </button>
          <button onClick={() => setLogoMode("base64")} className={`px-3 py-1 text-xs rounded-md ${logoMode === "base64" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white bg-midnight-800"}`}>
            <Upload className="w-3 h-3 inline mr-1" />Upload
          </button>
        </div>
        {logoMode === "url" ? (
          <input value={settings.logo_url || ""} onChange={e => update("logo_url", e.target.value)} placeholder="https://example.com/logo.png" className="input-field" />
        ) : (
          <div className="space-y-2">
            <input type="file" accept="image/*" onChange={e => handleFileUpload("logo_base64", e)} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-midnight-800 file:text-slate-200 hover:file:bg-midnight-700" />
          </div>
        )}
        {(settings.logo_url || settings.logo_base64) && (
          <div className="p-3 bg-midnight-800 rounded-lg"><p className="text-xs text-slate-500 mb-2">Preview:</p>
          <img src={logoMode === "base64" ? settings.logo_base64 : settings.logo_url} alt="Logo" className="h-12 object-contain" /></div>
        )}
      </div>

      {/* Favicon */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Image className="w-4 h-4 text-brand-400" />Favicon</div>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setFaviconMode("url")} className={`px-3 py-1 text-xs rounded-md ${faviconMode === "url" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white bg-midnight-800"}`}>URL</button>
          <button onClick={() => setFaviconMode("base64")} className={`px-3 py-1 text-xs rounded-md ${faviconMode === "base64" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white bg-midnight-800"}`}>Upload</button>
        </div>
        {faviconMode === "url" ? (
          <input value={settings.favicon_url || ""} onChange={e => update("favicon_url", e.target.value)} placeholder="https://example.com/favicon.ico" className="input-field" />
        ) : (
          <input type="file" accept="image/*" onChange={e => handleFileUpload("favicon_base64", e)} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-midnight-800 file:text-slate-200" />
        )}
      </div>

      {/* Theme Colors */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Palette className="w-4 h-4 text-brand-400" />Theme Colors</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[{ key: "theme_primary", label: "Primary / Brand", def: "#10b981" },
            { key: "theme_secondary", label: "Secondary", def: "#6366f1" },
            { key: "theme_background", label: "Background", def: "#0a0a1a" }].map(c => (
            <div key={c.key} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">{c.label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings[c.key] || c.def} onChange={e => update(c.key, e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-midnight-700 bg-transparent" />
                <input value={settings[c.key] || c.def} onChange={e => update(c.key, e.target.value)} className="input-field flex-1 font-mono text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Powered By */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Type className="w-4 h-4 text-brand-400" />Powered By Banner</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Banner Text</label>
          <input value={settings.powered_by_text || ""} onChange={e => update("powered_by_text", e.target.value)} placeholder="Powered by MyAIDoctor.io" className="input-field" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Banner Link URL</label>
          <input value={settings.powered_by_url || ""} onChange={e => update("powered_by_url", e.target.value)} placeholder="https://myaidoctor.io" className="input-field" /></div>
        </div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Login Page Message</label>
        <textarea value={settings.login_message || ""} onChange={e => update("login_message", e.target.value)} rows={2}
          placeholder="Welcome message displayed on the login page" className="input-field" /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-slate-400">Footer Text</label>
        <input value={settings.footer_text || ""} onChange={e => update("footer_text", e.target.value)} placeholder="© 2026 MyAIDoctor.io. All rights reserved." className="input-field" /></div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className="btn-primary py-3 px-8">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save All Branding Changes</>}
      </button>
    </div>
  );
}
