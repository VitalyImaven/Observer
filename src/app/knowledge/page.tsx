"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Upload,
  Trash2,
  FileText,
  FileImage,
  File,
  Loader2,
  Plus,
  Database,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { KnowledgeFile, KnowledgeBase } from "@/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type: string) {
  if (["pdf"].includes(type)) return FileText;
  if (["png", "jpg", "jpeg", "gif"].includes(type)) return FileImage;
  return File;
}

export default function KnowledgePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewKb, setShowNewKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [editKbName, setEditKbName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchKnowledgeBases = async () => {
    const res = await fetch("/api/knowledge-bases");
    const data = await res.json();
    setKnowledgeBases(data);
    return data as KnowledgeBase[];
  };

  const fetchFiles = async (kbId?: string | null) => {
    const url = kbId
      ? `/api/knowledge?knowledgeBaseId=${kbId}`
      : "/api/knowledge";
    const res = await fetch(url);
    const data = await res.json();
    setFiles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchKnowledgeBases().then((bases) => {
      if (bases.length > 0) {
        setSelectedKbId(bases[0].id);
        fetchFiles(bases[0].id);
      } else {
        fetchFiles();
      }
    });
  }, []);

  const handleSelectKb = (kbId: string | null) => {
    setSelectedKbId(kbId);
    fetchFiles(kbId);
  };

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    const res = await fetch("/api/knowledge-bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKbName }),
    });
    const newKb = await res.json();
    setNewKbName("");
    setShowNewKb(false);
    await fetchKnowledgeBases();
    handleSelectKb(newKb.id);
  };

  const handleRenameKb = async () => {
    if (!editingKbId || !editKbName.trim()) return;
    await fetch("/api/knowledge-bases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingKbId, name: editKbName }),
    });
    setEditingKbId(null);
    setEditKbName("");
    fetchKnowledgeBases();
  };

  const handleDeleteKb = async (kbId: string) => {
    if (!confirm("Delete this knowledge base and all its files?")) return;
    await fetch(`/api/knowledge-bases?id=${kbId}`, { method: "DELETE" });
    const bases = await fetchKnowledgeBases();
    if (selectedKbId === kbId) {
      const next = bases.length > 0 ? bases[0].id : null;
      setSelectedKbId(next);
      fetchFiles(next);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (selectedKbId) {
      formData.append("knowledgeBaseId", selectedKbId);
    }

    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchFiles(selectedKbId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file and its processed data?")) return;
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    fetchFiles(selectedKbId);
  };

  const selectedKbName = selectedKbId
    ? knowledgeBases.find((kb) => kb.id === selectedKbId)?.name
    : "All Files";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-text-secondary text-sm">
              Upload documents for Observer to learn from — organized by knowledge base
            </p>
          </div>
        </div>
      </div>

      {/* Knowledge Base Tabs */}
      <div className="bg-bg-secondary border border-border rounded-xl p-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="w-4 h-4 text-text-muted flex-shrink-0" />
          {knowledgeBases.map((kb) => (
            <div key={kb.id} className="flex items-center gap-0.5">
              {editingKbId === kb.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editKbName}
                    onChange={(e) => setEditKbName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameKb()}
                    className="bg-bg-primary border border-accent rounded px-2 py-1 text-xs w-32 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={handleRenameKb} className="p-1 text-success hover:bg-success-dim rounded">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setEditingKbId(null)} className="p-1 text-text-muted hover:bg-bg-hover rounded">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSelectKb(kb.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedKbId === kb.id
                      ? "bg-accent text-white"
                      : "bg-bg-hover text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {kb.name}
                </button>
              )}
              {selectedKbId === kb.id && editingKbId !== kb.id && (
                <>
                  <button
                    onClick={() => { setEditingKbId(kb.id); setEditKbName(kb.name); }}
                    className="p-1 text-text-muted hover:text-text-primary rounded"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteKb(kb.id)}
                    className="p-1 text-text-muted hover:text-danger rounded"
                    title="Delete KB"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}

          {showNewKb ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateKb()}
                placeholder="Name..."
                className="bg-bg-primary border border-accent rounded px-2 py-1 text-xs w-32 focus:outline-none"
                autoFocus
              />
              <button onClick={handleCreateKb} className="p-1 text-success hover:bg-success-dim rounded">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => { setShowNewKb(false); setNewKbName(""); }} className="p-1 text-text-muted hover:bg-bg-hover rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewKb(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-dim transition-colors"
            >
              <Plus className="w-3 h-3" />
              New KB
            </button>
          )}
        </div>
      </div>

      {/* Current KB info */}
      {selectedKbId && (
        <div className="text-xs text-text-muted mb-4">
          Uploading to: <span className="text-accent font-medium">{selectedKbName}</span>
          {" · "}Link this KB to a directive in the Directives page
        </div>
      )}

      {!selectedKbId && knowledgeBases.length > 0 && (
        <div className="text-xs text-warning mb-4">
          Select a knowledge base above to upload files to it
        </div>
      )}

      {knowledgeBases.length === 0 && (
        <div className="bg-warning-dim border border-warning/20 rounded-xl p-4 mb-6 text-sm text-warning">
          Create a knowledge base first by clicking &quot;New KB&quot; above, then upload documents to it.
        </div>
      )}

      {/* Upload Area */}
      {selectedKbId && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors ${
            uploading
              ? "border-accent bg-accent-dim"
              : "border-border hover:border-border-light"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            accept=".pdf,.txt,.md,.docx"
            className="hidden"
            id="file-upload"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-sm text-text-secondary">
                Processing file and creating embeddings...
              </p>
            </div>
          ) : (
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">
                Click to upload a document to &quot;{selectedKbName}&quot;
              </p>
              <p className="text-xs text-text-muted">
                Supports PDF, TXT, MD, DOCX
              </p>
            </label>
          )}
        </div>
      )}

      {/* Files List */}
      {files.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No documents{selectedKbId ? ` in "${selectedKbName}"` : ""}</p>
          <p className="text-sm">
            Upload your pitch deck, business plan, or other documents
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((f) => {
            const Icon = getFileIcon(f.type);
            return (
              <div
                key={f.id}
                className="bg-bg-secondary border border-border rounded-xl p-4 flex items-center gap-4 hover:border-border-light transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {f.originalName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatSize(f.size)} • {f.chunksCount} chunks •{" "}
                    {f.type.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="p-2 rounded-lg text-text-muted hover:bg-danger-dim hover:text-danger transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
