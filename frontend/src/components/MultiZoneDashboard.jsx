import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, Settings, Activity, Tag, Clock, ScrollText, Loader2, Edit2, X, Check, MapPin, ArrowRight } from 'lucide-react';
import ZoneManagement from './ZoneManagement';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

const MultiZoneDashboard = () => {
    const [status, setStatus] = useState(null);
    const [connected, setConnected] = useState(false);
    const [showZoneManagement, setShowZoneManagement] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [newTagName, setNewTagName] = useState("");

    // WebSocket Connection
    useEffect(() => {
        let ws;
        let reconnectTimer;

        const connect = () => {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                setConnected(true);
                console.log("WS Connected");
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setStatus(data);
                } catch (e) {
                    console.error("Parse error", e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                console.log("WS Closed, retrying...");
                reconnectTimer = setTimeout(connect, 2000);
            };
        };

        connect();

        return () => {
            if (ws) ws.close();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, []);

    const startAllZones = async () => {
        await fetch(`${API_URL}/zones/start-all`, { method: 'POST' });
    };

    const stopAllZones = async () => {
        await fetch(`${API_URL}/zones/stop-all`, { method: 'POST' });
    };

    const startEditingTag = (tag) => {
        setEditingTag({ id: tag.id, currentName: tag.name });
        setNewTagName(tag.name);
    };

    const saveTagName = async () => {
        if (!newTagName.trim()) return;

        try {
            const response = await fetch(`${API_URL}/tag/name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag_id: editingTag.id,
                    name: newTagName.trim()
                })
            });

            if (response.ok) {
                setEditingTag(null);
                setNewTagName("");
            }
        } catch (error) {
            console.error("Failed to update tag name:", error);
        }
    };

    const cancelEdit = () => {
        setEditingTag(null);
        setNewTagName("");
    };

    const getConnectionStateColor = (state) => {
        switch (state) {
            case 'connected': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'connecting': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-slate-400';
        }
    };

    const getConnectionIcon = (state) => {
        if (state === 'connected') return <Wifi className="w-4 h-4" />;
        if (state === 'connecting') return <Loader2 className="w-4 h-4 animate-spin" />;
        return <WifiOff className="w-4 h-4" />;
    };

    return (
        <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 to-slate-800">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Activity className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                            RFID Sentinel
                        </h1>
                        <p className="text-slate-400 text-sm">Multi-Zone Presence Monitor</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className={`flex items-center px-4 py-2 rounded-lg glass-panel ${connected ? 'text-green-400' : 'text-red-400'}`}>
                        {connected ? <Wifi className="w-5 h-5 mr-2" /> : <WifiOff className="w-5 h-5 mr-2" />}
                        <span className="font-semibold text-xs uppercase tracking-wider">
                            {connected ? 'System Online' : 'Disconnected'}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowZoneManagement(true)}
                        className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors border border-blue-500"
                    >
                        <Settings className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Control Panel */}
                <div className="glass-panel p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <div className="text-sm">
                            <span className="text-slate-400">Total Zones:</span>
                            <span className="ml-2 font-mono font-bold text-slate-200">{status?.total_zones || 0}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-slate-400">Active:</span>
                            <span className="ml-2 font-mono font-bold text-green-400">{status?.active_zones || 0}</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={startAllZones}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold text-sm transition-colors"
                        >
                            Start All
                        </button>
                        <button
                            onClick={stopAllZones}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg font-semibold text-sm transition-colors"
                        >
                            Stop All
                        </button>
                    </div>
                </div>

                {/* Transfers Panel */}
                {status?.transfers && status.transfers.length > 0 && (
                    <div className="glass-panel p-4 mb-6 border-l-4 border-l-blue-500">
                        <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center">
                            <ArrowRight className="w-5 h-5 mr-2" />
                            Recent Transfers
                        </h3>
                        <div className="space-y-2">
                            {status.transfers.slice(0, 5).map((transfer, idx) => (
                                <div key={idx} className="flex items-center text-sm bg-blue-500/5 p-2 rounded">
                                    <Tag className="w-4 h-4 text-blue-400 mr-2" />
                                    <span className="font-semibold text-slate-200">{transfer.tag_name}</span>
                                    <span className="mx-2 text-slate-500">→</span>
                                    <span className="text-slate-400">{transfer.from_zone}</span>
                                    <ArrowRight className="w-3 h-3 mx-2 text-slate-600" />
                                    <span className="text-blue-400">{transfer.to_zone}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Zones Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {status?.zones?.map(zone => (
                        <div key={zone.zone_id} className="glass-panel p-6">
                            {/* Zone Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <MapPin className="w-6 h-6 text-blue-400" />
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-200">{zone.zone_name}</h2>
                                        <p className="text-xs text-slate-500">{zone.ip}</p>
                                    </div>
                                </div>
                                <div className={`flex items-center px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider ${getConnectionStateColor(zone.connection_state)}`}>
                                    {getConnectionIcon(zone.connection_state)}
                                    <span className="ml-2">{zone.connection_state}</span>
                                </div>
                            </div>

                            {/* Zone Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-slate-900/50 p-3 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Active Tags</div>
                                    <div className="text-2xl font-bold text-emerald-400">{zone.active_count}</div>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Missing</div>
                                    <div className="text-2xl font-bold text-red-400">{zone.missing_count}</div>
                                </div>
                            </div>

                            {/* Missing Alert */}
                            {zone.missing_count > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                                    <div className="flex items-center text-red-400 text-sm font-semibold mb-2">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        {zone.missing_count} Missing Tag{zone.missing_count > 1 ? 's' : ''}
                                    </div>
                                    <div className="space-y-1">
                                        {zone.missing_tags?.slice(0, 3).map(tag => (
                                            <div key={tag.id} className="text-xs text-red-300 flex items-center justify-between">
                                                <span>{tag.name}</span>
                                                <span className="text-red-500/70">{tag.age_seconds}s ago</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Tags */}
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {zone.active_tags?.map(tag => (
                                    <div key={tag.id} className="glass-card p-3 flex items-center justify-between group">
                                        <div className="flex items-center space-x-3 flex-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-200 text-sm">{tag.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{tag.id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-slate-500 font-mono">{tag.age_seconds}s</span>
                                            <button
                                                onClick={() => startEditingTag(tag)}
                                                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit2 className="w-3 h-3 text-blue-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {zone.active_tags?.length === 0 && (
                                    <div className="text-center py-8 text-slate-600 text-sm">
                                        No tags detected in this zone
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* System Logs */}
                <div className="glass-panel p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-300 font-semibold flex items-center">
                            <ScrollText className="w-4 h-4 mr-2" />
                            System Logs
                        </h3>
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {status?.logs && status.logs.length > 0 ? (
                            status.logs.slice().reverse().map((log, i) => (
                                <div key={i} className={`text-xs p-2 rounded border-l-2 ${log.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-300' :
                                        log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' :
                                            log.type === 'warn' ? 'bg-amber-500/10 border-amber-500 text-amber-300' :
                                                'bg-slate-800/50 border-blue-500/30 text-slate-400'
                                    }`}>
                                    <span className="opacity-50 mr-2 font-mono">{log.time}</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-600 py-8 italic text-xs">No logs available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Zone Management Modal */}
            {showZoneManagement && (
                <ZoneManagement onClose={() => setShowZoneManagement(false)} />
            )}

            {/* Edit Tag Name Modal */}
            {editingTag && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-panel p-6 max-w-md w-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center">
                                <Edit2 className="w-5 h-5 mr-2 text-blue-400" />
                                Edit Tag Name
                            </h3>
                            <button onClick={cancelEdit} className="p-1 hover:bg-slate-700 rounded transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Tag ID</label>
                                <p className="text-sm font-mono text-slate-300 bg-slate-900 p-2 rounded mt-1">{editingTag.id}</p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Tag Name</label>
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && saveTagName()}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 mt-1 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Enter tag name..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={saveTagName}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors flex items-center justify-center"
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Save
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiZoneDashboard;
