import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";
import { Clock3, Loader2, MessageSquareText, Mic, MicOff, Plus, Send, Sparkles } from "lucide-react-native";
import MarkdownDisplay from "react-native-markdown-display";

import { useAuth } from "../context/AuthContext";
import { ChatMessageRecord, ChatSession, getChatSessions, getSessionMessages, streamChat } from "../api/chat";
import { palette, radius, spacing, text } from "../theme/tokens";
import { ActionButton, StatusChip, SurfaceCard } from "../components/AppSurface";

type Message = { id: string; role: "user" | "bot" | "status"; content: string };
type VoiceMode = "inactive" | "listening" | "thinking" | "speaking";
type SpeechResultEvent = { results?: Array<{ transcript?: string }>; isFinal?: boolean };
type SpeechErrorEvent = { error?: string; message?: string };
type SpeechVolumeEvent = { value: number };

const speechRecognitionPackage = (() => {
  try {
    return require("expo-speech-recognition");
  } catch {
    return null;
  }
})();

const ExpoSpeechRecognitionModule = speechRecognitionPackage?.ExpoSpeechRecognitionModule;
const useSpeechRecognitionEvent: (eventName: string, listener: (event: any) => void) => void =
  speechRecognitionPackage?.useSpeechRecognitionEvent ?? (() => {});
const isSpeechRecognitionAvailable = Boolean(ExpoSpeechRecognitionModule);

const SUGGESTIONS = [
  "What disease matches yellow rust-like streaks on wheat?",
  "Give me a treatment plan for leaf blight this week.",
  "How should I prevent recurring fungal infection after irrigation?",
];

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  content:
    "Hello! I am your AI Agronomist. Ask me about wheat diseases, treatment plans, or prevention, and I will help with field-ready guidance.",
};

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function cleanSpeechText(value: string) {
  return value
    .replace(/[#*`~_]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function mapSessionMessages(messages: ChatMessageRecord[]): Message[] {
  return messages.map((message) => ({
    id: String(message.id),
    role: message.role === "assistant" ? "bot" : (message.role as "user" | "bot"),
    content: message.content,
  }));
}

export default function Chat() {
  const { width } = useWindowDimensions();
  const sizeClass = width < 360 ? "tiny" : width <= 420 ? "compact" : "regular";
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateUUID());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => currentSessionId);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("inactive");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [pendingNewMessages, setPendingNewMessages] = useState(0);
  const [composerHeight, setComposerHeight] = useState(46);
  const scrollViewRef = useRef<ScrollView>(null);
  const voiceEnabledRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const finalVoiceHandledRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const isViewingPast = activeSessionId !== currentSessionId;

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    let active = true;

    const initChat = async () => {
      if (!token) return;

      try {
        const { sessions: fetchedSessions } = await getChatSessions(token);
        if (!active) return;

        setSessions(fetchedSessions);

        if (fetchedSessions.length > 0) {
          const latestId = fetchedSessions[0].session_id;
          setActiveSessionId(latestId);
          await loadSessionMessages(latestId, true);
        }
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      }
    };

    initChat();

    return () => {
      active = false;
      stopVoiceMode();
    };
  }, [token]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    if (!isNearBottomRef.current) {
      setPendingNewMessages((count) => count + 1);
      setShowJumpToLatest(true);
    }
  }, [messages, loadingSession]);

  const scrollToLatest = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setPendingNewMessages(0);
    setShowJumpToLatest(false);
  };

  const loadSessionMessages = async (sessionId: string, keepCurrentSession = false) => {
    if (!token) return;

    setLoadingSession(true);
    setMessages([WELCOME]);

    try {
      const { messages: rawMessages } = await getSessionMessages(sessionId, token);
      setMessages([WELCOME, ...mapSessionMessages(rawMessages)]);
      if (!keepCurrentSession) {
        setActiveSessionId(sessionId);
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    } finally {
      setLoadingSession(false);
    }
  };

  const refreshSessions = async () => {
    if (!token) return;

    try {
      const { sessions: fetchedSessions } = await getChatSessions(token);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error("Failed to refresh chat sessions:", error);
    }
  };

  const handleNewChat = () => {
    if (isStreaming) return;

    if (voiceMode !== "inactive") {
      stopVoiceMode();
    }

    const nextSession = generateUUID();
    setVoiceError(null);
    setQuery("");
    setInterimTranscript("");
    setCurrentSessionId(nextSession);
    setActiveSessionId(nextSession);
    setMessages([WELCOME]);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId || isStreaming || loadingSession) return;

    if (voiceMode !== "inactive") {
      stopVoiceMode();
    }

    await loadSessionMessages(sessionId);
    setActiveSessionId(sessionId);
  };

  const restartListeningSoon = () => {
    if (!voiceEnabledRef.current || isStreamingRef.current || isSpeakingRef.current || isViewingPast) return;

    setTimeout(() => {
      if (voiceEnabledRef.current && !isStreamingRef.current && !isSpeakingRef.current && !isViewingPast) {
        beginListening();
      }
    }, 450);
  };

  const stopVoicePlayback = () => {
    Speech.stop();
    isSpeakingRef.current = false;
  };

  const stopVoiceMode = () => {
    voiceEnabledRef.current = false;
    finalVoiceHandledRef.current = false;
    setVoiceMode("inactive");
    setInterimTranscript("");
    setVoiceLevel(0);
    stopVoicePlayback();
    ExpoSpeechRecognitionModule?.abort?.();
  };

  const speakAnswer = (value: string) => {
    const textToSpeak = cleanSpeechText(value);

    if (!textToSpeak) {
      restartListeningSoon();
      return;
    }

    setVoiceMode("speaking");
    isSpeakingRef.current = true;

    Speech.speak(textToSpeak, {
      language: "en-IN",
      pitch: 1,
      rate: 0.96,
      onDone: () => {
        isSpeakingRef.current = false;
        restartListeningSoon();
      },
      onStopped: () => {
        isSpeakingRef.current = false;
      },
      onError: () => {
        isSpeakingRef.current = false;
        restartListeningSoon();
      },
    });
  };

  const beginListening = async () => {
    if (!isSpeechRecognitionAvailable) {
      setVoiceError("Voice chat is unavailable in Expo Go. Use a development build to enable it.");
      stopVoiceMode();
      return;
    }

    if (Platform.OS === "web") {
      setVoiceError("Voice chat needs a native Expo build on mobile.");
      return;
    }

    if (isViewingPast) {
      setVoiceError("Start a new conversation before using voice chat.");
      return;
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceError("Microphone permission is required for voice chat.");
        stopVoiceMode();
        return;
      }

      setVoiceError(null);
      setInterimTranscript("");
      finalVoiceHandledRef.current = false;

      ExpoSpeechRecognitionModule?.start?.({
        lang: "en-IN",
        interimResults: true,
        addsPunctuation: true,
        continuous: false,
        iosTaskHint: "dictation",
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
          mode: "voiceChat",
        },
        iosVoiceProcessingEnabled: true,
        contextualStrings: ["wheat", "rust", "blight", "fungus", "irrigation", "pesticide"],
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 100,
        },
      });
    } catch (error) {
      console.error("Voice start failed:", error);
      setVoiceError("Voice chat could not start.");
      stopVoiceMode();
    }
  };

  const retryVoicePermission = () => {
    if (isStreaming || isViewingPast) return;
    voiceEnabledRef.current = true;
    beginListening();
  };

  const toggleVoiceMode = () => {
    if (voiceMode === "inactive") {
      voiceEnabledRef.current = true;
      beginListening();
      return;
    }

    stopVoiceMode();
  };

  const submitQuery = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || isStreaming || !token || isViewingPast) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSubmit.trim(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setQuery("");
    setIsStreaming(true);
    setVoiceError(null);

    const botMessageId = `${Date.now()}-bot`;
    setMessages((previous) => [...previous, { id: botMessageId, role: "status", content: "Agent is analyzing your query..." }]);

    if (voiceEnabledRef.current) {
      setVoiceMode("thinking");
      finalVoiceHandledRef.current = true;
    }

    try {
      const response = await streamChat(userMessage.content, activeSessionId, token);
      const finalAnswer = await consumeChatResponse(response, (event) => {
        if (event.event === "status") {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === botMessageId ? { ...message, role: "status", content: event.message || "Working..." } : message,
            ),
          );
        }

        if (event.event === "final_result") {
          const answer = event.data?.answer || "I could not generate a response.";
          setMessages((previous) =>
            previous.map((message) => (message.id === botMessageId ? { ...message, role: "bot", content: answer } : message)),
          );
        }

        if (event.event === "error") {
          const message = event.message || "Connection failed.";
          setMessages((previous) =>
            previous.map((item) => (item.id === botMessageId ? { ...item, role: "status", content: message } : item)),
          );
        }
      });

      if (voiceEnabledRef.current && finalAnswer) {
        speakAnswer(finalAnswer);
      } else if (voiceEnabledRef.current) {
        restartListeningSoon();
      }

      refreshSessions();
    } catch (error) {
      console.error(error);
      setMessages((previous) =>
        previous.map((item) => (item.id === botMessageId ? { ...item, role: "status", content: "Connection failed." } : item)),
      );
      if (voiceEnabledRef.current) {
        restartListeningSoon();
      }
    } finally {
      setIsStreaming(false);
    }
  };

  useSpeechRecognitionEvent("start", () => {
    if (!voiceEnabledRef.current) return;
    setVoiceMode("listening");
    setInterimTranscript("");
    setVoiceLevel(0);
  });

  useSpeechRecognitionEvent("volumechange", (event: SpeechVolumeEvent) => {
    if (!voiceEnabledRef.current) return;
    setVoiceLevel(Math.max(0, event.value));
  });

  useSpeechRecognitionEvent("result", (event: SpeechResultEvent) => {
    if (!voiceEnabledRef.current || finalVoiceHandledRef.current) return;

    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;

    setInterimTranscript(transcript);

    if (event.isFinal) {
      finalVoiceHandledRef.current = true;
      ExpoSpeechRecognitionModule?.stop?.();
      void submitQuery(transcript);
    }
  });

  useSpeechRecognitionEvent("nomatch", () => {
    if (!voiceEnabledRef.current) return;
    restartListeningSoon();
  });

  useSpeechRecognitionEvent("end", () => {
    setVoiceLevel(0);
    if (!voiceEnabledRef.current || finalVoiceHandledRef.current) return;
    restartListeningSoon();
  });

  useSpeechRecognitionEvent("error", (event: SpeechErrorEvent) => {
    console.error("Voice error:", event);

    if (!voiceEnabledRef.current) return;

    if (event.error === "no-speech" || event.error === "aborted") {
      restartListeningSoon();
      return;
    }

    setVoiceError(event.message || "Voice recognition failed.");
    stopVoiceMode();
  });

  const voiceOverlayColors = useMemo(() => {
    if (voiceMode === "listening") return palette.voiceListening;
    if (voiceMode === "thinking") return palette.voiceThinking;
    if (voiceMode === "speaking") return palette.voiceSpeaking;
    return palette.gradientHero;
  }, [voiceMode]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[...palette.gradientCanvas]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardWrap}>
        <SurfaceCard style={[styles.sessionBar, sizeClass !== "regular" && styles.sessionBarCompact]} density="compact">
          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sessionBarTitle}>Sessions</Text>
            <View style={styles.sessionHeaderActions}>
              {sizeClass === "tiny" ? (
                <TouchableOpacity onPress={() => setSessionSheetVisible(true)} style={styles.sheetTrigger}>
                  <Text style={styles.sheetTriggerText}>View</Text>
                </TouchableOpacity>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New chat"
                onPress={handleNewChat}
                disabled={isStreaming}
                style={[styles.newIconButton, isStreaming && styles.sessionPillDisabled]}
              >
                <Plus color={palette.primaryDeep} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
          {sizeClass === "tiny" ? (
            <StatusChip label={`${sessions.length + 1} session(s)`} tone="default" />
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionList}>
            {!isViewingPast ? <StatusChip label="Current" tone="primary" /> : null}
            {sessions.map((session) => {
              const isActive = activeSessionId === session.session_id;
              return (
                <Pressable
                  key={session.session_id}
                  disabled={isStreaming || loadingSession}
                  onPress={() => handleSelectSession(session.session_id)}
                  style={[
                    styles.sessionPill,
                    isActive && styles.sessionPillActive,
                    (isStreaming || loadingSession) && styles.sessionPillDisabled,
                  ]}
                >
                  <Clock3 color={isActive ? palette.primaryDeep : palette.textMuted} size={13} />
                  <View style={styles.sessionCopy}>
                    <Text numberOfLines={1} style={[styles.sessionLabel, isActive && styles.sessionLabelActive]}>
                      {session.first_message || "Chat"}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {formatDateLabel(session.created_at)} · {session.message_count}/100
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          )}
        </SurfaceCard>

        <View style={styles.chatContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
              const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 70;
              isNearBottomRef.current = isNearBottom;
              if (isNearBottom) {
                setShowJumpToLatest(false);
                setPendingNewMessages(0);
              }
            }}
            scrollEventThrottle={16}
          >
            {loadingSession ? (
              <SurfaceCard style={styles.loadingCard}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.loadingText}>Loading conversation...</Text>
              </SurfaceCard>
            ) : null}

            {!loadingSession && messages.length === 1 ? (
              <SurfaceCard style={styles.hintCard}>
                <Text style={styles.hintLabel}>Try asking</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable key={suggestion} onPress={() => setQuery(suggestion)} style={styles.suggestionChip}>
                      <Sparkles color={palette.accent} size={12} />
                      <Text numberOfLines={2} style={styles.suggestionText}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </SurfaceCard>
            ) : null}

            {!loadingSession &&
              messages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.role === "user" ? styles.messageRowUser : styles.messageRowBot]}>
                  <View
                    style={[
                      styles.messageBubble,
                      message.role === "user" ? styles.userBubble : message.role === "status" ? styles.statusBubble : styles.botBubble,
                    ]}
                  >
                    {message.role === "status" ? (
                      <View style={styles.statusRow}>
                        <Loader2 color={palette.textMuted} size={14} />
                        <Text style={styles.statusText}>{message.content}</Text>
                      </View>
                    ) : message.role === "bot" ? (
                      <MarkdownDisplay style={markdownStyles}>{message.content}</MarkdownDisplay>
                    ) : (
                      <Text style={styles.userText}>{message.content}</Text>
                    )}
                  </View>
                </View>
              ))}
          </ScrollView>

          {isViewingPast ? (
            <SurfaceCard style={styles.pastSessionBanner}>
              <MessageSquareText color={palette.primary} size={18} />
              <Text style={styles.pastSessionText}>You are viewing a previous conversation. Start a new one to continue chatting.</Text>
            </SurfaceCard>
          ) : null}

          {voiceError ? (
            <SurfaceCard style={styles.voiceErrorCard}>
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
              {voiceError.includes("Expo Go") ? (
                <Pressable onPress={retryVoicePermission} style={styles.retryVoiceButton}>
                  <Text style={styles.retryVoiceText}>Retry permission</Text>
                </Pressable>
              ) : null}
            </SurfaceCard>
          ) : null}

          {!isSpeechRecognitionAvailable ? (
            <SurfaceCard style={styles.voiceBadgeCard} density="compact">
              <Text style={styles.voiceBadgeText}>Voice unavailable in Expo Go</Text>
            </SurfaceCard>
          ) : null}

          {showJumpToLatest ? (
            <Pressable onPress={scrollToLatest} style={styles.jumpToLatest}>
              <Text style={styles.jumpToLatestText}>
                {pendingNewMessages > 0 ? `${pendingNewMessages} new • Jump to latest` : "Jump to latest"}
              </Text>
            </Pressable>
          ) : null}

          <SurfaceCard style={styles.inputCard}>
            <TextInput
              style={[styles.input, { height: composerHeight, minHeight: 46 }]}
              placeholder={voiceMode !== "inactive" ? "Listening..." : "Ask the agronomist anything..."}
              placeholderTextColor={palette.textMuted}
              value={query}
              onChangeText={setQuery}
              editable={!isStreaming && !isViewingPast}
              multiline
              onContentSizeChange={(event) => {
                const nextHeight = Math.max(46, Math.min(110, Math.ceil(event.nativeEvent.contentSize.height) + 12));
                setComposerHeight(nextHeight);
              }}
            />
            <View style={styles.inputActions}>
              <Pressable
                onPress={toggleVoiceMode}
                disabled={isStreaming || isViewingPast || !isSpeechRecognitionAvailable}
                style={[
                  styles.roundButton,
                  voiceMode !== "inactive" ? styles.roundButtonActive : null,
                  (isStreaming || isViewingPast || !isSpeechRecognitionAvailable) && styles.roundButtonDisabled,
                ]}
              >
                {voiceMode !== "inactive" ? <MicOff color={palette.white} size={18} /> : <Mic color={palette.primary} size={18} />}
              </Pressable>
              <Pressable
                onPress={() => void submitQuery(query)}
                disabled={!query.trim() || isStreaming || isViewingPast}
                style={[styles.sendButton, (!query.trim() || isStreaming || isViewingPast) && styles.roundButtonDisabled]}
              >
                <Send color={palette.white} size={18} />
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={sessionSheetVisible} transparent animationType="slide" onRequestClose={() => setSessionSheetVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSessionSheetVisible(false)}>
          <Pressable style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Select session</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
              {!isViewingPast ? <StatusChip label="Current" tone="primary" /> : null}
              {sessions.map((session) => {
                const isActive = activeSessionId === session.session_id;
                return (
                  <Pressable
                    key={session.session_id}
                    onPress={() => {
                      void handleSelectSession(session.session_id);
                      setSessionSheetVisible(false);
                    }}
                    style={[styles.sheetPill, isActive && styles.sessionPillActive]}
                  >
                    <Text numberOfLines={1} style={[styles.sessionLabel, isActive && styles.sessionLabelActive]}>
                      {session.first_message || "Chat"}
                    </Text>
                    <Text style={styles.sessionMeta}>{formatDateLabel(session.created_at)} · {session.message_count}/100</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {voiceMode !== "inactive" ? (
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceBackdrop} />
          <LinearGradient colors={[...voiceOverlayColors]} style={[styles.voiceOrb, { transform: [{ scale: 1 + Math.min(voiceLevel, 8) * 0.02 }] }]}>
            {voiceMode === "listening" ? <Mic color={palette.white} size={34} /> : <Sparkles color={palette.white} size={34} />}
          </LinearGradient>
          <Text style={styles.voiceTitle}>{voiceMode === "listening" ? "Listening..." : voiceMode === "thinking" ? "Thinking..." : "Speaking..."}</Text>
          <Text style={styles.voiceSubtitle}>
            {voiceMode === "listening"
              ? interimTranscript || "Ask your question naturally."
              : voiceMode === "thinking"
                ? "Preparing the agronomist response."
                : "Reading the answer aloud."}
          </Text>
          <ActionButton label="Stop voice chat" onPress={stopVoiceMode} tone="secondary" icon={<MicOff color={palette.primary} size={18} />} />
        </View>
      ) : null}
    </View>
  );
}

async function consumeChatResponse(
  response: Response,
  onEvent: (event: { event: string; data?: any; message?: string }) => void,
) {
  let finalAnswer = "";
  let bufferedText = "";

  const processLines = (lines: string[]) => {
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload) continue;

      try {
        const parsed = JSON.parse(payload);
        onEvent(parsed);

        if (parsed.event === "final_result") {
          finalAnswer = parsed.data?.answer || finalAnswer;
        }
      } catch {
        // Ignore partial JSON chunks and continue buffering.
      }
    }
  };

  const processChunk = (chunk: string) => {
    bufferedText += chunk;
    const lines = bufferedText.split(/\r?\n/);
    bufferedText = lines.pop() ?? "";
    processLines(lines);
  };

  const reader = response.body?.getReader?.();

  if (reader) {
    const decoder = new TextDecoder("utf-8");
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        processChunk(decoder.decode(result.value, { stream: !done }));
      }
    }
  } else {
    processChunk(await response.text());
  }

  if (bufferedText.trim()) {
    processLines([bufferedText]);
  }

  return finalAnswer;
}

const markdownStyles = {
  body: { color: palette.textPrimary, fontSize: 14, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  heading1: { fontSize: 18, fontWeight: "700" as const, color: palette.primary, marginBottom: 8 },
  heading2: { fontSize: 16, fontWeight: "700" as const, color: palette.primary, marginBottom: 6 },
  strong: { fontWeight: "700" as const, color: palette.primaryDeep },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  orbTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(220, 235, 220, 0.88)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -70,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 234, 210, 0.92)",
  },
  sessionBar: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  sessionBarCompact: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  sessionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sheetTrigger: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  sheetTriggerText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  sessionBarTitle: {
    color: palette.textMuted,
    fontSize: text.caption,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  newIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft,
  },
  sessionList: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    paddingRight: spacing.sm,
    paddingBottom: 2,
  },
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 132,
    maxWidth: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  sessionPillActive: {
    borderColor: palette.borderStrong,
    backgroundColor: palette.primarySoft,
  },
  sessionPillDisabled: {
    opacity: 0.55,
  },
  sessionCopy: {
    flex: 1,
  },
  sessionLabel: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  sessionLabelActive: {
    color: palette.primaryDeep,
  },
  sessionMeta: {
    marginTop: 2,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  chatContainer: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + 54,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: text.body,
    fontWeight: "500",
  },
  hintCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  hintLabel: {
    color: palette.textMuted,
    fontSize: text.caption,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    paddingBottom: 2,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    flexShrink: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  messageRow: {
    width: "100%",
    flexDirection: "row",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowBot: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: {
    backgroundColor: palette.primary,
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: "rgba(255,253,247,0.95)",
    borderWidth: 1,
    borderColor: palette.border,
    borderBottomLeftRadius: 6,
  },
  statusBubble: {
    backgroundColor: palette.surfaceMuted,
    borderBottomLeftRadius: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  userText: {
    color: palette.white,
    fontSize: text.body,
    lineHeight: 21,
  },
  jumpToLatest: {
    alignSelf: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: palette.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  jumpToLatestText: {
    color: palette.primaryDeep,
    fontSize: 12,
    fontWeight: "600",
  },
  pastSessionBanner: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pastSessionText: {
    flex: 1,
    color: palette.textSecondary,
    fontSize: text.body,
    lineHeight: 20,
  },
  voiceErrorCard: {
    marginTop: spacing.sm,
    backgroundColor: palette.warningSoft,
  },
  voiceErrorText: {
    color: palette.warning,
    fontSize: text.body,
    fontWeight: "600",
  },
  retryVoiceButton: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
  },
  retryVoiceText: {
    color: palette.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  voiceBadgeCard: {
    marginTop: spacing.xs,
    backgroundColor: palette.infoSoft,
  },
  voiceBadgeText: {
    color: palette.info,
    fontSize: 12,
    fontWeight: "600",
  },
  inputCard: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    color: palette.textPrimary,
    fontSize: 15,
  },
  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft,
  },
  roundButtonActive: {
    backgroundColor: palette.primary,
  },
  roundButtonDisabled: {
    opacity: 0.45,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
  },
  voiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  voiceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  voiceOrb: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTitle: {
    marginTop: spacing.xl,
    color: palette.white,
    fontSize: 28,
    fontWeight: "900",
  },
  voiceSubtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    color: "rgba(255,255,255,0.9)",
    fontSize: text.body,
    lineHeight: 22,
    textAlign: "center",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
    justifyContent: "flex-end",
  },
  sheetBody: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    maxHeight: "64%",
  },
  sheetTitle: {
    color: palette.textPrimary,
    fontSize: text.subtitle,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  sheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sheetPill: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
