"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Square,
  Trash2,
  Bot,
  User,
  Sparkles,
  BookOpen,
  MessageSquare,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getTextDirection } from "@/lib/rtl";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  savedAsQA?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [savingQA, setSavingQA] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsGenerating(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          useKnowledge,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "Error: Could not get a response. Check your API key in Settings.",
                }
              : m
          )
        );
        setIsGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                );
              }
            } catch {
              // Skip
            }
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Error: Failed to get response." }
              : m
          )
        );
      }
    }

    setIsGenerating(false);
  }, [input, messages, isGenerating, useKnowledge]);

  const stopGenerating = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsGenerating(false);
  };

  const clearChat = () => {
    if (isGenerating) stopGenerating();
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveAsQA = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.role !== "assistant" || !msg.content) return;

    setSavingQA(msgId);
    try {
      // First, use the parse API to extract Q&A pairs from the message
      const parseRes = await fetch("/api/qa/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content }),
      });
      const parseData = await parseRes.json();

      if (parseData.pairs && parseData.pairs.length > 0) {
        // Save all extracted pairs
        const saveRes = await fetch("/api/qa/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairs: parseData.pairs }),
        });
        const saveData = await saveRes.json();

        if (saveData.saved) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, savedAsQA: true } : m
            )
          );
          alert(
            `Saved ${saveData.saved} Q&A pair${saveData.saved > 1 ? "s" : ""} to the Q&A Bank!`
          );
        }
      } else {
        // If parsing didn't find structured Q&A, save as a single pair
        // using the previous user message as the question
        const msgIndex = messages.findIndex((m) => m.id === msgId);
        const prevUserMsg = messages
          .slice(0, msgIndex)
          .reverse()
          .find((m) => m.role === "user");

        if (prevUserMsg) {
          await fetch("/api/qa/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pairs: [
                {
                  question: prevUserMsg.content,
                  answer: msg.content,
                },
              ],
            }),
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, savedAsQA: true } : m
            )
          );
          alert("Saved 1 Q&A pair to the Q&A Bank!");
        }
      }
    } catch {
      alert("Failed to save Q&A pairs");
    }
    setSavingQA(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold">Chat with Observer</h1>
            <p className="text-xs text-text-muted">
              Powered by GPT-5.2 — Ask anything, prepare for meetings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseKnowledge(!useKnowledge)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              useKnowledge
                ? "bg-accent-dim border-accent/30 text-accent"
                : "bg-bg-primary border-border text-text-muted hover:text-text-secondary"
            }`}
            title="When enabled, the AI will reference your uploaded documents"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-danger hover:bg-danger-dim border border-border transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-accent opacity-60" />
            </div>
            <h2 className="text-lg font-medium text-text-primary mb-2">
              Chat with Observer
            </h2>
            <p className="text-sm text-center max-w-md mb-6">
              Ask questions, prepare for meetings, brainstorm answers, or
              generate Q&A pairs for your bank.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {[
                "Generate 20 tough VC questions with best answers",
                "What do you know about our company?",
                "Help me answer: What's your market size?",
                "How should I explain our competitive advantage?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-xs bg-bg-secondary border border-border rounded-lg px-3 py-2.5 hover:border-border-light hover:bg-bg-hover transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                {msg.role === "user" ? (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-muted mb-1">
                        You
                      </p>
                      <p className="text-sm whitespace-pre-wrap" dir={getTextDirection(msg.content)}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-accent-dim flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-accent">
                          Observer
                        </p>
                        {/* Save as Q&A button */}
                        {msg.content &&
                          !isGenerating &&
                          !msg.savedAsQA && (
                            <button
                              onClick={() => handleSaveAsQA(msg.id)}
                              disabled={savingQA === msg.id}
                              className="flex items-center gap-1 text-xs text-text-muted hover:text-success transition-colors ml-auto"
                              title="Extract Q&A pairs and save to Q&A Bank"
                            >
                              {savingQA === msg.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Save as Q&A</span>
                                </>
                              )}
                            </button>
                          )}
                        {msg.savedAsQA && (
                          <span className="flex items-center gap-1 text-xs text-success ml-auto">
                            <Check className="w-3 h-3" />
                            Saved to Q&A Bank
                          </span>
                        )}
                      </div>
                      {msg.content ? (
                        <div className="prose prose-sm prose-invert max-w-none text-sm" dir={getTextDirection(msg.content)}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                          {isGenerating &&
                            msg.id ===
                              messages[messages.length - 1]?.id && (
                              <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse-live" />
                            )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-text-muted">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Thinking...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border bg-bg-secondary/50 backdrop-blur-sm p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Observer anything... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="w-full bg-bg-primary border border-border rounded-xl px-4 py-3 pr-12 text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent max-h-32 overflow-auto"
                style={{ minHeight: "44px" }}
              />
            </div>
            {isGenerating ? (
              <button
                onClick={stopGenerating}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-danger hover:bg-red-600 text-white transition-colors flex-shrink-0"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-text-muted mt-2 text-center">
            {useKnowledge
              ? "Knowledge Base is active — responses include your uploaded documents"
              : "Knowledge Base is off — using general knowledge only"}
            {" • "}
            <span className="text-text-muted">
              Tip: Ask AI to generate Q&A pairs, then click &quot;Save as Q&A&quot; to
              add them to your bank
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
