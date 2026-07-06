# Alcatraz — A Fuga Impossível

Port fiel e continuação do clássico jogo de aventura textual **Alcatraz — A Fuga Impossível**, de Wilson Fazzio Martins (livro *Jogos de Habilidade*, ed. Aleph, 1986), originalmente escrito em MSX BASIC.

Este repositório traz o jogo original preservado e uma sequência inédita — **Alcatraz 2** — cada um disponível em duas formas: para rodar em qualquer navegador (HTML/JavaScript) e para rodar nativamente num MSX real ou emulador (MSX BASIC).

Você é um prisioneiro de Alcatraz e seu objetivo é escapar. O jogo combina a navegação por um labirinto que se revela conforme você explora com um interpretador de comandos em português (`VERBO SUBSTANTIVO`), à moda das aventuras de texto dos anos 80.

## Como jogar

### No navegador
Abra `index.html` — não requer instalação, servidor nem build. Na tela de título é possível escolher entre o **Alcatraz original** e o **Alcatraz 2**.

- **Setas** — mover pelo labirinto
- **Digite** um comando e **Enter** para confirmar (ex.: `PEGUE PA`, `ABRA GRADES COM CHAVE`)
- **Tab** — ver os objetos no local atual
- **Esc** — ver o inventário

Um painel lateral fixo lista, o tempo todo, todos os verbos, substantivos e teclas disponíveis.

### No MSX (real ou emulador)
Os arquivos em [`reference/`](reference/) são MSX BASIC puro, prontos para rodar:

- `ALCATRAZ.BAS` — o jogo original de 1986
- `ALCATRAZ2.BAS` — a sequência

Carregue o `.BAS` (em formato ASCII) num emulador como **webMSX** ou **openMSX** e dê `RUN`. Também é possível gerar um disquete inicializável (veja abaixo).

## O que há de novo

### Um port web fiel ao original
A versão JavaScript reimplementa o motor do BASIC de 1986 com fidelidade de comportamento, não apenas de aparência:

- **Mapa acumulativo**: como no original, a tela nunca é limpa durante a exploração — cada sala visitada revela seu bloco na posição absoluta, e você "desenha" a planta da prisão conforme anda.
- **Gráficos autênticos**: os tiles são desenhados a partir dos mesmos bitmaps e cores do MSX (paleta TMS9918), ampliados com nitidez de pixel.
- **Parser idêntico**: mesma gramática de `VERBO SUBSTANTIVO [preposição] SUBSTANTIVO`, com o vocabulário original — mas agora aceitando também acentuação correta na digitação (`LENÇOL` e `LENCOL` funcionam igual).
- **Textos com acentuação**: todas as mensagens foram reescritas com acentuação em português (o MSX de 1986 não tinha esse recurso), sem alterar a mecânica.

### Alcatraz 2 — A Fuga Ainda Mais Impossível
Uma sequência inédita construída sobre o mesmo motor, com um roteiro totalmente novo:

- Uma **nova prisão**, reativada e modernizada, com sistemas de vigilância, portas eletrônicas e setores reformados para impedir uma segunda fuga.
- Dificuldade que cresce pela **dependência entre objetos** — preparar e combinar equipamentos na ordem certa — e não por comandos obscuros.
- Novos itens, novos mecanismos e novos perigos, com pistas obtidas ao **examinar** os objetos.
- Uma fuga em **dois atos**, com uma mudança de cenário que amplia bastante a extensão do jogo.
- Mantém o tom seco e cruel do original: um passo em falso pode ser fatal.

O roteiro completo (com solução) é mantido fora do repositório, para preservar a experiência.

## Estrutura do projeto

```
alcatraz/
  index.html              # jogo para navegador (ponto de entrada)
  css/                    # estilos
  js/                     # motor: dados, parser, ações, render e estado
  reference/
    ALCATRAZ.BAS          # jogo original em MSX BASIC (1986)
    ALCATRAZ2.BAS         # sequência em MSX BASIC
    AUTOEXEC.BAS          # menu de boot do disquete (escolhe o jogo)
  tools/
    rebuild_dsk.py        # gera um disquete MSX (.DSK) inicializável
  rebuild-dsk.ps1         # atalho para o gerador de disquete
```

## Gerar o disquete MSX (.DSK)

O script [`tools/rebuild_dsk.py`](tools/rebuild_dsk.py) tokeniza os `.BAS` e monta um disquete FAT12 de 720 KB inicializável, com um menu de boot que permite escolher entre o Alcatraz original e o Alcatraz 2.

```powershell
./rebuild-dsk.ps1
```

Requer Python 3. O `.DSK` resultante pode ser montado direto em webMSX/openMSX.

## Créditos

- **Alcatraz — A Fuga Impossível** (1986): Wilson Fazzio Martins, do livro *Jogos de Habilidade* (ed. Aleph).
- Código-fonte original preservado e documentado pelo curso [MarMSX](https://marmsx.msxall.com/cursos/jogos/alcatraz/).
- **Ports HTML/JavaScript e MSX BASIC, e a sequência Alcatraz 2**: Rodrigo G. M. Garcia.
