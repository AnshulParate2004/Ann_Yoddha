import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { streamChat } from '../api/chat';
import { palette, radius } from '../theme/tokens';
import { Send, Sparkles } from 'lucide-react-native';
import MarkdownDisplay from 'react-native-markdown-display';

type Message = { id: string; role: 'user' | 'bot' | 'status'; content: string };

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function Chat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'bot', content: "Hello! I am your AI Agronomist Agent. Ask me anything about crop diseases!" }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const sessionIdRef = useRef(generateUUID());

  const sendMessage = async () => {
    if (!query.trim() || loading || !token) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query.trim() };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'status', content: 'Agent is analyzing query...' }]);

    try {
      const response = await streamChat(userMsg.content, sessionIdRef.current, token);
      
      // In a real mobile app, handling SSE natively requires libraries like `react-native-sse`.
      // For fallback in fetch, we can read text assuming JSON or accumulating.
      // For this simplified version since streaming fetch API is not natively supported in standard react-native RN fetch without polyfills:
      const txt = await response.text();
      
      // Attempt to parse out final answer from event stream formatting
      const lines = txt.split('\n');
      let finalAnswer = "";
      for (const line of lines) {
         if (line.startsWith('data: ')) {
           try {
             const dt = JSON.parse(line.slice(6));
             if (dt.event === 'final_result') finalAnswer = dt.data.answer;
             if (dt.event === 'error') finalAnswer = `Error: ${dt.message}`;
           } catch (e) {}
         }
      }

      if (!finalAnswer) finalAnswer = "I'm sorry, I couldn't reach the agent.";

      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, role: 'bot', content: finalAnswer } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, role: 'status', content: 'Connection failed.' } : m));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ann Yoddha Agronomist</Text>
        <Text style={styles.headerSub}>Agentic AI Assistant</Text>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.chatList} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
        {messages.map(m => (
          <View key={m.id} style={[styles.msgWrapper, m.role === 'user' ? styles.msgWrapperUser : styles.msgWrapperBot]}>
            <View style={[styles.msgBubble, m.role === 'user' ? styles.msgUser : m.role === 'status' ? styles.msgStatus : styles.msgBot]}>
              {m.role === 'status' ? (
                 <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                   <ActivityIndicator size="small" color={palette.textMuted}/>
                   <Text style={{color: palette.textMuted, fontSize: 12, fontStyle: 'italic'}}>{m.content}</Text>
                 </View>
              ) : m.role === 'bot' ? (
                <MarkdownDisplay style={markdownStyles}>{m.content}</MarkdownDisplay>
              ) : (
                <Text style={styles.userText}>{m.content}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask the Agronomist Agent..."
          placeholderTextColor={palette.textMuted}
          value={query}
          onChangeText={setQuery}
          editable={!loading}
        />
        <TouchableOpacity style={[styles.sendBtn, (!query.trim() || loading) && {opacity: 0.5}]} onPress={sendMessage} disabled={!query.trim() || loading}>
          <Send color="#fff" size={18} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: { color: palette.textPrimary, fontSize: 14, lineHeight: 22 },
  heading1: { fontSize: 18, fontWeight: '700' as const, color: palette.primary, marginBottom: 8 },
  heading2: { fontSize: 16, fontWeight: '600' as const, color: palette.primary, marginBottom: 6 },
  strong: { fontWeight: '700' as const, color: palette.primary },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: { padding: 16, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border },
  headerTitle: { fontSize: 16, fontWeight: '600', color: palette.textPrimary },
  headerSub: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  chatList: { flex: 1 },
  msgWrapper: { width: '100%', marginBottom: 12, flexDirection: 'row' },
  msgWrapperUser: { justifyContent: 'flex-end' },
  msgWrapperBot: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: radius.md },
  msgUser: { backgroundColor: palette.primary, borderBottomRightRadius: 4 },
  msgBot: { backgroundColor: palette.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: palette.border },
  msgStatus: { backgroundColor: 'transparent', padding: 4 },
  userText: { color: '#fff', fontSize: 14 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border, alignItems: 'center' },
  input: { flex: 1, backgroundColor: palette.background, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 14, color: palette.textPrimary },
  sendBtn: { marginLeft: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, justifyContent: 'center', alignItems: 'center' }
});
