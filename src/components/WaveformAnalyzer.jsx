import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Activity, Zap, Box, Clock, Search, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { parseVCD } from '../utils/VCDParser';

/**
 * Professional Multi-Language Waveform Studio
 * Implements Language-Specific Rendering Strategies (Verilog vs VHDL).
 */
const WaveformAnalyzer = ({ vcdText, lang = 'verilog', isPopup = false }) => {
    const canvasRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [zoom, setZoom] = useState(10);
    const [baseFormat, setBaseFormat] = useState('hex');
    const [scrollX, setScrollX] = useState(0);

    // Language-Specific Rendering Strategies
    const strategies = {
        verilog: {
            colors: { '0': '#334155', '1': '#10b981', 'x': '#ef4444', 'z': '#94a3b8' },
            busPrefix: (mode) => (mode === 'hex' ? '0x' : ''),
            busSuffix: () => '',
            nameStyle: (name) => name.split('.').pop()
        },
        vhdl: {
            colors: { 
                'u': '#991b1b', // Brightened Red (Uninitialized)
                'x': '#ef4444', // Red (Unknown)
                '0': '#334155', // Brighter Grey-Blue for 0
                '1': '#10b981', 
                'z': '#94a3b8', // High Impedance
                'w': '#dc2626', // Weak Unknown
                'l': '#064e3b', // Weak Low
                'h': '#065f46', // Weak High
                '-': '#475569'  // Don't Care
            },

            busPrefix: (mode) => (mode === 'hex' ? 'X"' : ''),
            busSuffix: (mode) => (mode === 'hex' ? '"' : ''),
            nameStyle: (name) => name.replace(/\./g, ' : ') // VHDL-style separators
        }
    };

    const strategy = strategies[lang] || strategies.verilog;

    const { signals, maxTime, displayUnit } = useMemo(() => {
        try {
            return parseVCD(vcdText);
        } catch (e) {
            console.error('VCD Parsing failed:', e);
            return { signals: [], maxTime: 0, displayUnit: 'ns' };
        }
    }, [vcdText]);

    const SIGNAL_HEIGHT = 80;
    const GRID_LEFT = 20;
    const totalTheoreticalWidth = Math.max(1200, maxTime * zoom + 100);

    const formatValue = (binStr, mode) => {
        if (!binStr || "uxzwl-".includes(binStr[0])) return binStr.toUpperCase();
        try {
            const num = parseInt(binStr, 2);
            const prefix = strategy.busPrefix(mode);
            const suffix = strategy.busSuffix(mode);
            if (mode === 'hex') return prefix + num.toString(16).toUpperCase() + suffix;
            if (mode === 'dec') return num.toString(10);
            return binStr;
        } catch (e) {
            return binStr;
        }
    };

    const drawDigital = (ctx, tv, centerY, zoom, currentScrollX, viewportWidth) => {
        const highY = centerY - 20;
        const lowY = centerY + 20;
        
        ctx.beginPath();
        for (let i = 0; i < tv.length; i++) {
            const [t, v] = tv[i];
            const x = t * zoom - currentScrollX + GRID_LEFT;
            const level = (v === '1' || v === 'h') ? highY : lowY;

            // Strategy-based Styling
            ctx.strokeStyle = strategy.colors[v] || strategy.colors['x'];
            
            // Special Dash Styles for Z/W/U
            if (v === 'z' || v === 'w') ctx.setLineDash([5, 5]);
            else if (v === 'u' || v === '-') ctx.setLineDash([2, 4]);
            else ctx.setLineDash([]);

            if (i === 0) {
                ctx.moveTo(x, level);
            } else {
                const [prevT, prevV] = tv[i - 1];
                const prevX = prevT * zoom - currentScrollX + GRID_LEFT;
                const prevLevel = (prevV === '1' || prevV === 'h') ? highY : lowY;
                ctx.lineTo(x, prevLevel);
                if (prevV !== v) ctx.lineTo(x, level);
            }
            if (x > viewportWidth) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const drawBus = (ctx, tv, centerY, zoom, currentScrollX, viewportWidth, mode) => {
        const busHeight = 32;
        for (let i = 0; i < tv.length; i++) {
            const [t1, v1] = tv[i];
            const nextT = (i < tv.length - 1) ? tv[i+1][0] : maxTime;
            const x1 = t1 * zoom - currentScrollX + GRID_LEFT;
            const x2 = nextT * zoom - currentScrollX + GRID_LEFT;

            if (x2 < 0) continue;
            if (x1 > viewportWidth) break;

            ctx.strokeStyle = '#10b981'; ctx.fillStyle = 'rgba(16, 185, 129, 0.05)'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x1, centerY);ctx.lineTo(x1 + 4, centerY - 16);ctx.lineTo(x2 - 4, centerY - 16);ctx.lineTo(x2, centerY);
            ctx.lineTo(x2 - 4, centerY + 16);ctx.lineTo(x1 + 4, centerY + 16);ctx.lineTo(x1, centerY);
            ctx.stroke(); ctx.fill();

            if (x2 - x1 > 40) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = '10px JetBrains Mono';
                ctx.fillText(formatValue(v1, mode), x1 + 10, centerY + 4);
            }
        }
    };

    const renderWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        const container = scrollContainerRef.current;
        if (!canvas || !container || signals.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const viewportWidth = container.clientWidth || 800;
        const viewportHeight = container.clientHeight || 600;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewportWidth * dpr;
        canvas.height = viewportHeight * dpr;
        ctx.scale(dpr, dpr);

        const currentScrollX = container.scrollLeft;
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);

        // Time Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let t = 0; t <= maxTime; t += 20) {
            const x = t * zoom - currentScrollX + GRID_LEFT;
            if (x < 0 || x > viewportWidth) continue;
            ctx.beginPath();ctx.moveTo(x, 0);ctx.lineTo(x, viewportHeight);ctx.stroke();
            if (t % 100 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.font = '8px JetBrains Mono';
                ctx.fillText(`${t}${displayUnit}`, x + 5, 15);
            }
        }

        signals.forEach((sig, index) => {
            const centerY = (index + 0.5) * SIGNAL_HEIGHT + 40;
            if (sig.size > 1) drawBus(ctx, sig.changes, centerY, zoom, currentScrollX, viewportWidth, baseFormat);
            else drawDigital(ctx, sig.changes, centerY, zoom, currentScrollX, viewportWidth);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.beginPath();ctx.moveTo(0, centerY + 40);ctx.lineTo(viewportWidth, centerY + 40);ctx.stroke();
        });
    }, [signals, maxTime, zoom, baseFormat, displayUnit, lang]);

    useEffect(() => {
        renderWaveform();
        window.addEventListener('resize', renderWaveform);
        return () => window.removeEventListener('resize', renderWaveform);
    }, [renderWaveform]);

    if (!vcdText || signals.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-[#030712] rounded-3xl border border-white/5 p-20">
                <div className="text-center">
                    <Activity size={48} className="mx-auto text-emerald-500/20 mb-6 animate-pulse" />
                    <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">Analyzing Signal Streams...</h3>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-[#030712] overflow-hidden ${isPopup ? 'p-8' : ''}`}>
            <div className="flex items-center justify-between mb-8 px-6">
                <div className="flex items-center space-x-6">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 ring-1 ring-emerald-500/20">
                        <Zap size={22} className="fill-emerald-500/20" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-black text-white uppercase tracking-[0.4em] flex items-center">
                            Logic Forge Studio
                            <span className="ml-4 px-2 py-0.5 bg-emerald-500/20 rounded text-[7px] text-emerald-400 border border-emerald-500/30 uppercase tracking-[0.2em]">{lang.toUpperCase()}_STRATEGY_ACTIVE</span>
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 flex items-center">
                            <Clock size={10} className="mr-2" /> {maxTime}{displayUnit} Capture • IEEE-1164 9-State Logic Model
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-10">
                    <div className="flex items-center space-x-6 bg-white/[0.03] px-6 py-2.5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Base Format</span>
                        <div className="flex items-center p-1 bg-black/40 rounded-xl space-x-1">
                            {['hex', 'dec', 'bin'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => setBaseFormat(fmt)}
                                    className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${baseFormat === fmt ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-slate-700 hover:text-slate-400'}`}
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-6 h-12 bg-white/[0.03] px-6 rounded-2xl border border-white/5">
                        <Search size={14} className="text-slate-700" />
                        <input 
                            type="range" min="1" max="50" step="0.5" value={zoom} 
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-40 h-1 bg-emerald-500/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex bg-[#010309] rounded-[40px] border border-white/5 overflow-hidden relative shadow-2xl">
                <div className="w-[220px] bg-[#030712] border-r border-white/5 overflow-hidden z-20 flex flex-col">
                    <div className="h-12 px-8 flex items-center border-b border-white/10 bg-white/[0.02]">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Signal Trace</span>
                    </div>
                    {signals.map((sig, i) => (
                        <div key={sig.name} className="h-20 flex flex-col justify-center px-10 group border-b border-white/[0.02] hover:bg-emerald-500/[0.02] transition-colors relative">
                            <div className="flex items-center">
                                <Box size={12} className="mr-4 text-emerald-500/40 group-hover:text-emerald-500 transition-colors" />
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] truncate group-hover:text-white">
                                    {strategy.nameStyle(sig.name)}
                                </span>
                            </div>
                            <span className="text-[8px] text-slate-700 font-black mt-2 uppercase tracking-tighter truncate opacity-40">
                                {sig.type.toUpperCase()} • {sig.size}-BIT
                            </span>
                        </div>
                    ))}
                </div>

                <div 
                    ref={scrollContainerRef}
                    onScroll={() => renderWaveform()}
                    className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#030712] relative group"
                >
                    <div style={{ width: totalTheoreticalWidth, height: 1 }} className="pointer-events-none" />
                    <div className="sticky left-0 top-0 w-full h-full">
                        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.012] to-transparent bg-[length:100%_6px] opacity-40 z-10 pointer-events-none"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaveformAnalyzer;
