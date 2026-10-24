(() => {
  "use strict";

  const SIZE = 12;
  const levels = Array.isArray(window.ENDLESS_LEVELS) ? window.ENDLESS_LEVELS : [];
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const directions = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };
  const ui = {
    maze: document.getElementById("maze"),
    segmentLabel: document.getElementById("segment-label"),
    routeLabel: document.getElementById("route-label"),
    depth: document.getElementById("depth"),
    segmentNumber: document.getElementById("segment-number"),
    timer: document.getElementById("timer"),
    status: document.getElementById("status"),
    restart: document.getElementById("restart"),
    gameOverModal: document.getElementById("game-over-modal"),
    gameOverMessage: document.getElementById("game-over-message"),
    modalRestart: document.getElementById("modal-restart")
  };

  let segmentIndex = 0;
  let currentSegment = null;
  let player = { row: 0, col: 0 };
  let startedAt = Date.now();
  let endedAt = null;
  let gameOver = false;
  let transitioning = false;
  let lastMoveAt = 0;
  const usedHashes = new Set();
  const usedMaps = new Set();
  const buttons = Array.from(document.querySelectorAll("[data-direction]"));

  function markerSide(row, col) {
    if (row === 0) return "top";
    if (row === SIZE - 1) return "bottom";
    if (col === 0) return "left";
    if (col === SIZE - 1) return "right";
    return null;
  }

  function validateMap(candidate, expectedEntrySide) {
    if (!candidate || !Array.isArray(candidate.map) || candidate.map.length !== SIZE) {
      return { ok: false, reason: "O mapa precisa ter 12 linhas." };
    }

    let entry = null;
    let exit = null;
    let entryCount = 0;
    let exitCount = 0;
    let walkableCount = 0;

    for (let row = 0; row < SIZE; row += 1) {
      const line = candidate.map[row];
      if (typeof line !== "string" || line.length !== SIZE) {
        return { ok: false, reason: "Cada linha precisa ter 12 caracteres." };
      }
      for (let col = 0; col < SIZE; col += 1) {
        const symbol = line[col];
        if (!"#.IO".includes(symbol)) {
          return { ok: false, reason: "O mapa contém um símbolo desconhecido." };
        }
        if (symbol !== "#") walkableCount += 1;
        if (symbol === "I") {
          entryCount += 1;
          entry = { row, col, side: markerSide(row, col) };
        }
        if (symbol === "O") {
          exitCount += 1;
          exit = { row, col, side: markerSide(row, col) };
        }
      }
    }

    if (entryCount !== 1 || exitCount !== 1) {
      return { ok: false, reason: "O mapa precisa ter exatamente um I e um O." };
    }
    if (!entry.side || !exit.side || opposite[entry.side] !== exit.side) {
      return { ok: false, reason: "Entrada e saída precisam estar em lados opostos." };
    }
    if (expectedEntrySide && entry.side !== expectedEntrySide) {
      return { ok: false, reason: "A entrada não combina com a direção do trecho anterior." };
    }

    const queue = [entry];
    const reached = new Set([entry.row + "," + entry.col]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      for (const step of Object.values(directions)) {
        const row = cell.row + step.row;
        const col = cell.col + step.col;
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || candidate.map[row][col] === "#") continue;
        const key = row + "," + col;
        if (!reached.has(key)) {
          reached.add(key);
          queue.push({ row, col });
        }
      }
    }
    const exitKey = exit.row + "," + exit.col;
    if (!reached.has(exitKey)) {
      return { ok: false, reason: "Não existe um caminho entre entrada e saída." };
    }
    if (reached.size !== walkableCount) {
      return { ok: false, reason: "O mapa contém uma área caminhável isolada." };
    }

    return { ok: true, entry, exit };
  }

  function canonicalMap(map) {
    return map.join("\n");
  }

  async function hashMap(map) {
    const bytes = new TextEncoder().encode(canonicalMap(map));
    if (window.crypto && window.crypto.subtle) {
      try {
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        return "sha256-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      } catch (error) {
        // O fallback permite jogar também em contextos locais sem Web Crypto.
      }
    }
    let hash = 2166136261;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
    return "fnv1a-" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function makeProceduralCandidate(entrySide) {
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill("#"));
    const horizontal = entrySide === "left" || entrySide === "right";
    const startEdge = entrySide === "left" || entrySide === "top" ? 0 : 4;
    const endEdge = 4 - startEdge;
    const randomLane = () => Math.floor(Math.random() * 5);
    const start = horizontal
      ? { x: startEdge, y: randomLane() }
      : { x: randomLane(), y: startEdge };
    const finish = horizontal
      ? { x: endEdge, y: randomLane() }
      : { x: randomLane(), y: endEdge };
    const keyOf = (x, y) => x + "," + y;
    const visited = new Set([keyOf(start.x, start.y)]);
    const stack = [start];

    const carveCell = (x, y) => {
      grid[1 + 2 * y][1 + 2 * x] = ".";
    };
    carveCell(start.x, start.y);

    while (stack.length) {
      const current = stack[stack.length - 1];
      const choices = [
        [current.x + 1, current.y],
        [current.x - 1, current.y],
        [current.x, current.y + 1],
        [current.x, current.y - 1]
      ].filter(([x, y]) => x >= 0 && x < 5 && y >= 0 && y < 5 && !visited.has(keyOf(x, y)));

      if (!choices.length) {
        stack.pop();
        continue;
      }

      const [nextX, nextY] = choices[Math.floor(Math.random() * choices.length)];
      visited.add(keyOf(nextX, nextY));
      stack.push({ x: nextX, y: nextY });
      carveCell(nextX, nextY);
      grid[1 + current.y + nextY][1 + current.x + nextX] = ".";
    }

    const entryRow = 1 + 2 * start.y;
    const entryCol = 1 + 2 * start.x;
    const exitRow = 1 + 2 * finish.y;
    const exitCol = 1 + 2 * finish.x;

    if (entrySide === "left") {
      grid[entryRow][0] = "I";
      grid[exitRow][SIZE - 1] = "O";
      grid[exitRow][SIZE - 2] = ".";
    } else if (entrySide === "right") {
      grid[entryRow][SIZE - 1] = "I";
      grid[entryRow][SIZE - 2] = ".";
      grid[exitRow][0] = "O";
      grid[exitRow][1] = ".";
    } else if (entrySide === "top") {
      grid[0][entryCol] = "I";
      grid[SIZE - 1][exitCol] = "O";
      grid[SIZE - 2][exitCol] = ".";
    } else {
      grid[SIZE - 1][entryCol] = "I";
      grid[SIZE - 2][entryCol] = ".";
      grid[0][exitCol] = "O";
      grid[1][exitCol] = ".";
    }

    return {
      id: "procedural-" + Date.now().toString(36),
      title: "Trecho procedural",
      map: grid.map((row) => row.join(""))
    };
  }

  async function findNextSegment(nextIndex, expectedEntrySide) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const useSavedLevel = nextIndex < levels.length && attempt === 0;
      const candidate = useSavedLevel
        ? levels[nextIndex]
        : makeProceduralCandidate(expectedEntrySide || "left");
      const validation = validateMap(candidate, expectedEntrySide);
      if (!validation.ok) continue;

      const signature = canonicalMap(candidate.map);
      const digest = await hashMap(candidate.map);
      if (usedMaps.has(signature) || usedHashes.has(digest)) continue;

      usedMaps.add(signature);
      usedHashes.add(digest);
      return {
        id: candidate.id,
        title: candidate.title || ("Trecho " + (nextIndex + 1)),
        map: candidate.map,
        entry: validation.entry,
        exit: validation.exit,
        source: useSavedLevel ? "saved" : "procedural"
      };
    }
    throw new Error("Não foi possível encontrar um segmento novo e válido.");
  }

  async function validateCatalog() {
    if (levels.length < 1) throw new Error("Adicione ao menos um mapa em levels.js.");
    const hashes = new Set();
    let expectedEntrySide = null;
    for (const level of levels) {
      const validation = validateMap(level, expectedEntrySide);
      if (!validation.ok) {
        throw new Error((level.title || "Segmento salvo") + ": " + validation.reason);
      }
      const digest = await hashMap(level.map);
      if (hashes.has(digest)) throw new Error("Há mapas duplicados em levels.js.");
      hashes.add(digest);
      expectedEntrySide = opposite[validation.exit.side];
    }
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return minutes + ":" + seconds;
  }

  function elapsedMilliseconds() {
    return (endedAt || Date.now()) - startedAt;
  }

  function updateStats() {
    ui.depth.textContent = String(segmentIndex);
    ui.segmentNumber.textContent = segmentIndex < levels.length
      ? (segmentIndex + 1) + " / " + levels.length
      : (segmentIndex + 1) + " · infinito";
    ui.timer.textContent = formatTime(elapsedMilliseconds());
    if (currentSegment) {
      ui.segmentLabel.textContent = currentSegment.source === "saved"
        ? currentSegment.title
        : "Trecho procedural " + (segmentIndex + 1);
      ui.routeLabel.innerHTML = currentSegment.entry.side.toUpperCase() + ' <span aria-hidden="true">→</span> ' + currentSegment.exit.side.toUpperCase();
    }
  }

  function renderBoard() {
    if (!currentSegment) return;
    ui.maze.replaceChildren();
    ui.maze.setAttribute("aria-label", "Labirinto, segmento " + (segmentIndex + 1));
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const symbol = currentSegment.map[row][col];
        const tile = document.createElement("div");
        const isPlayer = player.row === row && player.col === col;
        tile.className = "tile " + (symbol === "#" ? "wall" : "floor");
        if (symbol === "I") tile.classList.add("entry");
        if (symbol === "O") tile.classList.add("exit");
        if (isPlayer) tile.classList.add("player");
        tile.setAttribute("role", "gridcell");
        tile.setAttribute("aria-label", isPlayer ? "Jogador" : (symbol === "#" ? "Parede" : symbol === "O" ? "Saída" : symbol === "I" ? "Entrada" : "Caminho"));
        tile.textContent = isPlayer ? "" : (symbol === "O" ? "↗" : symbol === "I" ? "I" : "");
        ui.maze.appendChild(tile);
      }
    }
    buttons.forEach((button) => { button.disabled = gameOver || transitioning; });
  }

  function setStatus(message) {
    ui.status.textContent = message;
  }

  function finishSession(message) {
    gameOver = true;
    transitioning = false;
    endedAt = Date.now();
    const summary = message + " Profundidade: " + segmentIndex + " · tempo: " + formatTime(elapsedMilliseconds()) + ".";
    setStatus(summary);
    ui.gameOverMessage.textContent = summary;
    renderBoard();
    updateStats();
    if (!ui.gameOverModal.open) ui.gameOverModal.showModal();
  }

  async function advanceSegment() {
    transitioning = true;
    buttons.forEach((button) => { button.disabled = true; });
    setStatus("Saída alcançada. Validando o próximo segmento…");
    try {
      const expectedEntrySide = opposite[currentSegment.exit.side];
      const nextIndex = segmentIndex + 1;
      const nextSegment = await findNextSegment(nextIndex, expectedEntrySide);
      segmentIndex = nextIndex;
      currentSegment = nextSegment;
      player = { row: nextSegment.entry.row, col: nextSegment.entry.col };
      transitioning = false;
      updateStats();
      renderBoard();
      setStatus("Novo segmento aceito: mapa conectado e inédito nesta sessão.");
    } catch (error) {
      finishSession("A sessão foi encerrada porque não havia um próximo trecho válido.");
    }
  }

  function move(direction) {
    if (gameOver || transitioning || !currentSegment) return;
    const now = Date.now();
    if (now - lastMoveAt < 90) return;
    lastMoveAt = now;

    const step = directions[direction];
    const row = player.row + step.row;
    const col = player.col + step.col;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || currentSegment.map[row][col] === "#") {
      finishSession("Fim de sessão: você tocou em uma parede.");
      return;
    }

    player = { row, col };
    if (currentSegment.map[row][col] === "O") {
      renderBoard();
      advanceSegment();
      return;
    }

    renderBoard();
  }

  async function resetSession() {
    gameOver = false;
    transitioning = true;
    endedAt = null;
    segmentIndex = 0;
    startedAt = Date.now();
    lastMoveAt = 0;
    usedHashes.clear();
    usedMaps.clear();
    setStatus("Validando o primeiro segmento…");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await validateCatalog();
      const first = await findNextSegment(0, null);
      currentSegment = first;
      player = { row: first.entry.row, col: first.entry.col };
      transitioning = false;
      updateStats();
      renderBoard();
      setStatus("Use as setas, WASD ou os controles na tela para chegar à saída.");
    } catch (error) {
      currentSegment = null;
      transitioning = false;
      gameOver = true;
      ui.segmentLabel.textContent = "Falha ao carregar o mapa";
      ui.routeLabel.textContent = "MAPA INVÁLIDO";
      setStatus("Não foi possível iniciar: " + error.message);
    }
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const keyMap = {
      arrowup: "up", w: "up",
      arrowdown: "down", s: "down",
      arrowleft: "left", a: "left",
      arrowright: "right", d: "right"
    };
    const direction = keyMap[key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });

  buttons.forEach((button) => {
    button.addEventListener("click", () => move(button.dataset.direction));
  });
  ui.restart.addEventListener("click", resetSession);
  ui.modalRestart.addEventListener("click", () => {
    if (ui.gameOverModal.open) ui.gameOverModal.close();
    resetSession();
  });

  window.setInterval(updateStats, 250);
  resetSession();
})();
