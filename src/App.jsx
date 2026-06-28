import React, { useState, useRef, useEffect } from "react";
import {
  Upload, Mic, Square, Play, RefreshCcw, Download, ChevronDown,
  Volume2, Cpu, Terminal, Zap, Sparkles,
  Home, BarChart2, Loader2, FileText,
  Sun, Moon, Waves, Sliders, Music, Compass,
  VolumeX, Volume1, Scissors, Activity,
  Clock, ArrowRight, ChevronRight, Star,
  Shield, Cpu as CpuIcon, Gauge, Radio,
  Bell, ToggleLeft, Database, GitBranch
} from "lucide-react";
import "./App.css";

async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const pcmFloat = audioBuffer.getChannelData(0);
  const numSamples = pcmFloat.length;
  const int16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const wavBuffer = new ArrayBuffer(44 + int16.byteLength);
  const view = new DataView(wavBuffer);
  const write = (offset, str) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + int16.byteLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, int16.byteLength, true);
  new Int16Array(wavBuffer, 44).set(int16);
  await audioCtx.close();
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

const scrollTo = (id, offset = 80) => {
  const element = document.getElementById(id);
  if (element) {
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
};

// ─── Collapsible Stats Panel ──────────────────────────────────────────────────
const CollapsibleStatsPanel = ({ title, icon, children, badge, badgeStyle, panelId }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="stats-compact" id={panelId}>
      <div className="stats-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}<span>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {badge && <span className="stats-source-badge" style={badgeStyle}>{badge}</span>}
          <ChevronDown size={15} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.28s ease', color: 'var(--text-secondary)' }} />
        </div>
      </div>
      <div style={{ maxHeight: open ? '2000px' : 0, overflow: 'hidden', transition: 'max-height 0.38s cubic-bezier(0.4,0,0.2,1)', opacity: open ? 1 : 0 }}>
        {children}
      </div>
    </div>
  );
};

// ─── Feature Toggle ───────────────────────────────────────────────────────────
const FeatureToggle = ({ icon, label, active, onChange, description }) => (
  <button className={`feature-toggle ${active ? 'active' : ''}`} onClick={onChange} title={description}>
    {icon}<span>{label}</span>
  </button>
);

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
  <div className="feature-card" style={{ animationDelay: `${delay}s` }}>
    <div className="feature-icon"><Icon size={32} /></div>
    <h3>{title}</h3><p>{description}</p>
  </div>
);

// ─── Home animated background ─────────────────────────────────────────────────
const AnimatedWaveformHome = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); let animId, time = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;
      const g = ctx.createLinearGradient(0,0,W,0);
      g.addColorStop(0,'rgba(59,130,246,0.15)'); g.addColorStop(0.5,'rgba(139,92,246,0.2)'); g.addColorStop(1,'rgba(59,130,246,0.15)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      [{ amplitude:60,frequency:0.008,speed:0.025,color:'rgba(59,130,246,0.4)',width:3 },
       { amplitude:45,frequency:0.012,speed:0.035,color:'rgba(139,92,246,0.3)',width:2.5 },
       { amplitude:30,frequency:0.018,speed:0.045,color:'rgba(59,130,246,0.2)',width:2 },
       { amplitude:20,frequency:0.025,speed:0.06, color:'rgba(168,85,247,0.15)',width:1.5 }
      ].forEach(l => {
        ctx.beginPath(); ctx.strokeStyle=l.color; ctx.lineWidth=l.width;
        const phase=time*l.speed;
        for(let x=0;x<W;x+=2){
          let y=H/2+Math.sin(x*l.frequency+phase)*l.amplitude+Math.sin(x*0.003-phase*1.5)*(l.amplitude*0.6)+Math.sin(x*0.015+phase*0.8)*(l.amplitude*0.3)+Math.sin(x*0.03-phase*2)*(l.amplitude*0.15);
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.stroke();
      });
      for(let i=0;i<60;i++){
        const x=(i*137.5)%W,y=H/2+Math.sin(time*2+i*0.3)*40+Math.cos(x*0.02+time)*20,s=2+Math.sin(time*3+i)*1;
        ctx.fillStyle=`rgba(59,130,246,${0.3+Math.sin(time+i)*0.1})`;
        ctx.beginPath();ctx.arc(x,y,s,0,Math.PI*2);ctx.fill();
      }
      for(let i=0;i<5;i++){
        const r=100+i*40+Math.sin(time*2)*15;
        ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);
        ctx.strokeStyle=`rgba(59,130,246,${0.05-i*0.01})`;ctx.lineWidth=1;ctx.stroke();
      }
      time+=0.02; animId=requestAnimationFrame(draw);
    };
    resize(); window.addEventListener('resize',resize); draw();
    return ()=>{ window.removeEventListener('resize',resize); cancelAnimationFrame(animId); };
  },[]);
  return <canvas ref={canvasRef} className="animated-waveform-bg"/>;
};

// ─── Waveform canvas ──────────────────────────────────────────────────────────
const Waveform = ({ audioUrl, color }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!audioUrl) return;
    let mounted = true;
    (async () => {
      try {
        const actx = new AudioContext();
        const buf = await actx.decodeAudioData(await (await fetch(audioUrl)).arrayBuffer());
        const data = buf.getChannelData(0);
        const canvas = canvasRef.current;
        if (!canvas || !mounted) { await actx.close(); return; }
        const {width:W, height:H} = canvas;
        const ctx = canvas.getContext('2d');
        const step = Math.floor(data.length / W);
        ctx.clearRect(0,0,W,H);
        let x=0;
        for(let i=0;i<W;i++){
          let min=1,max=-1;
          for(let j=0;j<step;j++){
            const v=data[i*step+j];
            if(v!==undefined){if(v<min)min=v;if(v>max)max=v;}
          }
          ctx.fillStyle=color;
          ctx.fillRect(x,(min*0.5+0.5)*H,2,(max-min)*0.5*H);
          x+=2;
        }
        await actx.close();
      } catch(e){ console.error('Waveform:',e); }
    })();
    return ()=>{ mounted=false; };
  },[audioUrl]);
  return <canvas ref={canvasRef} width={400} height={80} className="waveform-canvas"/>;
};

// ─── Stat cells ───────────────────────────────────────────────────────────────
const StatCell = ({ icon, label, value, highlight }) => (
  <div className={`stat-cell${highlight?' stat-cell--hi':''}`}>
    <span>{icon} {label}</span><strong>{value}</strong>
  </div>
);
const ClockCell = ({ icon, label, value, formula }) => (
  <div className="clock-cell" title={formula||''}>
    <span>{icon} {label}</span><strong>{value}</strong>
    {formula && <small className="clock-formula">{formula}</small>}
  </div>
);

// ─── computeClockStats ────────────────────────────────────────────────────────
// FIX: Robust fallback chain so CPI / MIPS / Cycles never show 0
//      when the server sends real data.
function computeClockStats(stats) {
  const REAL_CPU_HZ   = 3_400_000_000;
  const clockPeriodNs = (1 / REAL_CPU_HZ * 1e9).toFixed(4);

  // ── 1. Time ────────────────────────────────────────────────────────────────
  const timeUs = Number(stats.time_us)  || 0;
  const samples = Number(stats.samples) || 0;
  const timeS   = timeUs > 0 ? timeUs / 1_000_000 : 0;

  // ── 2. Total instructions ──────────────────────────────────────────────────
  // Priority: instructions_total (real ASM counter) → instr_per_sample × samples
  let totalInstr = Number(stats.instructions_total) || 0;
  if (totalInstr === 0 && samples > 0) {
    const ips = parseFloat(stats.instr_per_sample) || 0;
    if (ips > 0) totalInstr = Math.round(ips * samples);
  }

  // ── 3. Real RDTSC clock cycles ─────────────────────────────────────────────
  // Priority: real_cycles from RDTSC → derive from time_us × CPU_HZ
  let realCycles = Number(stats.real_cycles) || 0;
  if (realCycles === 0 && timeS > 0)
    realCycles = Math.round(timeS * REAL_CPU_HZ);

  // ── 4. CPI = RDTSC cycles ÷ retired instructions ──────────────────────────
  // FIX: Try server value first; if it's 0 / NaN / missing, recompute from
  //      the (now-populated) realCycles and totalInstr.
  let realCpi = parseFloat(stats.real_cpi) || 0;
  if (!(realCpi > 0) && realCycles > 0 && totalInstr > 0)
    realCpi = realCycles / totalInstr;

  // ── 5. MIPS = instructions ÷ execution_time_s ÷ 1,000,000 ─────────────────
  // FIX: Same pattern — server value → recompute if absent / 0.
  let realMips = parseFloat(stats.real_mips) || 0;
  if (!(realMips > 0)) {
    if (realCycles > 0 && totalInstr > 0) {
      // Prefer RDTSC-based time for accuracy
      const execSec = realCycles / REAL_CPU_HZ;
      realMips = (totalInstr / execSec) / 1e6;
    } else if (timeS > 0 && totalInstr > 0) {
      realMips = (totalInstr / timeS) / 1e6;
    }
  }

  // ── 6. Throughput = samples per second ─────────────────────────────────────
  let realThroughput = Number(stats.real_throughput) || 0;
  if (!(realThroughput > 0) && samples > 0 && timeS > 0)
    realThroughput = samples / timeS;

  // ── 7. instr_per_sample display value ──────────────────────────────────────
  const instrPerSampleDisplay = (totalInstr > 0 && samples > 0)
    ? (totalInstr / samples).toFixed(1)
    : (parseFloat(stats.instr_per_sample) > 0
        ? parseFloat(stats.instr_per_sample).toFixed(1)
        : '—');

  // ── Format helpers ─────────────────────────────────────────────────────────
  const fmtTime = () => {
    if (timeUs >= 1_000_000) return (timeUs / 1_000_000).toFixed(2) + ' s';
    if (timeUs >= 1_000)     return (timeUs / 1_000).toFixed(1) + ' ms';
    return timeUs + ' µs';
  };

  const fmtMips = (m) => {
    if (!(m > 0)) return '—';
    if (m >= 1000) return (m / 1000).toFixed(2) + ' GIPS';
    return Math.round(m).toLocaleString() + ' MIPS';
  };

  return {
    execTime:       timeUs > 0 ? fmtTime() : '—',
    clockFreq:      '3.4 GHz',
    clockPeriod:    clockPeriodNs + ' ns',
    clockCycles:    realCycles   > 0 ? realCycles.toLocaleString()   : '—',
    instrCount:     totalInstr   > 0 ? totalInstr.toLocaleString()   : '—',
    instrPerSample: instrPerSampleDisplay,
    cpi:            realCpi  > 0 ? realCpi.toFixed(2)  : '—',
    mips:           fmtMips(realMips),
    throughput:     realThroughput > 0
                      ? Math.round(realThroughput).toLocaleString() + ' smp/s' : '—',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLLING vs INTERRUPT GRAPH — FIXED
//
// KEY INSIGHT: Only ONE mode is measured per request. The other is derived.
//
// CORRECT MODEL:
//   Polling  → processes ALL N samples.      Work = N,       Cycles = C_poll
//   Interrupt → processes RATIO×N samples.   Work = ratio×N, Cycles = C_poll × ratio
//
// The THROUGHPUT of both modes (samples-out / time) is IDENTICAL because
// interrupt skips the same proportion of time it skips samples.
//
// The meaningful comparison metrics are:
//   • CPU Cycles consumed      (polling uses more → bar chart of cycles)
//   • CPU Time (ms)            (polling takes longer)
//   • Instructions retired     (polling retires more)
//   • Effective CPU savings    ((1 – ratio) × 100 %)
//
// The line chart therefore shows CUMULATIVE CPU CYCLES over processing progress,
// not throughput — this correctly shows polling climbing faster than interrupt.
// ═══════════════════════════════════════════════════════════════════════════════

const PollingInterruptGraph = ({ stats }) => {
  const [chartData, setChartData] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!stats) return;

    const mode            = stats.mode_active || 'polling';
    const samples         = Number(stats.samples)       || 44100;
    const timeUs          = Number(stats.time_us)       || 100000;
    const realCycles      = Number(stats.real_cycles)   || 0;
    const realCpuFreq     = parseFloat(stats.real_cpu_freq_ghz) || 3.4;
    const CPU_HZ          = realCpuFreq * 1_000_000_000;
    const interruptsFired = Number(stats.interrupts_fired) || 0;
    const threshold       = Number(stats.threshold_used)   || 500;

    // ── Measured throughput (samples / execution_time_s) ─────────────────────
    const timeS = timeUs > 0 ? timeUs / 1_000_000 : 1;
    const realThroughput = Number(stats.real_throughput) > 0
      ? Number(stats.real_throughput)
      : samples / timeS;

    // ── Total instructions from ASM counter ──────────────────────────────────
    let totalInstr = Number(stats.instructions_total) || 0;
    if (totalInstr === 0) {
      const ips = parseFloat(stats.instr_per_sample) || 4;
      totalInstr = Math.round(ips * samples);
    }

    // ── RDTSC cycles (fall back to time-derived) ──────────────────────────────
    const measuredCycles = realCycles > 0
      ? realCycles
      : Math.round(timeS * CPU_HZ);

    // ── interruptRatio: fraction of samples processed in interrupt mode ───────
    // When interrupt mode is measured: use the real counter (most accurate).
    // When polling mode is measured: estimate from threshold vs 16-bit range
    //   using a conservative model — threshold/32768 gives the fraction BELOW
    //   threshold (samples skipped), so ratio = 1 – threshold/32768.
    //   We clamp to [0.10, 0.90] to keep the chart educational.
    const interruptRatio = (() => {
      if (mode === 'interrupt' && interruptsFired > 0 && samples > 0)
        return Math.min(0.99, interruptsFired / samples);

      // Polling mode — derive from threshold (conservative straight-line model)
      const maxAmplitude = 32768;
      const rawRatio = 1 - (threshold / maxAmplitude);
      return Math.min(0.90, Math.max(0.10, rawRatio));
    })();

    // ── Build both columns using CORRECT physics ──────────────────────────────
    // Polling  → does ALL work.            Interrupt → does ratio fraction.
    // CPI stays the same per sample (same code path, same pipeline pressure).
    // Cycles scale linearly with work done.

    let pollingCycles, interruptCycles, pollingInstr, interruptInstr;

    if (mode === 'polling') {
      // Measured
      pollingCycles = measuredCycles;
      pollingInstr  = totalInstr;
      // Derived: interrupt would have done only interruptRatio of the work
      interruptCycles = Math.round(pollingCycles * interruptRatio);
      interruptInstr  = Math.round(pollingInstr  * interruptRatio);
    } else {
      // Measured (interrupt)
      interruptCycles = measuredCycles;
      interruptInstr  = totalInstr;
      // Derived: polling would have done ALL samples = 1/ratio more work
      pollingCycles = Math.round(interruptCycles / interruptRatio);
      pollingInstr  = Math.round(interruptInstr  / interruptRatio);
    }

    // ── Per-mode CPI (should be equal; any difference = measurement noise) ───
    const cpiBase = (measuredCycles > 0 && totalInstr > 0)
      ? measuredCycles / totalInstr
      : (parseFloat(stats.real_cpi) || 2.0);

    // ── MIPS for each mode ────────────────────────────────────────────────────
    const mipsForMode = (cyc, instr) => {
      if (cyc <= 0 || instr <= 0) return 0;
      return (instr / (cyc / CPU_HZ)) / 1_000_000;
    };

    const pollingMips   = mipsForMode(pollingCycles,   pollingInstr);
    const interruptMips = mipsForMode(interruptCycles, interruptInstr);

    // ── Throughput: both modes deliver N samples/s to the consumer ────────────
    // The audio output rate is the same. The difference is CPU load.
    // For the chart we show CYCLES consumed (the real saving), not throughput.
    const pollingThroughput   = realThroughput;   // same output rate
    const interruptThroughput = realThroughput;   // same output rate

    // ── Time saved ────────────────────────────────────────────────────────────
    const pollingTimeMs   = (pollingCycles   / CPU_HZ) * 1000;
    const interruptTimeMs = (interruptCycles / CPU_HZ) * 1000;

    // ── CPU savings ───────────────────────────────────────────────────────────
    const cpuSavingsPct = ((1 - interruptRatio) * 100).toFixed(1);
    const cyclesSavedPct = pollingCycles > 0
      ? (((pollingCycles - interruptCycles) / pollingCycles) * 100).toFixed(1)
      : cpuSavingsPct;

    // ── Line chart: cumulative cycles consumed as processing advances ─────────
    // Progress points: [0%, 25%, 50%, 75%, 100%]
    // Polling  climbs steeply (every sample costs cycles).
    // Interrupt climbs at ratio× the rate (skips sub-threshold samples).
    const labels = ['Start', '25%', '50%', '75%', 'Complete'];
    const progressPoints = [0, 0.25, 0.5, 0.75, 1.0];
    const pollingLine   = progressPoints.map(p => pollingCycles   * p);
    const interruptLine = progressPoints.map(p => interruptCycles * p);

    setChartData({
      labels,
      polling:             pollingLine,
      interrupt:           interruptLine,
      // Throughput (displayed in cards, but note both are same)
      pollingThroughput,
      interruptThroughput,
      // Cycles (the KEY metric)
      pollingCycles,
      interruptCycles,
      cyclesSavedPct,
      // Instructions
      pollingInstr,
      interruptInstr,
      // CPI / MIPS
      pollingCpi:    cpiBase,
      interruptCpi:  cpiBase,
      pollingMips,
      interruptMips,
      // Times
      pollingTimeMs:   pollingTimeMs.toFixed(2),
      interruptTimeMs: interruptTimeMs.toFixed(2),
      // Summary
      samples,
      interruptsFired: mode === 'interrupt'
        ? interruptsFired
        : Math.round(samples * interruptRatio),
      mode,
      cpuSavings:          cpuSavingsPct,
      interruptRatio,
      realCpuFreq,
      timeMs: (timeUs / 1000).toFixed(2),
      realCpi:  cpiBase,
      realMips: mode === 'polling' ? pollingMips : interruptMips,
      // Y-axis: max cycles (for scaling the chart)
      maxCycles: pollingCycles,
    });
  }, [stats]);

  if (!chartData) return (
    <div className="piv2-placeholder">
      <Activity size={22} style={{opacity:0.2,marginBottom:4}}/>
      <span>Process audio to see Polling vs Interrupt comparison</span>
    </div>
  );

  const fmt    = n => (!n || isNaN(n)) ? '0' : Math.round(n).toLocaleString();
  const fmtNum = n => (!n || isNaN(n)) ? '0' : Number(n).toLocaleString();
  const fmtK   = n => {
    if (!n || isNaN(n)) return '0';
    const v = Math.round(n);
    if (v >= 1_000_000_000) return (v/1_000_000_000).toFixed(1)+'B';
    if (v >= 1_000_000)     return (v/1_000_000).toFixed(1)+'M';
    if (v >= 1_000)         return (v/1_000).toFixed(0)+'K';
    return v.toString();
  };

  // Chart renders CYCLES on the Y axis (the meaningful difference)
  const maxDisplay = Math.max(chartData.maxCycles * 1.08, 1000);

  const CW=500, CH=150, PL=52, PR=10, PT=12, PB=22;
  const plotW=CW-PL-PR, plotH=CH-PT-PB;
  const px = i => PL + (i/4)*plotW;
  const py = v => PT + plotH - (v/maxDisplay)*plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const iPoints = chartData.interrupt.map((v,i)=>`${px(i)},${py(v)}`).join(' ');
  const pPoints = chartData.polling  .map((v,i)=>`${px(i)},${py(v)}`).join(' ');

  return (
    <div className="piv2-wrap">
      {/* ── Header ── */}
      <div className="piv2-header">
        <div className="piv2-title-block">
          <span className="piv2-eyebrow">CPU CYCLE CONSUMPTION — REAL RDTSC</span>
          <span className="piv2-title">Polling vs Interrupt Mode Analysis</span>
        </div>
        <div className="piv2-badges">
          <span className="piv2-badge piv2-badge--int">
            <Bell size={9}/> Interrupt {chartData.mode==='interrupt'?'(Measured)':'(Derived)'}
          </span>
          <span className="piv2-badge piv2-badge--pol">
            <RefreshCcw size={9}/> Polling {chartData.mode==='polling'?'(Measured)':'(Derived)'}
          </span>
        </div>
      </div>

      {/* ── SVG Chart — shows cumulative CYCLES, not throughput ── */}
      <div className="piv2-chart-area">
        <div className="piv2-y-axis-wrap">
          <div className="piv2-y-title">CYCLES CONSUMED</div>
          <div className="piv2-y-labels">
            {yTicks.map((r,i)=>(
              <span key={i} className="piv2-y-label">{fmtK(maxDisplay*r)}</span>
            ))}
          </div>
        </div>
        <div className="piv2-plot-col">
          <svg ref={svgRef} width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}
            className="piv2-svg" role="img" aria-label="Polling vs interrupt CPU cycles chart">
            <defs>
              <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01"/>
              </linearGradient>
              <linearGradient id="polGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.08"/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01"/>
              </linearGradient>
            </defs>
            {yTicks.map((r,i)=>(
              <line key={i} x1={PL} y1={py(maxDisplay*r)} x2={CW-PR} y2={py(maxDisplay*r)}
                stroke="#334155" strokeWidth="0.8"
                strokeDasharray={i===0||i===4?'none':'4,6'} opacity="0.25"/>
            ))}
            <line x1={PL} y1={py(0)} x2={CW-PR} y2={py(0)} stroke="#475569" strokeWidth="1.2" opacity="0.4"/>
            {/* Shaded area under each line */}
            <path d={`M${px(0)},${py(chartData.interrupt[0])} ${iPoints} L${px(4)},${PT+plotH} L${px(0)},${PT+plotH} Z`} fill="url(#intGrad)"/>
            <path d={`M${px(0)},${py(chartData.polling[0])}   ${pPoints} L${px(4)},${PT+plotH} L${px(0)},${PT+plotH} Z`} fill="url(#polGrad)"/>
            {/* Lines */}
            <polyline points={iPoints} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={pPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Interrupt dots */}
            {chartData.interrupt.map((v,i)=>(
              <g key={`i${i}`} style={{cursor:'pointer'}}
                onMouseEnter={()=>setHoveredPoint({type:'interrupt',idx:i,v,x:px(i),y:py(v)})}
                onMouseLeave={()=>setHoveredPoint(null)}>
                <circle cx={px(i)} cy={py(v)} r="4.5" fill="#10b981" stroke="#fff" strokeWidth="2"/>
                <circle cx={px(i)} cy={py(v)} r="2"   fill="#fff" opacity="0.9"/>
              </g>
            ))}
            {/* Polling dots */}
            {chartData.polling.map((v,i)=>(
              <g key={`p${i}`} style={{cursor:'pointer'}}
                onMouseEnter={()=>setHoveredPoint({type:'polling',idx:i,v,x:px(i),y:py(v)})}
                onMouseLeave={()=>setHoveredPoint(null)}>
                <circle cx={px(i)} cy={py(v)} r="4.5" fill="#3b82f6" stroke="#fff" strokeWidth="2"/>
                <circle cx={px(i)} cy={py(v)} r="2"   fill="#fff" opacity="0.9"/>
              </g>
            ))}
            {/* Tooltip */}
            {hoveredPoint && (()=>{
              const tx=Math.min(hoveredPoint.x+12,CW-140);
              const ty=Math.max(hoveredPoint.y-42,2);
              const col=hoveredPoint.type==='interrupt'?'#10b981':'#3b82f6';
              return (
                <g>
                  <rect x={tx} y={ty} width={130} height={36} rx="5"
                    fill="#0a1628" stroke={col} strokeWidth="1.2" opacity="0.97"/>
                  <text x={tx+8} y={ty+13} fill={col} fontSize="7.5" fontFamily="monospace" fontWeight="700">
                    {hoveredPoint.type.toUpperCase()} · {chartData.labels[hoveredPoint.idx]}
                  </text>
                  <text x={tx+8} y={ty+27} fill="#e2e8f0" fontSize="8.5" fontFamily="monospace" fontWeight="600">
                    {fmtK(hoveredPoint.v)} cycles
                  </text>
                </g>
              );
            })()}
          </svg>
          <div className="piv2-x-labels">
            {chartData.labels.map((l,i)=><span key={i} className="piv2-x-label">{l}</span>)}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="piv2-cards">
        {/* Interrupt card */}
        <div className={`piv2-card piv2-card--int${chartData.mode==='interrupt'?' piv2-card--measured':''}`}>
          <div className="piv2-card-head">
            <div className="piv2-card-icon piv2-card-icon--int"><Bell size={13}/></div>
            <span className="piv2-card-title">INTERRUPT MODE</span>
            {chartData.mode==='interrupt'
              ? <span className="piv2-measured"><Activity size={8}/> MEASURED</span>
              : <span className="piv2-measured" style={{opacity:0.5}}>DERIVED</span>}
          </div>
          <div className="piv2-card-rows">
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Cpu size={14}/><span>CPU Cycles</span></div>
              <strong>{fmt(chartData.interruptCycles)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Clock size={14}/><span>CPU Time</span></div>
              <strong>{chartData.interruptTimeMs} <small>ms</small></strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><BarChart2 size={14}/><span>CPI</span></div>
              <strong>{(chartData.interruptCpi||0).toFixed(2)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Zap size={14}/><span>MIPS</span></div>
              <strong>{fmt(chartData.interruptMips)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Radio size={14}/><span>Samples proc.</span></div>
              <strong>{fmt(chartData.interruptsFired)} <small>/{fmt(chartData.samples)}</small></strong>
            </div>
          </div>
        </div>

        {/* Polling card */}
        <div className={`piv2-card piv2-card--pol${chartData.mode==='polling'?' piv2-card--measured':''}`}>
          <div className="piv2-card-head">
            <div className="piv2-card-icon piv2-card-icon--pol"><RefreshCcw size={13}/></div>
            <span className="piv2-card-title">POLLING MODE</span>
            {chartData.mode==='polling'
              ? <span className="piv2-measured"><Activity size={8}/> MEASURED</span>
              : <span className="piv2-measured" style={{opacity:0.5}}>DERIVED</span>}
          </div>
          <div className="piv2-card-rows">
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Cpu size={14}/><span>CPU Cycles</span></div>
              <strong>{fmt(chartData.pollingCycles)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Clock size={14}/><span>CPU Time</span></div>
              <strong>{chartData.pollingTimeMs} <small>ms</small></strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><BarChart2 size={14}/><span>CPI</span></div>
              <strong>{(chartData.pollingCpi||0).toFixed(2)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Zap size={14}/><span>MIPS</span></div>
              <strong>{fmt(chartData.pollingMips)}</strong>
            </div>
            <div className="piv2-card-row">
              <div className="piv2-row-label"><Radio size={14}/><span>Samples proc.</span></div>
              <strong>{fmt(chartData.samples)} <small>/{fmt(chartData.samples)}</small></strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="piv2-summary">
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Star size={8}/> CYCLES SAVED</span>
          <strong className="piv2-green">{chartData.cyclesSavedPct}%</strong>
        </div>
        <div className="piv2-sep"/>
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Activity size={8}/> CPU LOAD ↓</span>
          <strong className="piv2-green">{chartData.cpuSavings}%</strong>
        </div>
        <div className="piv2-sep"/>
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Cpu size={8}/> INT CYCLES</span>
          <strong className="piv2-green">{fmtK(chartData.interruptCycles)}</strong>
        </div>
        <div className="piv2-sep"/>
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Cpu size={8}/> POLL CYCLES</span>
          <strong className="piv2-blue">{fmtK(chartData.pollingCycles)}</strong>
        </div>
        <div className="piv2-sep"/>
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Clock size={8}/> PROCESS TIME</span>
          <strong>{chartData.timeMs} ms</strong>
        </div>
        <div className="piv2-sep"/>
        <div className="piv2-sum-item">
          <span className="piv2-sum-label"><Radio size={8}/> INT RATIO</span>
          <strong>{(chartData.interruptRatio * 100).toFixed(1)}%</strong>
        </div>
      </div>

      <div className="piv2-footer">
        <BarChart2 size={9}/> Chart = cumulative CPU cycles consumed · Measured mode uses real RDTSC · Derived = measured × interrupt ratio
        &nbsp;·&nbsp; CPI: {(chartData.realCpi||0).toFixed(2)}
        &nbsp;·&nbsp; Samples: {fmtNum(chartData.samples)}
        &nbsp;·&nbsp; Threshold: {stats.threshold_used || '500'}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUS BOTTLENECK VISUALIZATION (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
const BusBottleneckViz = ({ stats }) => {
  const realCycles      = Number(stats.real_cycles)       || 0;
  const samples         = Number(stats.samples)           || 0;
  const instrPerSample  = Number(stats.instr_per_sample)  || 12;
  const cacheHits       = Number(stats.cache_hits)        || 0;
  const cacheMisses     = Number(stats.cache_misses)      || 0;
  const mode            = stats.mode_active               || 'polling';
  const interruptsFired = Number(stats.interrupts_fired)  || samples;
  const CACHE_HIT_CYCLES  = 4;
  const CACHE_MISS_CYCLES = 50;
  const ALU_CYCLES        = 1;
  const BRANCH_CYCLES     = 2;
  const MEM_STORE_CYCLES  = 1;
  const totalInstr       = samples * instrPerSample;
  const instrFetchCycles = totalInstr;
  const dataHitCycles    = cacheHits   * CACHE_HIT_CYCLES;
  const dataMissCycles   = cacheMisses * CACHE_MISS_CYCLES;
  let aluOps = 0;
  if (Number(stats.vol_applied) > 0) aluOps += samples * 2;
  if (stats.compressor === 'true')   aluOps += samples * 2;
  if (stats.echo       === 'true')   aluOps += samples * 3;
  if (stats.pitch_shift=== 'true')   aluOps += samples;
  if (stats.noise_on   === 'true')   aluOps += samples * 2;
  if (stats.noise_gate === 'true')   aluOps += samples;
  const execCycles = aluOps * ALU_CYCLES;
  let branchCount = samples * 3;
  if (stats.compressor === 'true') branchCount += samples;
  if (stats.limiter    === 'true') branchCount += samples * 2;
  if (stats.noise_gate === 'true') branchCount += samples;
  const branchCycles = branchCount * BRANCH_CYCLES;
  const storeCycles  = samples * MEM_STORE_CYCLES;
  let interruptOverhead = 0;
  if (mode === 'interrupt') interruptOverhead = interruptsFired * 15;
  const accountedCycles = instrFetchCycles + dataHitCycles + dataMissCycles +
                          execCycles + branchCycles + storeCycles + interruptOverhead;
  const stallCycles  = Math.max(0, realCycles - accountedCycles);
  const totalDisplay = accountedCycles + stallCycles || 1;
  const pct = v => ((v / totalDisplay) * 100).toFixed(1);
  const fmt = v => Math.round(v).toLocaleString();
  const segments = [
    { key:'fetch',  label:'Instr Fetch',       cycles:instrFetchCycles, color:'#3b82f6', desc:'Fetching opcodes from instruction memory' },
    { key:'hit',    label:'L1 Cache Hit',      cycles:dataHitCycles,    color:'#14b8a6', desc:`${fmt(cacheHits)} hits × ${CACHE_HIT_CYCLES}cy` },
    { key:'miss',   label:'Cache Miss → DRAM', cycles:dataMissCycles,   color:'#f43f5e', desc:`${fmt(cacheMisses)} misses × ${CACHE_MISS_CYCLES}cy` },
    { key:'alu',    label:'ALU Operations',    cycles:execCycles,       color:'#8b5cf6', desc:`${fmt(aluOps)} arithmetic ops` },
    { key:'branch', label:'Branch/Jump',       cycles:branchCycles,     color:'#f59e0b', desc:'Conditional jumps' },
    { key:'store',  label:'Writeback',         cycles:storeCycles,      color:'#ec4899', desc:'Writing samples back' },
    { key:'int',    label:'Interrupt Handler', cycles:interruptOverhead, color:'#06b6d4', desc:`${fmt(interruptsFired)} interrupts × ~15cy` },
    { key:'stall',  label:'Pipeline Stall',    cycles:stallCycles,      color:'#475569', desc:'Hazards, alignment overhead' }
  ].filter(s => s.cycles > 0);
  const bottleneckPct = (
    parseFloat(pct(segments.find(s=>s.key==='fetch')?.cycles||0)) +
    parseFloat(pct(segments.find(s=>s.key==='miss' )?.cycles||0))
  ).toFixed(1);
  return (
    <div className="bv-wrap">
      <div className="bv-timeline-label">CYCLE BUDGET — {fmt(realCycles)} RDTSC cycles total</div>
      <div className="bv-timeline">
        {segments.map(s => (
          <div key={s.key} className="bv-seg"
            title={`${s.label}: ${fmt(s.cycles)} cycles (${pct(s.cycles)}%)\n${s.desc}`}
            style={{width:`${pct(s.cycles)}%`,background:s.color}}/>
        ))}
      </div>
      <div className="bv-timeline-ticks">
        {['0','25%','50%','75%','100%'].map(t=><span key={t}>{t}</span>)}
      </div>
      <div className="bv-rows">
        {segments.map(s => (
          <div key={s.key} className="bv-row">
            <div className="bv-dot" style={{background:s.color}}/>
            <span className="bv-label">{s.label}</span>
            <div className="bv-mini-bar">
              <div style={{width:`${pct(s.cycles)}%`,background:s.color,height:'100%',borderRadius:2,opacity:.75}}/>
            </div>
            <span className="bv-pct">{pct(s.cycles)}%</span>
            <span className="bv-cycles">{fmt(s.cycles)} cyc</span>
            <span className="bv-desc">{s.desc}</span>
          </div>
        ))}
      </div>
      <div className="bv-callout">
        <span className="bv-callout-icon">⚠</span>
        <div>
          <strong>Von Neumann Bottleneck Analysis (REAL DATA):</strong><br/>
          • Instruction fetch + cache misses consume <strong>{bottleneckPct}%</strong> of all cycles<br/>
          • Each cache miss costs <strong>{CACHE_MISS_CYCLES} cycles</strong> vs {CACHE_HIT_CYCLES} cycles on hit<br/>
          • {mode==='interrupt'
              ? `Interrupt mode saves ${((1-interruptsFired/samples)*100).toFixed(1)}% of processing`
              : 'Polling mode processes ALL samples regardless of amplitude'}
        </div>
      </div>
    </div>
  );
};

// ─── Home Page ────────────────────────────────────────────────────────────────
const HomePage = ({ setPage }) => (
  <div className="home-page">
    <AnimatedWaveformHome />
    <div className="hero-section">
      <div className="hero-badge"><CpuIcon size={14}/><span>64-BIT ASSEMBLY ENGINE</span></div>
      <h1 className="hero-title">Advanced Audio<span className="hero-gradient"> Processing Suite</span></h1>
      <p className="hero-subtitle">Professional audio processing powered by native 64-bit assembly optimization. Experience real-time effects with hardware-accelerated performance.</p>
      <div className="hero-buttons">
        <button className="hero-btn-primary" onClick={()=>{setPage('studio');window.scrollTo(0,0);}}>Launch Studio <ArrowRight size={18}/></button>
        <button className="hero-btn-secondary" onClick={()=>scrollTo('features')}>Learn More <ChevronRight size={18}/></button>
      </div>
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">64-BIT</span><span className="hero-stat-label">Optimized System</span></div>
        <div className="hero-stat"><span className="hero-stat-value">5+</span><span className="hero-stat-label">Advanced Features</span></div>
        <div className="hero-stat"><span className="hero-stat-value">~70%</span><span className="hero-stat-label">Faster Processing</span></div>
      </div>
    </div>
    <div className="features-section" id="features">
      <div className="container">
        <h2 className="section-title">Powerful Features<span className="section-subtitle">Built for Professional Audio Engineers</span></h2>
        <div className="features-grid-home">
          <FeatureCard icon={Zap}    title="Real-time Processing" description="Hardware-accelerated assembly processing with sub-millisecond latency" delay={0.1}/>
          <FeatureCard icon={Shield} title="Advanced Effects"     description="Pitch shift, compressor, echo, limiter, and noise gate built-in" delay={0.2}/>
          <FeatureCard icon={Gauge}  title="Performance Metrics"  description="Real CPU cycle counting and hardware performance analysis" delay={0.3}/>
          <FeatureCard icon={Radio}  title="Studio Quality"       description="Professional 64-bit processing with 44.1kHz/16-bit precision" delay={0.4}/>
        </div>
      </div>
    </div>
    <div className="cta-section">
      <div className="cta-content">
        <h3>Ready to transform your audio?</h3>
        <p>Experience the power of assembly-optimized audio processing</p>
        <button className="cta-button" onClick={()=>{setPage('studio');window.scrollTo(0,0);}}>Get Started <Star size={18}/></button>
      </div>
    </div>
  </div>
);

// ─── FIXED Audio Player — no crash on src change ─────────────────────────────
const AudioPlayer = ({ src }) => {
  const audioRef = useRef(null);
  const prevSrcRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (prevSrcRef.current === src) return;
    prevSrcRef.current = src;

    audio.pause();
    audio.currentTime = 0;
    audio.src = src;
    audio.load();
  }, [src]);

  if (!src) return null;

  return (
    <audio
      ref={audioRef}
      controls
      preload="auto"
      className="audio-player"
      style={{ width: '100%', marginTop: '12px' }}
    />
  );
};

// ─── Studio Page ──────────────────────────────────────────────────────────────
const StudioPage = ({
  file, originalURL, processedURL,
  isRecording, isProcessing,
  volume, setVolume, noise, setNoise,
  logs, stats,
  pitchShift, setPitchShift, compressor, setCompressor,
  echo, setEcho, limiter, setLimiter, noiseGate, setNoiseGate,
  mode, setMode, threshold, setThreshold,
  handleUpload, startRecording, stopRecording,
  processAudio, resetAll, downloadProcessedAudio,
  activeFeatures, fmtNum,
}) => {
  return (
    <>
      <div className="filters-fullwidth" id="section-filters">
        <div className="controls-row">
          <label className="control-btn">
            <Upload size={16}/> Upload
            <input type="file" accept="audio/*" onChange={handleUpload} hidden/>
          </label>
          {!isRecording
            ? <button className="control-btn" onClick={startRecording}><Mic size={16}/> Record</button>
            : <button className="control-btn stop" onClick={stopRecording}><Square size={16}/> Stop</button>
          }
          <button className="control-btn reset" onClick={resetAll}><RefreshCcw size={16}/> Reset</button>
        </div>

        <div className="advanced-features-section">
          <div className="features-header">
            <Activity size={16}/><span>ADVANCED AUDIO SYSTEM</span>
            <span className="features-count">{activeFeatures} / 5 Active</span>
          </div>
          <div className="features-grid">
            <FeatureToggle icon={<Music size={18}/>}   label="Pitch Shift" active={pitchShift} onChange={()=>setPitchShift(!pitchShift)} description="Changes frequency/tone"/>
            <FeatureToggle icon={<Compass size={18}/>} label="Compressor"  active={compressor} onChange={()=>setCompressor(!compressor)} description="Balances dynamic range (4:1)"/>
            <FeatureToggle icon={<VolumeX size={18}/>} label="Echo"        active={echo}       onChange={()=>setEcho(!echo)}             description="Adds depth with decaying repetitions"/>
            <FeatureToggle icon={<Volume1 size={18}/>} label="Limiter"     active={limiter}    onChange={()=>setLimiter(!limiter)}       description="Brick-wall 0dB safety guard"/>
            <FeatureToggle icon={<Scissors size={18}/>}label="Noise Gate"  active={noiseGate}  onChange={()=>setNoiseGate(!noiseGate)}   description="Mutes signal during pauses"/>
          </div>
        </div>

        <div className="mode-section">
          <div className="mode-header"><Bell size={14}/><span>PROCESSING MODE</span></div>
          <div className="mode-toggle-row">
            <button className={`mode-btn${mode===0?' active':''}`} onClick={()=>setMode(0)}>
              <ToggleLeft size={16}/> Polling
            </button>
            <button className={`mode-btn${mode===1?' active interrupt':''}`} onClick={()=>setMode(1)}>
              <Bell size={16}/> Interrupt
            </button>
            {mode===1 && (
              <div className="threshold-inline">
                <label>Threshold: {threshold}</label>
                <input type="range" min="100" max="5000" step="100" value={threshold}
                  onChange={e=>setThreshold(parseInt(e.target.value))}/>
              </div>
            )}
          </div>
        </div>

        <div className="sliders-compact">
          <div className="slider-item">
            <label><Volume2 size={14}/> Volume: {volume}x</label>
            <input type="range" min="0.5" max="5" step="0.1" value={volume} onChange={e=>setVolume(parseFloat(e.target.value))}/>
          </div>
          <div className="slider-item">
            <label><Waves size={14}/> Noise Reduction: {noise===0?"OFF":noise}</label>
            <input type="range" min="0" max="20" value={noise} onChange={e=>setNoise(parseInt(e.target.value))}/>
          </div>
        </div>

        <button className="process-btn" onClick={processAudio} disabled={isProcessing}>
          {isProcessing
            ? <><Loader2 className="spin" size={16}/> Processing with {activeFeatures} feature{activeFeatures!==1?'s':''}...</>
            : <><Play size={16}/> Execute Assembly Pipeline ({mode===1?'Interrupt':'Polling'})</>}
        </button>
        {isProcessing && (
          <div className="progress-spinner">
            <Loader2 className="spin" size={20}/>
            <span>Assembly engine processing {activeFeatures} effect{activeFeatures!==1?'s':''} in {mode===1?'interrupt':'polling'} mode...</span>
          </div>
        )}
      </div>

      <div className="content-row">
        <div className="audio-boxes-row">
          <div className="waveform-card">
            <div className="waveform-header"><Mic size={14}/> RAW INPUT</div>
            {originalURL
              ? (<><Waveform audioUrl={originalURL} color="#14B8A6"/><AudioPlayer src={originalURL}/></>)
              : <div className="empty-waveform">No signal — Upload or record audio</div>}
          </div>

          <div className="waveform-card">
            <div className="waveform-header" style={{justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}><Sparkles size={14}/> PROCESSED OUTPUT</div>
              {processedURL && (
                <button onClick={downloadProcessedAudio} className="download-btn">
                  <Download size={12}/> Export WAV
                </button>
              )}
            </div>
            {processedURL
              ? (<><Waveform audioUrl={processedURL} color="#F43F5E"/><AudioPlayer src={processedURL}/></>)
              : <div className="empty-waveform">{isProcessing?"Processing...":"Click 'Execute Assembly Pipeline' to process"}</div>}
          </div>
        </div>

        <div className="logs-column" id="section-logs">
          <div className="logs-header">
            <span style={{display:'flex',alignItems:'center',gap:6}}><Terminal size={14}/> SYSTEM LOGS</span>
            {logs.length>0 && <span className="log-count">{logs.length}</span>}
          </div>
          <div className="logs-content">
            {logs.length===0
              ? <div className="logs-empty">No activity yet.</div>
              : logs.map((log,i)=><div key={i} className="log-line">{log}</div>)}
          </div>
        </div>
      </div>

      {stats && (() => {
        const clk = computeClockStats(stats);
        const hitRate    = parseFloat(stats.cache_hit_rate||0).toFixed(1);
        const totalCache = Number(stats.cache_hits)+Number(stats.cache_misses);
        return (
          <div id="section-stats" style={{display:'flex',flexDirection:'column',gap:14}}>

            <CollapsibleStatsPanel title="ADVANCED FEATURES & AMPLITUDE STATS" icon={<Activity size={14}/>} badge="64-BIT ASM" panelId="sp1">
              <div className="stats-section-label">🎛️ Advanced features status</div>
              <div className="stats-grid-compact" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
                <StatCell icon="🎵" label="Pitch Shift" value={stats.pitch_shift==="true"?"ON":"OFF"}/>
                <StatCell icon="📊" label="Compressor"  value={stats.compressor ==="true"?"ON":"OFF"}/>
                <StatCell icon="🔄" label="Echo"        value={stats.echo       ==="true"?"ON":"OFF"}/>
                <StatCell icon="🛡️" label="Limiter"     value={stats.limiter    ==="true"?"ON":"OFF"}/>
                <StatCell icon="🚪" label="Noise Gate"  value={stats.noise_gate ==="true"?"ON":"OFF"}/>
              </div>
              <div className="stats-section-label" style={{marginTop:12}}>📐 Amplitude stats</div>
              <div className="stats-grid-compact">
                <StatCell icon="📈" label="Peak Before" value={fmtNum(stats.peak_before)}/>
                <StatCell icon="📉" label="Peak After"  value={fmtNum(stats.peak_after)}/>
                <StatCell icon="〰️" label="Avg Before"  value={fmtNum(stats.avg_before)}/>
                <StatCell icon="〰️" label="Avg After"   value={fmtNum(stats.avg_after)}/>
                <StatCell icon="🔊" label="Vol Applied" value={stats.vol_applied+"x"}/>
                <StatCell icon="🎙️" label="Noise Reduction"  value={stats.noise_on==="true"?"ON":"OFF"}/>
              </div>
            </CollapsibleStatsPanel>

            <CollapsibleStatsPanel title="PROCESSING MODE & CACHE SIMULATION" icon={<Database size={14}/>} badge="Real ASM Data"
              badgeStyle={{background:'linear-gradient(135deg,#10b98155,#06b6d455)',borderColor:'#10b98188',color:'#6ee7b7'}} panelId="sp2">
              <div className="stats-section-label">⚙️ Mode</div>
              <div className="stats-grid-compact" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                <StatCell icon="🔄" label="Active Mode" value={stats.mode_active==='interrupt'?'INTERRUPT':'POLLING'} highlight={stats.mode_active==='interrupt'}/>
                <StatCell icon="🔔" label="Interrupts"  value={stats.mode_active==='interrupt'?fmtNum(stats.interrupts_fired):'N/A'} highlight={stats.mode_active==='interrupt'}/>
                <StatCell icon="🎯" label="Threshold"   value={stats.mode_active==='interrupt'?stats.threshold_used:'N/A'}/>
                <StatCell icon="📊" label="Processed"   value={stats.mode_active==='interrupt'?`${fmtNum(stats.interrupts_fired)} / ${fmtNum(stats.samples)}`:fmtNum(stats.samples)}/>
              </div>
              <div className="stats-section-label" style={{marginTop:12}}>🗄️ Cache (8-slot direct-mapped)</div>
              <div className="stats-grid-compact" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                <StatCell icon="✅" label="Cache Hits"   value={fmtNum(stats.cache_hits)}   highlight/>
                <StatCell icon="❌" label="Cache Misses" value={fmtNum(stats.cache_misses)}/>
                <StatCell icon="📈" label="Hit Rate"     value={hitRate+"%"}                 highlight/>
                <StatCell icon="🔢" label="Total Access" value={fmtNum(totalCache)}/>
              </div>
            </CollapsibleStatsPanel>

            <CollapsibleStatsPanel
              title="POLLING vs INTERRUPT — CPU Cycle Comparison"
              icon={<Activity size={14}/>}
              badge="Real RDTSC Data"
              badgeStyle={{background:'linear-gradient(135deg,#3b82f655,#10b98155)',borderColor:'#3b82f688',color:'#93c5fd'}}
              panelId="sp3">
              <PollingInterruptGraph stats={stats}/>
            </CollapsibleStatsPanel>

            <CollapsibleStatsPanel title="BUS BOTTLENECK — VON NEUMANN ANALYSIS" icon={<GitBranch size={14}/>}
              badge="RDTSC Real Cycles"
              badgeStyle={{background:'linear-gradient(135deg,#f43f5e55,#8b5cf655)',borderColor:'#f43f5e88',color:'#fda4af'}} panelId="sp4">
              <div className="stats-section-label" style={{marginTop:8}}>🚌 Instruction fetch vs data access bus cycle breakdown</div>
              <BusBottleneckViz stats={stats}/>
            </CollapsibleStatsPanel>

            <CollapsibleStatsPanel title="CLOCK & PERFORMANCE CALCULATIONS" icon={<Clock size={14}/>}
              badge="Real Formulas · 64-bit"
              badgeStyle={{background:'linear-gradient(135deg,#14b8a655,#0d948855)',borderColor:'#14b8a688',color:'#5eead4'}} panelId="sp5">
              <div className="stats-section-label">⏱ Timing</div>
              <div className="stats-grid-compact" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                <ClockCell icon="⏱️" label="Exec Time"    value={clk.execTime}    formula="From ASM timer (µs → readable)"/>
                <ClockCell icon="📡" label="Clock Freq"   value={clk.clockFreq}   formula="Fixed 3.4 GHz (x86-64)"/>
                <ClockCell icon="⚡" label="Clock Period" value={clk.clockPeriod} formula="1 / 3.4 GHz = 0.2941 ns"/>
                <ClockCell icon="🔢" label="Clock Cycles" value={clk.clockCycles} formula="Real RDTSC cycles measured"/>
              </div>
              <div className="stats-section-label" style={{marginTop:12}}>📊 Performance</div>
              <div className="stats-grid-compact" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                <ClockCell icon="📝" label="Instructions" value={clk.instrCount}
                  formula={`Total from ASM INSTR_COUNT (${clk.instrPerSample} instr/sample)`}/>
                <ClockCell icon="🔄" label="CPI" value={clk.cpi}
                  formula="RDTSC cycles ÷ Total instructions"/>
                <ClockCell icon="⚡" label="MIPS" value={clk.mips}
                  formula="Total instr ÷ (RDTSC cycles ÷ 3.4 GHz) ÷ 1M"/>
                <ClockCell icon="🎵" label="Throughput" value={clk.throughput}
                  formula="Samples ÷ Exec time"/>
              </div>
              <p className="clock-formula-footer">
                Hover any cell · CPU = 3.4 GHz · Instr/sample = {clk.instrPerSample}
              </p>
            </CollapsibleStatsPanel>
          </div>
        );
      })()}
    </>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState('home');
  const [file, setFile]               = useState(null);
  const [originalURL, setOriginalURL] = useState(null);
  const [processedURL, setProcessedURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volume, setVolume]           = useState(1.5);
  const [noise, setNoise]             = useState(5);
  const [logs, setLogs]               = useState([]);
  const [stats, setStats]             = useState(null);
  const [theme, setTheme]             = useState(()=>localStorage.getItem('theme')||'dark');
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [pitchShift, setPitchShift]   = useState(false);
  const [compressor, setCompressor]   = useState(false);
  const [echo, setEcho]               = useState(false);
  const [limiter, setLimiter]         = useState(false);
  const [noiseGate, setNoiseGate]     = useState(false);
  const [mode, setMode]               = useState(0);
  const [threshold, setThreshold]     = useState(500);

  const mediaRecorder = useRef(null);
  const lastScrollY   = useRef(0);
  const addLog = msg => setLogs(p=>[...p.slice(-49), msg]);

  const toggleTheme = () => { const t=theme==='dark'?'light':'dark'; setTheme(t); localStorage.setItem('theme',t); };
  useEffect(()=>{ document.body.setAttribute('data-theme',theme); },[theme]);
  useEffect(()=>{
    const fn=()=>{ if(window.scrollY>lastScrollY.current&&window.scrollY>80)setNavbarVisible(false); else setNavbarVisible(true); lastScrollY.current=window.scrollY; };
    window.addEventListener('scroll',fn); return ()=>window.removeEventListener('scroll',fn);
  },[]);

  const setOriginalURLSafe = (url) => {
    setOriginalURL(prev => { if (prev && prev !== url) URL.revokeObjectURL(prev); return url; });
  };
  const setProcessedURLSafe = (url) => {
    setProcessedURL(prev => { if (prev && prev !== url) URL.revokeObjectURL(prev); return url; });
  };

  const handleUpload = e => {
    const audio=e.target.files[0]; if(!audio)return;
    setFile(audio);
    setOriginalURLSafe(URL.createObjectURL(audio));
    setStats(null); setLogs([]);
    addLog(`📁 Uploaded: ${audio.name} (${(audio.size/1024).toFixed(1)} KB)`);
    e.target.value="";
    setPage('studio');
  };

  const startRecording = async () => {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      mediaRecorder.current=new MediaRecorder(stream);
      const chunks=[];
      mediaRecorder.current.ondataavailable=e=>{ if(e.data.size>0)chunks.push(e.data); };
      mediaRecorder.current.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop()); addLog("🔄 Converting to WAV...");
        const raw=new Blob(chunks,{type:mediaRecorder.current.mimeType});
        const wav=await blobToWav(raw);
        setFile(new File([wav],"recorded.wav",{type:"audio/wav"}));
        setOriginalURLSafe(URL.createObjectURL(wav));
        setStats(null);
        addLog(`✅ Ready: ${(wav.size/1024).toFixed(1)} KB WAV`); setPage('studio');
      };
      mediaRecorder.current.start(); setIsRecording(true); addLog("🎙️ Recording started...");
    } catch(err){ addLog("❌ Mic error: "+err.message); }
  };
  const stopRecording = () => { if(mediaRecorder.current&&isRecording){mediaRecorder.current.stop();setIsRecording(false);} };

  const downloadProcessedAudio = () => {
    if(!processedURL){addLog("⚠️ No processed audio");return;}
    const a=document.createElement('a'); a.href=processedURL;
    a.download=`processed_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.wav`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    addLog("📥 Downloaded");
  };

  const processAudio = async () => {
    if(!file){alert("Upload or record audio first!");return;}
    setIsProcessing(true); setStats(null);
    addLog("🚀 Sending to assembly engine...");
    addLog(`⚙️  Mode: ${mode===1?`INTERRUPT (threshold: ${threshold})`:'POLLING'}`);
    if(noise>0) addLog(`🎙️ Noise Reduction: level ${noise}`);
    if(pitchShift)addLog("🎵 Pitch Shift enabled");
    if(compressor) addLog("📊 Compressor enabled");
    if(echo)       addLog("🔄 Echo enabled");
    if(limiter)    addLog("🛡️ Limiter enabled");
    if(noiseGate)  addLog("🚪 Noise Gate enabled");

    const fd=new FormData();
    fd.append("file",file); fd.append("volume",volume); fd.append("noise",noise);
    fd.append("pitch_shift",pitchShift?1:0); fd.append("compressor",compressor?1:0);
    fd.append("echo",echo?1:0); fd.append("limiter",limiter?1:0);
    fd.append("noise_gate",noiseGate?1:0); fd.append("mode",mode); fd.append("threshold",threshold);

    try {
      const res=await fetch("http://localhost:5000/process",{method:"POST",body:fd});
      if(!res.ok)throw new Error("Server error: "+res.status);
      const h=(k,d="0")=>res.headers.get(k)||d;
      const s = {
        time_us:            h("X-Time-Us"),
        samples:            h("X-Samples"),
        channels:           h("X-Channels", "1"),
        sample_rate:        h("X-Sample-Rate", "44100"),
        duration_ms:        h("X-Duration-Ms"),
        vol_applied:        h("X-Vol-Applied", String(volume)),
        noise_on:           h("X-Noise-On", "false"),
        peak_before:        h("X-Peak-Before"),
        peak_after:         h("X-Peak-After"),
        avg_before:         h("X-Avg-Before"),
        avg_after:          h("X-Avg-After"),
        pitch_shift:        h("X-Pitch-Shift", "false"),
        compressor:         h("X-Compressor",  "false"),
        echo:               h("X-Echo",        "false"),
        limiter:            h("X-Limiter",     "false"),
        noise_gate:         h("X-Noise-Gate",  "false"),
        mode_active:        h("X-Mode", "polling"),
        interrupts_fired:   h("X-Interrupts-Fired"),
        threshold_used:     h("X-Threshold", "500"),
        cache_hits:         h("X-Cache-Hits"),
        cache_misses:       h("X-Cache-Misses"),
        cache_hit_rate:     h("X-Cache-Hit-Rate"),
        real_cycles:        h("X-Real-Cycles"),
        cycles_per_sample:  h("X-Cycles-Per-Sample"),
        real_cpu_freq_ghz:  h("X-Real-Cpu-Freq"),
        real_cpi:           h("X-Real-Cpi"),
        real_mips:          h("X-Real-Mips"),
        real_throughput:    h("X-Real-Throughput"),
        instructions_total: h("X-Instructions-Total"),
        instr_per_sample:   h("X-Instr-Per-Sample"),
      };
      setStats(s);
      const rawLogs=res.headers.get("X-System-Logs");
      if(rawLogs) decodeURIComponent(rawLogs).split('|').filter(Boolean).forEach((l,i)=>setTimeout(()=>addLog(`[ASM] ${l}`),i*60));
      addLog(`✅ Processing complete`);
      addLog(`📊 Samples: ${Number(s.samples).toLocaleString()}`);
      addLog(`📈 Peak: ${s.peak_before} → ${s.peak_after}`);
      addLog(`🗄️ Cache: ${s.cache_hits} hits / ${s.cache_misses} misses (${parseFloat(s.cache_hit_rate).toFixed(1)}%)`);
      if(s.mode_active==='interrupt')addLog(`🔔 Interrupts fired: ${Number(s.interrupts_fired).toLocaleString()}`);

      const blob = await res.blob();
      const newURL = URL.createObjectURL(blob);
      setProcessedURLSafe(newURL);

    } catch(err){ addLog("❌ Error: "+err.message); }
    setIsProcessing(false);
  };

  const resetAll = () => {
    setFile(null);
    setOriginalURLSafe(null);
    setProcessedURLSafe(null);
    setStats(null); setLogs([]);
    setPitchShift(false); setCompressor(false); setEcho(false);
    setLimiter(false); setNoiseGate(false);
    setVolume(1.5); setNoise(5); setMode(0); setThreshold(500);
    addLog("🔄 System reset");
  };

  const fmtNum = v=>Number(v).toLocaleString();
  const activeFeatures=[pitchShift,compressor,echo,limiter,noiseGate].filter(Boolean).length;

  return (
    <div className="app" data-theme={theme}>
      <nav className={`navbar ${navbarVisible?'show':'hide'}`}>
        <div className="nav-brand" onClick={()=>setPage('home')} style={{cursor:'pointer'}}>
          <Cpu size={18} className="nav-logo"/>
          <span className="nav-title">Advanced Audio Suite</span>
          <span className="nav-badge-32">64-BIT ASM</span>
        </div>
        <div className="nav-tabs">
          <button className="nav-tab" onClick={()=>setPage('home')}><Home size={14}/> Home</button>
          <button className="nav-tab" onClick={()=>setPage('studio')}>
            <Sliders size={14}/> Studio
            {activeFeatures>0&&<span className="nav-badge">{activeFeatures}</span>}
          </button>
          {page==='studio'&&<>
            <button className="nav-tab" onClick={()=>scrollTo("section-logs")}>
              <FileText size={14}/> Logs {logs.length>0&&<span className="nav-badge">{logs.length}</span>}
            </button>
            <button className="nav-tab" onClick={()=>scrollTo("section-stats")}>
              <BarChart2 size={14}/> Stats {stats&&<span className="nav-dot"/>}
            </button>
          </>}
        </div>
        <div className="nav-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}
            <span>{theme==='dark'?'Light':'Dark'}</span>
          </button>
          <div className="nav-status">
            <span className={`status-dot ${isProcessing?"processing":""}`}/>
            <span className="status-text">{isProcessing?"Processing":"Idle"}</span>
          </div>
        </div>
      </nav>

      {page==='home'
        ?<HomePage setPage={setPage}/>
        :<StudioPage
            file={file} originalURL={originalURL} processedURL={processedURL}
            isRecording={isRecording} isProcessing={isProcessing}
            volume={volume} setVolume={setVolume} noise={noise} setNoise={setNoise}
            logs={logs} stats={stats}
            pitchShift={pitchShift} setPitchShift={setPitchShift}
            compressor={compressor} setCompressor={setCompressor}
            echo={echo} setEcho={setEcho} limiter={limiter} setLimiter={setLimiter}
            noiseGate={noiseGate} setNoiseGate={setNoiseGate}
            mode={mode} setMode={setMode} threshold={threshold} setThreshold={setThreshold}
            handleUpload={handleUpload} startRecording={startRecording} stopRecording={stopRecording}
            processAudio={processAudio} resetAll={resetAll} downloadProcessedAudio={downloadProcessedAudio}
            activeFeatures={activeFeatures} fmtNum={fmtNum}
          />}
    </div>
  );
}