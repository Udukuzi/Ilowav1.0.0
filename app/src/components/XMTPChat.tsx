/**
 * XMTP Radio Chat Component
 * 
 * E2EE chat for radio stations - wallet-based authentication
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ILOWA_COLORS } from '../theme/colors';
import { initXMTP, joinRadioChatRoom, sendMessage, streamMessages, isXMTPConnected } from '../lib/chat/xmtp';

interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
}

interface XMTPChatProps {
  stationId: string;
  isVisible: boolean;
  userAddress?: string;
}

export function XMTPChat({ stationId, isVisible, userAddress }: XMTPChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const conversationRef = useRef<any>(null);

  useEffect(() => {
    if (!isVisible) return;
    
    if (!userAddress) {
      setError('Connect wallet to join live chat');
      return;
    }

    // Wallet is connected — clear any stale "connect wallet" error
    setError(null);

    // Auto-connect when wallet is available
    if (!isXMTPConnected()) {
      connectToChat();
    } else {
      setIsConnected(true);
    }
  }, [isVisible, userAddress]);

  const connectToChat = async () => {
    if (!userAddress) {
      setError('Connect wallet to join chat');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Initialize XMTP with user's wallet
      const client = await initXMTP({ address: userAddress });
      if (!client) {
        // Expo Go can't load native XMTP — local chat still works, E2EE in APK
        setError(null);
        setIsConnected(false);
        return;
      }

      // Join station chat room
      const conversation = await joinRadioChatRoom(stationId);
      conversationRef.current = conversation;
      setIsConnected(true);

      // Stream incoming messages
      streamMessages(conversation, (msg) => {
        const newMessage: ChatMessage = {
          id: `${msg.timestamp.getTime()}-${msg.sender}`,
          sender: shortenAddress(msg.sender),
          content: msg.content,
          timestamp: msg.timestamp,
          isOwn: msg.sender === userAddress,
        };
        setMessages((prev) => [...prev, newMessage]);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // Optimistic local add regardless of connection state
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: shortenAddress(userAddress || 'you'),
      content: inputText.trim(),
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, newMessage]);
    const text = inputText.trim();
    setInputText('');

    // If connected, also send via XMTP E2EE
    if (conversationRef.current) {
      try {
        await sendMessage(conversationRef.current, text);
      } catch (err) {
        console.warn('[XMTPChat] Send failed:', err);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <KeyboardAvoidingView
      style={styles.containerOuter}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.3)']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, isConnected && styles.dotConnected]} />
          <Text style={styles.headerTitle}>Live Chat</Text>
        </View>
        <Text style={styles.viewerCount}>{messages.length} messages</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          {!isConnected && userAddress && (
            <Pressable onPress={connectToChat} style={styles.connectButton}>
              <Text style={styles.connectButtonText}>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={{ maxHeight: 250 }}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        nestedScrollEnabled={true}
      >
        {messages.map((item) => (
          <View key={item.id} style={[styles.message, item.isOwn && styles.ownMessage]}>
            <Text style={styles.sender}>{item.sender}</Text>
            <Text style={styles.content}>{item.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Say something..."
          placeholderTextColor="#666"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable onPress={handleSend} style={styles.sendButton}>
          <Ionicons name="send" size={20} color={ILOWA_COLORS.gold} />
        </Pressable>
      </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  containerOuter: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  dotConnected: {
    backgroundColor: '#10B981',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerCount: {
    color: '#666',
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  connectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: ILOWA_COLORS.gold,
    borderRadius: 12,
  },
  connectButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  messageList: {
    padding: 12,
    gap: 8,
  },
  message: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 10,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  sender: {
    color: ILOWA_COLORS.gold,
    fontSize: 10,
    marginBottom: 2,
  },
  content: {
    color: '#fff',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
