# 🎙️ Real-Time Voice Processing and Hardware Performance Analyzer

A full-stack system that captures and processes live audio in real time, while measuring and visualizing actual hardware performance metrics — built as part of the **Computer Organization & Assembly Language (COAL)** course.

This project bridges low-level systems programming with modern full-stack development: performance-critical audio processing logic is implemented in **x86-64 NASM assembly**, wrapped by a **C++** backend, served through **Node.js/Express**, and visualized live using **React**.

---

## ✨ Features

- 🎧 **Real-time audio capture and processing**
- ⚙️ **Core processing logic written in x86-64 NASM assembly** for performance-critical operations
- 📊 **Genuine hardware performance measurement** (not estimated or hardcoded):
  - CPU cycle counts via `RDTSC`
  - Cycles Per Instruction (CPI)
  - Millions of Instructions Per Second (MIPS)
  - Cache hit/miss rates
  - Instruction counts
- 🔄 **Live polling vs. interrupt-driven comparison**, using real measured data side-by-side
- 📈 **Interactive React dashboard** for visualizing performance metrics in real time

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Performance-critical logic | x86-64 NASM Assembly |
| Backend core | C++ |
| Server | Node.js / Express |
| Frontend | React |
| Audio handling | FFmpeg |

---

## 📁 Project Structure

```
COAL-PROJECT/
├── build.bat              # Build script for assembly/C++ components
├── main.cpp                # C++ core logic
├── proces_Asm.asm          # x86-64 NASM assembly module
├── server.js               # Node.js/Express server
├── package.json
├── package-lock.json
└── src/
    ├── App.jsx              # React app entry
    └── App.css
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [NASM](https://www.nasm.us/) assembler
- A C++ compiler (e.g. MinGW/g++ on Windows)
- [FFmpeg](https://ffmpeg.org/) installed and accessible in your system PATH

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/malaikasalam/COAL-PROJECT-.git
   cd COAL-PROJECT-
   ```

2. **Install frontend/server dependencies**
   ```bash
   npm install
   ```

3. **Build the assembly and C++ components**
   ```bash
   build.bat
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Run the React frontend**
   ```bash
   npm start
   ```

---

## 📊 How It Works

1. Live audio is captured and passed to the C++ core, which calls into the NASM assembly module for performance-critical processing.
2. While processing runs, the system measures real hardware-level metrics using `RDTSC` and related counters — no simulated or hardcoded values.
3. These metrics are sent through the Node.js/Express server to the React frontend.
4. The dashboard visualizes the data live, including a direct comparison between **polling** and **interrupt-driven** processing modes.

---

## 👥 Team

- **Malaika Salam**
- **Ayesha Saleh**
- **Aasfa Maham Ghazir**
  

---

## 📄 License

This project is licensed under the MIT License — feel free to use, modify, and build upon it.

---

## 🙏 Acknowledgments

Built as part of the Computer Organization & Assembly Language (COAL) course curriculum, combining low-level systems concepts with practical full-stack engineering.
