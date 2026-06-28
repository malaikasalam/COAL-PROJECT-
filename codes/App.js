import React, { useState, useRef, useEffect } from "react";
import {
  Upload, Mic, Square, Play, RefreshCcw,
  Volume2, Activity, Cpu, Terminal, Music, Zap,
  Home, BarChart2, Sparkles, Loader2, FileText,
  Hash, Sun, Moon, Waves, Headphones, Radio,
  Disc, Sliders, Gauge, Signal, Clock, Timer, Database
} from "lucide-react";
import "./App.css";

// ── Convert any audio blob → 16-bit PCM WAV in the browser ───────────────────
async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx    = new AudioContext({ sampleRate: 44100 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const pcmFloat   = audioBuffer.getChannelData(0);
  const numSamples = pcmFloat.length;

  const int16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const wavBuffer = new ArrayBuffer(44 + int16.byteLength);
  const view      = new DataView(wavBuffer);
  const write     = (offset, str) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0,  'RIFF');
  view.setUint32( 4, 36 + int16.byteLength, true);
  write(8,  'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16,        true);
  view.setUint16(20, 1,         true);
  view.setUint16(22, 1,         true);
  view.setUint32(24, 44100,     true);
  view.setUint32(28, 44100 * 2, true);
  view.setUint16(32, 2,         true);
  view.setUint16(34, 16,        true);
  write(36, 'data');
  view.setUint32(40, int16.byteLength, true);
  new Int16Array(wavBuffer, 44).set(int16);

  await audioCtx.close();
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

// ── Waveform Component ──────────────────────────────────────────────
const Waveform = ({ audioUrl, color, label }) => {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!audioUrl) {
      setLoading(true);
      return;
    }

    const drawWaveform = async () => {
      setLoading(true);
      try {
        const audioContext = new AudioContext();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        
        const samples = channelData.length;
        const step = Math.floor(samples / width);
        
        ctx.clearRect(0, 0, width, height);
        
        let x = 0;
        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
            const idx = i * step + j;
            if (idx < samples) {
              const val = channelData[idx];
              if (val < min) min = val;
              if (val > max) max = val;
            }
          }
          const yMin = (min * 0.5 + 0.5) * height;
          const yMax = (max * 0.5 + 0.5) * height;
          
          ctx.fillStyle = color;
          ctx.fillRect(x, yMin, 2, yMax - yMin);
          x += 2;
        }
        
        await audioContext.close();
      } catch (err) {
        console.error('Waveform error:', err);
      }
      setLoading(false);
    };
    
    drawWaveform();
  }, [audioUrl, color]);

  return (
    <div className="waveform-box">
      <div className="waveform-label">{label}</div>
      <canvas ref={canvasRef} width={300} height={60} className="waveform-canvas"></canvas>
      {loading && <div className="waveform-loading">Loading...</div>}
    </div>
  );
};

export default function App() {
  const [file, setFile]                 = useState(null);
  const [originalURL, setOriginalURL]   = useState(null);
  const [processedURL, setProcessedURL] = useState(null);
  const [isRecording, setIsRecording]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volume, setVolume]             = useState(1.5);
  const [noise, setNoise]               = useState(5);
  const [logs, setLogs]                 = useState([]);
  const [stats, setStats]               = useState(null);
  const [theme, setTheme]               = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const mediaRecorder = useRef(null);
  const addLog = (msg) => setLogs(prev => [...prev.slice(-99), msg]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleUpload = (e) => {
    const audio = e.target.files[0];
    if (!audio) return;
    setFile(audio);
    setOriginalURL(URL.createObjectURL(audio));
    setProcessedURL(null);
    setStats(null);
    setLogs([]);
    addLog(`📁 Uploaded: ${audio.name} (${(audio.size / 1024).toFixed(1)} KB)`);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        addLog("🔄 Converting to WAV...");
        const rawBlob = new Blob(chunks, { type: mediaRecorder.current.mimeType });
        const wavBlob = await blobToWav(rawBlob);
        const wavFile = new File([wavBlob], "recorded.wav", { type: "audio/wav" });
        setFile(wavFile);
        setOriginalURL(URL.createObjectURL(wavBlob));
        setProcessedURL(null);
        setStats(null);
        addLog(`✅ Ready: ${(wavBlob.size / 1024).toFixed(1)} KB WAV`);
      };
      mediaRecorder.current.start();
      setIsRecording(true);
      addLog("🎙️ Recording...");
    } catch (err) {
      addLog("❌ Mic error: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  // ── UPDATED: processAudio with REAL logs from backend ──────────────────────
  const processAudio = async () => {
    if (!file) { alert("Upload or record audio first!"); return; }
    setIsProcessing(true);
    setStats(null);
    
    addLog(`🚀 Starting assembly processing...`);
    addLog(`📁 Input: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    addLog(`🔊 Volume: ${volume}x | Noise: ${noise > 0 ? `ON (${noise})` : "OFF"}`);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("volume", volume);
    fd.append("noise", noise);

    try {
      const res = await fetch("http://localhost:5000/process", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Server error: " + res.status);

      // ── Get REAL logs from backend header ─────────────────────────────────
      const logsHeader = res.headers.get("X-System-Logs");
      if (logsHeader) {
        const realLogs = decodeURIComponent(logsHeader).split('|');
        realLogs.forEach(log => {
          if (log && log.trim()) {
            addLog(log);
          }
        });
      }

      // ── Get stats from backend headers ────────────────────────────────────
      const s = {
        time_us:     res.headers.get("X-Time-Us")     || "0",
        samples:     res.headers.get("X-Samples")     || "0",
        channels:    res.headers.get("X-Channels")    || "1",
        sample_rate: res.headers.get("X-Sample-Rate") || "44100",
        duration_ms: res.headers.get("X-Duration-Ms") || "0",
        cycles_est:  res.headers.get("X-Cycles-Est")  || "0",
        speedup:     res.headers.get("X-Speedup")     || "2.67",
        vol_applied: res.headers.get("X-Vol-Applied") || String(volume),
        noise_on:    res.headers.get("X-Noise-On")    || "false",
        peak_before: res.headers.get("X-Peak-Before") || "0",
        peak_after:  res.headers.get("X-Peak-After")  || "0",
        avg_before:  res.headers.get("X-Avg-Before")  || "0",
        avg_after:   res.headers.get("X-Avg-After")   || "0",
      };
      setStats(s);

      const blob = await res.blob();

      if (processedURL) URL.revokeObjectURL(processedURL);
      setProcessedURL(URL.createObjectURL(blob));

      setTimeout(() => scrollTo("section-logs"), 300);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
      addLog(`   Check if server is running on port 5000`);
    }
    setIsProcessing(false);
  };

  const resetAll = () => {
    setFile(null); setOriginalURL(null);
    setProcessedURL(null); setStats(null); setLogs([]);
    addLog("🔄 System reset");
  };

  const fmtNum  = (v) => Number(v).toLocaleString();
  const fmtTime = (us) => {
    const n = Number(us);
    if (n >= 1000000) return (n / 1000000).toFixed(2) + " s";
    if (n >= 1000)    return (n / 1000).toFixed(2)    + " ms";
    return n + " µs";
  };

  return (
    <div className="app" data-theme={theme}>
      <nav className="navbar">
        <div className="nav-brand">
          <Cpu size={18} className="nav-logo" />
          <span className="nav-title">Audio Processing System</span>
        </div>

        <div className="nav-tabs">
          <button className="nav-tab" onClick={() => scrollTo("section-home")}>
            <Home size={14} /> Home
          </button>
          <button className="nav-tab" onClick={() => scrollTo("section-logs")}>
            <FileText size={14} /> Logs
            {logs.length > 0 && <span className="nav-badge">{logs.length}</span>}
          </button>
          <button className="nav-tab" onClick={() => scrollTo("section-stats")}>
            <BarChart2 size={14} /> Stats
            {stats && <span className="nav-dot" />}
          </button>
        </div>

        <div className="nav-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="nav-status">
            <span className={`status-dot ${isProcessing ? "processing" : "idle"}`} />
            <span className="status-text">{isProcessing ? "Processing" : "Idle"}</span>
          </div>
        </div>
      </nav>

      {/* FULL WIDTH FILTERS PANEL */}
      <div className="filters-fullwidth" id="section-home">
        <div className="controls-row">
          <label className="control-btn">
            <Upload size={16} /> Upload
            <input type="file" accept="audio/*" onChange={handleUpload} hidden />
          </label>
          {!isRecording ? (
            <button className="control-btn" onClick={startRecording}>
              <Mic size={16} /> Record
            </button>
          ) : (
            <button className="control-btn stop" onClick={stopRecording}>
              <Square size={16} /> Stop
            </button>
          )}
          <button className="control-btn reset" onClick={resetAll}>
            <RefreshCcw size={16} /> Reset
          </button>
        </div>

        <div className="sliders-compact">
          <div className="slider-item">
            <label><Volume2 size={14} /> Volume: {volume}x</label>
            <input type="range" min="0.5" max="5" step="0.1" value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))} />
          </div>
          <div className="slider-item">
            <label><Waves size={14} /> Noise Reduction: {noise === 0 ? "OFF" : noise}</label>
            <input type="range" min="0" max="20" value={noise}
              onChange={e => setNoise(parseInt(e.target.value))} />
          </div>
        </div>

        <button className="process-btn" onClick={processAudio} disabled={isProcessing}>
          {isProcessing
            ? <><Loader2 className="spin" size={16} /> Processing audio...</>
            : <><Play size={16} /> Execute Assembly</>}
        </button>

        {isProcessing && (
          <div className="progress-spinner">
            <Loader2 className="spin" size={20} />
            <span>Assembly engine running... please wait</span>
          </div>
        )}
      </div>

      {/* CONTENT ROW: Audio Boxes (Left) + Logs (Right) */}
      <div className="content-row">
        {/* LEFT SIDE - Both Audio Boxes in ONE LINE */}
        <div className="audio-boxes-row">
          <div className="waveform-card">
            <div className="waveform-header"><Mic size={14} /> RAW INPUT</div>
            {originalURL ? (
              <>
                <Waveform audioUrl={originalURL} color="#14B8A6" label="Original" />
                <audio controls src={originalURL} className="audio-player" />
              </>
            ) : (
              <div className="empty-waveform">No signal detected</div>
            )}
          </div>

          <div className="waveform-card">
            <div className="waveform-header"><Sparkles size={14} /> PROCESSED OUTPUT</div>
            {processedURL ? (
              <>
                <Waveform audioUrl={processedURL} color="#F43F5E" label="Processed" />
                <audio controls src={processedURL} className="audio-player" />
              </>
            ) : (
              <div className="empty-waveform">
                {isProcessing ? "Processing..." : "Waiting for execution"}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - System Logs */}
        <div className="logs-column" id="section-logs">
          <div className="logs-header">
            <Terminal size={14} /> SYSTEM LOGS
            {logs.length > 0 && <span className="log-count">{logs.length}</span>}
          </div>
          <div className="logs-content">
            {logs.length === 0 ? (
              <div className="logs-empty">No activity yet. Upload or record audio.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* STATS PANEL - Full Width at Bottom */}
      {stats && (
        <div className="stats-compact" id="section-stats">
          <div className="stats-header"><Zap size={14} /> PERFORMANCE STATS</div>
          <div className="stats-grid-compact">
            <div className="stat-cell"><span>⏱️ Time</span><strong>{fmtTime(stats.time_us)}</strong></div>
            <div className="stat-cell"><span>⚡ Cycles</span><strong>{fmtNum(stats.cycles_est)}</strong></div>
            <div className="stat-cell"><span>🚀 Speedup</span><strong>{stats.speedup}x</strong></div>
            <div className="stat-cell"><span>📊 Samples</span><strong>{fmtNum(stats.samples)}</strong></div>
            <div className="stat-cell"><span>📈 Peak</span><strong>{stats.peak_before}→{stats.peak_after}</strong></div>
            <div className="stat-cell"><span>📉 Avg</span><strong>{stats.avg_before}→{stats.avg_after}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}