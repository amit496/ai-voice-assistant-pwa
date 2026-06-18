import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

const BAR_COUNT = 17;

function mapFrequencyData(data, barCount = BAR_COUNT) {
  if (!data?.length) return null;

  return Array.from({ length: barCount }, (_, index) => {
    const bin = Math.floor((index / barCount) * data.length);
    const nextBin = Math.min(bin + 1, data.length - 1);
    const value = (data[bin] + data[nextBin]) / 2 / 255;
    return 10 + value ** 0.85 * 42;
  });
}

export default function useNovaAgent({
  setConversation,
  setAuraReply,
  setLiveTranscript,
  setPhase,
}) {
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const pendingUserRef = useRef("");
  const lastAssistantRef = useRef("");

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      const text = String(message || "").trim();
      if (!text) return;

      if (role === "user") {
        setLiveTranscript(text);
        pendingUserRef.current = text;
        return;
      }

      const userText = pendingUserRef.current.trim();
      if (userText) {
        setConversation((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "user" && last.text === userText) return prev;
          return [...prev, { role: "user", text: userText }];
        });
        pendingUserRef.current = "";
        setLiveTranscript("");
      }

      if (lastAssistantRef.current === text) return;
      lastAssistantRef.current = text;
      setAuraReply(text);
      setConversation((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.text === text) return prev;
        return [...prev, { role: "assistant", text }];
      });
    },
    onModeChange: ({ mode }) => {
      if (mode === "listening") setPhase("listening");
      if (mode === "speaking") setPhase("speaking");
    },
    onStatusChange: ({ status }) => {
      if (status === "connecting") setPhase("thinking");
      if (status === "disconnected") {
        setPhase((current) => (current === "idle" ? "idle" : "responded"));
        pendingUserRef.current = "";
        lastAssistantRef.current = "";
      }
    },
    onError: (message) => {
      console.warn("Nova agent error:", message);
      setPhase((current) => (current === "idle" ? "idle" : "responded"));
    },
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setAgentEnabled(Boolean(data.agentEnabled));
        setAgentId(data.agentId || null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const startAgentSession = useCallback(async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    setPhase("thinking");

    const sessionRes = await fetch("/api/agent-session");
    const session = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok) {
      throw new Error(session.error || "Could not start Nova agent session");
    }

    if (session.signedUrl) {
      await conversation.startSession({ signedUrl: session.signedUrl });
      return;
    }

    const resolvedAgentId = session.agentId || agentId;
    if (!resolvedAgentId) {
      throw new Error("Nova agent ID is missing. Set ELEVENLABS_AGENT_ID in server/.env");
    }

    await conversation.startSession({ agentId: resolvedAgentId });
  }, [agentId, conversation, setPhase]);

  const stopAgentSession = useCallback(async () => {
    await conversation.endSession();
    setLiveTranscript("");
    setPhase((current) => (current === "idle" ? "idle" : "responded"));
  }, [conversation, setLiveTranscript, setPhase]);

  const toggleAgentSession = useCallback(async () => {
    if (conversation.status === "connected" || conversation.status === "connecting") {
      await stopAgentSession();
      return;
    }

    try {
      await startAgentSession();
    } catch (err) {
      console.warn("Failed to start agent session:", err);
      setPhase("idle");
      throw err;
    }
  }, [conversation.status, setPhase, startAgentSession, stopAgentSession]);

  const sendAgentText = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      conversation.sendUserMessage(trimmed);
      setConversation((prev) => [...prev, { role: "user", text: trimmed }]);
      setLiveTranscript("");
      setPhase("thinking");
    },
    [conversation, setConversation, setLiveTranscript, setPhase]
  );

  const updateAgentBars = useCallback(
    (setBarLevels, idleLevels) => {
      if (conversation.status !== "connected") return false;

      const data = conversation.isSpeaking
        ? conversation.getOutputByteFrequencyData()
        : conversation.getInputByteFrequencyData();
      const levels = mapFrequencyData(data);
      if (levels) {
        setBarLevels(levels);
        return true;
      }

      setBarLevels(idleLevels);
      return true;
    },
    [conversation]
  );

  const resetAgentConversation = useCallback(() => {
    pendingUserRef.current = "";
    lastAssistantRef.current = "";
    if (conversation.status === "connected") {
      conversation.endSession();
    }
  }, [conversation]);

  return {
    agentEnabled,
    agentConnected: conversation.status === "connected",
    agentConnecting: conversation.status === "connecting",
    agentMode: conversation.mode,
    toggleAgentSession,
    stopAgentSession,
    sendAgentText,
    updateAgentBars,
    resetAgentConversation,
  };
}
