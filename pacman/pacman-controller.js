const DESLOCAMENTOS = {
    up: { x: 0, y: -1, rotacao: -90 },
    down: { x: 0, y: 1, rotacao: 90 },
    left: { x: -1, y: 0, rotacao: 180 },
    right: { x: 1, y: 0, rotacao: 0 }
};

const TECLAS_DIRECAO = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right"
};

// Controla exclusivamente o estado, a entrada e as colisões do Pac-man.
function criarControlePacman({ mapa, posicaoInicial, aoMover }) {
    const pacman = { x: posicaoInicial.x, y: posicaoInicial.y, rotacao: 0 };
    let direcao = null;
    let ativo = true;
    let ultimoMovimento = 0;
    const intervaloMovimento = 120;

    function podeMoverPara(x, y) {
        return mapa[y]?.[x] !== undefined && mapa[y][x] !== "#";
    }

    function direcionar(novaDirecao) {
        if (!ativo || !DESLOCAMENTOS[novaDirecao]) return false;
        direcao = novaDirecao;
        pacman.rotacao = DESLOCAMENTOS[direcao].rotacao;
        return true;
    }

    function tratarTecla(evento) {
        const novaDirecao = TECLAS_DIRECAO[evento.key];
        if (!ativo || !novaDirecao) return;
        evento.preventDefault();
        direcionar(novaDirecao);
        // A primeira casa responde imediatamente; repetições não aceleram o jogo.
        if (!evento.repeat) mover(true);
    }

    function mover(forcarMovimento = false) {
        if (!ativo || !direcao) return false;
        const agora = Date.now();
        if (!forcarMovimento && agora - ultimoMovimento < intervaloMovimento) return false;

        const deslocamento = DESLOCAMENTOS[direcao];
        const novoX = pacman.x + deslocamento.x;
        const novoY = pacman.y + deslocamento.y;
        if (!podeMoverPara(novoX, novoY)) return false;

        pacman.x = novoX;
        pacman.y = novoY;
        ultimoMovimento = agora;
        aoMover?.(pacman);
        return true;
    }

    document.addEventListener("keydown", tratarTecla);

    return {
        pacman,
        mover,
        direcionar,
        parar() { ativo = false; },
        destruir() {
            ativo = false;
            document.removeEventListener("keydown", tratarTecla);
        }
    };
}

window.PacmanController = { criarControlePacman };
