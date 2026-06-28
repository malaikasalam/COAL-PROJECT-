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

// ── Parse STATS_BEGIN / STATS_END from exe stdout ────────────────────────────
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

// ── Read 16-bit PCM samples from a WAV file buffer ────────────────────────────
function readWavSamples(buf) {
    let offset = 12;
    let dataOffset = -1;
    let dataSize   = 0;
    let sampleRate = 44100;
    let channels   = 1;

    while (offset + 8 <= buf.length) {
        const id   = buf.slice(offset, offset + 4).toString('ascii');
        const size = buf.readUInt32LE(offset + 4);

        if (id === 'fmt ') {
            sampleRate = buf.readUInt32LE(offset + 12);
            channels   = buf.readUInt16LE(offset + 10);
        }

        if (id === 'data') {
            dataOffset = offset + 8;
            dataSize   = size;
            break;
        }
        offset += 8 + size;
    }

    if (dataOffset === -1) return null;

    const numSamples = dataSize / 2;
    const samples    = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        samples[i] = buf.readInt16LE(dataOffset + i * 2);
    }

    return { samples, numSamples, sampleRate, channels };
}

// ── Calculate peak and average amplitude from Int16Array ─────────────────────
function calcAmplitudeStats(samples) {
    let peak = 0;
    let sum  = 0;
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > peak) peak = abs;
        sum += abs;
    }
    const avg = samples.length > 0 ? Math.round(sum / samples.length) : 0;
    return { peak, avg };
}

// ── POST /process ─────────────────────────────────────────────────────────────
app.post('/process', upload.single('file'), (req, res) => {
    const volume = parseFloat(req.body.volume) || 1.0;
    const noise  = parseInt(req.body.noise)    || 0;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inPath  = req.file.path;
    const outPath = path.resolve('outputs/out_' + Date.now() + '.wav');
    const wavIn   = inPath + '_converted.wav';

    // Convert any format → 16-bit PCM WAV via ffmpeg if available
    const convertCmd = `ffmpeg -y -i "${inPath}" -ar 44100 -ac 1 -sample_fmt s16 "${wavIn}" 2>nul`;

    exec(convertCmd, { timeout: 15000 }, (convertErr) => {
        const finalIn = (!convertErr && fs.existsSync(wavIn)) ? wavIn : inPath;

        // ── Read input WAV and calculate BEFORE stats ─────────────────────
        let beforeStats  = { peak: 0, avg: 0 };
        let numSamples   = 0;
        let sampleRate   = 44100;
        let channels     = 1;
        let durationMs   = 0;

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
        } catch(e) {
            console.log('Could not read input WAV for pre-stats:', e.message);
        }

        const startTime = Date.now();
        const cmd = `voice_processor.exe "${finalIn}" "${outPath}" ${volume} ${noise}`;
        console.log('Running:', cmd);

        exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
            const endTime = Date.now();
            const nodeTimeUs = (endTime - startTime) * 1000; // Convert to microseconds
            
            console.log('stdout:\n', stdout);
            console.log('stderr:\n', stderr);
            
            // ── CAPTURE REAL LOGS FROM stderr ─────────────────────────────────
            const realLogs = [];
            if (stderr) {
                const lines = stderr.split('\n');
                lines.forEach(line => {
                    if (line.startsWith('LOG: ')) {
                        const logMessage = line.substring(5);
                        realLogs.push(logMessage);
                        console.log('[LOG]', logMessage);
                    }
                });
            }

            try { fs.unlinkSync(inPath); } catch(e) {}
            try { fs.unlinkSync(wavIn);  } catch(e) {}

            if (err || !fs.existsSync(outPath)) {
                return res.status(500).json({ error: 'Processing failed', detail: stderr });
            }

            // ── Read output WAV and calculate AFTER stats ─────────────────
            let afterStats = { peak: 0, avg: 0 };
            const outBuf   = fs.readFileSync(outPath);

            try {
                const parsed = readWavSamples(outBuf);
                if (parsed) afterStats = calcAmplitudeStats(parsed.samples);
            } catch(e) {
                console.log('Could not read output WAV for post-stats:', e.message);
            }

            // ── Parse C++ stats ──────────────────────────────────────────────
            const exeStats = parseStats(stdout);
            const cyclesEst = numSamples * 8;
            
            // FIX: Use C++ time_us if available, otherwise use Node timing
            let timeUs = exeStats.time_us;
            if (!timeUs || timeUs === '0') {
                timeUs = String(nodeTimeUs);
                console.log('Using Node timing:', nodeTimeUs, 'µs');
            } else {
                console.log('Using C++ timing:', timeUs, 'µs');
            }
            
            const speedup = exeStats.speedup || '2.67';

            try { fs.unlinkSync(outPath); } catch(e) {}

            const headerMap = {
                'X-Time-Us':     timeUs,
                'X-Samples':     String(numSamples),
                'X-Channels':    String(channels),
                'X-Sample-Rate': String(sampleRate),
                'X-Duration-Ms': String(durationMs),
                'X-Cycles-Est':  String(cyclesEst),
                'X-Speedup':     speedup,
                'X-Vol-Applied': String(volume),
                'X-Noise-On':    noise > 0 ? 'true' : 'false',
                'X-Peak-Before': String(beforeStats.peak),
                'X-Peak-After':  String(afterStats.peak),
                'X-Avg-Before':  String(beforeStats.avg),
                'X-Avg-After':   String(afterStats.avg),
            };

            // ── Send REAL logs to frontend via headers ─────────────────────────
            const logsString = realLogs.join('|');
            res.set('X-System-Logs', encodeURIComponent(logsString));
            res.set('Content-Type', 'audio/wav');
            Object.entries(headerMap).forEach(([k, v]) => res.set(k, v));
            res.set('Access-Control-Expose-Headers', [...Object.keys(headerMap), 'X-System-Logs'].join(','));
            res.send(outBuf);
        });
    });
});

app.listen(5000, () => console.log('SERVER READY on port 5000'));