import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Play, Square, Settings, MapPin, Clock, Wifi } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const ZoneManagement = ({ onClose }) => {
    const [zones, setZones] = useState([]);
    const [editingZone, setEditingZone] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        reader_ip: '',
        reader_port: 2189,
        timeout: 8.0,
        mapped_zone_id: '',
        simulation_mode: false
    });

    useEffect(() => {
        loadZones();
    }, []);

    const loadZones = async () => {
        try {
            const response = await fetch(`${API_URL}/zones`);
            const data = await response.json();
            setZones(data.zones || []);
        } catch (error) {
            console.error('Failed to load zones:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingZone) {
                // Update existing zone
                await fetch(`${API_URL}/zones/${editingZone.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new zone
                await fetch(`${API_URL}/zones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            resetForm();
            loadZones();
        } catch (error) {
            console.error('Failed to save zone:', error);
        }
    };

    const handleEdit = (zone) => {
        setEditingZone(zone);
        setFormData({
            name: zone.name,
            reader_ip: zone.reader_ip,
            reader_port: zone.reader_port,
            timeout: zone.timeout,
            mapped_zone_id: zone.mapped_zone_id || '',
            simulation_mode: zone.simulation_mode || false
        });
    };

    const handleDelete = async (zoneId) => {
        if (!confirm('Are you sure you want to delete this zone?')) return;

        try {
            await fetch(`${API_URL}/zones/${zoneId}`, { method: 'DELETE' });
            loadZones();
        } catch (error) {
            console.error('Failed to delete zone:', error);
        }
    };

    const handleStartStop = async (zoneId, isRunning) => {
        try {
            const action = isRunning ? 'stop' : 'start';
            await fetch(`${API_URL}/zones/${zoneId}/${action}`, { method: 'POST' });
        } catch (error) {
            console.error('Failed to start/stop zone:', error);
        }
    };

    const resetForm = () => {
        setEditingZone(null);
        setFormData({
            name: '',
            reader_ip: '',
            reader_port: 2189,
            timeout: 8.0,
            mapped_zone_id: '',
            simulation_mode: false
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-200 flex items-center">
                        <Settings className="w-6 h-6 mr-2 text-blue-400" />
                        Zone Management
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Zone Form */}
                <div className="glass-card p-4 mb-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-300">
                        {editingZone ? 'Edit Zone' : 'Add New Zone'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Zone Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm"
                                placeholder="e.g., Warehouse, Loading Dock"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Reader IP</label>
                            <input
                                type="text"
                                value={formData.reader_ip}
                                onChange={(e) => setFormData({ ...formData, reader_ip: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm"
                                placeholder="192.168.1.100"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Port</label>
                            <input
                                type="number"
                                value={formData.reader_port}
                                onChange={(e) => setFormData({ ...formData, reader_port: parseInt(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Timeout (seconds)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.timeout}
                                onChange={(e) => setFormData({ ...formData, timeout: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Maps to Zone</label>
                            <select
                                value={formData.mapped_zone_id}
                                onChange={(e) => setFormData({ ...formData, mapped_zone_id: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 mt-1 text-sm"
                            >
                                <option value="">None</option>
                                {zones.filter(z => !editingZone || z.id !== editingZone.id).map(zone => (
                                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.simulation_mode}
                                onChange={(e) => setFormData({ ...formData, simulation_mode: e.target.checked })}
                                className="rounded border-slate-700 bg-slate-900 text-blue-500 mr-2"
                            />
                            <label className="text-sm text-slate-300">Simulation Mode</label>
                        </div>
                        <div className="col-span-2 flex space-x-3">
                            <button
                                type="submit"
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
                            >
                                {editingZone ? 'Update Zone' : 'Add Zone'}
                            </button>
                            {editingZone && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Zones List */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-300 mb-3">Configured Zones</h3>
                    {zones.map(zone => (
                        <div key={zone.id} className="glass-card p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h4 className="text-lg font-semibold text-slate-200">{zone.name}</h4>
                                        {zone.simulation_mode && (
                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                                SIMULATION
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="flex items-center text-slate-400">
                                            <Wifi className="w-4 h-4 mr-2" />
                                            {zone.reader_ip}:{zone.reader_port}
                                        </div>
                                        <div className="flex items-center text-slate-400">
                                            <Clock className="w-4 h-4 mr-2" />
                                            {zone.timeout}s timeout
                                        </div>
                                        {zone.mapped_zone_id && (
                                            <div className="flex items-center text-slate-400">
                                                <MapPin className="w-4 h-4 mr-2" />
                                                Maps to: {zones.find(z => z.id === zone.mapped_zone_id)?.name || 'Unknown'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                    <button
                                        onClick={() => handleEdit(zone)}
                                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4 text-blue-400" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(zone.id)}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {zones.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            No zones configured. Add your first zone above!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZoneManagement;
