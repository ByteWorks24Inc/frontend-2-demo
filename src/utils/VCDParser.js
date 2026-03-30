/**
 * Multi-Language Logic VCD Parser (Verilog / VHDL / SystemVerilog)
 * Implements full IEEE-1164 9-state logic support:
 * 'U' (uninitialized), 'X' (unknown), '0' (low), '1' (high),
 * 'Z' (high impedance), 'W' (weak unknown), 'L' (weak low),
 * 'H' (weak high), '-' (don't care)
 */

export const parseVCD = (vcdContent) => {
    if (!vcdContent) return { signals: [], maxTime: 0, displayUnit: 'ns' };

    const signals = new Map();
    const idMap = new Map();
    let rawTime = 0;
    let maxTime = 0;
    let multiplier = 1;
    let displayUnit = 'ns';
    let currentScope = [];

    const tokens = vcdContent.split(/\s+/).filter(Boolean);
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === '$timescale') {
            const val = tokens[i + 1];
            const unit = tokens[i + 2];
            let num = parseInt(val);
            let u = unit;
            
            if (isNaN(num)) {
                num = parseInt(val.match(/\d+/)[0]);
                u = val.match(/[a-z]+/i)[0];
            } else if (u === '$end') {
                u = val.match(/[a-z]+/i)[0];
            }

            displayUnit = u;
            if (u.includes('ps')) multiplier = num * 0.001;
            else if (u.includes('ns')) multiplier = num * 1;
            else if (u.includes('us')) multiplier = num * 1000;

            while (tokens[i] !== '$end') i++;
        } else if (token === '$scope') {
            currentScope.push(tokens[i + 2]);
            i += 3;
        } else if (token === '$upscope') {
            currentScope.pop();
        } else if (token === '$var') {
            const type = tokens[i+1];
            const size = tokens[i+2];
            const id = tokens[i+3];
            const baseName = tokens[i+4];
            const fullName = [...currentScope, baseName].join('.');
            
            signals.set(fullName, {
                name: fullName,
                type: type.toLowerCase(), // wire, reg, logic, signal
                size: parseInt(size),
                changes: []
            });
            idMap.set(id, fullName);
            while (tokens[i] !== '$end') i++;
        } else if (token.startsWith('#')) {
            rawTime = parseInt(token.substring(1));
            const normalizedTime = rawTime * multiplier;
            if (normalizedTime > maxTime) maxTime = normalizedTime;
        } else {
            // Value Change Detection (Multi-State IEEE-1164 Model)
            let value = '';
            let id = '';

            // Handle Bus/Vector Change: b1010 !
            if (token.startsWith('b') || token.startsWith('B')) {
                value = token.substring(1);
                id = tokens[++i];
            } 
            // Handle Real/Float Change: r1.23 ! (skipped for now)
            else if (token.startsWith('r') || token.startsWith('R')) {
                i++;
                continue;
            } 
            // Handle 9-State Scalar Change: u, x, 0, 1, z, w, l, h, -
            else if ("ux01zwlh-UX01ZWLH".includes(token[0]) && token.length > 1) {
                value = token[0];
                id = token.substring(1);
            } else if ("ux01zwlh-UX01ZWLH".includes(token)) {
                value = token;
                id = tokens[++i];
            }

            const signalName = idMap.get(id);
            if (signalName) {
                const sig = signals.get(signalName);
                const normalizedTime = rawTime * multiplier;
                sig.changes.push([normalizedTime, value.toLowerCase()]);
            }
        }
    }

    const finalSignals = Array.from(signals.values()).map(sig => {
        sig.changes.sort((a, b) => a[0] - b[0]);
        // Initial state reconstruction (VHDL defaults to 'U', Verilog to 'x')
        const isVHDL = sig.type === 'signal' || sig.type === 'port';
        if (sig.changes.length === 0 || sig.changes[0][0] > 0) {
            sig.changes.unshift([0, isVHDL ? 'u' : 'x']);
        }
        return sig;
    });

    return {
        signals: finalSignals,
        maxTime,
        displayUnit
    };
};
