; ============================================================
; VOICE PROCESSING SYSTEM - REAL-ADDRESS MODE (20-bit)
; ============================================================
; Implements: void processASM(short* samples, int count, float volume, int noise)
;
; REAL-ADDRESS MODE (20-bit addressing):
;   - Uses segment:offset pairs (DS:SI, ES:DI)
;   - Maximum addressable memory: 1MB (2^20 = 1,048,576 bytes)
;   - Segments: CS, DS, SS, ES
;   - 20-bit effective address = (segment << 4) + offset
;
; COAL Concepts Demonstrated:
;   1. Real-Address Mode segmentation
;   2. IN/OUT I/O Port Simulation using memory-mapped port registers
;      - PORT1 (0x60) = Microphone Input  → simulates: IN  AL, PORT1
;      - PORT2 (0x61) = Speaker Output    → simulates: OUT PORT2, AL
;   3. Register-based processing (AX, BX, CX, DX, SI, DI)
;   4. Fetch-Decode-Execute Cycle with 20-bit addressing
;   5. Von Neumann Bottleneck fix - minimum memory access
;
; NOTE ON IN/OUT SIMULATION:
;   Real IN/OUT instructions (e.g. IN AL, 0x60) require Ring-0 privilege
;   and would cause a General Protection Fault in protected/user mode.
;   Per standard COAL simulation practice, we model I/O ports as
;   memory-mapped registers in .data — functionally identical for
;   demonstrating the Fetch→Decode→Execute I/O cycle.
;
;   PORT1 (mic in)    → cpu reads sample FROM port register  (simulates IN)
;   PORT2 (spk out)   → cpu writes result INTO port register (simulates OUT)
; ============================================================

BITS 16

section .data use16
    _THREE      dw  3           ; constant for 3-sample IDIV
    _TWO        dw  2           ; constant for 2-sample IDIV
    _fp256      dd  256.0       ; float 256 (not used in real mode)

    ; ── Simulated I/O Port Registers (memory-mapped) ─────────────────────────
    ; These model the physical port data registers.
    ; PORT1 = 0x60 → Microphone input  (IN  AL, PORT1)
    ; PORT2 = 0x61 → Speaker output    (OUT PORT2, AL)
    PORT1_REG   dw  0           ; mic input  port data register
    PORT2_REG   dw  0           ; speaker output port data register

    PORT1       equ 60h         ; I/O address of mic input port
    PORT2       equ 61h         ; I/O address of speaker output port

    ; For 20-bit segment storage
    _data_seg   dw  0

section .text use16
global _processASM

; ── Entry & prologue ─────────────────────────────────────────────────────────
; Real-mode calling convention (16-bit stack):
;   [BP+4]  = short* samples (offset)
;   [BP+6]  = short* samples (segment)   ← far pointer
;   [BP+8]  = int    count
;   [BP+10] = int    volume * 100  (e.g. 150 = 1.5x)
;   [BP+14] = int    noise flag

_processASM:
    push  bp
    mov   bp, sp
    push  ds
    push  es
    push  si
    push  di
    push  bx
    push  cx
    push  dx

    ; ── Set up segments for 20-bit addressing ───────────────────────────────
    mov   dx, [bp+6]        ; DX = segment of samples array
    mov   si, [bp+4]        ; SI = offset  of samples array
    mov   ds, dx            ; DS:SI = source (samples in)
    mov   es, dx            ; ES:DI = destination (samples out)
    mov   di, si

    ; ── Load count ──────────────────────────────────────────────────────────
    mov   cx, [bp+8]        ; CX = sample count

    ; ── Load volume (integer scaled, e.g. 150 = 1.5x) ───────────────────────
    mov   bx, [bp+10]       ; BX = volume * 100

    ; ── Load noise flag ─────────────────────────────────────────────────────
    mov   dx, [bp+14]       ; DX = noise flag

    ; ── Local variables on stack ─────────────────────────────────────────────
    push  word 0            ; iter = 0  at [BP-2]

    mov   [_data_seg], ds   ; save DS for port register access

; ── Main processing loop ─────────────────────────────────────────────────────
PROCESS_LOOP:
    test  cx, cx
    jz    DONE

    ; ════════════════════════════════════════════════════════════════════════
    ; FETCH STAGE — Simulated:  IN AX, PORT1
    ; ────────────────────────────────────────────────────────────────────────
    ; In real hardware:   IN AL, 60h  reads one byte from mic input port.
    ; Here we first write the current audio sample into the PORT1 register
    ; (modelling the device putting data onto the bus), then read it back —
    ; exactly the Fetch operand step described in the proposal.
    ; ════════════════════════════════════════════════════════════════════════
    mov   ax, [si]          ; load raw sample from memory buffer
    mov   [PORT1_REG], ax   ; → device places sample on PORT1 data bus
    mov   ax, [PORT1_REG]   ; ← CPU reads from PORT1  (simulates IN AX, PORT1)

    ; ── EXECUTE: Volume scaling ──────────────────────────────────────────────
    push  dx
    push  cx

    imul  bx                ; DX:AX = sample * volume_scaled
    mov   cx, 100
    idiv  cx                ; AX = result / 100  → real volume applied

    pop   cx
    pop   dx

    ; ── Hard clip to 16-bit signed range ────────────────────────────────────
    cmp   ax, 32767
    jle   CHECK_MIN
    mov   ax, 32767
    jmp   CHECK_NOISE

CHECK_MIN:
    cmp   ax, -32768
    jge   CHECK_NOISE
    mov   ax, -32768

    ; ── EXECUTE: Noise smoothing (moving average) ────────────────────────────
CHECK_NOISE:
    cmp   dx, 0
    je    OUTPUT_SAMPLE

    mov   bp, sp
    add   bp, 4
    mov   bp, [bp-2]        ; get iter from stack
    cmp   bp, 2
    jl    TRY_TWO_SAMPLE

    ; 3-sample moving average
    push  ax
    mov   ax, [si-2]        ; sample[i-1]
    add   ax, [si-4]        ; sample[i-2]
    pop   bx
    add   ax, bx            ; AX = s[i] + s[i-1] + s[i-2]
    cwd
    idiv  word [_THREE]
    jmp   OUTPUT_SAMPLE

TRY_TWO_SAMPLE:
    cmp   bp, 1
    jl    OUTPUT_SAMPLE

    ; 2-sample moving average
    push  ax
    mov   ax, [si-2]        ; sample[i-1]
    pop   bx
    add   ax, bx
    cwd
    idiv  word [_TWO]

    ; ════════════════════════════════════════════════════════════════════════
    ; STORE STAGE — Simulated:  OUT PORT2, AX
    ; ────────────────────────────────────────────────────────────────────────
    ; In real hardware:   OUT 61h, AL  sends one byte to the speaker port.
    ; Here we write the processed sample into PORT2_REG (CPU puts result on
    ; the output data bus), then copy it to the output memory buffer —
    ; modelling the Store step of the I/O execution cycle.
    ; ════════════════════════════════════════════════════════════════════════
OUTPUT_SAMPLE:
    mov   [PORT2_REG], ax   ; → CPU places result on PORT2 data bus (OUT PORT2, AX)
    mov   ax, [PORT2_REG]   ; ← read back from port register
    mov   [di], ax          ; store to ES:DI output buffer (20-bit effective address)

    ; ── Advance pointers ────────────────────────────────────────────────────
    add   si, 2
    add   di, 2

    ; ── Increment iter ──────────────────────────────────────────────────────
    mov   bp, sp
    add   bp, 4
    inc   word [bp-2]

    dec   cx
    jmp   PROCESS_LOOP

; ── Epilogue ─────────────────────────────────────────────────────────────────
DONE:
    pop   ax                ; remove iter from stack
    pop   dx
    pop   cx
    pop   bx
    pop   di
    pop   si
    pop   es
    pop   ds
    pop   bp
    ret