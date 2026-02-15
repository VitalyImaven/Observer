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
} from "lucide-react";
import type { KnowledgeFile } from "@/types";

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
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setFiles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

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
    fetchFiles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file and its processed data?")) return;
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    fetchFiles();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-text-secondary text-sm">
              Upload documents for Observer to learn from during meetings
            </p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
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
              Click to upload a document
            </p>
            <p className="text-xs text-text-muted">
              Supports PDF, TXT, MD, DOCX — Pitch decks, business plans, financials, etc.
            </p>
          </label>
        )}
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No documents uploaded</p>
          <p className="text-sm">
            Upload your pitch deck, business plan, or other documents to help
            Observer provide accurate answers
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
