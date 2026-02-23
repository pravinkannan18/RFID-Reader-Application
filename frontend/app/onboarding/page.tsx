'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addWebSocketListener } from '@/lib/websocket';

export default function OnboardingPage() {
  const router = useRouter();
  const [loanId, setLoanId] = useState('');
  const [epc, setEpc] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isScanning, setIsScanning] = useState(false);
  const [timerConfig, setTimerConfig] = useState(30);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configInput, setConfigInput] = useState('30');
  const wsListenerRef = useRef<(() => void) | null>(null);

  // Load timer config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('timerConfig');
    if (savedConfig) {
      const config = parseInt(savedConfig);
      setTimerConfig(config);
      setConfigInput(config.toString());
    }
  }, []);

  useEffect(() => {
    // Only set up WebSocket listener if scanning is active
    if (isScanning && loanId) {
      wsListenerRef.current = addWebSocketListener((data: string) => {
        // Listen for TRACK messages from backend
        if (data.startsWith('TRACK:')) {
          const parts = data.split(':');
          const receivedEpc = parts[1]?.trim();
          const deviceId = parts[2]?.trim();
          if (receivedEpc) {
            setEpc(receivedEpc);
            setMessage(`✓ RFID Tag Detected: ${receivedEpc}${deviceId ? ` (Reader: ${deviceId})` : ''}`);
            setMessageType('success');
            // Auto-bind when EPC is received
            performBind(loanId, receivedEpc);
          }
        }
      });
    }

    return () => {
      if (wsListenerRef.current) {
        wsListenerRef.current();
      }
    };
  }, [isScanning, loanId]);

  const performBind = async (loan: string, tag: string) => {
    if (!loan || !tag) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('loan_id', loan);
      params.append('epc', tag);

      const response = await fetch(`/bind?${params.toString()}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setMessage(`✓ Successfully Bound: Loan ${result.loan_id} → EPC ${result.epc}`);
      setMessageType('success');
      
      // Redirect to tracking page after 1.5 seconds
      setTimeout(() => {
        router.push('/tracking');
      }, 1500);
    } catch (error) {
      setMessage(`Error binding: ${error instanceof Error ? error.message : 'Failed to bind'}`);
      setMessageType('error');
    }
  };

  const startScanning = () => {
    if (!loanId.trim()) {
      setMessage('Please enter a Loan ID first');
      setMessageType('error');
      return;
    }
    setIsScanning(true);
    setMessage(`� Scanning... Waiting for RFID tag for Loan ID: ${loanId}`);
    setMessageType('');
    setEpc('');
  };

  const stopScanning = () => {
    setIsScanning(false);
    setMessage('');
    setEpc('');
  };

  const handleBind = () => {
    if (!loanId || !epc) {
      setMessage('Please enter Loan ID and scan an RFID tag');
      setMessageType('error');
      return;
    }
    performBind(loanId, epc);
  };

  const saveTimerConfig = (newValue: string) => {
    const num = parseInt(newValue);
    if (!isNaN(num) && num > 0) {
      setTimerConfig(num);
      setConfigInput(newValue);
      localStorage.setItem('timerConfig', newValue);
      setShowConfigModal(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Header with Timer Config */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', color: '#2c3e50', margin: '0 0 8px 0' }}>Asset Onboarding</h1>
            <p style={{ color: '#7f8c8d', fontSize: '14px', margin: 0 }}>Register gold packets to the system</p>
          </div>
          <button 
            onClick={() => setShowConfigModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.3s',
              whiteSpace: 'nowrap',
              marginLeft: '16px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
          >
            Timer Config
          </button>
        </div>

        {/* Timer Config Modal */}
        {showConfigModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h2 style={{ marginTop: 0, color: '#2c3e50', fontSize: '24px' }}>Timer Configuration</h2>
              <p style={{ color: '#7f8c8d', marginBottom: '24px', fontSize: '14px' }}>
                Set the countdown duration for vault entry detection in the tracking page
              </p>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '14px' }}>
                  Countdown Seconds
                </label>
                <input
                  type="number"
                  value={configInput}
                  onChange={(e) => setConfigInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveTimerConfig(configInput)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #ecf0f1',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3498db'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#ecf0f1'}
                  min="1"
                  max="300"
                />
                <small style={{ color: '#95a5a6', display: 'block', marginTop: '6px', fontSize: '12px' }}>
                  Recommended: 30-60 seconds
                </small>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => saveTimerConfig(configInput)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#229954'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setConfigInput(timerConfig.toString());
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7f8c8d'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#95a5a6'}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          marginBottom: '20px'
        }}>
          {/* Loan ID Input */}
          <div style={{ marginBottom: '30px' }}>
            <label htmlFor="loan_id" style={{
              display: 'block',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Loan ID
            </label>
            <input
              id="loan_id"
              type="text"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              placeholder="Enter loan ID (e.g., L120980)"
              disabled={isScanning}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #ecf0f1',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                transition: 'all 0.3s ease',
                opacity: isScanning ? 0.5 : 1,
                cursor: isScanning ? 'not-allowed' : 'text',
                backgroundColor: isScanning ? '#f0f0f0' : 'white'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3498db'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#ecf0f1'}
            />
          </div>

          {/* EPC Display */}
          <div style={{ marginBottom: '30px' }}>
            <label htmlFor="epc" style={{
              display: 'block',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
            </label>
            {epc && (
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#27ae60' }}>
                ✓ RFID detected - ready for binding
              </p>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <button 
              onClick={startScanning} 
              disabled={isScanning || !loanId.trim()}
              style={{
                padding: '14px 20px',
                backgroundColor: isScanning ? '#bdc3c7' : (loanId.trim() ? '#27ae60' : '#ecf0f1'),
                color: isScanning ? '#7f8c8d' : (loanId.trim() ? 'white' : '#95a5a6'),
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isScanning || !loanId.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: isScanning || !loanId.trim() ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isScanning && loanId.trim()) {
                  e.currentTarget.style.backgroundColor = '#229954';
                }
              }}
              onMouseLeave={(e) => {
                if (!isScanning && loanId.trim()) {
                  e.currentTarget.style.backgroundColor = '#27ae60';
                }
              }}
            >
              {isScanning ? '🔍 Scanning...' : (loanId.trim() ? 'Start Scanning' : 'Enter ID First')}
            </button>
            
            <button 
              onClick={stopScanning} 
              disabled={!isScanning}
              style={{
                padding: '14px 20px',
                backgroundColor: isScanning ? '#e74c3c' : '#ecf0f1',
                color: isScanning ? 'white' : '#95a5a6',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isScanning ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                opacity: isScanning ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (isScanning) {
                  e.currentTarget.style.backgroundColor = '#c0392b';
                }
              }}
              onMouseLeave={(e) => {
                if (isScanning) {
                  e.currentTarget.style.backgroundColor = '#e74c3c';
                }
              }}
            >
              Stop Scanning
            </button>
          </div>

          <button 
            onClick={handleBind} 
            disabled={isScanning || !epc}
            style={{
              width: '100%',
              padding: '14px 20px',
              backgroundColor: epc && !isScanning ? '#3498db' : '#ecf0f1',
              color: epc && !isScanning ? 'white' : '#95a5a6',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: epc && !isScanning ? 'pointer' : 'not-allowed',
              marginTop: '12px',
              transition: 'all 0.3s ease',
              opacity: epc && !isScanning ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (epc && !isScanning) {
                e.currentTarget.style.backgroundColor = '#2980b9';
              }
            }}
            onMouseLeave={(e) => {
              if (epc && !isScanning) {
                e.currentTarget.style.backgroundColor = '#3498db';
              }
            }}
          >
            Bind Asset
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: messageType === 'success' ? '#d5f4e6' : (messageType === 'error' ? '#fadbd8' : '#e8f4f8'),
            borderLeft: `4px solid ${messageType === 'success' ? '#27ae60' : (messageType === 'error' ? '#e74c3c' : '#3498db')}`,
            color: messageType === 'success' ? '#27ae60' : (messageType === 'error' ? '#c0392b' : '#2980b9'),
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
