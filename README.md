# Endless Maze

Protótipo web independente para jogar no computador e no celular. Não precisa de instalação, conta ou serviço externo.

## Como jogar

- Use as setas ou as teclas W, A, S, D no computador.
- No celular, toque nas setas exibidas na tela.
- Encontre O para atravessar o segmento seguinte. Bater em uma parede encerra a sessão.
- O placar acompanha a profundidade; o tempo fica disponível como critério secundário.

## Executar

Abra o arquivo index.html no navegador. Para servir os arquivos localmente, também é possível executar:

    cd /Users/kaiofer/Downloads/personal/UFABC/TCC/endless_maze
    python3 -m http.server 8000

Depois acesse http://localhost:8000.

## Fases e método

Os dez segmentos iniciais estão em levels.js, como grades simbólicas de 12 × 12. Para acrescentar um, copie um objeto da lista, altere o id, o título e as 12 linhas do mapa. Use somente # (parede), . (caminho), I (entrada) e O (saída).

O jogo valida cada candidato antes de aceitá-lo: dimensões e símbolos, presença única de I e O, lados opostos, compatibilidade com o segmento anterior e conectividade de todas as casas caminháveis por busca em largura (BFS). Depois calcula um hash da representação canônica e rejeita mapas já usados na sessão. O navegador usa SHA-256 quando disponível e um hash local como alternativa.

Depois dos dez mapas salvos, a sessão continua com candidatos de labirinto gerados localmente e submetidos ao mesmo validador e ao controle de repetição. Isso mantém o protótipo simples e jogável; a geração por LLM e sua medição experimental podem ser conectadas como uma fonte alternativa de candidatos, seguindo o fluxo do artigo.

## Artigo de referência

[Generation of Digital Game Environments Using Generative AI](https://www.overleaf.com/read/ywvfkffknxpx#e1f797) — este protótipo aplica ao Endless Maze a representação simbólica, a validação determinística, a geração contínua de segmentos compatíveis e inéditos e a pontuação por profundidade e tempo.
