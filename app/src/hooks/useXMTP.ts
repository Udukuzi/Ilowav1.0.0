import { useState, useCallback, useRef, useEffect } from 'react';
import {
  initXMTP,
  joinRadioChatRoom,
  sendMessage as xmtpSendMessage,
  streamMessages,
  isXMTPConnected,
} from '../lib/chat/xmtp';

interface ChatMessage {
  id: string;
  senderAddress: string;
  content: string;
  timestamp: Date;
}

interface XMTPState {
  connected: boolean;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

export function useXMTP() {
  const [state, setState] = useState<XMTPState>({
    connected: false,
    messages: [],
    loading: false,
    error: null,
  });

  const conversationRef = useRef<any>(null);

  const connect = useCallback(async (wallet: any) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const client = await initXMTP(wallet);
      if (client) {
        setState((prev) => ({ ...prev, connected: true, loading: false }));
      } else {
        setState((prev) => ({ ...prev, loading: false, error: 'XMTP SDK not available' }));
      }
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to connect XMTP' }));
    }
  }, []);

  const joinRoom = useCallback(async (stationId: string) => {
    try {
      const conversation = await joinRadioChatRoom(stationId);
      conversationRef.current = conversation;

      streamMessages(conversation, (msg) => {
        const chatMsg: ChatMessage = {
          id: `${msg.timestamp.getTime()}-${msg.sender}`,
          senderAddress: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp,
        };
        setState((prev) => ({ ...prev, messages: [...prev.messages, chatMsg] }));
      });
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to join chat room' }));
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    try {
      if (conversationRef.current) {
        await xmtpSendMessage(conversationRef.current, text);
      }
      const msg: ChatMessage = {
        id: Date.now().toString(),
        senderAddress: 'you',
        content: text,
        timestamp: new Date(),
      };
      setState((prev) => ({ ...prev, messages: [...prev.messages, msg] }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to send message' }));
    }
  }, []);

  return {
    ...state,
    connect,
    joinRoom,
    sendMessage,
  };
}
