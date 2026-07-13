import { useLayoutEffect, useRef, useState } from "react";

const COLS = 10, ROWS = 20, CELL = 28;
const NEXT_CELL = 13, NEXT_SIZE = 64;

const COLORS = {
  I: "#3E7CA6", O: "#C9A227", T: "#7A3B57",
  S: "#5B6B3F", Z: "#C22A26", J: "#445366", L: "#C97C3D"
};

function shade(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return "rgb(" + r + "," + g + "," + b + ")";
}

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  T: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  S: [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
  Z: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  L: [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]]
};

function rotateGrid(g) {
  const n = g.length, out = [];
  for (let y = 0; y < n; y++) {
    out.push([]);
    for (let x = 0; x < n; x++) out[y].push(0);
  }
  for (let y2 = 0; y2 < n; y2++) {
    for (let x2 = 0; x2 < n; x2++) {
      out[x2][n - 1 - y2] = g[y2][x2];
    }
  }
  return out;
}

const PIECE_ROTATIONS = {};
Object.keys(SHAPES).forEach(function (key) {
  const states = [SHAPES[key]];
  for (let i = 0; i < 3; i++) states.push(rotateGrid(states[states.length - 1]));
  PIECE_ROTATIONS[key] = states;
});

const TYPES = Object.keys(SHAPES);

function newBag() {
  const bag = TYPES.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
  }
  return bag;
}

export default function App() {
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [statusLine, setStatusLine] = useState("Ready");
  const [overlayShow, setOverlayShow] = useState(true);
  const [overlayTitle, setOverlayTitle] = useState("TETRIS");
  const [overlaySub, setOverlaySub] = useState(
    isTouch ? "Tap the board or <span class=\"kbd\">START</span> to begin"
            : "Press <span class=\"kbd\">SPACE</span> to begin"
  );
  const [liveMsg, setLiveMsg] = useState("");

  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const overlayRef = useRef(null);
  const startBtnRef = useRef(null);
  const pauseBtnRef = useRef(null);
  const muteBtnRef = useRef(null);
  const touchWrapRef = useRef(null);

  useLayoutEffect(function () {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const nextCanvas = nextCanvasRef.current;
    const nextCtx = nextCanvas.getContext("2d");

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = COLS * CELL * dpr;
    canvas.height = ROWS * CELL * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    nextCanvas.width = NEXT_SIZE * dpr;
    nextCanvas.height = NEXT_SIZE * dpr;
    nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let audioCtx = null, masterGain = null, noiseBuffer = null;
    let muted = false;
    try { muted = localStorage.getItem("tetris_muted") === "1"; } catch (e) {}
    setMuted(muted);

    function ensureAudio() {
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          masterGain = audioCtx.createGain();
          masterGain.gain.value = 0.5;
          masterGain.connect(audioCtx.destination);
        } catch (e) { audioCtx = null; }
      } else if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    }

    function getNoiseBuffer() {
      if (!noiseBuffer && audioCtx) {
        const len = Math.floor(audioCtx.sampleRate * 0.3);
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      return noiseBuffer;
    }

    function playTone(freq, dur, type, vol, delay, glideTo) {
      if (muted || !audioCtx) return;
      const t = audioCtx.currentTime + (delay || 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    function playThud(vol, dur, cutoff) {
      if (muted || !audioCtx) return;
      const buf = getNoiseBuffer();
      if (!buf) return;
      const t = audioCtx.currentTime;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff || 300;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.15));
      src.connect(filter).connect(gain).connect(masterGain);
      src.start(t);
      src.stop(t + (dur || 0.15) + 0.02);
    }

    function sfxMove() { playTone(720, 0.045, "square", 0.10); }
    function sfxRotate() { playTone(980, 0.06, "square", 0.12, 0, 760); }
    function sfxSoftDrop() { playTone(420, 0.03, "square", 0.06); }
    function sfxHardDrop() {
      playTone(300, 0.09, "sawtooth", 0.10, 0, 90);
      playThud(0.35, 0.14, 260);
    }
    function sfxLock() { playThud(0.18, 0.10, 220); }
    function sfxLineClear(count) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const n = Math.min(count, notes.length);
      for (let i = 0; i < n; i++) playTone(notes[i], 0.11, "triangle", 0.16, i * 0.05);
      if (count >= 4) playTone(1318.5, 0.16, "triangle", 0.18, 0.22);
    }
    function sfxLevelUp() {
      playTone(660, 0.09, "triangle", 0.14, 0);
      playTone(880, 0.09, "triangle", 0.14, 0.09);
      playTone(1108.7, 0.14, "triangle", 0.16, 0.18);
    }
    function sfxGameOver() {
      const notes = [392, 349.23, 293.66, 220];
      for (let i = 0; i < notes.length; i++) playTone(notes[i], 0.22, "square", 0.14, i * 0.16);
    }
    function sfxStart() {
      playTone(523.25, 0.08, "square", 0.14, 0);
      playTone(783.99, 0.11, "square", 0.16, 0.09);
    }
    function sfxPause() { playTone(600, 0.07, "square", 0.10); }
    function sfxResume() { playTone(760, 0.07, "square", 0.10); }

    let bag = [];
    function nextFromBag() {
      if (bag.length === 0) bag = newBag();
      return bag.shift();
    }

    let board, current, next, score, level, lines, highScore;
    let dropInterval, lockTimer, lockResets, gameOver, paused, started;
    let clearingRows = [];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      highScore = parseInt(localStorage.getItem("tetris_high_score") || "0", 10) || 0;
    } catch (e) { highScore = 0; }
    setHighScore(highScore);

    function emptyBoard() {
      const b = [];
      for (let y = 0; y < ROWS; y++) b.push(new Array(COLS).fill(null));
      return b;
    }

    function spawnPiece(type) {
      return { type: type, rot: 0, x: 3, y: -1 };
    }

    function cellsOf(piece) {
      const grid = PIECE_ROTATIONS[piece.type][piece.rot];
      const cells = [];
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (grid[y][x]) cells.push({ x: piece.x + x, y: piece.y + y });
        }
      }
      return cells;
    }

    function collides(piece, dx, dy, rot) {
      const testPiece = { type: piece.type, rot: rot !== undefined ? rot : piece.rot, x: piece.x + dx, y: piece.y + dy };
      const cells = cellsOf(testPiece);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.x < 0 || c.x >= COLS || c.y >= ROWS) return true;
        if (c.y >= 0 && board[c.y][c.x]) return true;
      }
      return false;
    }

    function resetGame() {
      board = emptyBoard();
      bag = [];
      current = spawnPiece(nextFromBag());
      next = nextFromBag();
      score = 0;
      level = 1;
      lines = 0;
      dropInterval = 1000;
      lockTimer = 0;
      lockResets = 0;
      gameOver = false;
      paused = false;
      clearingRows = [];
      updateStats();
    }

    function updateStats() {
      setScore(score);
      setLevel(level);
      setLines(lines);
    }

    function tryMove(dx, dy) {
      if (!collides(current, dx, dy)) {
        current.x += dx;
        current.y += dy;
        if (isGrounded()) resetLockIfAllowed(); else lockTimer = 0;
        return true;
      }
      return false;
    }

    function tryRotate(dir) {
      const newRot = (current.rot + dir + 4) % 4;
      const kicks = [0, -1, 1, -2, 2];
      for (let i = 0; i < kicks.length; i++) {
        if (!collides(current, kicks[i], 0, newRot)) {
          current.x += kicks[i];
          current.rot = newRot;
          if (isGrounded()) resetLockIfAllowed(); else lockTimer = 0;
          return true;
        }
      }
      return false;
    }

    function isGrounded() { return collides(current, 0, 1); }

    function resetLockIfAllowed() {
      if (lockResets < 15) { lockTimer = 0; lockResets++; }
    }

    function hardDrop() {
      let dist = 0;
      while (!collides(current, 0, 1)) { current.y++; dist++; }
      score += dist * 2;
      sfxHardDrop();
      lockPiece(true);
    }

    function ghostY() {
      let y = current.y;
      while (!collides(current, 0, (y - current.y) + 1)) y++;
      return y;
    }

    function lockPiece(fromHardDrop) {
      const cells = cellsOf(current);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.y < 0) { triggerGameOver(); return; }
        board[c.y][c.x] = COLORS[current.type];
      }
      const full = [];
      for (let y = 0; y < ROWS; y++) {
        if (board[y].every(function (v) { return v !== null; })) full.push(y);
      }
      if (full.length > 0) {
        clearingRows = full;
        setTimeout(function () { finishClear(full); }, reduceMotion ? 0 : 140);
      } else {
        if (!fromHardDrop) sfxLock();
        spawnNext();
      }
    }

    function finishClear(full) {
      full.sort(function (a, b) { return a - b; });
      for (let i = 0; i < full.length; i++) {
        board.splice(full[i], 1);
        board.unshift(new Array(COLS).fill(null));
      }
      clearingRows = [];
      const count = full.length;
      const points = [0, 100, 300, 500, 800][count] * level;
      score += points;
      lines += count;
      sfxLineClear(count);
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(100, 1000 - (level - 1) * 75);
        sfxLevelUp();
      }
      updateStats();
      announce(count + (count === 1 ? " line" : " lines") + " cleared");
      spawnNext();
    }

    function spawnNext() {
      current = spawnPiece(next);
      next = nextFromBag();
      lockTimer = 0;
      lockResets = 0;
      acc = 0;
      if (collides(current, 0, 0)) triggerGameOver();
    }

    function triggerGameOver() {
      gameOver = true;
      started = false;
      sfxGameOver();
      if (score > highScore) {
        highScore = score;
        setHighScore(highScore);
        try { localStorage.setItem("tetris_high_score", String(highScore)); } catch (e) {}
      }
      setOverlayTitle("GAME OVER");
      setOverlaySub("Score " + score + " &middot; " + (isTouch ? "Tap to restart" : "Press <span class=\"kbd\">R</span> to restart"));
      setOverlayShow(true);
      setStatusLine("Game over");
      announce("Game over. Final score " + score);
    }

    function announce(msg) { setLiveMsg(msg); }

    function drawCell(c2d, x, y, size, color) {
      c2d.fillStyle = color;
      c2d.fillRect(x, y, size, size);
      c2d.strokeStyle = shade(color, -40);
      c2d.lineWidth = 2;
      c2d.strokeRect(x + 1, y + 1, size - 2, size - 2);
      c2d.fillStyle = "rgba(255,255,255,0.14)";
      c2d.fillRect(x + 2, y + 2, size - 4, 3);
    }

    function render() {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--board-bg").trim() || "#17140f";
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--board-line").trim();
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= COLS; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * CELL + 0.5, 0);
        ctx.lineTo(gx * CELL + 0.5, ROWS * CELL);
        ctx.stroke();
      }
      for (let gy = 0; gy <= ROWS; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * CELL + 0.5);
        ctx.lineTo(COLS * CELL, gy * CELL + 0.5);
        ctx.stroke();
      }

      for (let y = 0; y < ROWS; y++) {
        const isClearing = clearingRows.indexOf(y) !== -1;
        for (let x = 0; x < COLS; x++) {
          const val = board[y][x];
          if (val) {
            if (isClearing) {
              ctx.fillStyle = "#ede7d8";
              ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
            } else {
              drawCell(ctx, x * CELL, y * CELL, CELL, val);
            }
          }
        }
      }

      if (!gameOver && started && !paused && clearingRows.length === 0) {
        const gy2 = ghostY();
        const grid = PIECE_ROTATIONS[current.type][current.rot];
        ctx.strokeStyle = "rgba(237,231,216,0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        for (let yy = 0; yy < 4; yy++) {
          for (let xx = 0; xx < 4; xx++) {
            if (grid[yy][xx]) {
              const px = (current.x + xx) * CELL, py = (gy2 + yy) * CELL;
              ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
            }
          }
        }
        ctx.setLineDash([]);

        const color = COLORS[current.type];
        for (let y3 = 0; y3 < 4; y3++) {
          for (let x3 = 0; x3 < 4; x3++) {
            if (grid[y3][x3]) {
              const px2 = (current.x + x3) * CELL, py2 = (current.y + y3) * CELL;
              if (py2 >= -CELL) drawCell(ctx, px2, py2, CELL, color);
            }
          }
        }
      }

      nextCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--board-bg").trim() || "#17140f";
      nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE);
      if (next) {
        const ngrid = PIECE_ROTATIONS[next][0];
        let minX = 4, maxX = -1, minY = 4, maxY = -1;
        for (let ny = 0; ny < 4; ny++) {
          for (let nx = 0; nx < 4; nx++) {
            if (ngrid[ny][nx]) {
              minX = Math.min(minX, nx); maxX = Math.max(maxX, nx);
              minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
            }
          }
        }
        const w = (maxX - minX + 1) * NEXT_CELL, h = (maxY - minY + 1) * NEXT_CELL;
        const offX = (NEXT_SIZE - w) / 2, offY = (NEXT_SIZE - h) / 2;
        for (let py3 = 0; py3 < 4; py3++) {
          for (let px3 = 0; px3 < 4; px3++) {
            if (ngrid[py3][px3]) {
              drawCell(nextCtx, offX + (px3 - minX) * NEXT_CELL, offY + (py3 - minY) * NEXT_CELL, NEXT_CELL, COLORS[next]);
            }
          }
        }
      }
    }

    let lastTime = 0, acc = 0, rafId = 0;
    function loop(t) {
      const dt = t - lastTime;
      lastTime = t;
      if (started && !paused && !gameOver && clearingRows.length === 0) {
        acc += dt;
        if (isGrounded()) {
          lockTimer += dt;
          if (lockTimer >= 500) { lockTimer = 0; lockPiece(); }
        } else if (acc >= dropInterval) {
          acc = 0;
          current.y++;
        }
      } else {
        acc = 0;
      }
      render();
      rafId = requestAnimationFrame(loop);
    }

    function startGame() {
      ensureAudio();
      resetGame();
      started = true;
      setOverlayShow(false);
      setStatusLine("Playing");
      setPaused(false);
      sfxStart();
      announce("Game started");
    }

    function togglePause() {
      if (!started || gameOver) return;
      ensureAudio();
      paused = !paused;
      setPaused(paused);
      if (paused) {
        setOverlayTitle("PAUSED");
        setOverlaySub(isTouch ? "Tap to resume" : "Press <span class=\"kbd\">P</span> to resume");
        setOverlayShow(true);
        setStatusLine("Paused");
        sfxPause();
      } else {
        setOverlayShow(false);
        setStatusLine("Playing");
        sfxResume();
      }
      announce(paused ? "Paused" : "Resumed");
    }

    function toggleMute() {
      muted = !muted;
      try { localStorage.setItem("tetris_muted", muted ? "1" : "0"); } catch (e) {}
      setMuted(muted);
      if (!muted) { ensureAudio(); sfxMove(); }
    }

    function onKeyDown(e) {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Spacebar"].indexOf(e.key) !== -1) {
        e.preventDefault();
      }
      if (!started) {
        if (e.key === " " || e.key === "Spacebar") startGame();
        return;
      }
      if (gameOver) {
        if (e.key === "r" || e.key === "R") startGame();
        return;
      }
      if (e.key === "p" || e.key === "P") { togglePause(); return; }
      if (paused) return;

      switch (e.key) {
        case "ArrowLeft": if (tryMove(-1, 0)) sfxMove(); break;
        case "ArrowRight": if (tryMove(1, 0)) sfxMove(); break;
        case "ArrowDown": if (tryMove(0, 1)) { score++; sfxSoftDrop(); } updateStats(); break;
        case "ArrowUp": if (tryRotate(1)) sfxRotate(); break;
        case "x": case "X": if (tryRotate(1)) sfxRotate(); break;
        case "z": case "Z": if (tryRotate(-1)) sfxRotate(); break;
        case " ": case "Spacebar": hardDrop(); updateStats(); break;
      }
    }
    document.addEventListener("keydown", onKeyDown);

    function onStartClick() { if (gameOver || !started) startGame(); }
    function onPauseClick() { togglePause(); }
    function onOverlayClick() {
      if (!started || gameOver) startGame();
      else if (paused) togglePause();
    }
    function onMuteClick() { toggleMute(); }

    const startBtn = startBtnRef.current;
    const pauseBtn = pauseBtnRef.current;
    const muteBtn = muteBtnRef.current;
    const overlayEl = overlayRef.current;
    startBtn.addEventListener("click", onStartClick);
    pauseBtn.addEventListener("click", onPauseClick);
    overlayEl.addEventListener("click", onOverlayClick);
    muteBtn.addEventListener("click", onMuteClick);

    function touchAction(action) {
      ensureAudio();
      if (!started) { startGame(); return; }
      if (gameOver || paused) return;
      if (action === "left") { if (tryMove(-1, 0)) sfxMove(); }
      else if (action === "right") { if (tryMove(1, 0)) sfxMove(); }
      else if (action === "down") { if (tryMove(0, 1)) { score++; sfxSoftDrop(); } updateStats(); }
      else if (action === "rotate") { if (tryRotate(1)) sfxRotate(); }
      else if (action === "drop") { hardDrop(); updateStats(); }
    }

    const REPEATABLE = { left: true, right: true, down: true };
    const touchCleanups = [];
    const touchButtons = touchWrapRef.current ? touchWrapRef.current.querySelectorAll(".touch-btn") : [];
    touchButtons.forEach(function (btn) {
      const action = btn.getAttribute("data-action");
      let holdTimer = null, repeatTimer = null;
      function stopRepeat() {
        clearTimeout(holdTimer);
        clearInterval(repeatTimer);
        holdTimer = repeatTimer = null;
      }
      function onDown(e) {
        e.preventDefault();
        touchAction(action);
        if (REPEATABLE[action]) {
          holdTimer = setTimeout(function () {
            repeatTimer = setInterval(function () { touchAction(action); }, 60);
          }, 220);
        }
      }
      btn.addEventListener("pointerdown", onDown);
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
        btn.addEventListener(evt, stopRepeat);
      });
      touchCleanups.push(function () {
        btn.removeEventListener("pointerdown", onDown);
        ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
          btn.removeEventListener(evt, stopRepeat);
        });
        stopRepeat();
      });
    });

    let boardRect = canvas.getBoundingClientRect();
    function refreshBoardRect() { boardRect = canvas.getBoundingClientRect(); }
    window.addEventListener("resize", refreshBoardRect);
    window.addEventListener("orientationchange", refreshBoardRect);

    function boardCellPx() {
      if (!boardRect.width || !boardRect.height) refreshBoardRect();
      return { x: boardRect.width / COLS, y: boardRect.height / ROWS };
    }

    let swipe = null;
    function onPointerDown(e) {
      if (!started || paused || gameOver || swipe) return;
      ensureAudio();
      refreshBoardRect();
      swipe = {
        id: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastY: e.clientY,
        startTime: performance.now(),
        accX: 0, accY: 0
      };
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!swipe || e.pointerId !== swipe.id) return;
      e.preventDefault();
      if (!started || paused || gameOver) return;
      const dx = e.clientX - swipe.lastX;
      const dy = e.clientY - swipe.lastY;
      swipe.lastX = e.clientX;
      swipe.lastY = e.clientY;
      swipe.accX += dx;
      swipe.accY += dy;

      const cell = boardCellPx();
      const stepX = Math.max(cell.x * 0.6, 10);
      const stepY = Math.max(cell.y * 0.6, 10);

      while (swipe.accX >= stepX) { if (tryMove(1, 0)) sfxMove(); swipe.accX -= stepX; }
      while (swipe.accX <= -stepX) { if (tryMove(-1, 0)) sfxMove(); swipe.accX += stepX; }
      while (swipe.accY >= stepY) {
        if (tryMove(0, 1)) { score++; sfxSoftDrop(); }
        updateStats();
        swipe.accY -= stepY;
      }
      if (swipe.accY < 0) swipe.accY = 0;
    }

    function endSwipe(e) {
      if (!swipe || e.pointerId !== swipe.id) return;
      const totalDX = e.clientX - swipe.startX;
      const totalDY = e.clientY - swipe.startY;
      const elapsed = performance.now() - swipe.startTime;
      if (started && !paused && !gameOver) {
        if (Math.abs(totalDX) < 12 && Math.abs(totalDY) < 12 && elapsed < 300) {
          if (tryRotate(1)) sfxRotate();
        } else if (elapsed > 0 && totalDY > Math.abs(totalDX) &&
                   totalDY > boardCellPx().y * 1.5 && (totalDY / elapsed) > 0.9) {
          hardDrop();
          updateStats();
        }
      }
      swipe = null;
    }
    function onPointerCancel() { swipe = null; }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endSwipe);
    canvas.addEventListener("pointercancel", onPointerCancel);

    resetGame();
    render();
    rafId = requestAnimationFrame(loop);

    return function cleanup() {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      startBtn.removeEventListener("click", onStartClick);
      pauseBtn.removeEventListener("click", onPauseClick);
      overlayEl.removeEventListener("click", onOverlayClick);
      muteBtn.removeEventListener("click", onMuteClick);
      touchCleanups.forEach(function (fn) { fn(); });
      window.removeEventListener("resize", refreshBoardRect);
      window.removeEventListener("orientationchange", refreshBoardRect);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endSwipe);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      if (audioCtx) audioCtx.close();
    };
  }, []);

  return (
    <div className="poster">
      <div className="layout">
        <div className="board-frame">
          <canvas ref={canvasRef} id="board" width="280" height="560" role="img" aria-label="Tetris playing field" />
          <div ref={overlayRef} className={"overlay" + (overlayShow ? " show" : "")} id="overlay">
            <div className="big" id="overlayTitle">{overlayTitle}</div>
            <div className="line" id="overlaySub" dangerouslySetInnerHTML={{ __html: overlaySub }} />
          </div>
        </div>

        <aside className="sidebar">
          <div className="stat-block">
            <div className="stat-row">
              <span className="stat-label">Score</span>
              <span className="stat-value accent" id="score">{score}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">High</span>
              <span className="stat-value" id="highScore">{highScore}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Level</span>
              <span className="stat-value" id="level">{level}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Lines</span>
              <span className="stat-value" id="lines">{lines}</span>
            </div>
          </div>

          <div className="next-block">
            <div className="next-label">Next piece</div>
            <div className="next-wrap">
              <canvas ref={nextCanvasRef} id="next" width="64" height="64" />
            </div>
          </div>

          <div className="controls-block">
            <div className="next-label">Controls</div>
            <div className="key-row"><span>Move</span><span><kbd>&larr;</kbd> <kbd>&rarr;</kbd></span></div>
            <div className="key-row"><span>Soft drop</span><span><kbd>&darr;</kbd></span></div>
            <div className="key-row"><span>Hard drop</span><span><kbd>SPACE</kbd></span></div>
            <div className="key-row"><span>Rotate</span><span><kbd>&uarr;</kbd> / <kbd>X</kbd> <kbd>Z</kbd></span></div>
            <div className="key-row"><span>Pause</span><span><kbd>P</kbd></span></div>
          </div>

          <button ref={startBtnRef} className="btn" id="startBtn" type="button">Start</button>
          <button ref={pauseBtnRef} className="btn ghost" id="pauseBtn" type="button">{paused ? "Resume" : "Pause"}</button>
          <button ref={muteBtnRef} className="btn ghost" id="muteBtn" type="button">{muted ? "Sound: Off" : "Sound: On"}</button>

          <div ref={touchWrapRef} className="touch-controls" aria-label="Touch controls">
            <button className="touch-btn" data-action="left" type="button" aria-label="Move left">&#9664;</button>
            <button className="touch-btn" data-action="rotate" type="button" aria-label="Rotate">&#8635;</button>
            <button className="touch-btn" data-action="right" type="button" aria-label="Move right">&#9654;</button>
            <button className="touch-btn wide" data-action="down" type="button" aria-label="Soft drop">&#9660; SOFT</button>
            <button className="touch-btn wide" data-action="drop" type="button" aria-label="Hard drop">DROP</button>
          </div>
        </aside>
      </div>

      <footer className="colophon">
        <span>Seven-bag randomizer &middot; ghost piece &middot; 100&ndash;800 pts / line</span>
        <span id="statusLine">{statusLine}</span>
      </footer>

      <div className="visually-hidden" id="liveRegion" aria-live="polite">{liveMsg}</div>
    </div>
  );
}
