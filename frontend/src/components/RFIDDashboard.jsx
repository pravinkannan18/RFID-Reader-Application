import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, AlertTriangle, Settings, Activity, Search, Tag, Clock, ScrollText, AlertCircle, Loader2, Edit2, X, Check } from 'lucide-react';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

const RFIDDashboard = () => {
    const [status, setStatus] = useState(null);
    const [connected, setConnected] = useState(false);
    const [showConfig, setShowConfig] = useState(false);

    // Config State
    const [config, setConfig] = useState({
        timeout: 8.0,
        ip: "192.168.29.201",
        simulation: false
    });

    // Edit Tag Name State
    const [editingTag, setEditingTag] = useState(null); // {id, currentName}
    const [newTagName, setNewTagName] = useState("");

    const wsParams = useRef(null);

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

    const toggleMonitor = async () => {
        if (status?.monitoring) {
            await fetch(`${API_URL}/stop`, { method: 'POST' });
        } else {
            await fetch(`${API_URL}/start`, { method: 'POST' });
        }
    };

    const updateConfig = async () => {
        await fetch(`${API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        setShowConfig(false);
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
                        <p className="text-slate-400 text-sm">Real-time Presence Monitor</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Connection Status Badge */}
                    <div className={`flex items-center px-4 py-2 rounded-lg glass-panel transition-all duration-300 ${status?.connection_state === 'connected' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                        status?.connection_state === 'connecting' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                            status?.connection_state === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                'text-slate-400'
                        }`}>
                        {status?.connection_state === 'connected' && <Wifi className="w-5 h-5 mr-2" />}
                        {status?.connection_state === 'connecting' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        {(status?.connection_state === 'failed' || status?.connection_state === 'disconnected') && <WifiOff className="w-5 h-5 mr-2" />}

                        <span className="font-semibold uppercase tracking-wider text-xs">
                            {status?.connection_state === 'connected' ? 'Online' :
                                status?.connection_state === 'connecting' ? 'Connecting...' :
                                    status?.connection_state === 'failed' ? 'Failed' : 'Disconnected'}
                        </span>
                    </div>

                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-3 rounded-lg transition-colors border ${showConfig ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Sidebar Controls */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Status Card */}
                    <div className="glass-panel p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-slate-200">Monitor Status</h2>
                            <div className={`w-3 h-3 rounded-full ${status?.monitoring ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Tags</span>
                                <span className="font-mono">{status ? status.active_count + status.missing_count : 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Missing</span>
                                <span className="font-mono text-red-400">{status?.missing_count || 0}</span>
                            </div>

                            <button
                                onClick={toggleMonitor}
                                className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${status?.monitoring
                                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/25'
                                    }`}
                            >
                                {status?.monitoring ? "STOP MONITORING" : "START MONITORING"}
                            </button>
                        </div>
                    </div>

                    {/* Config Panel */}
                    {showConfig && (
                        <div className="glass-panel p-6 animate-in slide-in-from-top-4 duration-300">
                            <h3 className="font-semibold mb-4 text-slate-300">Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-bold">Reader IP</label>
                                    <input
                                        type="text"
                                        value={config.ip}
                                        onChange={e => setConfig({ ...config, ip: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-bold">Missing Timeout (s)</label>
                                    <input
                                        type="number"
                                        value={config.timeout}
                                        onChange={e => setConfig({ ...config, timeout: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center space-x-3 mt-2">
                                    <input
                                        type="checkbox"
                                        checked={config.simulation}
                                        onChange={e => setConfig({ ...config, simulation: e.target.checked })}
                                        className="rounded border-slate-700 bg-slate-900 text-blue-500"
                                    />
                                    <span className="text-sm text-slate-300">Simulation Mode</span>
                                </div>
                                <button
                                    onClick={updateConfig}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Apply Settings
                                </button>
                            </div>
                        </div>
                    )}


                    {/* System Logs Panel */}
                    <div className="glass-panel p-4 mt-6 max-h-[400px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-300 font-semibold flex items-center">
                                <ScrollText className="w-4 h-4 mr-2" />
                                System Logs
                            </h3>
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE</span>
                        </div>
                        <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar flex-1">
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

                {/* Main Content */}
                <div className="lg:col-span-3 space-y-6">

                    {/* Missing Alert */}
                    {status?.missing_count > 0 && (
                        <div className="glass-panel p-4 border-l-4 border-l-red-500 bg-red-500/5 animate-pulse">
                            <div className="flex items-start space-x-4">
                                <div className="p-2 bg-red-500/20 rounded-full">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-500">Missing Assets Detected</h3>
                                    <p className="text-red-400/80 text-sm">The following items have not been seen for over {config.timeout} seconds:</p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {status.missing_tags.map(tag => (
                                    <div key={tag.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                        <div className="flex items-center space-x-3">
                                            <Tag className="w-4 h-4 text-red-400" />
                                            <div>
                                                <p className="font-semibold text-slate-200">{tag.name}</p>
                                                <p className="text-xs text-red-400 font-mono">{tag.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center text-red-400 text-sm font-mono">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {tag.age_seconds}s
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {status?.active_tags.length === 0 && !status.missing_count && (
                            <div className="col-span-full py-20 text-center text-slate-500">
                                <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p className="text-lg">No tags detected in range</p>
                            </div>
                        )}

                        {status?.active_tags.map(tag => (
                            <div key={tag.id} className="glass-card p-4 flex flex-col justify-between group relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        <span className="text-xs font-bold text-emerald-400 tracking-wider">ACTIVE</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-slate-500 font-mono">{tag.age_seconds}s ago</span>
                                        <button
                                            onClick={() => startEditingTag(tag)}
                                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-all opacity-0 group-hover:opacity-100"
                                            title="Edit tag name"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-lg text-slate-100 group-hover:text-blue-400 transition-colors">
                                        {tag.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-mono mt-1">{tag.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            {/* Edit Tag Name Modal */}
            {editingTag && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-panel p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center">
                                <Edit2 className="w-5 h-5 mr-2 text-blue-400" />
                                Edit Tag Name
                            </h3>
                            <button
                                onClick={cancelEdit}
                                className="p-1 hover:bg-slate-700 rounded transition-colors"
                            >
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

export default RFIDDashboard;
