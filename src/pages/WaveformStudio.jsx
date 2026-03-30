import React, { useState, useEffect } from 'react';
import WaveformAnalyzer from '../components/WaveformAnalyzer';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X, Maximize2, Zap } from 'lucide-react';

/**
 * Waveform Studio Popup Page
 * Dedicated, full-screen viewport for simulation traces.
 * Synchronizes with parent window via postMessage.
 */
const WaveformStudio = () => {
    const [vcdText, setVcdText] = useState(null);
    const [lang, setLang] = useState('verilog');
    const [status, setStatus] = useState('waiting'); // 'waiting', 'connected', 'error'


    useEffect(() => {
        // Handshake: Listen for the parent's vcd payload
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'load_vcd') {
                setVcdText(event.data.vcd);
                if (event.data.lang) setLang(event.data.lang);
                setStatus('connected');
                // Acknowledge back
                if (window.opener) {
                    window.opener.postMessage({ type: 'vcd_received' }, '*');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        
        // Initial signal to parent that we're ready
        if (window.opener) {
            window.opener.postMessage({ type: 'studio_ready' }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <div className="h-screen bg-[#030712] overflow-hidden flex flex-col">
            <header className="h-16 px-10 border-b border-white/5 flex items-center justify-between bg-[#0b0f1a]/50 backdrop-blur-3xl z-50">
                <div className="flex items-center space-x-6">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                        <Zap size={20} className="fill-emerald-500/20" />
                    </div>
                    <div>
                        <h1 className="text-xs font-black text-white uppercase tracking-[0.4em]">BitLab Waveform Studio</h1>
                        <div className="flex items-center text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                            System Status: {status.toUpperCase()}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center space-x-4">
                    <div className="h-8 w-px bg-white/5"></div>
                    <button className="text-slate-500 hover:text-white transition-colors" onClick={() => window.close()}>
                        <X size={18} />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {!vcdText ? (
                        <motion.div 
                            key="waiting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center p-20 text-center"
                        >
                            <div className="relative">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                    className="p-10 border-2 border-emerald-500/20 border-t-emerald-500/80 rounded-full"
                                />
                                <Activity size={32} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
                            </div>
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] mt-10">Awaiting Signal Data</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-3 max-w-sm leading-relaxed">
                                Please execute a simulation in the BitLab editor. Waveforms will automatically sync with this window.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="studio"
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-full"
                        >
                            <WaveformAnalyzer vcdText={vcdText} lang={lang} isPopup={true} />
                        </motion.div>

                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default WaveformStudio;
