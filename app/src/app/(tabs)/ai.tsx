import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ILOWA_COLORS } from '../../theme/colors';
import { ElderAvatar } from '../../components/ElderAvatar';
import { useRegion } from '../../hooks/useRegion';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { chatWithElderAI, initPrivacyAI } from '../../lib/ai/privacy-ai';

interface ChatMessage {
  id: string;
  role: 'user' | 'elder';
  text: string;
  timestamp: number;
}

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const voiceInput = useVoiceInput();
  const { activeElder, elderColors, activeLanguage, config } = useRegion();
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [aiSource, setAiSource] = useState<'aya' | 'lelapa' | 'glm5' | 'local'>('local');

  // Initialize privacy AI on mount
  React.useEffect(() => {
    initPrivacyAI({
      region: config?.region || 'west-africa',
      defaultLanguage: activeLanguage?.code || 'en',
    }).catch(console.error);
  }, [config?.region, activeLanguage?.code]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Reset the conversation whenever the Elder or language actually changes.
  // This is the fix for the bug where switching to Gogo Thandi still showed
  // Baba Dee's greeting — useState only captures the initial value once.
  React.useEffect(() => {
    const greeting = activeElder.greeting[activeLanguage.code] || activeElder.greeting.en;
    setMessages([
      {
        id: `welcome-${activeElder.id}-${activeLanguage.code}`,
        role: 'elder',
        text: `${greeting}\n\nI am ${activeElder.name}, ${activeElder.title}. Ask me anything about markets, predictions, or seek wisdom from the ancestors.`,
        timestamp: Date.now(),
      },
    ]);
    setAiSource('local');
  }, [activeElder.id, activeLanguage.code]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      const response = await chatWithElderAI({
        message: text.trim(),
        elderId: activeElder.id,
        language: activeLanguage?.code || 'en',
        region: config?.region || 'west-africa',
      });
      
      setAiSource(response.source);
      
      const elderMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'elder',
        text: response.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, elderMsg]);
    } catch (error) {
      console.error('[AI] Chat error:', error);
      const wisdom = activeElder.wisdom[Math.floor(Math.random() * activeElder.wisdom.length)];
      const elderMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'elder',
        text: wisdom,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, elderMsg]);
      setAiSource('local');
    } finally {
      setIsThinking(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
        <ElderAvatar elder={activeElder} size={40} showGlow />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: elderColors.primary }]}>
            {activeElder.name}
          </Text>
          <Text style={styles.headerTitle}>{activeElder.title}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="sparkles" size={14} color={ILOWA_COLORS.purple} />
          <Text style={styles.headerBadgeText}>
            {aiSource === 'glm5' ? 'GLM-5 Deep' : aiSource === 'aya' ? 'Aya AI' : aiSource === 'lelapa' ? 'Lelapa AI' : 'Elder Wisdom'}
          </Text>
        </View>
      </Animated.View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <Animated.View
            key={msg.id}
            entering={FadeIn.duration(300)}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.elderBubble,
            ]}
          >
            {msg.role === 'elder' && (
              <View style={styles.elderMsgHeader}>
                <ElderAvatar elder={activeElder} size={24} />
                <Text style={[styles.elderMsgName, { color: elderColors.primary }]}>
                  {activeElder.name}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                msg.role === 'user' && styles.userMessageText,
              ]}
            >
              {msg.text}
            </Text>
          </Animated.View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {[
            'Today\'s wisdom',
            'Analyze SOL/USD trend',
            'Calculate DeFi yield',
            'Predict Naira rate',
            'Explain staking',
            'Trending topics',
          ].map((action, i) => (
            <Pressable
              key={i}
              style={styles.quickChip}
              onPress={() => sendMessage(action)}
            >
              <Text style={styles.quickChipText}>{action}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <VoiceInputButton
          size={40}
          onRecordComplete={async (uri) => {
            const text = await voiceInput.transcribe(uri);
            if (text) {
              sendMessage(text);
            }
            voiceInput.reset();
          }}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Ask the Elder..."
          placeholderTextColor={ILOWA_COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => sendMessage(inputText)}
          returnKeyType="send"
          multiline={false}
        />
        <Pressable
          onPress={() => sendMessage(inputText)}
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() ? elderColors.primary : ILOWA_COLORS.cardDark },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() ? ILOWA_COLORS.deepBlack : ILOWA_COLORS.textMuted}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ILOWA_COLORS.deepBlack,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontFamily: 'Sora-Bold',
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textMuted,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontFamily: 'Sora',
    fontSize: 10,
    color: ILOWA_COLORS.purple,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  elderBubble: {
    alignSelf: 'flex-start',
    backgroundColor: ILOWA_COLORS.cardDark,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    borderBottomRightRadius: 4,
  },
  elderMsgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  elderMsgName: {
    fontFamily: 'Sora',
    fontSize: 11,
  },
  messageText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    lineHeight: 21,
  },
  userMessageText: {
    color: ILOWA_COLORS.cyan,
  },
  quickActions: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
  },
  quickRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  quickChip: {
    backgroundColor: ILOWA_COLORS.cardDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickChipText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    backgroundColor: ILOWA_COLORS.cardDark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
