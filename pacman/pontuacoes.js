const CHAVE_ARMAZENAMENTO = "pacman-pontuacoes-v1";
const memoria = {};

function dimensoesDisponiveis() {
    const dimensoes = [];
    for (let linhas = 9; linhas <= 19; linhas += 2) {
        for (let colunas = 15; colunas <= 31; colunas += 2) {
            dimensoes.push({ linhas, colunas });
        }
    }
    return dimensoes;
}

function chaveDimensao(largura, altura) {
    return `${altura}x${largura}`;
}

function tempoKio(largura, altura) {
    // Referência proporcional à área da tela: cerca de 30 s no menor labirinto.
    return Math.round(largura * altura * 220);
}

function criarRegistrosIniciais() {
    return Object.fromEntries(dimensoesDisponiveis().map(({ linhas, colunas }) => [
        chaveDimensao(colunas, linhas),
        [{ nome: "KIO", tempoMs: tempoKio(colunas, linhas) }]
    ]));
}

function lerPontuacoes() {
    try {
        const salvas = localStorage.getItem(CHAVE_ARMAZENAMENTO);
        return salvas ? JSON.parse(salvas) : criarRegistrosIniciais();
    } catch {
        return criarRegistrosIniciais();
    }
}

function gravarPontuacoes(pontuacoes) {
    try {
        localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(pontuacoes));
    } catch {
        Object.assign(memoria, pontuacoes);
    }
}

let pontuacoes = lerPontuacoes();
dimensoesDisponiveis().forEach(({ linhas, colunas }) => {
    const chave = chaveDimensao(colunas, linhas);
    if (!Array.isArray(pontuacoes[chave])) pontuacoes[chave] = [{ nome: "KIO", tempoMs: tempoKio(colunas, linhas) }];
});
gravarPontuacoes(pontuacoes);

function obterHistorico(largura, altura) {
    const chave = chaveDimensao(largura, altura);
    return [...(pontuacoes[chave] || [])].sort((a, b) => a.tempoMs - b.tempoMs);
}

function salvarPontuacao(largura, altura, nome, tempoMs) {
    const chave = chaveDimensao(largura, altura);
    if (!pontuacoes[chave]) pontuacoes[chave] = [];
    pontuacoes[chave].push({ nome, tempoMs: Math.round(tempoMs) });
    gravarPontuacoes(pontuacoes);
}

function formatarTempo(tempoMs) {
    const minutos = Math.floor(tempoMs / 60000);
    const segundos = Math.floor((tempoMs % 60000) / 1000);
    const decimos = Math.floor((tempoMs % 1000) / 100);
    return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}:${decimos}`;
}

window.Pontuacoes = { dimensoesDisponiveis, chaveDimensao, obterHistorico, salvarPontuacao, formatarTempo };
