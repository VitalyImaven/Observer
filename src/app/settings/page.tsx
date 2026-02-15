"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [chatModel, setChatModel] = useState("gpt-5.2");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [transcriptionModel, setTranscriptionModel] = useState("gpt-4o-transcribe");
  const [language, setLanguage] = useState("en");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.openaiApiKey) setApiKey(data.openaiApiKey);
        if (data.chatModel) setChatModel(data.chatModel);
        if (data.embeddingModel) setEmbeddingModel(data.embeddingModel);
        if (data.transcriptionModel) setTranscriptionModel(data.transcriptionModel);
        if (data.language) setLanguage(data.language);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    const body: Record<string, string> = {
      chatModel,
      embeddingModel,
      transcriptionModel,
      language,
    };
    if (apiKey && !apiKey.startsWith("sk-...")) {
      body.openaiApiKey = apiKey;
    }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-text-secondary text-sm">
            Configure your API keys and model preferences
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* API Key */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <label className="block text-sm font-medium mb-2">
            OpenAI API Key
          </label>
          <p className="text-xs text-text-muted mb-3">
            Used for answer generation, transcription, and embeddings. Get yours
            at{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              className="text-accent hover:underline"
            >
              platform.openai.com
            </a>
          </p>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Chat Model */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <label className="block text-sm font-medium mb-2">
            Chat Model (Answer Generation)
          </label>
          <p className="text-xs text-text-muted mb-3">
            The AI model that generates answers to investor questions and powers the Chat
          </p>
          <select
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="gpt-5.2">GPT-5.2 (Latest flagship, best quality)</option>
            <option value="gpt-5.2-pro">GPT-5.2 Pro (More compute, best answers)</option>
            <option value="gpt-5-mini">GPT-5 Mini (Faster, lower cost)</option>
            <option value="gpt-4o">GPT-4o (Previous gen, fast)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Previous gen, fastest)</option>
          </select>
        </div>

        {/* Transcription Model */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <label className="block text-sm font-medium mb-2">
            Transcription Model
          </label>
          <p className="text-xs text-text-muted mb-3">
            Converts speech to text during meetings
          </p>
          <select
            value={transcriptionModel}
            onChange={(e) => setTranscriptionModel(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="gpt-4o-transcribe">
              GPT-4o Transcribe (Best accuracy)
            </option>
            <option value="gpt-4o-mini-transcribe">
              GPT-4o Mini Transcribe (Faster)
            </option>
            <option value="whisper-1">Whisper v1 (Classic)</option>
          </select>
        </div>

        {/* Embedding Model */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <label className="block text-sm font-medium mb-2">
            Embedding Model
          </label>
          <p className="text-xs text-text-muted mb-3">
            Used for matching questions to prepared answers and knowledge
          </p>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="text-embedding-3-small">
              Text Embedding 3 Small (Fast, affordable)
            </option>
            <option value="text-embedding-3-large">
              Text Embedding 3 Large (Best quality)
            </option>
          </select>
        </div>

        {/* Language */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <label className="block text-sm font-medium mb-2">
            Meeting Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="en">English</option>
            <option value="he">Hebrew</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
          </select>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-xl transition-colors"
        >
          {saved ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
