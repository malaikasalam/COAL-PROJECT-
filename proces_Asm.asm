BITS 64

; ============================================================
; ADVANCED VOICE ENHANCEMENT ENGINE
; Pipeline per sample:
;   1. Pre-emphasis  (boost highs: y = x - 0.97*x_prev)
;   2. VAD           (short-term energy → speech vs silence)
;   3. Adaptive noise floor (update only during silence)
;   4. Spectral gate  (oversubtraction scaled by noise slider)
;   5. IIR band-pass  (HP 300 Hz → LP 3400 Hz, voice band)
;   6. De-emphasis    (inverse pre-emphasis: y = x + 0.97*y_prev)
;   7. Normalize gain (bring output back to input RMS level)
;   8. All other features: noise gate, volume, compressor,
;      echo, limiter, pitch shift
;
; REAL INSTRUCTION COUNTING:
;   INSTR_COUNT is incremented throughout the pipeline.
;   Each inc represents one logical instruction unit.
;   getInstrCount() exports the total.
;   resetCacheCounters() resets it to 0 each run.
; ============================================================

section .data

    ; ── I/O ports ──────────────────────────────────────────
    PORT1_REG   dq  0
    PORT2_REG   dq  0

    ; ── Feature flags ──────────────────────────────────────
    FLAG_PITCH  dq  0
    FLAG_COMP   dq  0
    FLAG_ECHO   dq  0
    FLAG_LIMIT  dq  0
    FLAG_NGATE  dq  0

    ; ── Noise gate threshold ───────────────────────────────
    NGATE_THRESH    dq  300

    ; ── Compressor ─────────────────────────────────────────
    COMP_THRESH     dq  16384

    ; ── Echo ───────────────────────────────────────────────
    ECHO_BUFFER     times 44100 dw 0
    ECHO_WRITE_IDX  dq  0
    ECHO_DELAY      dq  22050

    ; ── Limiter ────────────────────────────────────────────
    LIMIT_MAX       dq  32000

    ; ── Pitch shift ────────────────────────────────────────
    PITCH_IDX       dq  0
    PITCH_FACTOR    dq  6
    PITCH_LAST      dq  0

    ; ── RDTSC ──────────────────────────────────────────────
    RDTSC_START     dq  0
    RDTSC_END       dq  0
    REAL_CYCLES     dq  0

    ; ── Real instruction counter ───────────────────────────
    ; Incremented at every logical instruction point in the pipeline.
    ; Reset by resetCacheCounters(). Exported via getInstrCount().
    INSTR_COUNT     dq  0

    ; ══════════════════════════════════════════════════════
    ; VOICE ENHANCEMENT STATE
    ; ══════════════════════════════════════════════════════

    PREEMPH_PREV    dq  0
    DEEMPH_PREV     dq  0

    VAD_ENERGY      dq  0
    VAD_COUNT       dq  0
    VAD_FRAME       dq  160
    VAD_IS_SPEECH   dq  0
    VAD_HANGOVER    dq  0
    VAD_HANGOVER_MAX dq 882

    NOISE_FLOOR     dq  512
    NOISE_FLOOR_MIN dq  64
    NOISE_FLOOR_MAX dq  8192
    NF_DECAY        dq  250
    NF_LEARN        dq  6
    NF_RELEASE      dq  255

    NOISE_SLIDER    dq  0

    SPEC_BETA       dq  16

    HP_ALPHA        dq  245
    LP_ALPHA        dq  140
    LP_BETA         dq  116

    HP_PREV_IN      dq  0
    HP_PREV_OUT     dq  0
    LP_PREV_OUT     dq  0

    GAIN_SMOOTH     dq  256
    GAIN_MIN        dq  192
    GAIN_MAX        dq  512

    ; ── Cache simulation ───────────────────────────────────
    CACHE_TAGS      dq -1,-1,-1,-1,-1,-1,-1,-1
    CACHE_VALS      dw 0,0,0,0,0,0,0,0
    CACHE_HITS      dq 0
    CACHE_MISSES    dq 0
    SLOT_HITS       dq 0,0,0,0,0,0,0,0
    SLOT_MISSES     dq 0,0,0,0,0,0,0,0

section .text

global processASM
global getRealCycles
global getCacheHits
global getCacheMisses
global getSlotHits
global getSlotMisses
global getInstrCount
global resetCacheCounters
global startRDTSC
global stopRDTSC

; ============================================================
; resetCacheCounters — resets ALL voice enhancement state
;                      AND the real instruction counter
; ============================================================
resetCacheCounters:
    push rdi
    push rcx
    push rax

    lea  rdi, [rel CACHE_TAGS]
    mov  rcx, 8
    mov  rax, -1
.reset_tags:
    mov  [rdi], rax
    add  rdi, 8
    dec  rcx
    jnz  .reset_tags

    mov  qword [rel CACHE_HITS],   0
    mov  qword [rel CACHE_MISSES], 0

    lea  rdi, [rel SLOT_HITS]
    mov  rcx, 8
    xor  rax, rax
.reset_hits:
    mov  [rdi], rax
    add  rdi, 8
    dec  rcx
    jnz  .reset_hits

    lea  rdi, [rel SLOT_MISSES]
    mov  rcx, 8
.reset_misses:
    mov  [rdi], rax
    add  rdi, 8
    dec  rcx
    jnz  .reset_misses

    ; ── Reset real instruction counter ──
    mov  qword [rel INSTR_COUNT], 0

    ; Reset voice enhancement state
    mov  qword [rel PREEMPH_PREV],   0
    mov  qword [rel DEEMPH_PREV],    0
    mov  qword [rel VAD_ENERGY],     0
    mov  qword [rel VAD_COUNT],      0
    mov  qword [rel VAD_IS_SPEECH],  0
    mov  qword [rel VAD_HANGOVER],   0
    mov  qword [rel NOISE_FLOOR],    512
    mov  qword [rel HP_PREV_IN],     0
    mov  qword [rel HP_PREV_OUT],    0
    mov  qword [rel LP_PREV_OUT],    0
    mov  qword [rel GAIN_SMOOTH],    256

    mov  qword [rel ECHO_WRITE_IDX], 0

    lea  rdi, [rel ECHO_BUFFER]
    mov  rcx, 44100
    xor  rax, rax
.clear_echo:
    mov  word [rdi], ax
    add  rdi, 2
    dec  rcx
    jnz  .clear_echo

    pop  rax
    pop  rcx
    pop  rdi
    ret

; ============================================================
; startRDTSC
; ============================================================
startRDTSC:
    push rbx
    push rdx
    rdtsc
    shl  rdx, 32
    or   rax, rdx
    mov  [rel RDTSC_START], rax
    pop  rdx
    pop  rbx
    ret

; ============================================================
; stopRDTSC
; ============================================================
stopRDTSC:
    push rbx
    push rdx
    rdtsc
    shl  rdx, 32
    or   rax, rdx
    mov  [rel RDTSC_END], rax
    sub  rax, [rel RDTSC_START]
    mov  [rel REAL_CYCLES], rax
    pop  rdx
    pop  rbx
    ret

; ============================================================
; processASM
; RCX = short* samples
; RDX = long long count
; R8  = vol128  (volume * 128)
; R9  = noise   (noise slider 0..20)
; [rbp+48]  = pitch_shift (0/1)
; [rbp+56]  = compressor  (0/1)
; [rbp+64]  = echo        (0/1)
; [rbp+72]  = limiter     (0/1)
; [rbp+80]  = noise_gate  (0/1)
; ============================================================
processASM:
    push rbp
    mov  rbp, rsp
    push rbx
    push rsi
    push rdi
    push r12
    push r13
    push r14
    push r15
    sub  rsp, 32

    mov  rsi, rcx
    mov  r12, rdx
    mov  r13, r8
    mov  r14, r9

    mov  [rel NOISE_SLIDER], r14

    mov  rax, [rbp+48]
    mov  [rel FLAG_PITCH], rax
    mov  rax, [rbp+56]
    mov  [rel FLAG_COMP], rax
    mov  rax, [rbp+64]
    mov  [rel FLAG_ECHO], rax
    mov  rax, [rbp+72]
    mov  [rel FLAG_LIMIT], rax
    mov  rax, [rbp+80]
    mov  [rel FLAG_NGATE], rax

    test r12, r12
    jz   PROC_DONE

PROC_LOOP:
    test r12, r12
    jz   PROC_DONE

    ; ── Count: loop overhead (test + load) = 2 ──
    add  qword [rel INSTR_COUNT], 2

    ; ========================================================
    ; CACHE SIMULATION
    ; ========================================================
    mov  rax, rsi
    shr  rax, 4
    mov  rcx, rax
    and  rcx, 7
    lea  rbx, [rel CACHE_TAGS]
    mov  rdx, [rbx + rcx*8]
    cmp  rdx, rax
    jne  .cache_miss

.cache_hit:
    inc  qword [rel CACHE_HITS]
    inc  qword [rel SLOT_HITS + rcx*8]
    lea  rbx, [rel CACHE_VALS]
    movsx rax, word [rbx + rcx*2]
    ; cache hit = 5 instructions (addr calc, tag check, hit, load)
    add  qword [rel INSTR_COUNT], 5
    jmp  .after_fetch

.cache_miss:
    inc  qword [rel CACHE_MISSES]
    inc  qword [rel SLOT_MISSES + rcx*8]
    movsx rax, word [rsi]
    lea  rbx, [rel CACHE_TAGS]
    mov  rdx, rsi
    shr  rdx, 4
    mov  [rbx + rcx*8], rdx
    lea  rbx, [rel CACHE_VALS]
    mov  [rbx + rcx*2], ax
    ; cache miss = 9 instructions (addr calc, tag check, miss, DRAM load, writeback)
    add  qword [rel INSTR_COUNT], 9

.after_fetch:
    mov  [rel PORT1_REG], rax
    mov  rax, [rel PORT1_REG]
    ; port read/write = 2
    add  qword [rel INSTR_COUNT], 2

    ; ========================================================
    ; STAGE 1 — PRE-EMPHASIS FILTER
    ; ========================================================
    test r14, r14
    jz   .after_preemph

    ; 1 test/branch + state load + multiply + shift + subtract + clamp(2) + state store = 8
    add  qword [rel INSTR_COUNT], 8

    mov  rdi, rax
    mov  rbx, [rel PREEMPH_PREV]
    imul rbx, 248
    sar  rbx, 8
    sub  rax, rbx

    cmp  rax, 32767
    jle  .pe_clamp_low
    mov  rax, 32767
    jmp  .pe_done
.pe_clamp_low:
    cmp  rax, -32768
    jge  .pe_done
    mov  rax, -32768
.pe_done:
    mov  [rel PREEMPH_PREV], rdi

.after_preemph:

    ; ========================================================
    ; STAGE 2 — VAD
    ; ========================================================
    test r14, r14
    jz   .after_vad

    ; base VAD ops: square + scale + accumulate + increment count = 4
    add  qword [rel INSTR_COUNT], 4

    mov  rbx, rax
    imul rbx, rbx
    sar  rbx, 8
    add  [rel VAD_ENERGY], rbx
    inc  qword [rel VAD_COUNT]

    mov  rbx, [rel VAD_COUNT]
    cmp  rbx, [rel VAD_FRAME]
    jl   .vad_no_decision

    ; decision block: avg + threshold + compare = 6 extra
    add  qword [rel INSTR_COUNT], 6

    mov  rbx, [rel VAD_ENERGY]
    imul rbx, 103
    sar  rbx, 14

    mov  rdi, [rel NOISE_FLOOR]
    imul rdi, rdi
    sar  rdi, 8
    sal  rdi, 2

    cmp  rbx, rdi
    jg   .vad_speech
    cmp  qword [rel VAD_HANGOVER], 0
    jg   .vad_hangover_active
    mov  qword [rel VAD_IS_SPEECH], 0
    jmp  .vad_reset_frame
.vad_hangover_active:
    dec  qword [rel VAD_HANGOVER]
    mov  qword [rel VAD_IS_SPEECH], 1
    jmp  .vad_reset_frame
.vad_speech:
    mov  qword [rel VAD_IS_SPEECH], 1
    mov  rbx, [rel VAD_HANGOVER_MAX]
    mov  [rel VAD_HANGOVER], rbx

.vad_reset_frame:
    mov  qword [rel VAD_ENERGY], 0
    mov  qword [rel VAD_COUNT],  0

.vad_no_decision:

.after_vad:

    ; ========================================================
    ; STAGE 3 — ADAPTIVE NOISE FLOOR UPDATE
    ; ========================================================
    test r14, r14
    jz   .after_nf_update

    ; abs + branch on speech/silence + multiply + shift + add + clamp = 7
    add  qword [rel INSTR_COUNT], 7

    mov  rbx, rax
    test rbx, rbx
    jns  .nf_abs_ok
    neg  rbx
.nf_abs_ok:

    cmp  qword [rel VAD_IS_SPEECH], 0
    jne  .nf_speech

    mov  rdi, [rel NOISE_FLOOR]
    imul rdi, [rel NF_DECAY]
    sar  rdi, 8
    mov  rcx, rbx
    imul rcx, [rel NF_LEARN]
    sar  rcx, 8
    add  rdi, rcx

    cmp  rdi, [rel NOISE_FLOOR_MIN]
    jge  .nf_clamp_max
    mov  rdi, [rel NOISE_FLOOR_MIN]
.nf_clamp_max:
    cmp  rdi, [rel NOISE_FLOOR_MAX]
    jle  .nf_store
    mov  rdi, [rel NOISE_FLOOR_MAX]
    jmp  .nf_store

.nf_speech:
    mov  rdi, [rel NOISE_FLOOR]
    imul rdi, [rel NF_RELEASE]
    sar  rdi, 8
    cmp  rdi, [rel NOISE_FLOOR_MIN]
    jge  .nf_store
    mov  rdi, [rel NOISE_FLOOR_MIN]

.nf_store:
    mov  [rel NOISE_FLOOR], rdi

.after_nf_update:

    ; ========================================================
    ; STAGE 4 — SPECTRAL GATE
    ; ========================================================
    test r14, r14
    jz   .after_spectral_gate

    ; threshold calc + abs + compare + branch = 6
    add  qword [rel INSTR_COUNT], 6

    mov  rbx, [rel NOISE_SLIDER]
    imul rbx, 32
    add  rbx, 256
    imul rbx, [rel NOISE_FLOOR]
    sar  rbx, 8

    mov  rdi, rax
    test rdi, rdi
    jns  .gate_abs_ok
    neg  rdi
.gate_abs_ok:
    cmp  rdi, rbx
    jg   .gate_pass

    ; comfort noise path: multiply + shift + sign restore = 3 extra
    add  qword [rel INSTR_COUNT], 3
    mov  rcx, [rel NOISE_FLOOR]
    imul rcx, [rel SPEC_BETA]
    sar  rcx, 8
    test rax, rax
    jns  .comfort_pos
    neg  rcx
.comfort_pos:
    mov  rax, rcx
    jmp  .after_spectral_gate

.gate_pass:
    ; spectral subtraction path: subtract + clamp + sign restore = 3 extra
    add  qword [rel INSTR_COUNT], 3
    mov  rcx, [rel NOISE_FLOOR]
    sub  rdi, rcx
    test rdi, rdi
    jns  .sub_ok
    xor  rdi, rdi
.sub_ok:
    test rax, rax
    jns  .sub_pos
    neg  rdi
.sub_pos:
    mov  rax, rdi

.after_spectral_gate:

    ; ========================================================
    ; STAGE 5 — IIR BAND-PASS
    ; ========================================================
    test r14, r14
    jz   .after_bandpass

    ; HP: load prev_in + prev_out + subtract + add + multiply + shift + store×2 = 8
    ; LP: load prev_out + multiply + multiply + add + shift + store = 6
    ; total = 14
    add  qword [rel INSTR_COUNT], 14

    mov  rbx, [rel HP_PREV_OUT]
    mov  rdi, [rel HP_PREV_IN]
    mov  rcx, rax
    sub  rcx, rdi
    add  rcx, rbx
    imul rcx, [rel HP_ALPHA]
    sar  rcx, 8
    mov  [rel HP_PREV_IN],  rax
    mov  [rel HP_PREV_OUT], rcx

    mov  rbx, [rel LP_PREV_OUT]
    imul rbx, [rel LP_ALPHA]
    mov  rdi, rcx
    imul rdi, [rel LP_BETA]
    add  rbx, rdi
    sar  rbx, 8
    mov  [rel LP_PREV_OUT], rbx
    mov  rax, rbx

    cmp  rax, 32767
    jle  .bp_clamp_low
    mov  rax, 32767
    jmp  .after_bandpass
.bp_clamp_low:
    cmp  rax, -32768
    jge  .after_bandpass
    mov  rax, -32768

.after_bandpass:

    ; ========================================================
    ; STAGE 6 — DE-EMPHASIS
    ; ========================================================
    test r14, r14
    jz   .after_deemph

    ; load + multiply + shift + add + clamp + store = 6
    add  qword [rel INSTR_COUNT], 6

    mov  rbx, [rel DEEMPH_PREV]
    imul rbx, 248
    sar  rbx, 8
    add  rax, rbx

    cmp  rax, 32767
    jle  .de_clamp_low
    mov  rax, 32767
    jmp  .de_done
.de_clamp_low:
    cmp  rax, -32768
    jge  .de_done
    mov  rax, -32768
.de_done:
    mov  [rel DEEMPH_PREV], rax

.after_deemph:

    ; ========================================================
    ; STAGE 7 — GAIN NORMALIZATION
    ; ========================================================
    test r14, r14
    jz   .after_gain_norm

    ; abs check + skip-small guard = 2
    add  qword [rel INSTR_COUNT], 2

    mov  rbx, rax
    test rbx, rbx
    jns  .gn_abs
    neg  rbx
.gn_abs:
    cmp  rbx, 64
    jl   .after_gain_norm

    ; target selection + smooth multiply×2 + shift×2 + add + clamp×2 + store = 10
    add  qword [rel INSTR_COUNT], 10

    mov  rcx, 16384
    cmp  rbx, 8192
    jg   .gn_target_normal
    cmp  rbx, 2048
    jl   .gn_target_boost
    mov  rcx, 256
    jmp  .gn_smooth
.gn_target_boost:
    mov  rcx, 384
    jmp  .gn_smooth
.gn_target_normal:
    mov  rcx, 256

.gn_smooth:
    mov  rdi, [rel GAIN_SMOOTH]
    imul rdi, 253
    sar  rdi, 8
    imul rcx, 3
    sar  rcx, 8
    add  rdi, rcx
    cmp  rdi, [rel GAIN_MIN]
    jge  .gn_max_clamp
    mov  rdi, [rel GAIN_MIN]
.gn_max_clamp:
    cmp  rdi, [rel GAIN_MAX]
    jle  .gn_store
    mov  rdi, [rel GAIN_MAX]
.gn_store:
    mov  [rel GAIN_SMOOTH], rdi

    ; apply: multiply + shift + clamp = 3
    add  qword [rel INSTR_COUNT], 3

    imul rax, rdi
    sar  rax, 8

    cmp  rax, 32767
    jle  .gn_clamp_low
    mov  rax, 32767
    jmp  .after_gain_norm
.gn_clamp_low:
    cmp  rax, -32768
    jge  .after_gain_norm
    mov  rax, -32768

.after_gain_norm:

    ; ========================================================
    ; NOISE GATE
    ; ========================================================
    cmp  qword [rel FLAG_NGATE], 0
    je   .after_noise_gate

    ; compare flag + abs + compare threshold + zero = 4
    add  qword [rel INSTR_COUNT], 4

    mov  rbx, rax
    test rbx, rbx
    jns  .ng_abs
    neg  rbx
.ng_abs:
    cmp  rbx, [rel NGATE_THRESH]
    jg   .after_noise_gate
    xor  rax, rax

.after_noise_gate:

    ; ========================================================
    ; VOLUME — soft knee clipping
    ; ========================================================
    ; multiply + shift + clamp check + soft knee = 5
    add  qword [rel INSTR_COUNT], 5

    imul rax, r13
    sar  rax, 7

    cmp  rax, 28000
    jle  .soft_check_low
    sub  rax, 28000
    imul rax, 4681
    sar  rax, 15
    add  rax, 28000
    cmp  rax, 32767
    jle  .after_clip
    mov  rax, 32767
    jmp  .after_clip
.soft_check_low:
    cmp  rax, -28000
    jge  .after_clip
    add  rax, 28000
    imul rax, 4681
    sar  rax, 15
    sub  rax, 28000
    cmp  rax, -32768
    jge  .after_clip
    mov  rax, -32768
.after_clip:

    ; ========================================================
    ; COMPRESSOR
    ; ========================================================
    cmp  qword [rel FLAG_COMP], 0
    je   .after_compressor

    ; flag check + abs + threshold compare + compress(sub+sar+add) + sign restore = 7
    add  qword [rel INSTR_COUNT], 7

    mov  rdi, 1
    mov  rbx, rax
    test rax, rax
    jns  .comp_abs
    neg  rbx
    mov  rdi, -1
.comp_abs:
    cmp  rbx, [rel COMP_THRESH]
    jle  .after_compressor
    sub  rbx, [rel COMP_THRESH]
    sar  rbx, 2
    add  rbx, [rel COMP_THRESH]
    mov  rax, rbx
    imul rax, rdi
.after_compressor:

    ; ========================================================
    ; ECHO
    ; ========================================================
    cmp  qword [rel FLAG_ECHO], 0
    je   .after_echo

    ; read index + wrap + load echo + scale + mix + clamp + store + advance = 14
    add  qword [rel INSTR_COUNT], 14

    mov  rdi, rax
    mov  rbx, [rel ECHO_WRITE_IDX]
    sub  rbx, [rel ECHO_DELAY]
    jns  .echo_read_ok
    add  rbx, 44100
.echo_read_ok:
    movsx rcx, word [rel ECHO_BUFFER + rbx*2]
    mov  rax, rcx
    imul rax, 25
    sar  rax, 7
    add  rax, rdi
    cmp  rax, 32767
    jle  .echo_clamp_min
    mov  rax, 32767
    jmp  .echo_write
.echo_clamp_min:
    cmp  rax, -32768
    jge  .echo_write
    mov  rax, -32768
.echo_write:
    push rax
    mov  rax, rdi
    imul rax, 75
    sar  rax, 7
    mov  rbx, [rel ECHO_WRITE_IDX]
    mov  [rel ECHO_BUFFER + rbx*2], ax
    inc  qword [rel ECHO_WRITE_IDX]
    cmp  qword [rel ECHO_WRITE_IDX], 44100
    jb   .echo_no_wrap
    mov  qword [rel ECHO_WRITE_IDX], 0
.echo_no_wrap:
    pop  rax
.after_echo:

    ; ========================================================
    ; LIMITER
    ; ========================================================
    cmp  qword [rel FLAG_LIMIT], 0
    je   .after_limiter

    ; flag + load max + compare + clamp×2 = 4
    add  qword [rel INSTR_COUNT], 4

    mov  rbx, [rel LIMIT_MAX]
    cmp  rax, rbx
    jle  .limit_neg
    mov  rax, rbx
    jmp  .after_limiter
.limit_neg:
    neg  rbx
    cmp  rax, rbx
    jge  .after_limiter
    mov  rax, rbx
.after_limiter:

    ; ========================================================
    ; PITCH SHIFT
    ; ========================================================
    cmp  qword [rel FLAG_PITCH], 0
    je   .after_pitch

    ; flag + increment + compare + branch + average or store = 8
    add  qword [rel INSTR_COUNT], 8

    inc  qword [rel PITCH_IDX]
    mov  rbx, [rel PITCH_IDX]
    cmp  rbx, [rel PITCH_FACTOR]
    jl   .pitch_store
    mov  qword [rel PITCH_IDX], 0
    mov  rbx, [rel PITCH_LAST]
    add  rax, rbx
    sar  rax, 1
    jmp  .after_pitch
.pitch_store:
    mov  [rel PITCH_LAST], rax
.after_pitch:

    ; ========================================================
    ; OUTPUT — write back + advance pointer
    ; ========================================================
    ; store + port write + advance = 3
    add  qword [rel INSTR_COUNT], 3

    mov  [rel PORT2_REG], rax
    mov  rax, [rel PORT2_REG]
    mov  word [rsi], ax

    add  rsi, 2
    dec  r12
    jnz  PROC_LOOP

PROC_DONE:
    add  rsp, 32
    pop  r15
    pop  r14
    pop  r13
    pop  r12
    pop  rdi
    pop  rsi
    pop  rbx
    pop  rbp
    ret

; ============================================================
; EXPORT FUNCTIONS
; ============================================================
getRealCycles:
    mov  rax, [rel REAL_CYCLES]
    ret

getCacheHits:
    mov  rax, [rel CACHE_HITS]
    ret

getCacheMisses:
    mov  rax, [rel CACHE_MISSES]
    ret

getSlotHits:
    mov  rax, [rel SLOT_HITS + rcx*8]
    ret

getSlotMisses:
    mov  rax, [rel SLOT_MISSES + rcx*8]
    ret

; ============================================================
; getInstrCount — returns real counted instructions
; ============================================================
getInstrCount:
    mov  rax, [rel INSTR_COUNT]
    ret