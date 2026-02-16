"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Radio,
  Zap,
  MessageSquare,
  FileText,
  Star,
  Square,
  Loader2,
  Sparkles,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  Volume2,
  Trash2,
} from "lucide-react";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useStreamingAnswer } from "@/hooks/useStreamingAnswer";
import type { Directive, TranscriptEntry } from "@/types";
import ReactMarkdown from "react-markdown";
import { getTextDirection } from "@/lib/rtl";

interface AnswerEntry {
  id: string;
  speech: string;
  answer: string;
  timestamp: number;
  source: "ai" | "qa-bank";
  similarity?: number;
  matchedQuestion?: string;
}

export default function MeetingDashboard() {
  const [mode, setMode] = useState<"live" | "qa-match">("live");
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [activeDirectiveId, setActiveDirectiveId] = useState<string | null>(null);
  const [showDirectiveMenu, setShowDirectiveMenu] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [qaMatches, setQaMatches] = useState<
    { question: string; answer: string; similarity: number }[]
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentSpeech, setCurrentSpeech] = useState<string>("");
  const [apiKeySet, setApiKeySet] = useState(true);
  const [answerHistory, setAnswerHistory] = useState<AnswerEntry[]>([]);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const answerTopRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const currentSpeechRef = useRef<string>("");
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // When answer is complete, add to history stack
  const handleAnswerComplete = useCallback((completedAnswer: string) => {
    const speech = currentSpeechRef.current;
    if (!speech || !completedAnswer) return;
    setAnswerHistory((prev) => [{
      id: Date.now().toString(),
      speech,
      answer: completedAnswer,
      timestamp: Date.now(),
      source: "ai",
    }, ...prev]);
  }, []);

  const {
    answer,
    isGenerating,
    generateAnswer,
    matchQA,
    stopGenerating,
    clearAnswer,
  } = useStreamingAnswer({ onAnswerComplete: handleAnswerComplete });

  const generateAnswerRef = useRef(generateAnswer);
  const matchQARef = useRef(matchQA);
  useEffect(() => { generateAnswerRef.current = generateAnswer; }, [generateAnswer]);
  useEffect(() => { matchQARef.current = matchQA; }, [matchQA]);

  // ═══════════════════════════════════════════════════════════
  // THE SIMPLE FLOW:
  // 1. Microphone listens
  // 2. Someone speaks → audio is recorded
  // 3. 2 seconds of silence → complete audio blob arrives here
  // 4. Send to transcribe → get text
  // 5. Send text to model → show answer
  // ═══════════════════════════════════════════════════════════
  const handleSpeechComplete = useCallback(async (blob: Blob) => {
    console.log(`[FLOW] Speech complete — ${blob.size} bytes of audio`);

    // Step 1: Transcribe
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = blob.type.includes("webm") ? "webm" : "wav";
      formData.append("audio", blob, `audio.${ext}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.log("[FLOW] Transcription failed");
        setIsTranscribing(false);
        return;
      }

      const data = await res.json();
      const text = data.text?.trim();

      if (!text) {
        console.log("[FLOW] Transcription returned empty — ignoring");
        setIsTranscribing(false);
        return;
      }

      console.log(`[FLOW] Transcribed: "${text}"`);
      setIsTranscribing(false);

      // Add to transcript
      const entry: TranscriptEntry = {
        id: Date.now().toString(),
        speaker: "Speaker",
        text,
        timestamp: Date.now(),
        isQuestion: false,
      };
      setTranscript((prev) => [...prev, entry]);

      // Step 2: Send to model
      setCurrentSpeech(text);
      currentSpeechRef.current = text;

      const fullContext = [...transcriptRef.current, entry]
        .map((t) => t.text)
        .join(" ");

      console.log(`[FLOW] Sending to model. Mode: ${modeRef.current}`);

      if (modeRef.current === "live") {
        // Live AI mode — always send to model (model decides if answer needed)
        generateAnswerRef.current(text, fullContext);
      } else {
        // Q&A Match mode — first check Q&A bank, fallback to AI
        // Note: similarity can come from AI re-ranking (60-100) or embeddings (40-85)
        const MIN_SIMILARITY = 60;
        const matches = await matchQARef.current(text);
        const goodMatch = matches?.find((m: { similarity: number }) => m.similarity >= MIN_SIMILARITY);

        if (goodMatch) {
          console.log(`[FLOW] Q&A match found: ${goodMatch.similarity}% — "${goodMatch.question}"`);
          setQaMatches(matches);
          setAnswerHistory((prev) => [{
            id: Date.now().toString(),
            speech: text,
            answer: goodMatch.answer,
            timestamp: Date.now(),
            source: "qa-bank",
            similarity: goodMatch.similarity,
            matchedQuestion: goodMatch.question,
          }, ...prev]);
        } else {
          // No match above 80% — send to AI model (model decides if answer needed)
          console.log(`[FLOW] No Q&A match above ${MIN_SIMILARITY}% — sending to AI`);
          generateAnswerRef.current(text, fullContext);
        }
      }
    } catch (err) {
      console.error("[FLOW] Error:", err);
      setIsTranscribing(false);
    }
  }, []);

  const { isRecording, isSpeaking, startRecording, stopRecording } =
    useAudioCapture({
      onSpeechComplete: handleSpeechComplete,
      silenceTimeoutMs: 2000,
    });

  // Load settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setApiKeySet(!!data.openaiApiKey && data.openaiApiKey !== "");
        setActiveDirectiveId(data.activeDirectiveId || null);
        if (data.mode) setMode(data.mode);
      });
    fetch("/api/directives")
      .then((r) => r.json())
      .then(setDirectives);
  }, []);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [transcript]);
  useEffect(() => { if (isGenerating) answerTopRef.current?.scrollIntoView({ behavior: "smooth" }); }, [isGenerating]);

  // Clear streaming answer once saved to history
  useEffect(() => {
    if (!isGenerating && answer && answerHistory.length > 0 && answerHistory[0].answer === answer) {
      clearAnswer();
      setCurrentSpeech("");
    }
  }, [isGenerating, answer, answerHistory, clearAnswer]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      clearAnswer();
      setQaMatches([]);
      startRecording();
    }
  };

  const handleSetDirective = async (id: string | null) => {
    setActiveDirectiveId(id);
    setShowDirectiveMenu(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeDirectiveId: id }),
    });
  };

  const handleModeChange = async (newMode: "live" | "qa-match") => {
    setMode(newMode);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClearHistory = () => {
    setAnswerHistory([]);
    clearAnswer();
    setCurrentSpeech("");
  };

  const activeDirective = directives.find((d) => d.id === activeDirectiveId);

  return (
    <div className="flex flex-col h-full">
      {/* Top Control Bar */}
      <div className="flex-shrink-0 border-b border-border bg-bg-secondary/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-bg-primary border border-border rounded-lg p-0.5">
              <button
                onClick={() => handleModeChange("live")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === "live"
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Live AI
              </button>
              <button
                onClick={() => handleModeChange("qa-match")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === "qa-match"
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Q&A Match
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowDirectiveMenu(!showDirectiveMenu)}
                className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-xs hover:border-border-light transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-text-secondary max-w-[150px] truncate">
                  {activeDirective ? activeDirective.name : "No directive"}
                </span>
                <ChevronDown className="w-3 h-3 text-text-muted" />
              </button>
              {showDirectiveMenu && (
                <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 min-w-[220px] py-1 animate-fade-in">
                  <button
                    onClick={() => handleSetDirective(null)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-colors ${
                      !activeDirectiveId ? "text-accent" : "text-text-secondary"
                    }`}
                  >
                    No directive
                  </button>
                  {directives.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSetDirective(d.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-colors flex items-center gap-2 ${
                        activeDirectiveId === d.id ? "text-accent" : "text-text-secondary"
                      }`}
                    >
                      {activeDirectiveId === d.id && (
                        <Star className="w-3 h-3 fill-current flex-shrink-0" />
                      )}
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleRecording}
            disabled={!apiKeySet}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isRecording
                ? "bg-danger text-white hover:bg-red-600"
                : apiKeySet
                ? "bg-accent hover:bg-accent-hover text-white"
                : "bg-bg-hover text-text-muted cursor-not-allowed"
            }`}
          >
            {isRecording ? (
              <>
                <div className="relative">
                  <Square className="w-4 h-4" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse-live" />
                </div>
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Listening
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-live-pulse animate-pulse-live" />
                <span className="text-danger font-medium">LIVE</span>
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-1.5 text-xs text-accent">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                Speaking...
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <Loader2 className="w-3 h-3 animate-spin" />
                Transcribing...
              </div>
            )}
          </div>
        </div>

        {!apiKeySet && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning-dim border-t border-warning/20 text-warning text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              API key not configured.{" "}
              <a href="/settings" className="underline font-medium">
                Go to Settings
              </a>{" "}
              to add your OpenAI API key.
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Transcript — dark, minimal, compact */}
        <div className="w-[42%] border-r border-border flex flex-col min-w-0 bg-bg-primary">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
            <Volume2 className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Transcript</span>
            <span className="text-xs text-text-muted/60 ml-auto">
              {transcript.length}
            </span>
          </div>
          <div className="flex-1 overflow-auto px-3 py-3">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                {isRecording ? (
                  <>
                    <Radio className="w-8 h-8 mb-2 animate-pulse opacity-30" />
                    <p className="text-xs">Listening for speech...</p>
                  </>
                ) : (
                  <>
                    <MicOff className="w-8 h-8 mb-2 opacity-15" />
                    <p className="text-xs">Click &quot;Start Listening&quot;</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div ref={transcriptEndRef} />
                {[...transcript].reverse().map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`animate-fade-in rounded-lg px-3 py-2.5 transition-all ${
                      i === 0
                        ? "bg-accent/10 border-l-[3px] border-l-accent border border-accent/20"
                        : "border-l-[3px] border-l-transparent border border-transparent hover:bg-bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${i === 0 ? "text-accent" : "text-text-muted/50"}`}>
                        {entry.speaker}
                      </span>
                      <span className="text-[10px] text-text-muted/40 ml-auto">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-[13px] leading-relaxed ${i === 0 ? "text-text-primary font-medium" : "text-text-secondary"}`} dir={getTextDirection(entry.text)}>
                      {entry.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Answer Stack — wider, richer, prominent */}
        <div className="w-[58%] flex flex-col min-w-0 bg-gradient-to-b from-bg-secondary/60 to-bg-primary">
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/60 bg-bg-secondary/30">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold">
              {mode === "live" ? "AI Answers" : "Matched Answers"}
            </span>
            {(answerHistory.length > 0 || isGenerating) && (
              <span className="text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded-full">
                {answerHistory.length}{isGenerating ? "+1" : ""}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {answerHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-danger transition-colors"
                  title="Clear all answers"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {isGenerating && (
                <button
                  onClick={stopGenerating}
                  className="flex items-center gap-1 text-xs text-danger hover:text-red-400 transition-colors"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-5 py-4">
            <div ref={answerTopRef} />

            {!answer && !isGenerating && answerHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Sparkles className="w-12 h-12 mb-3 opacity-10" />
                <p className="text-sm">Waiting for a question...</p>
                <p className="text-xs mt-1 text-text-muted/60">
                  {mode === "live"
                    ? "AI will generate answers after someone speaks"
                    : "Matching against your Q&A bank"}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Currently generating — top with glow */}
                {(isGenerating || answer) && (
                  <div className="animate-fade-in animate-glow rounded-2xl border-2 border-accent/50 bg-gradient-to-br from-accent/10 via-bg-secondary to-bg-secondary overflow-hidden shadow-lg shadow-accent/5">
                    {currentSpeech && (
                      <div className="px-5 pt-4 pb-2.5 border-b border-accent/15 bg-accent/5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Speech</span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                            AI Generating...
                          </span>
                          <span className="text-[10px] text-text-muted/50 ml-auto">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary" dir={getTextDirection(currentSpeech)}>
                          {currentSpeech}
                        </p>
                      </div>
                    )}
                    <div className="px-5 py-4">
                      {answer ? (
                        <div className="prose prose-sm prose-invert max-w-none text-[15px] leading-relaxed" dir={getTextDirection(answer)}>
                          <ReactMarkdown>{answer}</ReactMarkdown>
                          {isGenerating && (
                            <span className="inline-block w-2 h-5 bg-accent ml-0.5 animate-pulse-live rounded-sm" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-text-muted">
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                          <span className="text-sm">Generating answer...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* History — newest first, first one highlighted */}
                {answerHistory.map((entry, i) => {
                  const isLatest = i === 0 && !isGenerating && !answer;
                  const isQA = entry.source === "qa-bank";
                  return (
                    <div
                      key={entry.id}
                      className={`animate-fade-in rounded-2xl overflow-hidden transition-all ${
                        isLatest
                          ? isQA
                            ? "border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/30 to-bg-secondary shadow-lg shadow-emerald-500/5"
                            : "border-2 border-accent/40 bg-gradient-to-br from-accent/8 to-bg-secondary shadow-lg shadow-accent/5"
                          : isQA
                            ? "border border-emerald-500/20 bg-emerald-950/10"
                            : "border border-border/60 bg-bg-secondary/60"
                      }`}
                    >
                      <div className={`px-5 pt-3.5 pb-2.5 border-b ${
                        isLatest ? (isQA ? "border-emerald-500/15 bg-emerald-500/5" : "border-accent/15 bg-accent/5") : "border-border/40"
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isLatest ? "text-text-secondary" : "text-text-muted/50"}`}>Speech</span>
                          {isQA ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isLatest ? "bg-emerald-500/25 text-emerald-400" : "bg-emerald-500/15 text-emerald-400/70"
                            }`}>
                              Q&A Bank {entry.similarity ? `· ${entry.similarity}%` : ""}
                            </span>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isLatest ? "bg-blue-500/25 text-blue-400" : "bg-blue-500/15 text-blue-400/70"
                            }`}>
                              AI Generated
                            </span>
                          )}
                          {isLatest && (
                            <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">
                              Latest
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted/40 ml-auto">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <button
                            onClick={() => handleCopy(entry.answer, entry.id)}
                            className="flex items-center text-text-muted/50 hover:text-text-primary transition-colors"
                            title="Copy answer"
                          >
                            {copiedId === entry.id ? (
                              <Check className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className={`text-sm ${isLatest ? "text-text-secondary" : "text-text-muted"}`} dir={getTextDirection(entry.speech)}>
                          {entry.speech}
                        </p>
                        {isQA && entry.matchedQuestion && (
                          <p className="text-[11px] text-emerald-400/60 mt-1" dir={getTextDirection(entry.matchedQuestion)}>
                            Matched: &quot;{entry.matchedQuestion}&quot;
                          </p>
                        )}
                      </div>
                      <div className={`px-5 py-4 ${isLatest ? "" : "opacity-80"}`}>
                        <div className={`prose prose-sm prose-invert max-w-none ${isLatest ? "text-[15px] leading-relaxed" : "text-[13px]"}`} dir={getTextDirection(entry.answer)}>
                          <ReactMarkdown>{entry.answer}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
