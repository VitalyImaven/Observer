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
} from "lucide-react";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useStreamingAnswer } from "@/hooks/useStreamingAnswer";
import type { Directive, TranscriptEntry } from "@/types";
import ReactMarkdown from "react-markdown";
import { getTextDirection } from "@/lib/rtl";

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
  const [copied, setCopied] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const [apiKeySet, setApiKeySet] = useState(true);
  const [waitingForComplete, setWaitingForComplete] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const questionBufferRef = useRef<string>("");
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const {
    answer,
    isGenerating,
    generateAnswer,
    matchQA,
    stopGenerating,
    clearAnswer,
  } = useStreamingAnswer();

  // Check if API key is configured
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

  // Keep transcript ref in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Auto-scroll answer
  useEffect(() => {
    answerRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [answer]);

  const detectQuestion = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.endsWith("?")) return true;
    const questionStarters = [
      "what", "how", "why", "when", "where", "who", "which",
      "can you", "could you", "would you", "do you", "are you",
      "is there", "have you", "tell me", "explain", "describe",
      "what's", "how's", "how do", "how much", "how many",
      // Hebrew question words
      "מה", "איך", "למה", "מתי", "איפה", "מי", "האם", "כמה",
      "איזה", "ספר", "תסביר", "תאר",
    ];
    const lower = trimmed.toLowerCase();
    return questionStarters.some((starter) => lower.startsWith(starter));
  };

  // Trigger answer generation after the question is complete
  const triggerAnswer = useCallback(
    async (fullQuestion: string) => {
      setLastQuestion(fullQuestion);
      setWaitingForComplete(false);

      const transcriptContext = transcriptRef.current
        .slice(-10)
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      if (mode === "live") {
        generateAnswer(fullQuestion, transcriptContext);
      } else {
        const matches = await matchQA(fullQuestion);
        if (matches && matches.length > 0) {
          setQaMatches(matches);
        } else {
          generateAnswer(fullQuestion, transcriptContext);
        }
      }
    },
    [mode, generateAnswer, matchQA]
  );

  const handleAudioChunk = useCallback(
    async (blob: Blob) => {
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
          setIsTranscribing(false);
          return;
        }

        const data = await res.json();
        if (data.text && data.text.trim()) {
          const text = data.text.trim();
          const isQuestion = detectQuestion(text);

          const entry: TranscriptEntry = {
            id: Date.now().toString(),
            speaker: "Speaker",
            text,
            timestamp: Date.now(),
            isQuestion,
          };

          setTranscript((prev) => [...prev, entry]);

          if (isQuestion) {
            // Accumulate question text -- speaker may still be talking
            questionBufferRef.current = questionBufferRef.current
              ? questionBufferRef.current + " " + text
              : text;
            setWaitingForComplete(true);

            // Reset the debounce timer -- wait for speaker to finish
            if (questionTimerRef.current) {
              clearTimeout(questionTimerRef.current);
            }
            questionTimerRef.current = setTimeout(() => {
              const fullQuestion = questionBufferRef.current;
              questionBufferRef.current = "";
              questionTimerRef.current = null;
              if (fullQuestion) {
                triggerAnswer(fullQuestion);
              }
            }, 3000); // Wait 3 seconds of silence after last question chunk
          } else if (questionBufferRef.current) {
            // Non-question speech while accumulating -- could be part of the question context
            // Extend the buffer and reset timer
            questionBufferRef.current += " " + text;
            if (questionTimerRef.current) {
              clearTimeout(questionTimerRef.current);
            }
            questionTimerRef.current = setTimeout(() => {
              const fullQuestion = questionBufferRef.current;
              questionBufferRef.current = "";
              questionTimerRef.current = null;
              if (fullQuestion) {
                triggerAnswer(fullQuestion);
              }
            }, 3000);
          }
        }
      } catch {
        // Transcription error, continue listening
      }
      setIsTranscribing(false);
    },
    [triggerAnswer]
  );

  const { isRecording, error: audioError, startRecording, stopRecording } =
    useAudioCapture({
      onAudioChunk: handleAudioChunk,
      chunkDurationMs: 6000,
    });

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
      // Clear any pending question buffer
      if (questionTimerRef.current) {
        clearTimeout(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      questionBufferRef.current = "";
      setWaitingForComplete(false);
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

  const handleCopy = () => {
    const text = answer || qaMatches.map((m) => m.answer).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activeDirective = directives.find((d) => d.id === activeDirectiveId);

  return (
    <div className="flex flex-col h-full">
      {/* Top Control Bar */}
      <div className="flex-shrink-0 border-b border-border bg-bg-secondary/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
          {/* Left: Mode + Directive */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode Selector */}
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

            {/* Directive Selector */}
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
                        activeDirectiveId === d.id
                          ? "text-accent"
                          : "text-text-secondary"
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

          {/* Center: Recording Button */}
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

          {/* Right: Status */}
          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-live-pulse animate-pulse-live" />
                <span className="text-danger font-medium">LIVE</span>
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="w-3 h-3 animate-spin" />
                Transcribing...
              </div>
            )}
            {waitingForComplete && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <Loader2 className="w-3 h-3 animate-spin" />
                Listening for full question...
              </div>
            )}
          </div>
        </div>

        {/* Warning if no API key */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Transcript */}
        <div className="w-1/2 border-r border-border flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-secondary/30">
            <Volume2 className="w-4 h-4 text-text-muted" />
            <span className="text-sm font-medium">Live Transcript</span>
            <span className="text-xs text-text-muted ml-auto">
              {transcript.length} entries
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                {isRecording ? (
                  <>
                    <Radio className="w-10 h-10 mb-3 animate-pulse opacity-40" />
                    <p className="text-sm">Listening for speech...</p>
                    <p className="text-xs mt-1">
                      Speak or play your meeting audio
                    </p>
                  </>
                ) : (
                  <>
                    <MicOff className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Click &quot;Start Listening&quot; to begin</p>
                    <p className="text-xs mt-1">
                      Observer will capture and transcribe the conversation
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={`animate-fade-in rounded-lg p-3 ${
                      entry.isQuestion
                        ? "bg-accent-dim border border-accent/30"
                        : "bg-bg-secondary border border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          entry.isQuestion ? "text-accent" : "text-text-muted"
                        }`}
                      >
                        {entry.speaker}
                      </span>
                      {entry.isQuestion && (
                        <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                          Question
                        </span>
                      )}
                      <span className="text-xs text-text-muted ml-auto">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm" dir={getTextDirection(entry.text)}>{entry.text}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Answer */}
        <div className="w-1/2 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-secondary/30">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">
              {mode === "live" ? "AI Answer" : "Matched Answer"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {(answer || qaMatches.length > 0) && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
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
          <div className="flex-1 overflow-auto p-4">
            {!answer && qaMatches.length === 0 && !isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Sparkles className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Waiting for a question...</p>
                <p className="text-xs mt-1">
                  {mode === "live"
                    ? "AI will generate answers to detected questions"
                    : "Matching against your Q&A bank"}
                </p>
              </div>
            ) : (
              <div className="animate-fade-in">
                {lastQuestion && (
                  <div className="mb-4 p-3 bg-accent-dim rounded-lg border border-accent/20">
                    <p className="text-xs text-accent font-medium mb-1">
                      Detected Question
                    </p>
                    <p className="text-sm" dir={getTextDirection(lastQuestion)}>{lastQuestion}</p>
                  </div>
                )}

                {/* Live AI Answer */}
                {(mode === "live" || qaMatches.length === 0) && answer && (
                  <div className="prose prose-sm prose-invert max-w-none" dir={getTextDirection(answer)}>
                    <ReactMarkdown>{answer}</ReactMarkdown>
                    {isGenerating && (
                      <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse-live" />
                    )}
                    <div ref={answerRef} />
                  </div>
                )}

                {/* Q&A Matches */}
                {mode === "qa-match" && qaMatches.length > 0 && (
                  <div className="space-y-4">
                    {qaMatches.map((match, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border transition-all ${
                          i === 0
                            ? "bg-success-dim border-success/30"
                            : "bg-bg-secondary border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              i === 0
                                ? "bg-success/20 text-success"
                                : "bg-bg-hover text-text-muted"
                            }`}
                          >
                            {match.similarity}% match
                          </span>
                          {i === 0 && (
                            <span className="text-xs text-success font-medium">
                              Best Match
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mb-2" dir={getTextDirection(match.question)}>
                          Q: {match.question}
                        </p>
                        <p
                          className={`text-sm whitespace-pre-wrap ${
                            i === 0 ? "text-text-primary font-medium" : ""
                          }`}
                          dir={getTextDirection(match.answer)}
                        >
                          {match.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {isGenerating && !answer && (
                  <div className="flex items-center gap-2 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating answer...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
