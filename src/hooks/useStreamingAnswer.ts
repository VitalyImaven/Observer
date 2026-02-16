"use client";

import { useState, useCallback, useRef } from "react";

interface UseStreamingAnswerOptions {
  onAnswerComplete?: (answer: string) => void;
}

export function useStreamingAnswer(options?: UseStreamingAnswerOptions) {
  const [answer, setAnswer] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(options?.onAnswerComplete);
  onCompleteRef.current = options?.onAnswerComplete;

  const generateAnswer = useCallback(
    async (question: string, context?: string) => {
      // Abort any previous generation
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAnswer("");
      setIsGenerating(true);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, context }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setAnswer("Error generating answer. Check your API key in Settings.");
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
                  setAnswer(accumulated);
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }

        // Notify when a real answer was generated
        if (accumulated && onCompleteRef.current) {
          onCompleteRef.current(accumulated);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Intentional abort
        } else {
          setAnswer("Error: Failed to generate answer.");
        }
      }

      setIsGenerating(false);
    },
    []
  );

  const matchQA = useCallback(async (question: string) => {
    try {
      const res = await fetch("/api/match-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.matches || [];
    } catch {
      return null;
    }
  }, []);

  const stopGenerating = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsGenerating(false);
  }, []);

  const clearAnswer = useCallback(() => {
    setAnswer("");
  }, []);

  return {
    answer,
    isGenerating,
    generateAnswer,
    matchQA,
    stopGenerating,
    clearAnswer,
  };
}
