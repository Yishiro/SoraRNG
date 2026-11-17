'use client';
import { useEffect, useRef, useState } from 'react';
export function useOpeningAudio() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      void context.current?.close();
    },
    [],
  );
  function play(kind: 'tear' | 'flip', rank = 0) {
    const audio = context.current;
    if (!enabled || !audio) return;
    void audio.resume().catch(() => {});
    const time = audio.currentTime;
    const duration = kind === 'tear' ? 0.5 : 0.18;
    const buffer = audio.createBuffer(
      1,
      Math.ceil(audio.sampleRate * duration),
      audio.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = audio.createBufferSource();
    noise.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = kind === 'tear' ? 900 : 1800;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(kind === 'tear' ? 0.07 : 0.025, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    noise.connect(filter).connect(gain).connect(audio.destination);
    noise.start();
    noise.stop(time + duration);
    if (kind === 'flip') {
      const timer = setTimeout(() => {
        if (context.current !== audio || audio.state === 'closed') return;
        const at = audio.currentTime;
        [1, 1.5, 2].forEach((ratio, i) => {
          const oscillator = audio.createOscillator(),
            volume = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = (320 + rank * 75) * ratio;
          volume.gain.setValueAtTime(0.001, at + i * 0.035);
          volume.gain.linearRampToValueAtTime(0.026, at + 0.035 + i * 0.035);
          volume.gain.exponentialRampToValueAtTime(
            0.001,
            at + 0.45 + i * 0.035,
          );
          oscillator.connect(volume).connect(audio.destination);
          oscillator.start(at + i * 0.035);
          oscillator.stop(at + 0.5 + i * 0.035);
        });
      }, 340);
      timers.current.push(timer);
    }
  }
  function toggle() {
    if (enabled) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      void context.current?.suspend();
      setEnabled(false);
      return;
    }
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => {});
      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  }
  return { enabled, toggle, play };
}
