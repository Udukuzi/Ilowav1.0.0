/**
 * KYD Ticketing Hook
 * 
 * React hook for integrating KYD Labs TICKS protocol ticketing
 * into Ilowa components.
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  kydClient,
  KYDEvent,
  Ticket,
  TicketTier,
  PurchaseResult,
  getTicketAvailability,
} from '../lib/ticketing/kyd';

interface UseKYDTicketingOptions {
  walletAddress?: string;
  autoFetch?: boolean;
}

interface UseKYDTicketingReturn {
  // State
  events: KYDEvent[];
  myTickets: Ticket[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchEvents: (filters?: { status?: KYDEvent['status'] }) => Promise<void>;
  fetchMyTickets: () => Promise<void>;
  purchaseTicket: (eventId: string, tierId: string) => Promise<PurchaseResult>;
  transferTicket: (ticketId: string, toWallet: string) => Promise<boolean>;
  verifyTicket: (qrData: string) => Promise<{ valid: boolean; event?: KYDEvent }>;
  getEvent: (eventId: string) => Promise<KYDEvent | null>;
  
  // Helpers
  getAvailability: (tier: TicketTier) => ReturnType<typeof getTicketAvailability>;
}

export function useKYDTicketing(options: UseKYDTicketingOptions = {}): UseKYDTicketingReturn {
  const { walletAddress, autoFetch = true } = options;
  
  const [events, setEvents] = useState<KYDEvent[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize KYD client
  useEffect(() => {
    const init = async () => {
      const success = await kydClient.initialize();
      setIsInitialized(success);
      if (!success) {
        setError('Failed to initialize KYD client');
      }
    };
    init();
  }, []);

  // Auto-fetch events on mount
  useEffect(() => {
    if (isInitialized && autoFetch) {
      fetchEvents();
      if (walletAddress) {
        fetchMyTickets();
      }
    }
  }, [isInitialized, autoFetch, walletAddress]);

  const fetchEvents = useCallback(async (filters?: { status?: KYDEvent['status'] }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await kydClient.getEvents(filters);
      setEvents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyTickets = useCallback(async () => {
    if (!walletAddress) {
      setMyTickets([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await kydClient.getMyTickets(walletAddress);
      setMyTickets(result);
    } catch (err) {
      console.error('[useKYDTicketing] Failed to fetch tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const purchaseTicket = useCallback(async (
    eventId: string,
    tierId: string
  ): Promise<PurchaseResult> => {
    if (!walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your wallet to purchase tickets.');
      return { success: false, error: 'Wallet not connected' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Demo mode: build tx but return simulated signature
      // Real wallet: wire to MWA signAndSendTransaction
      const demoSignAndSend = async (txBuilder: (signer: PublicKey) => Promise<Transaction>) => {
        const signer = new PublicKey(walletAddress!);
        await txBuilder(signer); // build it to validate, but don't send in demo
        return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      };
      
      const result = await kydClient.purchaseTicket(
        eventId,
        tierId,
        walletAddress,
        demoSignAndSend
      );

      if (result.success && result.ticket) {
        setMyTickets(prev => [...prev, result.ticket!]);
        Alert.alert(
          'Purchase Successful! 🎫',
          'Your ticket has been added to your wallet.',
          [{ text: 'View Ticket', onPress: () => {} }, { text: 'OK' }]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Unable to complete purchase');
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const transferTicket = useCallback(async (
    ticketId: string,
    toWallet: string
  ): Promise<boolean> => {
    if (!walletAddress) {
      Alert.alert('Wallet Required', 'Please connect your wallet.');
      return false;
    }

    setIsLoading(true);
    try {
      const demoSignAndSend = async (txBuilder: (signer: PublicKey) => Promise<Transaction>) => {
        const signer = new PublicKey(walletAddress!);
        await txBuilder(signer);
        return `demo_xfer_${Date.now()}`;
      };
      
      const result = await kydClient.transferTicket(
        ticketId,
        walletAddress,
        toWallet,
        demoSignAndSend
      );

      if (result.success) {
        // Remove ticket from local state
        setMyTickets(prev => prev.filter(t => t.id !== ticketId));
        Alert.alert('Transfer Complete', 'Ticket has been transferred successfully.');
      } else {
        Alert.alert('Transfer Failed', result.error || 'Unable to transfer ticket');
      }

      return result.success;
    } catch (err) {
      console.error('[useKYDTicketing] Transfer failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const verifyTicket = useCallback(async (qrData: string) => {
    const result = await kydClient.verifyTicket(qrData);
    return {
      valid: result.valid,
      event: result.event,
    };
  }, []);

  const getEvent = useCallback(async (eventId: string) => {
    return kydClient.getEvent(eventId);
  }, []);

  return {
    events,
    myTickets,
    isLoading,
    error,
    fetchEvents,
    fetchMyTickets,
    purchaseTicket,
    transferTicket,
    verifyTicket,
    getEvent,
    getAvailability: getTicketAvailability,
  };
}
