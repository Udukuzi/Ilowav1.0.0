/**
 * Event Ticket Card Component
 * 
 * Displays KYD event information with glass morphism styling
 * and purchase functionality.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, MapPin, Users, Ticket, Clock } from 'lucide-react-native';
import { ILOWA_COLORS } from '../theme/colors';
import { KYDEvent, TicketTier, formatTicketPrice, getTicketAvailability, formatEventDate } from '../lib/ticketing/kyd';

interface EventTicketCardProps {
  event: KYDEvent;
  onPurchase?: (eventId: string, tierId: string) => Promise<void>;
  compact?: boolean;
}

export function EventTicketCard({ event, onPurchase, compact = false }: EventTicketCardProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = async () => {
    if (!selectedTier || !onPurchase) return;
    
    setIsPurchasing(true);
    try {
      await onPurchase(event.id, selectedTier);
    } finally {
      setIsPurchasing(false);
      setSelectedTier(null);
    }
  };

  const soldPercentage = (event.soldCount / event.totalCapacity) * 100;
  const isAlmostSoldOut = soldPercentage > 80;

  return (
    <View style={[styles.cardOuter, compact && styles.cardCompact]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.15)']}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Event Image */}
        {event.imageUrl && !compact && (
          <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, event.status === 'sold_out' && styles.statusSoldOut]}>
          <Text style={styles.statusText}>
            {event.status === 'active' ? (isAlmostSoldOut ? '🔥 Almost Sold Out' : '✓ On Sale') 
              : event.status === 'sold_out' ? 'Sold Out'
              : event.status}
          </Text>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>
          
          <View style={styles.metaRow}>
            <Calendar size={14} color={ILOWA_COLORS.gold} />
            <Text style={styles.metaText}>{formatEventDate(event.startTime)}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <MapPin size={14} color={ILOWA_COLORS.textMuted} />
            <Text style={styles.metaText}>{event.venue}, {event.location}</Text>
          </View>

          <View style={styles.metaRow}>
            <Users size={14} color={ILOWA_COLORS.cyan} />
            <Text style={styles.metaText}>
              {event.soldCount}/{event.totalCapacity} ({Math.round(soldPercentage)}% sold)
            </Text>
          </View>
        </View>

        {/* Ticket Tiers */}
        {!compact && (
          <View style={styles.tiersSection}>
            <Text style={styles.tiersTitle}>Select Ticket</Text>
            {event.tiers.map((tier) => {
              const availability = getTicketAvailability(tier);
              const isSelected = selectedTier === tier.id;
              
              return (
                <Pressable
                  key={tier.id}
                  style={[
                    styles.tierCard,
                    isSelected && styles.tierCardSelected,
                    availability.status === 'sold_out' && styles.tierCardDisabled,
                  ]}
                  onPress={() => availability.status !== 'sold_out' && setSelectedTier(tier.id)}
                  disabled={availability.status === 'sold_out'}
                >
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                      {tier.name}
                    </Text>
                    <Text style={styles.tierDescription} numberOfLines={1}>
                      {tier.description}
                    </Text>
                    {tier.benefits.length > 0 && (
                      <Text style={styles.tierBenefits} numberOfLines={1}>
                        ✓ {tier.benefits.slice(0, 2).join(' • ')}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.tierPricing}>
                    <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                      {formatTicketPrice(tier.price)}
                    </Text>
                    <Text style={[
                      styles.tierAvailability,
                      availability.status === 'low' && styles.tierAvailabilityLow,
                      availability.status === 'sold_out' && styles.tierAvailabilitySoldOut,
                    ]}>
                      {availability.status === 'sold_out' ? 'Sold Out' 
                        : availability.status === 'low' ? `${availability.available} left!`
                        : `${availability.available} available`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Purchase Button */}
        {!compact && selectedTier && (
          <Pressable
            style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing}
          >
            <LinearGradient
              colors={[ILOWA_COLORS.gold, '#B8860B']}
              style={styles.purchaseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color={ILOWA_COLORS.deepBlack} />
              ) : (
                <>
                  <Ticket size={18} color={ILOWA_COLORS.deepBlack} />
                  <Text style={styles.purchaseText}>Purchase Ticket</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {/* Compact View Price */}
        {compact && (
          <View style={styles.compactFooter}>
            <Text style={styles.compactPrice}>
              From {formatTicketPrice(Math.min(...event.tiers.map(t => t.price)))}
            </Text>
            <View style={styles.compactBadge}>
              <Ticket size={12} color={ILOWA_COLORS.gold} />
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
    marginBottom: 16,
  },
  cardCompact: {
    width: 200,
    marginBottom: 0,
    marginRight: 12,
  },
  card: {
    padding: 0,
  },
  eventImage: {
    width: '100%',
    height: 140,
    backgroundColor: ILOWA_COLORS.cardDark,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSoldOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  statusText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  eventInfo: {
    padding: 16,
    gap: 8,
  },
  eventName: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: ILOWA_COLORS.textSecondary,
  },
  tiersSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tiersTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
    marginBottom: 10,
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tierCardSelected: {
    borderColor: ILOWA_COLORS.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  tierCardDisabled: {
    opacity: 0.5,
  },
  tierInfo: {
    flex: 1,
    gap: 2,
  },
  tierName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: ILOWA_COLORS.textPrimary,
  },
  tierNameSelected: {
    color: ILOWA_COLORS.gold,
  },
  tierDescription: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: ILOWA_COLORS.textMuted,
  },
  tierBenefits: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.cyan,
    marginTop: 2,
  },
  tierPricing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tierPrice: {
    fontFamily: 'Sora-Bold',
    fontSize: 16,
    color: ILOWA_COLORS.textPrimary,
  },
  tierPriceSelected: {
    color: ILOWA_COLORS.gold,
  },
  tierAvailability: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: ILOWA_COLORS.textMuted,
  },
  tierAvailabilityLow: {
    color: '#F59E0B',
  },
  tierAvailabilitySoldOut: {
    color: '#EF4444',
  },
  purchaseButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  purchaseText: {
    fontFamily: 'Sora-Bold',
    fontSize: 15,
    color: ILOWA_COLORS.deepBlack,
  },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  compactPrice: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 13,
    color: ILOWA_COLORS.gold,
  },
  compactBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
