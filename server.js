const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');

const app    = express();
const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

app.use(cors());

function parseStats(stdout) {
    const stats = {};
    const match = stdout.match(/STATS_BEGIN\n([\s\S]*?)STATS_END/);
    if (!match) return stats;
    match[1].trim().split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
            stats[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    });
    return stats;
}

function readWavSamples(buf) {
    let offset = 12, dataOffset = -1, dataSize = 0, sampleRate = 44100, channels = 1;
    while (offset + 8 <= buf.length) {
        const id   = buf.slice(offset, offset + 4).toString('ascii');
        const size = buf.readUInt32LE(offset + 4);
        if (id === 'fmt ') {
            sampleRate = buf.readUInt32LE(offset + 12);
            channels   = buf.readUInt16LE(offset + 10);
        }
        if (id === 'data') { dataOffset = offset + 8; dataSize = size; break; }
        offset += 8 + size;
    }
    if (dataOffset === -1) return null;
    const numSamples = dataSize / 2;
    const samples    = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++)
        samples[i] = buf.readInt16LE(dataOffset + i * 2);
    return { samples, numSamples, sampleRate, channels };
}

function calcAmplitudeStats(samples) {
    let peak = 0, sum = 0;
    for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        if (a > peak) peak = a;
        sum += a;
    }
    return { peak, avg: samples.length > 0 ? Math.round(sum / samples.length) : 0 };
}

// ── Run voice_processor.exe once and return parsed stats ─────────────────────
function runProcessor(finalIn, outPath, params, callback) {
    const { volume, noise, mode, threshold, pitch_shift, compressor, echo, limiter, noise_gate } = params;
    const cmd = `"${__dirname}\\voice_processor.exe" "${finalIn}" "${outPath}" ${volume} ${noise} ${mode} ${threshold} ${pitch_shift} ${compressor} ${echo} ${limiter} ${noise_gate}`;
    console.log('Running:', cmd);
    const startTime = Date.now();
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        const nodeTimeUs = (Date.now() - startTime) * 1000;
        if (err || !fs.existsSync(outPath)) {
            return callback(new Error('Processing failed: ' + (err?.message || 'no output file')), null);
        }
        const exeStats = parseStats(stdout);
        const timeUs = (exeStats.time_us && exeStats.time_us !== '0') ? exeStats.time_us : String(nodeTimeUs);

        const safeFloat = (val, fallback = '0') => {
            if (!val || val === '' || val === 'nan' || val === 'inf') return fallback;
            const n = parseFloat(val);
            if (isNaN(n) || !isFinite(n)) return fallback;
            return val;
        };

        const FIXED_CPU_HZ = 3_400_000_000;
        const computedMips = (() => {
            const rawMips = parseFloat(exeStats.real_mips);
            if (rawMips > 0 && isFinite(rawMips)) return exeStats.real_mips;
            const cycles = parseInt(exeStats.real_cycles) || 0;
            const samp   = parseInt(exeStats.samples) || 0;
            const ips    = parseFloat(exeStats.instr_per_sample) || 4;
            if (cycles > 0 && samp > 0) {
                const execSec = cycles / FIXED_CPU_HZ;
                const totalI  = samp * ips;
                const mips    = (totalI / execSec) / 1e6;
                if (isFinite(mips) && mips > 0) return mips.toFixed(4);
            }
            return '0';
        })();

        callback(null, {
            time_us:            timeUs,
            samples:            exeStats.samples            || '0',
            real_cycles:        exeStats.real_cycles        || '0',
            real_cpi:           safeFloat(exeStats.real_cpi, '0'),
            real_mips:          computedMips,
            real_throughput:    safeFloat(exeStats.real_throughput, '0'),
            instructions_total: exeStats.instructions_total || '0',
            instr_per_sample:   exeStats.instr_per_sample   || '0',
            cache_hits:         exeStats.cache_hits         || '0',
            cache_misses:       exeStats.cache_misses       || '0',
            cache_hit_rate:     exeStats.cache_hit_rate     || '0',
            interrupts_fired:   exeStats.interrupts_fired   || '0',
            mode_reported:      exeStats.mode               || (mode === 1 ? 'interrupt' : 'polling'),
            peak_before:        exeStats.peak_before        || '0',
            peak_after:         exeStats.peak_after         || '0',
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// /compare  — runs audio through BOTH polling AND interrupt, returns both stats
// ─────────────────────────────────────────────────────────────────────────────
app.post('/compare', upload.single('file'), (req, res) => {
    const volume      = parseFloat(req.body.volume)    || 1.0;
    const noise       = parseInt(req.body.noise)       || 0;
    const pitch_shift = parseInt(req.body.pitch_shift) || 0;
    const compressor  = parseInt(req.body.compressor)  || 0;
    const echo        = parseInt(req.body.echo)        || 0;
    const limiter     = parseInt(req.body.limiter)     || 0;
    const noise_gate  = parseInt(req.body.noise_gate)  || 0;
    const threshold   = parseInt(req.body.threshold)   || 500;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inPath  = req.file.path;
    const wavIn   = inPath + '_converted.wav';
    const convertCmd = `"${process.env.USERPROFILE}\\ffmpeg\\ffmpeg.exe" -y -i "${inPath}" -ar 44100 -ac 1 -sample_fmt s16 "${wavIn}"`;

    exec(convertCmd, { timeout: 15000 }, (convertErr) => {
        try { fs.unlinkSync(inPath); } catch(e) {}

        if (convertErr || !fs.existsSync(wavIn)) {
            return res.status(500).json({ error: 'Audio conversion failed' });
        }

        const params = { volume, noise, pitch_shift, compressor, echo, limiter, noise_gate, threshold };

        // Run POLLING (mode=0)
        const outPoll = path.resolve('outputs/compare_poll_' + Date.now() + '.wav');
        runProcessor(wavIn, outPoll, { ...params, mode: 0 }, (err1, pollStats) => {
            if (err1) {
                try { fs.unlinkSync(wavIn); } catch(e) {}
                return res.status(500).json({ error: 'Polling run failed: ' + err1.message });
            }

            // Run INTERRUPT (mode=1) — use the SAME converted wav
            const outInt = path.resolve('outputs/compare_int_' + Date.now() + '.wav');
            runProcessor(wavIn, outInt, { ...params, mode: 1 }, (err2, intStats) => {
                try { fs.unlinkSync(wavIn);   } catch(e) {}
                try { fs.unlinkSync(outPoll); } catch(e) {}
                try { fs.unlinkSync(outInt);  } catch(e) {}

                if (err2) {
                    return res.status(500).json({ error: 'Interrupt run failed: ' + err2.message });
                }

                res.json({
                    polling:   pollStats,
                    interrupt: intStats,
                });
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// /process  — existing single-run endpoint (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/process', upload.single('file'), (req, res) => {
    const volume      = parseFloat(req.body.volume)    || 1.0;
    const noise       = parseInt(req.body.noise)       || 0;
    const pitch_shift = parseInt(req.body.pitch_shift) || 0;
    const compressor  = parseInt(req.body.compressor)  || 0;
    const echo        = parseInt(req.body.echo)        || 0;
    const limiter     = parseInt(req.body.limiter)     || 0;
    const noise_gate  = parseInt(req.body.noise_gate)  || 0;
    const mode        = parseInt(req.body.mode)        || 0;
    const threshold   = parseInt(req.body.threshold)   || 500;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inPath  = req.file.path;
    const outPath = path.resolve('outputs/out_' + Date.now() + '.wav');
    const wavIn   = inPath + '_converted.wav';
    const convertCmd = `"${process.env.USERPROFILE}\\ffmpeg\\ffmpeg.exe" -y -i "${inPath}" -ar 44100 -ac 1 -sample_fmt s16 "${wavIn}"`;

    console.log('Converting:', convertCmd);
    exec(convertCmd, { timeout: 15000 }, (convertErr) => {
        if (convertErr || !fs.existsSync(wavIn)) {
            try { fs.unlinkSync(inPath); } catch(e) {}
            return res.status(500).json({ error: 'Audio conversion failed.' });
        }
        const finalIn = wavIn;

        let beforeStats = { peak: 0, avg: 0 };
        let numSamples = 0, sampleRate = 44100, channels = 1, durationMs = 0;
        try {
            const inBuf  = fs.readFileSync(finalIn);
            const parsed = readWavSamples(inBuf);
            if (parsed) {
                beforeStats = calcAmplitudeStats(parsed.samples);
                numSamples  = parsed.numSamples;
                sampleRate  = parsed.sampleRate;
                channels    = parsed.channels;
                durationMs  = Math.round((numSamples / (sampleRate * channels)) * 1000);
            }
        } catch(e) { console.log('Pre-stats error:', e.message); }

        const startTime = Date.now();
        const cmd = `"${__dirname}\\voice_processor.exe" "${finalIn}" "${outPath}" ${volume} ${noise} ${mode} ${threshold} ${pitch_shift} ${compressor} ${echo} ${limiter} ${noise_gate}`;
        console.log('Running:', cmd);

        exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
            const nodeTimeUs = (Date.now() - startTime) * 1000;
            console.log('STDOUT:\n', stdout);
            console.log('STDERR:\n', stderr);

            const realLogs = [];
            if (stderr) {
                stderr.split('\n').forEach(line => {
                    if (line.startsWith('LOG: ')) realLogs.push(line.substring(5).trim());
                });
            }

            try { fs.unlinkSync(inPath); } catch(e) {}
            try { fs.unlinkSync(wavIn);  } catch(e) {}

            if (err || !fs.existsSync(outPath)) {
                console.log('ERROR:', err?.message);
                return res.status(500).json({ error: 'Processing failed', detail: stderr });
            }

            let afterStats = { peak: 0, avg: 0 };
            const outBuf   = fs.readFileSync(outPath);
            try {
                const parsed = readWavSamples(outBuf);
                if (parsed) afterStats = calcAmplitudeStats(parsed.samples);
            } catch(e) { console.log('Post-stats error:', e.message); }

            const exeStats = parseStats(stdout);

            const timeUs = (exeStats.time_us && exeStats.time_us !== '0')
                             ? exeStats.time_us
                             : String(nodeTimeUs);

            const FIXED_CPU_HZ = 3_400_000_000;

            const safeFloat = (val, fallback = '0') => {
                if (!val || val === '' || val === 'nan' || val === 'inf') return fallback;
                const n = parseFloat(val);
                if (isNaN(n) || !isFinite(n)) return fallback;
                return val;
            };

            const computedMips = (() => {
                const rawMips = parseFloat(exeStats.real_mips);
                if (rawMips > 0 && isFinite(rawMips)) return exeStats.real_mips;
                const cycles = parseInt(exeStats.real_cycles) || 0;
                const samp   = parseInt(exeStats.samples)     || numSamples;
                const ips    = parseInt(exeStats.instr_per_sample) || 4;
                if (cycles > 0 && samp > 0) {
                    const execSec  = cycles / FIXED_CPU_HZ;
                    const totalI   = samp * ips;
                    const mips     = (totalI / execSec) / 1e6;
                    if (isFinite(mips) && mips > 0) return mips.toFixed(4);
                }
                return '0';
            })();

            const instrPerSample = exeStats.instr_per_sample || '4';

            const slotHeaders = {};
            for (let i = 0; i < 8; i++) {
                slotHeaders[`X-Slot-Hits-${i}`]   = exeStats[`slot_hits_${i}`]   || '0';
                slotHeaders[`X-Slot-Misses-${i}`] = exeStats[`slot_misses_${i}`] || '0';
            }

            const headerMap = {
                'X-Time-Us':            timeUs,
                'X-Samples':            String(numSamples),
                'X-Channels':           String(channels),
                'X-Sample-Rate':        String(sampleRate),
                'X-Duration-Ms':        String(durationMs),
                'X-Vol-Applied':        String(volume),
                'X-Noise-On':           noise > 0 ? 'true' : 'false',
                'X-Peak-Before':        String(beforeStats.peak),
                'X-Peak-After':         String(afterStats.peak),
                'X-Avg-Before':         String(beforeStats.avg),
                'X-Avg-After':          String(afterStats.avg),
                'X-Pitch-Shift':        pitch_shift ? 'true' : 'false',
                'X-Compressor':         compressor  ? 'true' : 'false',
                'X-Echo':               echo        ? 'true' : 'false',
                'X-Limiter':            limiter     ? 'true' : 'false',
                'X-Noise-Gate':         noise_gate  ? 'true' : 'false',
                'X-Mode':               exeStats.mode             || (mode === 1 ? 'interrupt' : 'polling'),
                'X-Interrupts-Fired':   exeStats.interrupts_fired || '0',
                'X-Threshold':          String(threshold),
                'X-Cache-Hits':         exeStats.cache_hits       || '0',
                'X-Cache-Misses':       exeStats.cache_misses     || '0',
                'X-Cache-Hit-Rate':     exeStats.cache_hit_rate   || '0',
                'X-Real-Cycles':        exeStats.real_cycles          || '0',
                'X-Cycles-Per-Sample':  exeStats.cycles_per_sample    || '0',
                'X-Real-Cpu-Freq':      '3.4',
                'X-Real-Cpi':           safeFloat(exeStats.real_cpi,  '0'),
                'X-Real-Mips':          computedMips,
                'X-Real-Throughput':    safeFloat(exeStats.real_throughput, '0'),
                'X-Instr-Per-Sample':   instrPerSample,
                'X-Instructions-Total': exeStats.instructions_total || '0',
                ...slotHeaders
            };

            res.set('Content-Type', 'audio/wav');
            res.set('X-System-Logs', encodeURIComponent(realLogs.join('|')));
            Object.entries(headerMap).forEach(([k, v]) => res.set(k, v));
            res.set('Access-Control-Expose-Headers',
                [...Object.keys(headerMap), 'X-System-Logs'].join(','));
            res.send(outBuf);
        });
    });
});

app.listen(5000, () => console.log('SERVER READY on port 5000'));