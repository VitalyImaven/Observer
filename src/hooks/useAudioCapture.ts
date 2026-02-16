"use client";

import { useState, useRef, useCallback } from "react";

interface UseAudioCaptureOptions {
  onSpeechComplete: (blob: Blob) => void;
  silenceThreshold?: number;
  silenceTimeoutMs?: number;
}

export function useAudioCapture({
  onSpeechComplete,
  silenceThreshold = 0.03,
  silenceTimeoutMs = 2000,
}: UseAudioCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const activeRef = useRef(false);

  // Speech state
  const stateRef = useRef<"idle" | "recording" | "silence">("idle");
  const silenceStartRef = useRef<number>(0);
  const onSpeechCompleteRef = useRef(onSpeechComplete);
  onSpeechCompleteRef.current = onSpeechComplete;

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

  const startMediaRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !stream.active) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    console.log("[AUDIO] MediaRecorder started — recording speech");
  }, []);

  const stopMediaRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeTypeRef.current });
          resolve(blob);
        } else {
          resolve(null);
        }
      };
      recorder.stop();
      recorderRef.current = null;
    });
  }, []);

  const startMonitor = useCallback(() => {
    if (monitorRef.current) return;

    monitorRef.current = setInterval(() => {
      if (!activeRef.current) return;

      const level = getAudioLevel();
      const speaking = level > silenceThreshold;
      const now = Date.now();

      if (stateRef.current === "idle") {
        if (speaking) {
          // Speech started — begin recording
          stateRef.current = "recording";
          setIsSpeaking(true);
          startMediaRecorder();
          console.log("[AUDIO] Speech detected — started recording");
        }
      } else if (stateRef.current === "recording") {
        if (!speaking) {
          // Silence just started during recording
          stateRef.current = "silence";
          silenceStartRef.current = now;
        }
      } else if (stateRef.current === "silence") {
        if (speaking) {
          // Speech resumed — go back to recording
          stateRef.current = "recording";
          silenceStartRef.current = 0;
          console.log("[AUDIO] Speech resumed during silence window");
        } else {
          // Still silent — check if 2s passed
          const elapsed = now - silenceStartRef.current;
          if (elapsed >= silenceTimeoutMs) {
            // 2 seconds of silence confirmed — stop recording and emit
            console.log(`[AUDIO] ${silenceTimeoutMs}ms silence — stopping recorder, sending audio`);
            stateRef.current = "idle";
            setIsSpeaking(false);
            silenceStartRef.current = 0;

            stopMediaRecorder().then((blob) => {
              if (blob && blob.size > 1000) {
                console.log(`[AUDIO] Sending speech blob: ${blob.size} bytes`);
                onSpeechCompleteRef.current(blob);
              } else {
                console.log("[AUDIO] Blob too small, skipping");
              }
            });
          }
        }
      }
    }, 100);
  }, [getAudioLevel, silenceThreshold, silenceTimeoutMs, startMediaRecorder, stopMediaRecorder]);

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

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      mimeTypeRef.current = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      activeRef.current = true;
      stateRef.current = "idle";
      setIsRecording(true);
      setIsSpeaking(false);

      startMonitor();
      console.log("[AUDIO] Listening started — waiting for speech...");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to access microphone"
      );
    }
  }, [startMonitor]);

  const stopRecording = useCallback(() => {
    activeRef.current = false;
    stateRef.current = "idle";

    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
      recorderRef.current = null;
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
    chunksRef.current = [];

    setIsRecording(false);
    setIsSpeaking(false);
  }, []);

  return { isRecording, isSpeaking, error, startRecording, stopRecording };
}
