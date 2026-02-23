'use client';

import { useEffect, useRef, useState } from 'react';
import { addWebSocketListener } from '@/lib/websocket';

interface PacketStatus {
  packet_id: string;
  epc: string;
  onboarding_time: string | null;
  vault_entry_time: string | null;
  vault_out_time: string | null;
}

interface TimerState {
  packet_id: string;
  remainingSeconds: number;
  isActive: boolean;
  isExpired: boolean;
  hasVaultEntry: boolean;
}

export default function TrackingPage() {
  const [packets, setPackets] = useState<PacketStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerConfig, setTimerConfig] = useState(30); // Default 30 seconds
  const [timers, setTimers] = useState<Map<string, TimerState>>(new Map());
  const wsListenerRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load timer config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('timerConfig');
    if (savedConfig) {
      const config = parseInt(savedConfig);
      setTimerConfig(config);
    }
  }, []);

  // Main effect for packet loading and WebSocket
  useEffect(() => {
    loadPacketStatus();

    wsListenerRef.current = addWebSocketListener((data: string) => {
      if (data.startsWith('TRACK:')) {
        const parts = data.split(':');
        const epc = parts[1]?.trim();
        if (epc) {
          loadPacketStatus();
        }
      }
    });

    return () => {
      if (wsListenerRef.current) {
        wsListenerRef.current();
      }
    };
  }, []);

  // Timer countdown effect
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimers(prev => {
        const updated = new Map(prev);
        updated.forEach((timer, packetId) => {
          if (timer.isActive && !timer.hasVaultEntry) {
            if (timer.remainingSeconds > 0) {
              timer.remainingSeconds -= 1;
            } else if (timer.remainingSeconds === 0 && !timer.isExpired) {
              timer.isExpired = true;
              timer.isActive = false;
              
              // Find the EPC for this packet and record the timeout
              const packet = packets.find(p => p.packet_id === packetId);
              if (packet && packet.epc) {
                fetch(`/api/v1/tag-out?epc=${packet.epc}`, { method: 'POST' })
                  .then(() => {
                    console.log(`✓ Tag timeout recorded for EPC: ${packet.epc}`);
                    // Reload packet status to update vault_out_time
                    setTimeout(loadPacketStatus, 500);
                  })
                  .catch(err => console.error('Failed to record tag timeout:', err));
              }
            }
          }
        });
        return updated;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [packets]);

  // Monitor packet status changes to update timers
  useEffect(() => {
    const newTimers = new Map(timers);

    packets.forEach(packet => {
      const timer = newTimers.get(packet.packet_id);

      // If packet has vault entry, stop timer
      if (packet.vault_entry_time) {
        if (timer) {
          timer.isActive = false;
          timer.hasVaultEntry = true;
        }
      } 
      // If packet is newly onboarded and no timer, start one
      else if (packet.onboarding_time && !timer) {
        newTimers.set(packet.packet_id, {
          packet_id: packet.packet_id,
          remainingSeconds: timerConfig,
          isActive: true,
          isExpired: false,
          hasVaultEntry: false
        });
      }
    });

    setTimers(newTimers);
  }, [packets, timerConfig]);

  const loadPacketStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/packet-status');
      const data = await response.json();
      setPackets(data || []);
    } catch (error) {
      console.error('Failed to load packet status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return date.toLocaleString();
    } catch {
      return timeString;
    }
  };

  const getRecentPackets = () => {
    return packets.filter(p => {
      const timer = timers.get(p.packet_id);
      return timer && (timer.isActive || timer.isExpired);
    }).slice(0, 5); // Show last 5 active timers
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', padding: '40px 20px', paddingBottom: '60px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', color: '#2c3e50', margin: '0 0 8px 0' }}>Gold Packet Movement Tracking</h1>
          <p style={{ color: '#7f8c8d', fontSize: '14px', margin: 0 }}>Real-time monitoring of all scanned packets through the vault system</p>
        </div>

        {/* Active Timer Section */}
        {getRecentPackets().length > 0 && (
          <div style={{
            marginBottom: '40px',
            padding: '30px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            borderTop: '4px solid #f39c12'
          }}>
            <h3 style={{ margin: '0 0 24px 0', color: '#2c3e50', fontSize: '18px', fontWeight: '600' }}>
              Active Monitoring - Vault Entry Countdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
              {getRecentPackets().map(packet => {
                const timer = timers.get(packet.packet_id);
                if (!timer) return null;

                const isExpired = timer.isExpired;
                const bgColor = isExpired ? 'white' : 'white';
                const borderColor = isExpired ? '#e74c3c' : '#f39c12';
                const timerColor = isExpired ? '#e74c3c' : (timer.remainingSeconds <= 10 ? '#e74c3c' : '#f39c12');

                return (
                  <div
                    key={packet.packet_id}
                    style={{
                      padding: '20px',
                      backgroundColor: bgColor,
                      border: `2px solid ${borderColor}`,
                      borderRadius: '10px',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#95a5a6', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                      {packet.packet_id}
                    </div>
                    
                    {isExpired ? (
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#e74c3c',
                          marginBottom: '8px'
                        }}>
                          TIMEOUT
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '48px',
                        fontWeight: 'bold',
                        color: timerColor,
                        fontFamily: 'monospace',
                        marginBottom: '8px',
                        letterSpacing: '2px'
                      }}>
                        {String(timer.remainingSeconds).padStart(2, '0')}
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: isExpired ? '#e74c3c' : '#7f8c8d', fontWeight: '500' }}>
                      {isExpired 
                        ? 'Not detected' 
                        : 'Waiting...'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <button 
            onClick={loadPacketStatus} 
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ecf0f1' : '#27ae60',
              color: loading ? '#95a5a6' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#229954';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#27ae60';
              }
            }}
          >
            {loading ? 'Loading...' : 'Refresh Status'}
          </button>
        </div>

        {/* Packets Table */}
        {packets.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            <p style={{ fontSize: '16px', color: '#95a5a6' }}>No packets tracked yet</p>
            <p style={{ fontSize: '13px', color: '#bdc3c7' }}>Onboard assets to begin tracking them here</p>
          </div>
        ) : (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#2c3e50',
                  color: 'white'
                }}>
                  <th style={{ padding: '18px 20px', textAlign: 'left', fontWeight: '600', fontSize: '14px', borderRight: '1px solid #34495e' }}>
                    Packet ID
                  </th>
                  <th style={{ padding: '18px 20px', textAlign: 'left', fontWeight: '600', fontSize: '14px', borderRight: '1px solid #34495e' }}>
                    Onboarding Time
                  </th>
                  <th style={{ padding: '18px 20px', textAlign: 'left', fontWeight: '600', fontSize: '14px', borderRight: '1px solid #34495e' }}>
                    Vault Entry
                  </th>
                  <th style={{ padding: '18px 20px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>
                    Vault Out
                  </th>
                </tr>
              </thead>
              <tbody>
                {packets.map((packet, index) => {
                  const timer = timers.get(packet.packet_id);
                  // Show "Monitoring..." only if timer is actively counting down
                  // Show timestamp if vault_out_time exists (EPC not detected)
                  const showMonitoring = timer && timer.isActive && packet.vault_entry_time && !packet.vault_out_time;
                  
                  return (
                  <tr 
                    key={index}
                    style={{
                      borderBottom: '1px solid #ecf0f1',
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f4f8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white'}
                  >
                    <td style={{ 
                      padding: '16px 20px',
                      borderRight: '1px solid #ecf0f1',
                      fontWeight: '600',
                      color: '#2c3e50',
                      fontSize: '14px'
                    }}>
                      {packet.packet_id}
                    </td>
                    <td style={{ 
                      padding: '16px 20px',
                      borderRight: '1px solid #ecf0f1',
                      fontSize: '13px',
                      color: packet.onboarding_time ? '#27ae60' : '#95a5a6'
                    }}>
                      {formatTime(packet.onboarding_time)}
                    </td>
                    <td style={{ 
                      padding: '16px 20px',
                      borderRight: '1px solid #ecf0f1',
                      fontSize: '13px',
                      color: packet.vault_entry_time ? '#3498db' : '#95a5a6'
                    }}>
                      {formatTime(packet.vault_entry_time)}
                    </td>
                    <td style={{ 
                      padding: '16px 20px',
                      fontSize: '13px',
                      color: showMonitoring ? '#f39c12' : (packet.vault_out_time ? '#e74c3c' : '#95a5a6')
                    }}>
                      {showMonitoring ? (
                        <span style={{ fontStyle: 'italic', fontWeight: '500' }}>Monitoring...</span>
                      ) : (
                        formatTime(packet.vault_out_time)
                      )}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
