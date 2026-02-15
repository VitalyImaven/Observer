"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Star,
  StarOff,
} from "lucide-react";
import type { Directive } from "@/types";

export default function DirectivesPage() {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDirectives = async () => {
    const res = await fetch("/api/directives");
    const data = await res.json();
    setDirectives(data);
    setLoading(false);
  };

  const fetchActiveDirective = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setActiveId(data.activeDirectiveId || null);
  };

  useEffect(() => {
    fetchDirectives();
    fetchActiveDirective();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    await fetch("/api/directives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, content: formContent }),
    });
    setFormName("");
    setFormContent("");
    setShowForm(false);
    fetchDirectives();
  };

  const handleUpdate = async (id: string) => {
    await fetch("/api/directives", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: formName, content: formContent }),
    });
    setEditingId(null);
    setFormName("");
    setFormContent("");
    fetchDirectives();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this directive?")) return;
    await fetch(`/api/directives?id=${id}`, { method: "DELETE" });
    if (activeId === id) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeDirectiveId: null }),
      });
      setActiveId(null);
    }
    fetchDirectives();
  };

  const handleSetActive = async (id: string) => {
    const newId = activeId === id ? null : id;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeDirectiveId: newId }),
    });
    setActiveId(newId);
  };

  const startEdit = (d: Directive) => {
    setEditingId(d.id);
    setFormName(d.name);
    setFormContent(d.content);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading directives...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Directives</h1>
            <p className="text-text-secondary text-sm">
              Instructions that guide how Observer responds during meetings
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormName("");
            setFormContent("");
          }}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Directive
        </button>
      </div>

      {/* Create / Edit Form */}
      {(showForm || editingId) && (
        <div className="bg-bg-secondary border border-border rounded-xl p-5 mb-6 animate-fade-in">
          <h3 className="font-medium mb-4">
            {editingId ? "Edit Directive" : "New Directive"}
          </h3>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Directive name (e.g., 'Confident & Concise')"
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="Write your directive instructions here...&#10;&#10;Example: Respond with confidence. Keep answers under 3 sentences. Focus on market size and traction metrics. Always mention competitive advantages."
            rows={6}
            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2 mt-3">
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
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex items-center gap-2 bg-bg-hover hover:bg-border text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Directives List */}
      {directives.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No directives yet</p>
          <p className="text-sm">
            Create directives to control how Observer responds during meetings
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {directives.map((d) => (
            <div
              key={d.id}
              className={`bg-bg-secondary border rounded-xl p-5 transition-all ${
                activeId === d.id
                  ? "border-accent bg-accent-dim"
                  : "border-border hover:border-border-light"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{d.name}</h3>
                    {activeId === d.id && (
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-2 whitespace-pre-wrap">
                    {d.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleSetActive(d.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      activeId === d.id
                        ? "text-accent hover:bg-accent/20"
                        : "text-text-muted hover:bg-bg-hover hover:text-warning"
                    }`}
                    title={
                      activeId === d.id
                        ? "Deactivate directive"
                        : "Set as active directive"
                    }
                  >
                    {activeId === d.id ? (
                      <Star className="w-4 h-4 fill-current" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(d)}
                    className="p-2 rounded-lg text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-2 rounded-lg text-text-muted hover:bg-danger-dim hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
