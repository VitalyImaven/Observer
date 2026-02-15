"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Save,
  CheckSquare,
  Square,
} from "lucide-react";
import type { QAPair } from "@/types";
import { getTextDirection } from "@/lib/rtl";

interface GeneratedPair {
  question: string;
  answer: string;
  selected: boolean;
}

export default function QABankPage() {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formTags, setFormTags] = useState("");
  const [loading, setLoading] = useState(true);

  // AI Generation state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateCount, setGenerateCount] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPairs, setGeneratedPairs] = useState<GeneratedPair[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPairs = async () => {
    const res = await fetch("/api/qa");
    const data = await res.json();
    setPairs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPairs();
  }, []);

  // Manual CRUD
  const handleCreate = async () => {
    if (!formQuestion.trim() || !formAnswer.trim()) return;
    await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: formQuestion,
        answer: formAnswer,
        tags: formTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    resetForm();
    fetchPairs();
  };

  const handleUpdate = async (id: string) => {
    await fetch("/api/qa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        question: formQuestion,
        answer: formAnswer,
        tags: formTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    resetForm();
    fetchPairs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Q&A pair?")) return;
    await fetch(`/api/qa?id=${id}`, { method: "DELETE" });
    fetchPairs();
  };

  const startEdit = (p: QAPair) => {
    setEditingId(p.id);
    setFormQuestion(p.question);
    setFormAnswer(p.answer);
    setFormTags(p.tags.join(", "));
    setShowForm(false);
    setShowGenerate(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormQuestion("");
    setFormAnswer("");
    setFormTags("");
  };

  // AI Generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedPairs([]);
    try {
      const res = await fetch("/api/qa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatePrompt || undefined,
          count: generateCount,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else if (data.pairs) {
        setGeneratedPairs(
          data.pairs.map((p: { question: string; answer: string }) => ({
            ...p,
            selected: true,
          }))
        );
      }
    } catch {
      alert("Failed to generate Q&A pairs");
    }
    setIsGenerating(false);
  };

  const togglePairSelection = (index: number) => {
    setGeneratedPairs((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const toggleAllSelection = () => {
    const allSelected = generatedPairs.every((p) => p.selected);
    setGeneratedPairs((prev) =>
      prev.map((p) => ({ ...p, selected: !allSelected }))
    );
  };

  const handleSaveGenerated = async () => {
    const selected = generatedPairs.filter((p) => p.selected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/qa/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairs: selected.map((p) => ({
            question: p.question,
            answer: p.answer,
          })),
        }),
      });
      const data = await res.json();
      if (data.saved) {
        setGeneratedPairs([]);
        setShowGenerate(false);
        setGeneratePrompt("");
        fetchPairs();
      }
    } catch {
      alert("Failed to save Q&A pairs");
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading Q&A pairs...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Q&A Bank</h1>
            <p className="text-text-secondary text-sm">
              Pre-prepared answers matched to investor questions during meetings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowGenerate(true);
              setShowForm(false);
              setEditingId(null);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setShowGenerate(false);
              setEditingId(null);
              setFormQuestion("");
              setFormAnswer("");
              setFormTags("");
            }}
            className="flex items-center gap-2 bg-bg-secondary border border-border hover:border-border-light text-text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </button>
        </div>
      </div>

      {/* AI Generation Panel */}
      {showGenerate && (
        <div className="bg-bg-secondary border border-accent/30 rounded-xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-medium">Generate Q&A with AI</h3>
          </div>

          {generatedPairs.length === 0 ? (
            <>
              <p className="text-sm text-text-secondary mb-4">
                AI will generate realistic investor questions and craft the best
                answers using your Knowledge Base and active Directive.
              </p>
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="Optional: Describe what you want (e.g., 'Focus on SaaS metrics and unit economics' or 'Generate tough questions about competition and market risk')&#10;&#10;Leave empty for a comprehensive set covering all common VC topics."
                rows={3}
                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm resize-none mb-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-text-secondary">
                    Number of Q&A pairs:
                  </label>
                  <select
                    value={generateCount}
                    onChange={(e) => setGenerateCount(Number(e.target.value))}
                    className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating {generateCount} pairs...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowGenerate(false);
                    setGeneratedPairs([]);
                  }}
                  className="flex items-center gap-2 bg-bg-hover hover:bg-border text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Generated pairs preview */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-text-secondary">
                  <span className="text-accent font-medium">
                    {generatedPairs.length}
                  </span>{" "}
                  Q&A pairs generated.{" "}
                  <span className="text-text-muted">
                    Review and select which to save:
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAllSelection}
                    className="text-xs text-accent hover:underline"
                  >
                    {generatedPairs.every((p) => p.selected)
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-auto space-y-2 mb-4 pr-1">
                {generatedPairs.map((pair, i) => (
                  <div
                    key={i}
                    onClick={() => togglePairSelection(i)}
                    className={`rounded-lg p-3 border cursor-pointer transition-all ${
                      pair.selected
                        ? "bg-accent-dim border-accent/30"
                        : "bg-bg-primary border-border opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {pair.selected ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4 text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1" dir={getTextDirection(pair.question)}>
                          {pair.question}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-2" dir={getTextDirection(pair.answer)}>
                          {pair.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveGenerated}
                  disabled={
                    isSaving ||
                    generatedPairs.filter((p) => p.selected).length === 0
                  }
                  className="flex items-center gap-2 bg-success hover:bg-emerald-400 text-black px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving & creating embeddings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save {generatedPairs.filter((p) => p.selected).length}{" "}
                      pairs to Q&A Bank
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-bg-hover hover:bg-border text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
                <button
                  onClick={() => {
                    setGeneratedPairs([]);
                    setShowGenerate(false);
                  }}
                  className="flex items-center gap-2 bg-bg-hover hover:bg-border text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Create / Edit Form */}
      {(showForm || editingId) && (
        <div className="bg-bg-secondary border border-border rounded-xl p-5 mb-6 animate-fade-in">
          <h3 className="font-medium mb-4">
            {editingId ? "Edit Q&A Pair" : "New Q&A Pair"}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                Investor Question
              </label>
              <textarea
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="What question might the investor ask?"
                rows={2}
                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                Your Best Answer
              </label>
              <textarea
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                placeholder="Write the perfect answer you want to give..."
                rows={4}
                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                Tags (optional, comma-separated)
              </label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="market, traction, financials"
                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() =>
                editingId ? handleUpdate(editingId) : handleCreate()
              }
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              {editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-bg-hover hover:bg-border text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Q&A List */}
      {pairs.length === 0 && !showGenerate && !showForm ? (
        <div className="text-center py-16 text-text-muted">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No Q&A pairs yet</p>
          <p className="text-sm mb-6">
            Generate Q&A pairs with AI or add them manually. During meetings,
            Observer will match investor questions to your best answers.
          </p>
          <button
            onClick={() => setShowGenerate(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate your first Q&A set with AI
          </button>
        </div>
      ) : (
        pairs.length > 0 && (
          <div className="space-y-3">
            {pairs.map((p) => (
              <div
                key={p.id}
                className="bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-border-light transition-colors"
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === p.id ? null : p.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" dir={getTextDirection(p.question)}>{p.question}</p>
                    {p.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {p.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-bg-hover text-text-muted px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(p);
                      }}
                      className="p-2 rounded-lg text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="p-2 rounded-lg text-text-muted hover:bg-danger-dim hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedId === p.id ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </div>
                {expandedId === p.id && (
                  <div className="px-4 pb-4 border-t border-border pt-3 animate-fade-in">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
                      Answer
                    </p>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap" dir={getTextDirection(p.answer)}>
                      {p.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {pairs.length > 0 && (
        <div className="mt-6 text-center text-xs text-text-muted">
          {pairs.length} Q&A pair{pairs.length !== 1 ? "s" : ""} •{" "}
          {pairs.filter((p) => p.embedding).length} with embeddings (ready for
          matching)
        </div>
      )}
    </div>
  );
}
