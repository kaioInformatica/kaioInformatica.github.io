let tamanhoCelula = 30;
const parametros = new URLSearchParams(window.location.search);
const linhasConfiguradas = Number(parametros.get("linhas"));
const colunasConfiguradas = Number(parametros.get("colunas"));
const possuiConfiguracao = parametros.has("linhas") && parametros.has("colunas")
    && Number.isInteger(linhasConfiguradas) && Number.isInteger(colunasConfiguradas);
const usarCenarioIA = parametros.get("origem") === "ia" && possuiConfiguracao;
const labirinto = usarCenarioIA
    ? window.Labirintos.obterCenarioIA(colunasConfiguradas, linhasConfiguradas)
    : possuiConfiguracao
        ? window.Labirintos.criarLabirintoConfiguravel(colunasConfiguradas, linhasConfiguradas)
        : window.Labirintos.obterCenarioIA(21, 9);
const origemLabirintoAtual = usarCenarioIA || !possuiConfiguracao ? "ai" : "mathematical";
const { mapa } = labirinto;

const game = document.getElementById("game");
const boardArea = document.getElementById("boardArea");
const touchButtons = document.querySelectorAll(".direction-button");
const imgPacman = document.getElementById("pacman");
const placar = document.getElementById("pontos");
const visorTempo = document.getElementById("tempo");
const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const rowsSlider = document.getElementById("rowsSlider");
const columnsSlider = document.getElementById("columnsSlider");
const rowsValue = document.getElementById("rowsValue");
const columnsValue = document.getElementById("columnsValue");
const originInputs = document.querySelectorAll('input[name="mazeOrigin"]');
originInputs.forEach(input => {
    input.checked = input.value === origemLabirintoAtual;
});
const aiOptions = document.getElementById("aiOptions");
const applySettingsButton = document.getElementById("applySettingsButton");
const scorePanelButton = document.getElementById("scorePanelButton");
const scorePanel = document.getElementById("scorePanel");
const scoreDimension = document.getElementById("scoreDimension");
const scoreHistory = document.getElementById("scoreHistory");
const celulas = [];
let pontos = 0;
let jogoFinalizado = false;
let cookies = [];
let jogoIniciado = false;
let tempoDecorridoMs = 0;
let inicioTimer = null;
let animacaoTimer = null;

function renderizarHistorico() {
    const [altura, largura] = scoreDimension.value.split("x").map(Number);
    const registros = window.Pontuacoes.obterHistorico(largura, altura);
    scoreHistory.replaceChildren();
    registros.forEach(({ nome, tempoMs }) => {
        const item = document.createElement("li");
        const nomeJogador = document.createElement("span");
        const tempoJogador = document.createElement("time");
        nomeJogador.textContent = nome;
        tempoJogador.textContent = window.Pontuacoes.formatarTempo(tempoMs);
        item.append(nomeJogador, tempoJogador);
        scoreHistory.appendChild(item);
    });
}

function configurarPainelPontuacoes() {
    window.Pontuacoes.dimensoesDisponiveis().forEach(({ linhas, colunas }) => {
        const opcao = document.createElement("option");
        opcao.value = `${linhas}x${colunas}`;
        opcao.textContent = `${linhas} linhas × ${colunas} colunas`;
        scoreDimension.appendChild(opcao);
    });
    scoreDimension.value = `${labirinto.altura}x${labirinto.largura}`;
    renderizarHistorico();
}

scorePanelButton.addEventListener("click", () => {
    const aberto = scorePanel.classList.toggle("open");
    scorePanelButton.textContent = aberto ? "→" : "←";
    scorePanelButton.setAttribute("aria-label", aberto ? "Fechar recordes" : "Abrir recordes");
    if (aberto) renderizarHistorico();
});
scoreDimension.addEventListener("change", renderizarHistorico);

function atualizarValoresConfiguracao() {
    rowsValue.textContent = rowsSlider.value;
    columnsValue.textContent = columnsSlider.value;
}

function atualizarOrigemLabirinto() {
    const origemSelecionada = document.querySelector('input[name="mazeOrigin"]:checked').value;
    const usarIA = origemSelecionada === "ai";

    aiOptions.classList.toggle("hidden", !usarIA);
    applySettingsButton.disabled = false;
    applySettingsButton.textContent = usarIA ? "Usar labirinto de IA" : "Criar labirinto";
}

function abrirConfiguracoes() {
    rowsSlider.value = labirinto.altura;
    columnsSlider.value = labirinto.largura;
    atualizarValoresConfiguracao();
    atualizarOrigemLabirinto();
    settingsModal.classList.remove("hidden");
    rowsSlider.focus();
}

function fecharConfiguracoes() {
    settingsModal.classList.add("hidden");
    settingsButton.focus();
}

settingsButton.addEventListener("click", abrirConfiguracoes);
closeSettingsButton.addEventListener("click", fecharConfiguracoes);
rowsSlider.addEventListener("input", atualizarValoresConfiguracao);
columnsSlider.addEventListener("input", atualizarValoresConfiguracao);
originInputs.forEach(input => input.addEventListener("change", atualizarOrigemLabirinto));
settingsModal.addEventListener("click", evento => {
    if (evento.target === settingsModal) fecharConfiguracoes();
});
applySettingsButton.addEventListener("click", () => {
    const origemSelecionada = document.querySelector('input[name="mazeOrigin"]:checked').value;
    const configuracao = new URLSearchParams({
        origem: origemSelecionada === "ai" ? "ia" : "mathematical",
        linhas: rowsSlider.value,
        colunas: columnsSlider.value
    });
    window.location.search = configuracao.toString();
});

mapa.forEach((linha, y) => {
    linha.split("").forEach((coluna, x) => {
        if (coluna === ".") cookies.push({ x, y });
    });
});

function desenharMapa() {
    mapa.forEach((linha, y) => {
        celulas[y] = [];
        linha.split("").forEach((coluna, x) => {
            const cell = document.createElement("div");
            cell.classList.add("cell", coluna === "#" ? "wall" : "path");
            celulas[y][x] = cell;
            game.appendChild(cell);
        });
    });
    atualizarCookies();
}

function atualizarCookies() {
    document.querySelectorAll(".cookie").forEach(cookie => cookie.remove());
    cookies.forEach(cookie => {
        const elemento = document.createElement("div");
        elemento.classList.add("cookie");
        celulas[cookie.y][cookie.x].appendChild(elemento);
    });
}

function atualizarTimer() {
    const minutos = Math.floor(tempoDecorridoMs / 60000);
    const segundos = Math.floor((tempoDecorridoMs % 60000) / 1000);
    const decimosDeSegundo = Math.floor((tempoDecorridoMs % 1000) / 100);
    visorTempo.textContent = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}:${decimosDeSegundo}`;
}

function iniciarTimer() {
    if (inicioTimer !== null) return;
    inicioTimer = performance.now();

    function animarTimer(agora) {
        tempoDecorridoMs = agora - inicioTimer;
        atualizarTimer();
        if (!jogoFinalizado) animacaoTimer = requestAnimationFrame(animarTimer);
    }

    animacaoTimer = requestAnimationFrame(animarTimer);
}

function comerCookie(pacman) {
    const index = cookies.findIndex(cookie => cookie.x === pacman.x && cookie.y === pacman.y);
    if (index === -1) return;

    cookies.splice(index, 1);
    pontos += 10;
    placar.textContent = pontos;
    atualizarCookies();

    if (cookies.length === 0) {
        jogoFinalizado = true;
        controlePacman.parar();
        tempoDecorridoMs = performance.now() - inicioTimer;
        atualizarTimer();
        cancelAnimationFrame(animacaoTimer);
        animacaoTimer = null;
        registrarPontuacaoAtual();
        setTimeout(() => {
            alert("🎉 Parabéns! Você comeu todos os cookies!");
            abrirConfiguracoes();
        }, 100);
    }
}

function registrarPontuacaoAtual() {
    let nome = "";
    while (!nome) {
        const resposta = window.prompt("Você venceu! Digite seu nome (até 3 caracteres):");
        if (resposta === null) return;
        nome = resposta.trim().toUpperCase();
        if (!nome || nome.length > 3) {
            nome = "";
            window.alert("Informe um nome com 1 a 3 caracteres.");
        }
    }

    window.Pontuacoes.salvarPontuacao(labirinto.largura, labirinto.altura, nome, tempoDecorridoMs);
    scoreDimension.value = `${labirinto.altura}x${labirinto.largura}`;
    renderizarHistorico();
}

const controlePacman = window.PacmanController.criarControlePacman({
    mapa,
    posicaoInicial: labirinto.posicaoInicial,
    aoMover: () => {
        jogoIniciado = true;
        iniciarTimer();
    }
});
const { pacman } = controlePacman;

function ajustarTamanhoTabuleiro() {
    const larguraDisponivel = boardArea.clientWidth;
    const alturaDisponivel = boardArea.clientHeight;
    if (!larguraDisponivel || !alturaDisponivel) return;

    tamanhoCelula = Math.max(6, Math.floor(Math.min(
        30,
        larguraDisponivel / labirinto.largura,
        alturaDisponivel / labirinto.altura
    )));

    game.style.setProperty("--cell-size", `${tamanhoCelula}px`);
    game.style.setProperty("--cookie-size", `${Math.max(2, Math.min(8, Math.round(tamanhoCelula * 0.27)))}px`);
    game.style.gridTemplateColumns = `repeat(${labirinto.largura}, ${tamanhoCelula}px)`;
    game.style.gridTemplateRows = `repeat(${labirinto.altura}, ${tamanhoCelula}px)`;
    imgPacman.style.left = `${pacman.x * tamanhoCelula}px`;
    imgPacman.style.top = `${pacman.y * tamanhoCelula}px`;
}

window.addEventListener("resize", ajustarTamanhoTabuleiro);
window.visualViewport?.addEventListener("resize", ajustarTamanhoTabuleiro);
touchButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (controlePacman.direcionar(button.dataset.direction)) {
            controlePacman.mover(true);
        }
    });
});

// Tenta atualizar frequentemente; o controle mantém o intervalo real de 120 ms.
// Isso evita uma espera extra quando o jogador troca de direção entre dois ticks.
setInterval(() => {
    if (!jogoFinalizado) controlePacman.mover();
}, 20);

function animar() {
    const destinoX = pacman.x * tamanhoCelula;
    const destinoY = pacman.y * tamanhoCelula;
    const pixelX = Number.parseFloat(imgPacman.style.left) || destinoX;
    const pixelY = Number.parseFloat(imgPacman.style.top) || destinoY;
    // A animação termina antes do próximo passo lógico (120 ms).
    const velocidade = Math.max(1, tamanhoCelula / 6);

    const proximoX = pixelX + Math.sign(destinoX - pixelX) * Math.min(velocidade, Math.abs(destinoX - pixelX));
    const proximoY = pixelY + Math.sign(destinoY - pixelY) * Math.min(velocidade, Math.abs(destinoY - pixelY));
    imgPacman.style.left = `${proximoX}px`;
    imgPacman.style.top = `${proximoY}px`;
    imgPacman.style.transform = `rotate(${pacman.rotacao}deg)`;

    // A bolinha só é removida quando a imagem alcança a célula logicamente ocupada.
    if (jogoIniciado && proximoX === destinoX && proximoY === destinoY) {
        comerCookie(pacman);
    }
    requestAnimationFrame(animar);
}

desenharMapa();
configurarPainelPontuacoes();
ajustarTamanhoTabuleiro();
animar();
