"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Save, ChevronDown, ChevronUp, Check, DollarSign,
  Building2, Shield, AlertTriangle, Trash2,
} from "lucide-react";
import { PIPELINE_LAYERS, estimateCostPerMinute, PipelineLayer, ProviderDef } from "@/lib/voice-pipeline";

interface SavedConfig {
  layer: string;
  provider: string;
  config: Record<string, string>;
  clinicId: string | null;
}

export default function VoicePipelinePage() {
  const [saved, setSaved] = useState<SavedConfig[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Local state for each layer's selection
  const [selections, setSelections] = useState<Record<string, { provider: string; config: Record<string, string> }>>({});

  // Override state
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrideClinic, setOverrideClinic] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/super-admin/voice-pipeline");
    const data = await res.json();
    setSaved(data.configs || []);
    setClinics(data.clinics || []);
    setOverrides(data.clinicOverrides || []);

    // Initialize selections from saved configs
    const sel: Record<string, { provider: string; config: Record<string, string> }> = {};
    for (const layer of PIPELINE_LAYERS) {
      const cfg = (data.configs || []).find((c: any) => c.layer === layer.key);
      sel[layer.key] = cfg
        ? { provider: cfg.provider, config: (cfg.config as Record<string, string>) || {} }
        : { provider: layer.providers[0]?.id || "", config: {} };
    }
    setSelections(sel);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectProvider(layerKey: string, providerId: string) {
    setSelections((s) => ({ ...s, [layerKey]: { provider: providerId, config: {} } }));
  }

  function updateConfig(layerKey: string, fieldKey: string, value: string) {
    setSelections((s) => ({
      ...s,
      [layerKey]: { ...s[layerKey], config: { ...s[layerKey].config, [fieldKey]: value } },
    }));
  }

  async function saveLayer(layerKey: string) {
    const sel = selections[layerKey];
    if (!sel) return;
    setSaving(layerKey);
    const res = await fetch("/api/super-admin/voice-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", layer: layerKey, provider: sel.provider, config: sel.config }),
    });
    if (res.ok) { setMsg(`${layerKey} saved`); load(); }
    else { const d = await res.json(); setMsg(d.error); }
    setSaving(null);
    setTimeout(() => setMsg(""), 3000);
  }

  async function saveOverride(clinicId: string, layerKey: string, providerId: string, config: Record<string, string>) {
    await fetch("/api/super-admin/voice-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", clinicId, layer: layerKey, provider: providerId, config }),
    });
    load();
  }

  async function deleteOverride(clinicId: string, layerKey: string) {
    await fetch("/api/super-admin/voice-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", clinicId, layer: layerKey }),
    });
    load();
  }

  const costEstimate = estimateCostPerMinute(
    Object.entries(selections).map(([layer, s]) => ({ layer, provider: s.provider }))
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white">Voice AI Pipeline</h1>
          <p className="text-sm text-slate-400 mt-1">Configure providers for each layer of the voice AI stack</p>
        </div>
        <div className="card px-4 py-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-brand-400" />
          <div>
            <p className="text-xs text-slate-500">Estimated cost</p>
            <p className="text-sm font-mono font-semibold text-brand-300">{costEstimate}</p>
          </div>
        </div>
      </div>

      {msg && <div className="p-3 rounded-lg bg-brand-950/50 border border-brand-800/40 text-sm text-brand-300">{msg}</div>}

      {/* Pipeline Layers */}
      <div className="space-y-3">
        {PIPELINE_LAYERS.map((layer, idx) => {
          const sel = selections[layer.key];
          const isExpanded = expanded === layer.key;
          const currentProvider = layer.providers.find((p) => p.id === sel?.provider);
          const isSaved = saved.some((s) => s.layer === layer.key && s.provider === sel?.provider);

          return (
            <div key={layer.key} className="card overflow-hidden">
              {/* Layer header */}
              <button onClick={() => setExpanded(isExpanded ? null : layer.key)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-midnight-800/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-700/30 flex items-center justify-center text-brand-400 font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{layer.label}</p>
                  <p className="text-xs text-slate-500">{layer.description}</p>
                </div>
                <div className="text-right mr-2">
                  <span className="badge bg-midnight-800 text-slate-300">{currentProvider?.name || "Not set"}</span>
                  {currentProvider?.hipaa && <span className="badge bg-brand-900/50 text-brand-300 ml-1 text-[10px]">HIPAA</span>}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              {/* Expanded config */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-midnight-800/50 pt-4">
                  {/* Provider selection */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {layer.providers.map((provider) => (
                      <button key={provider.id}
                        onClick={() => selectProvider(layer.key, provider.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          sel?.provider === provider.id
                            ? "border-brand-500 bg-brand-950/50"
                            : "border-midnight-700/50 hover:border-midnight-600"
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{provider.name}</span>
                          {sel?.provider === provider.id && <Check className="w-4 h-4 text-brand-400" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{provider.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-mono text-brand-400">{provider.cost}</span>
                          {provider.hipaa && <Shield className="w-3 h-3 text-brand-500" />}
                          {!provider.hipaa && provider.id !== "mock" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Provider note */}
                  {currentProvider?.note && (
                    <p className="text-xs text-slate-400 bg-midnight-800/40 p-2 rounded">💡 {currentProvider.note}</p>
                  )}

                  {/* Config fields */}
                  {currentProvider && currentProvider.fields.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentProvider.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-400">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                          </label>
                          {field.type === "select" ? (
                            <select value={sel?.config[field.key] || ""}
                              onChange={(e) => updateConfig(layer.key, field.key, e.target.value)}
                              className="input-field text-xs">
                              <option value="">Select...</option>
                              {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : (
                            <input type={field.type === "password" ? "password" : "text"}
                              value={sel?.config[field.key] || ""}
                              onChange={(e) => updateConfig(layer.key, field.key, e.target.value)}
                              placeholder={field.placeholder || ""}
                              className="input-field text-xs" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save button */}
                  <button onClick={() => saveLayer(layer.key)} disabled={saving === layer.key}
                    className="btn-primary text-xs py-1.5">
                    {saving === layer.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {isSaved ? "Update" : "Save"} {layer.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-Clinic Overrides */}
      <div className="card p-5 space-y-4">
        <button onClick={() => setShowOverrides(!showOverrides)}
          className="flex items-center gap-2 text-sm font-semibold text-white w-full">
          <Building2 className="w-4 h-4 text-brand-400" />
          Per-Clinic Overrides ({overrides.length} configured)
          {showOverrides ? <ChevronUp className="w-4 h-4 ml-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 ml-auto text-slate-500" />}
        </button>

        {showOverrides && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Override the global pipeline for specific clinics. Unset layers fall back to the global default.</p>

            {/* Existing overrides */}
            {overrides.length > 0 && (
              <div className="space-y-2">
                {overrides.map((ov, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-midnight-800/40 text-xs">
                    <span className="text-slate-300 font-medium">{(ov as any).clinic?.name || ov.clinicId}</span>
                    <span className="text-slate-500">{ov.layer}</span>
                    <span className="badge bg-midnight-700 text-slate-300">{ov.provider}</span>
                    <button onClick={() => deleteOverride(ov.clinicId!, ov.layer)}
                      className="ml-auto p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Add override */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500">Clinic</label>
                <select value={overrideClinic} onChange={(e) => setOverrideClinic(e.target.value)} className="input-field text-xs">
                  <option value="">Select clinic...</option>
                  {clinics.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {PIPELINE_LAYERS.slice(0, 3).map((layer) => (
                <div key={layer.key} className="space-y-1">
                  <label className="text-[11px] text-slate-500">{layer.label}</label>
                  <select className="input-field text-xs" id={`ov-${layer.key}`} defaultValue="">
                    <option value="">Use global default</option>
                    {layer.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={() => {
              if (!overrideClinic) return;
              PIPELINE_LAYERS.forEach((layer) => {
                const el = document.getElementById(`ov-${layer.key}`) as HTMLSelectElement;
                if (el?.value) {
                  saveOverride(overrideClinic, layer.key, el.value, {});
                }
              });
            }} disabled={!overrideClinic} className="btn-primary text-xs py-1.5 disabled:opacity-50">
              <Save className="w-3 h-3" />Save Override
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
