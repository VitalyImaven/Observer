"use client";

import { useState, useRef, useCallback } from "react";

interface UseAudioCaptureOptions {
  onAudioChunk: (blob: Blob) => void;
  chunkDurationMs?: number;
  silenceThreshold?: number;
  minSpeechHits?: number;
}

export function useAudioCapture({
  onAudioChunk,
  chunkDurationMs = 6000,
  silenceThreshold = 0.03,
  minSpeechHits = 3,
}: UseAudioCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Check current audio level
  const getAudioLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }, []);

  const speechHitsRef = useRef(0);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordChunk = useCallback(
    (stream: MediaStream, mimeType: string) => {
      if (!activeRef.current || !stream.active) return;

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      speechHitsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Monitor audio level every 200ms during this chunk
      monitorRef.current = setInterval(() => {
        const level = getAudioLevel();
        if (level > silenceThreshold) {
          speechHitsRef.current++;
        }
      }, 200);

      recorder.onstop = () => {
        if (monitorRef.current) {
          clearInterval(monitorRef.current);
          monitorRef.current = null;
        }

        // Only send if we had sustained speech (multiple hits above threshold)
        // minSpeechHits=3 means at least 3 x 200ms = 600ms of speech
        const hadSpeech = speechHitsRef.current >= minSpeechHits;

        if (chunks.length > 0 && hadSpeech && activeRef.current) {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size > 4000) {
            onAudioChunk(blob);
          }
        }

        // Start next chunk
        if (activeRef.current && stream.active) {
          recordChunk(stream, mimeType);
        }
      };

      recorder.start();

      timeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, chunkDurationMs);
    },
    [onAudioChunk, chunkDurationMs, getAudioLevel, silenceThreshold, minSpeechHits]
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio analyser for silence detection
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      activeRef.current = true;
      setIsRecording(true);

      recordChunk(stream, mimeType);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to access microphone"
      );
    }
  }, [recordChunk]);

  const stopRecording = useCallback(() => {
    activeRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    setIsRecording(false);
  }, []);

  return { isRecording, error, startRecording, stopRecording };
}
