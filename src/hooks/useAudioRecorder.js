import { useRef, useState, useCallback } from 'react';

export default function useAudioRecorder() {
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Audio recording error:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!mediaRecorderRef.current || !isRecording) {
          reject(new Error('Recording not started'));
          return;
        }

        const mediaRecorder = mediaRecorderRef.current;

        mediaRecorder.onstop = () => {
          try {
            // Create audio blob
            const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });

            // Stop all tracks
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((track) => track.stop());
              mediaStreamRef.current = null;
            }

            mediaRecorderRef.current = null;
            chunksRef.current = [];
            setIsRecording(false);

            resolve(blob);
          } catch (err) {
            console.error('Error stopping recording:', err);
            reject(err);
          }
        };

        mediaRecorder.stop();
      }),
    [isRecording]
  );

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
