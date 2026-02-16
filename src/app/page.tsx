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
        generateAnswerRef.current(text, fullContext);
      } else {
        const matches = await matchQARef.current(text);
        if (matches && matches.length > 0) {
          setQaMatches(matches);
          setAnswerHistory((prev) => [{
            id: Date.now().toString(),
            speech: text,
            answer: matches[0].answer,
            timestamp: Date.now(),
          }, ...prev]);
        } else {
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
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);
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
        {/* Left: Transcript */}
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
                    <p className="text-xs mt-1">Speak or play your meeting audio</p>
                  </>
                ) : (
                  <>
                    <MicOff className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Click &quot;Start Listening&quot; to begin</p>
                    <p className="text-xs mt-1">Observer will capture and transcribe the conversation</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className="animate-fade-in rounded-lg p-3 bg-bg-secondary border border-border"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-muted">
                        {entry.speaker}
                      </span>
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

        {/* Right: Answer Stack */}
        <div className="w-1/2 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-secondary/30">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">
              {mode === "live" ? "AI Answers" : "Matched Answers"}
            </span>
            {(answerHistory.length > 0 || isGenerating) && (
              <span className="text-xs text-text-muted">
                {answerHistory.length}{isGenerating ? " + 1" : ""} answers
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
          <div className="flex-1 overflow-auto p-4">
            <div ref={answerTopRef} />

            {!answer && !isGenerating && answerHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Sparkles className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Waiting for a question...</p>
                <p className="text-xs mt-1">
                  {mode === "live"
                    ? "AI will generate answers after someone speaks"
                    : "Matching against your Q&A bank"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Currently generating — top */}
                {(isGenerating || answer) && (
                  <div className="animate-fade-in rounded-xl border-2 border-accent/40 bg-accent-dim/30 overflow-hidden">
                    {currentSpeech && (
                      <div className="px-4 pt-3 pb-2 border-b border-accent/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-accent">Speech</span>
                          <span className="text-xs text-text-muted ml-auto">
                            {new Date().toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary" dir={getTextDirection(currentSpeech)}>
                          {currentSpeech}
                        </p>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      {answer ? (
                        <div className="prose prose-sm prose-invert max-w-none" dir={getTextDirection(answer)}>
                          <ReactMarkdown>{answer}</ReactMarkdown>
                          {isGenerating && (
                            <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse-live" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-text-muted">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Generating answer...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* History — newest first */}
                {answerHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="animate-fade-in rounded-xl border border-border bg-bg-secondary overflow-hidden"
                  >
                    <div className="px-4 pt-3 pb-2 border-b border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text-muted">Speech</span>
                        <span className="text-xs text-text-muted ml-auto">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <button
                          onClick={() => handleCopy(entry.answer, entry.id)}
                          className="flex items-center text-text-muted hover:text-text-primary transition-colors"
                          title="Copy answer"
                        >
                          {copiedId === entry.id ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-text-secondary" dir={getTextDirection(entry.speech)}>
                        {entry.speech}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <div className="prose prose-sm prose-invert max-w-none" dir={getTextDirection(entry.answer)}>
                        <ReactMarkdown>{entry.answer}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
