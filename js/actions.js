// Porta fiel das rotinas de ação do BASIC original (linhas 1620-2980) e da
// lógica dos 14 tiles de perigo (linhas 500-660). Números de linha citados nos
// comentários referem-se a reference/ALCATRAZ.BAS.txt.
// As mensagens abaixo usam acentuação correta (o original não tinha acentos
// por limitação de charset do MSX); a lógica/mecânica é idêntica ao fonte.
'use strict';

function nameOf(idx) { return NOUNS_DISPLAY[idx]; } // nome acentuado, só para exibição

// ctx agrega o estado do jogo e os callbacks de apresentação (msg/gameOver/win/sound),
// implementados em game.js, para manter actions.js livre de DOM/canvas.
function makeActionContext(state, callbacks) {
  return {
    state,
    msg: callbacks.msg,
    gameOver: callbacks.gameOver,
    win: callbacks.win,
    sound: callbacks.sound,
    posCode() { return String.fromCharCode(state.pc + 60) + String.fromCharCode(state.pl + 60); },
    loc(idx) { return state.objLoc[idx]; },
    setLoc(idx, code) { state.objLoc[idx] = code; },
    destroy(idx) { state.objLoc[idx] = '  '; }, // linha 1590: some do jogo
    carried(idx) { return state.objLoc[idx] === '**'; },
    name(idx) { return nameOf(idx); },
    carriedCount() {
      let q = 0;
      for (let n = 0; n < NOUNS.length; n++) if (state.objLoc[n] === '**') q++;
      return q;
    },
    tile() { return state.maze[state.pl - MAZE_ROW_OFFSET][state.pc]; },
    setTile(code) { state.maze[state.pl - MAZE_ROW_OFFSET][state.pc] = code; },
  };
}

function currentScenario(ctx) {
  return ALCATRAZ_SCENARIOS[ctx.state.scenarioId] || ALCATRAZ_SCENARIOS.original;
}

function isAlcatraz2(ctx) {
  return currentScenario(ctx).id === 'alcatraz2';
}

function act(ctx) { return ctx.state.act || 1; }

function isAtAlcatraz2GuardPost(ctx) {
  if (!isAlcatraz2(ctx) || act(ctx) !== 1) return false;
  const pos = ctx.posCode();
  return pos === '@@' || pos === 'A@';
}

function isAtAlcatraz2SentryPost(ctx) {
  if (!isAlcatraz2(ctx) || act(ctx) !== 1) return false;
  const pos = ctx.posCode();
  return pos === 'B@' || pos === 'C@';
}

// Transição para o Ato 2 (descida pela mangueira): troca o mapa, reposiciona
// o jogador e deixa para trás tudo que não estiver sendo carregado. A tela é
// limpa por game.js quando o hazard retorna 'warp'.
function beginAct2(ctx) {
  const st = ctx.state;
  st.act = 2;
  st.maze = ALCATRAZ2_MAZE_ACT2.map((row) => row.slice());
  st.pc = A2_ACT2_START_PC;
  st.pl = A2_ACT2_START_PL;
  for (let n = 0; n < NOUNS.length; n++) {
    if (st.objLoc[n] !== '**') st.objLoc[n] = '  '; // ficou na prisão
  }
  for (const [idx, loc] of Object.entries(ALCATRAZ2_ACT2_NOUN_LOCS)) {
    st.objLoc[Number(idx)] = loc;
  }
}

function isAlcatraz2GuardVisible(ctx) {
  return (isAtAlcatraz2GuardPost(ctx) && ctx.state.x[21] === 0)
    || isAtAlcatraz2SentryPost(ctx);
}

// Alcatraz 2: o guarda tolera UMA investida; insistir é fatal. x[22] conta as
// tentativas contra guardas e é zerado sempre que o jogador anda para outra
// célula (game.js), então só a insistência imediata mata.
function guardBlockOrKill(ctx) {
  ctx.state.x[22] += 1;
  if (ctx.state.x[22] >= 2) {
    ctx.msg('Você insistiu. O guarda perdeu a paciência e atirou.');
    return 'dead';
  }
  ctx.msg('O guarda barrou a passagem e ficou de olho. Insistir seria fatal.');
  return 'block';
}

function replaceMazeDir(ctx, pc, pl, dirIdx, tileChar) {
  const row = ctx.state.maze[pl - MAZE_ROW_OFFSET];
  if (!row || !row[pc]) return;
  const code = row[pc];
  row[pc] = code.slice(0, dirIdx) + tileChar + code.slice(dirIdx + 1);
}

function setPassage(ctx, pc, pl, dir, tileChar) {
  const dirs = {
    north: { idx: 0, dx: 0, dy: -1, opposite: 1 },
    south: { idx: 1, dx: 0, dy: 1, opposite: 0 },
    east: { idx: 2, dx: 1, dy: 0, opposite: 3 },
    west: { idx: 3, dx: -1, dy: 0, opposite: 2 },
  };
  const info = dirs[dir];
  if (!info) return;
  replaceMazeDir(ctx, pc, pl, info.idx, tileChar);
  replaceMazeDir(ctx, pc + info.dx, pl + info.dy, info.opposite, tileChar);
}

// ---- Handlers compartilhados por mais de uma ação (mesmos alvos de GOSUB) ----

// 1620: objeto já está rasgado/cortado - rejeitado
function h1620(ctx) {
  ctx.msg('Mais do que já estão?');
}

// 1630: rasga/corta corda ou lençol -> vira tiras, zera flags de corda amarrada
function h1630(ctx, J) {
  ctx.msg('Está bem. Ficou em tiras.');
  ctx.state.x[1] = 0;
  ctx.state.x[0] = 0;
  ctx.setLoc(N_TIRAS, '**');
  ctx.destroy(J);
}

// 1660: rasga jornal/cobertor/baralho - aceito, sem muita utilidade
function h1660(ctx, J) {
  ctx.msg('Ok, não parecia ser muito útil mesmo...');
  ctx.destroy(J);
}

// 1700: amarra/coloca corda no poço - prepara a fuga final
function h1700(ctx, J) {
  ctx.msg('Ok, e ela vai até o fundo.');
  ctx.state.x[0] = 1;
  ctx.setLoc(J, ctx.posCode());
}

// 2960/2970: confirmação genérica + som de sucesso
function h2960(ctx) {
  ctx.msg('Ok...');
  ctx.sound('ok');
}

const HANDLERS = {
  // ---- RASGUE (tear) ----
  1620: h1620,
  1630: h1630,
  1650(ctx, J) { ctx.msg('Ok, mas é um desperdício.'); ctx.destroy(J); }, // RASGUE DINHEIRO
  1660: h1660,
  1670(ctx, J) { ctx.msg('Ok, mas não sei porque fez isso.'); ctx.destroy(J); }, // RASGUE ROUPA

  // ---- AMARRE (tie) ----
  1680(ctx, J) { // AMARRE TIRAS -> vira corda
    ctx.msg(`As ${nameOf(J).toLowerCase()} transformaram-se numa ${ctx.name(N_CORDA).toLowerCase()}!`);
    ctx.setLoc(N_CORDA, '**');
    ctx.destroy(J);
  },
  1700: h1700, // AMARRE/COLOQUE CORDA NO POCO
  1720(ctx, J, I) { ctx.msg(`Não dá, a ${ctx.name(I).toLowerCase()} é de alvenaria.`); }, // AMARRE CORDA NA CAMA
  1730(ctx) { ctx.msg('Ok...'); }, // AMARRE CORDA NAS GRADES

  // ---- PUXE (pull) ----
  1740(ctx) { // PUXE CORDA
    if (ctx.state.x[1] === 0 || ctx.posCode() !== 'CC') { ctx.msg('Nada ocorreu.'); return; }
    ctx.msg('A chave veio junto com ela!');
    ctx.setLoc(N_CHAVE, '**');
  },

  // ---- COMA (eat) ----
  1770(ctx, J) { ctx.msg('Não estava boa... Talvez sem tempero.'); ctx.destroy(J); }, // COMIDA
  1790(ctx) { ctx.msg('Você é doente? Necessita de um psiquiatra? Não vou fazê-lo.'); }, // OSSO

  // ---- COLOQUE (place) ----
  1800(ctx, J) { ctx.msg('Ficou muito arrumada...'); ctx.setLoc(J, ctx.posCode()); }, // LENCOL NA CAMA
  1820(ctx, J) { ctx.msg('Ok. Acho que agora vai funcionar.'); ctx.state.x[2] = 1; ctx.destroy(J); }, // PILHA NA LANTERNA
  1840(ctx, J) { ctx.msg('Encaixou perfeitamente.'); ctx.state.x[3] = 1; ctx.destroy(J); }, // PILHA NO GRAVADOR
  1860(ctx, J) { // JORNAL NA PORTA
    const p = ctx.posCode();
    if (p !== '?F' && p !== 'B@') { ctx.msg('Não vejo nenhuma porta.'); return; }
    if (p === 'B@') { ctx.msg('Não há espaço para colocá-lo.'); return; }
    ctx.state.x[4] = 1;
    ctx.msg('Coube sob ela.');
    ctx.setLoc(J, p);
  },
  1890(ctx, J, I) { // COBERTOR NO FOGO - apaga o fogo
    ctx.msg('Ele o abafou!');
    ctx.setLoc(J, ctx.posCode());
    ctx.setLoc(I, 'JJ');
    ctx.setTile('0000');
    ctx.sound('unlock');
  },
  1910(ctx) { // AGUA NO FOGO - morte por asfixia
    ctx.sound('death');
    ctx.msg('O local ficou cheio de fumaça e você morreu asfixiado!');
    ctx.gameOver();
  },
  1930(ctx, J) { ctx.msg('Ok...'); ctx.state.x[5] = 1; ctx.destroy(J); }, // FITA NO GRAVADOR
  1940(ctx, J, I) { // ESPELHO NA LUZ - desativa alarme de feixe de luz
    ctx.sound('zap');
    ctx.msg('Você conseguiu! Desativou o alarme!');
    ctx.setTile('1000');
    ctx.setLoc(I, 'JJ');
    ctx.destroy(J);
  },
  1970(ctx) { ctx.msg('Agora ela está pronta para funcionar.'); ctx.state.x[6] = 1; }, // SERRA NA TOMADA
  1990(ctx, J, I) { // AGUA NO ALARME - curto-circuito
    ctx.sound('zap');
    ctx.msg('Entrou em curto!');
    ctx.setTile('0011');
    ctx.setLoc(I, 'JJ');
    ctx.destroy(J);
    ctx.sound('ok');
  },

  // ---- LIGUE (turn on) ----
  2010(ctx) { // LANTERNA
    if (ctx.state.x[2] === 0) { ctx.msg('Não funciona...'); return; }
    ctx.msg('Está acesa.'); ctx.state.x[7] = 1;
  },
  2030(ctx) { // SERRA
    if (ctx.state.x[6] === 0) { ctx.msg('Não quer ligar...'); return; }
    ctx.msg('Está ligada.'); ctx.state.x[8] = 1; ctx.sound('ok');
  },
  2060(ctx) { // GRAVADOR
    if (ctx.state.x[3] === 0) { ctx.msg('Acho que está quebrado... Não funciona de modo algum.'); return; }
    if (ctx.state.x[5] === 0) { ctx.msg('Falta alguma coisa para se ouvir algo no gravador...'); return; }
    ctx.msg('Toca uma música suave... Dá vontade de dormir...');
    ctx.state.x[9] = 1;
  },

  // ---- CORTE (cut) ----
  // 86 (CORTE LENCOL) e 84 (CORTE CORDA) -> h1630; 83 (CORTE TIRAS) -> h1620
  2100(ctx, J) { // CORTE PORTA COM SERRA
    const p = ctx.posCode();
    if (p !== 'B@' && p !== '?F') { ctx.msg('Onde está a porta?'); return; }
    if (p === '?F' || ctx.state.x[8] === 0 || ctx.state.x[6] === 0) { ctx.msg('Ela está desligada.'); return; }
    ctx.sound('zap');
    ctx.msg(`A ${ctx.name(J).toLowerCase()} caiu em pedaços.`);
    ctx.setTile('0011');
  },

  // ---- TIRE (remove) ----
  2160(ctx) { ctx.msg('Ok...'); ctx.state.x[6] = 0; }, // SERRA DA TOMADA
  2170(ctx, J) { ctx.msg('Está fora.'); ctx.state.x[2] = 0; ctx.state.x[7] = 0; ctx.setLoc(J, '**'); }, // PILHA DA LANTERNA
  2180(ctx, J) { ctx.msg('Ok...'); ctx.state.x[5] = 0; ctx.state.x[9] = 0; ctx.setLoc(J, '**'); }, // FITA DO GRAVADOR
  2190(ctx, J) { ctx.msg('Ok... Mas o que você vai fazer com ela?'); ctx.state.x[3] = 0; ctx.state.x[9] = 0; ctx.setLoc(J, '**'); }, // PILHA DO GRAVADOR

  // ---- CAVE (dig) ----
  2200(ctx, J) {
    ctx.sound('zap');
    ctx.msg('Um buraco foi aberto.');
    ctx.setTile('0010');
    ctx.destroy(J);
  },

  // ---- DISPARE (fire) ----
  2960: h2960,

  // ---- VISTA (wear) ----
  2230(ctx) { ctx.msg('Está no corpo. Tem um caimento perfeito!'); },

  // ---- ENTRE (enter) ----
  2240(ctx) { // ENTRE POCO - final do jogo (vitória ou morte)
    if (ctx.state.x[0] === 0) {
      ctx.msg('Você foi direto para o fundo. Morte instantânea...');
      ctx.gameOver();
      return;
    }
    ctx.win();
  },

  // ---- BEBA (drink) ----
  2260(ctx) { ctx.msg('Não era pura! Você morreu contaminado.'); ctx.gameOver(); }, // AGUA
  2270(ctx) { ctx.msg('Você ficou bêbado e entregou-se. Você não tem inteligência alguma.'); ctx.gameOver(); }, // BEBIDA

  // ---- ABRA (open) ----
  2280(ctx) { // GRADES COM CHAVE
    const p = ctx.posCode();
    if (p === 'CC') { ctx.msg('Abriu!'); ctx.setTile('1100'); ctx.sound('unlock'); return; }
    if (p === 'EB') { ctx.msg('Abriu de novo!'); ctx.setTile('0610'); ctx.sound('unlock'); return; }
    ctx.msg('Não estou vendo grades.');
  },
  2310(ctx) { // PORTA
    const p = ctx.posCode();
    if (p === 'B@' || p === '?F') { ctx.msg('Está trancada.'); return; }
    ctx.msg('Não há nenhuma porta por perto.');
  },

  // ---- PECA (pedir um favor) ----
  2330(ctx, J, I) {
    if (I === -1) { ctx.msg('A quem?'); return; }
    if (I !== N_GUARDA && I !== N_PRESIDIARIO && I !== N_CARCEREIRO) {
      ctx.msg('Você está louco? Por que não fala com pessoas?'); return;
    }
    if (!(J === N_COMIDA && I === N_GUARDA && ctx.posCode() === 'CC')) {
      ctx.msg('Ouviu o que disse mas nada fez.'); return;
    }
    ctx.msg('Ele satisfez seu pedido e saiu, deixando a chave lá fora...');
    ctx.setLoc(I, 'CD');
    ctx.setLoc(J, ctx.posCode());
  },

  // ---- JOGUE (throw) ----
  2370(ctx, J, I) {
    if (J === N_AGUA && I === N_ALARME) { HANDLERS[1990](ctx, J, I); return; }
    if (J === N_AGUA && I === N_FOGO) { HANDLERS[1910](ctx, J, I); return; }
    if (J === N_COBERTOR && I === N_FOGO) { HANDLERS[1890](ctx, J, I); return; }
    if (J === N_CORDA && I === N_POCO) { HANDLERS[1700](ctx, J, I); return; }
    if (J < 22 && J !== N_CORDA) { ctx.msg('Você perdeu o objeto.'); ctx.destroy(J); return; }
    if (J > 21) { ctx.msg('Você não é tão forte assim...'); return; }
    if (ctx.posCode() !== 'CC') { ctx.msg('Nada aconteceu...'); return; }
    if (ctx.loc(N_GUARDA) === 'CD') {
      ctx.msg('Encostou num objeto lá fora. Não dá para ver o que é.');
      ctx.state.x[1] = 1;
      return;
    }
    ctx.msg('Nada aconteceu, ainda...');
  },

  // ---- QUEIME (burn) ----
  2450(ctx, J, I) {
    if (I !== N_FOSFOROS) { ctx.msg('Com o quê?!'); return; }
    if (J > 21) { ctx.msg('Não dá para fazê-lo.'); return; }
    if (J === N_JORNAL && ctx.state.x[4] === 1) {
      ctx.sound('zap');
      ctx.msg('O fogo abriu uma passagem!');
      ctx.setTile('0011');
      return;
    }
    ctx.msg('Se desfez em cinzas...');
    ctx.destroy(J);
  },

  // ---- PEGUE (take) ----
  2520(ctx, J) {
    const scenario = currentScenario(ctx);
    const canTake = J <= 21 || scenario.takeableNouns.includes(J);
    if (!canTake) { ctx.msg('Não dá.'); return; }
    // Maximo de itens carregados. No Alcatraz 2 e' 7: e' o que cabe nas 3
    // linhas da area de texto no pior caso (nomes longos como RESPIRADOR) e
    // ainda deixa folga sobre o pico do caminho critico (~5 simultaneos).
    // O original mantem o limite do BASIC de 1986 (6). carriedCount() conta
    // ANTES de pegar, entao comparamos com (max-1).
    const maxItems = isAlcatraz2(ctx) ? 7 : 6;
    if (ctx.carriedCount() > maxItems - 1) {
      ctx.msg(isAlcatraz2(ctx)
        ? 'Suas mãos e bolsos estão cheios. Largue algo antes de pegar mais.'
        : 'Não dá para pegar mais nada.');
      return;
    }
    if (ctx.carried(J)) { ctx.msg('Você já está carregando este objeto.'); return; }
    ctx.setLoc(J, '**');
    ctx.msg('Ok.');
    if (J === N_CORDA) ctx.state.x[0] = 0;
    ctx.state.x[4] = 0; // original: "IF J+10 THEN X(4)=0" é sempre verdadeiro (J>=0), replicado fielmente
  },

  // ---- SOLTE (drop) ----
  2610(ctx, J) {
    if (!ctx.carried(J)) { ctx.msg(`Você não carrega ${ctx.name(J).toLowerCase()}.`); return; }
    ctx.msg('Está no chão.');
    ctx.setLoc(J, ctx.posCode());
  },

  // ---- DE (give) ----
  2650(ctx, J, I) {
    if (I !== N_GUARDA && I !== N_PRESIDIARIO && I !== N_CARCEREIRO && I !== N_CAES) {
      ctx.msg('Acho que a prisão afetou seu QI.'); return;
    }
    if (J === N_OSSO && I === N_CAES) {
      ctx.msg('Os cães devoraram seu braço. Assim fica impossível a fuga.');
      ctx.gameOver(); return;
    }
    if (J === N_COMIDA && I === N_PRESIDIARIO) {
      ctx.msg('Ele aceitou e deu dinheiro em troca a você!');
      ctx.setLoc(N_DINHEIRO, '**');
      ctx.destroy(J); return;
    }
    if (J === N_DINHEIRO && I === N_GUARDA) {
      ctx.msg('Ele aceitou e deixou você passar.');
      ctx.setLoc(N_DINHEIRO, 'IG');
      ctx.setLoc(N_GUARDA, 'JJ');
      ctx.setTile('1040');
      ctx.sound('unlock'); return;
    }
    if (J === N_DINHEIRO && I === N_CARCEREIRO) {
      ctx.msg('Ele não era subornável. Você foi morto.');
      ctx.gameOver(); return;
    }
    if (J === N_BARALHO && I === N_CARCEREIRO) {
      ctx.msg('Ele aceitou e foi embora!');
      ctx.setTile('1001');
      ctx.sound('unlock');
      ctx.destroy(J); return;
    }
    if (!ctx.carried(J)) { ctx.msg('Mas você não carrega esse objeto!'); return; }
    ctx.msg('Ele aceitou, mas nada aconteceu.');
    ctx.destroy(J);
  },

  // ---- MATE (kill) ----
  2740(ctx, J) {
    if (J !== N_GUARDA && J !== N_PRESIDIARIO && J !== N_CARCEREIRO && J !== N_CAES) {
      ctx.msg('Seu lugar não é aqui, é no manicômio.'); return;
    }
    ctx.msg('Você foi morto antes que pudesse fazer algo.');
    ctx.gameOver();
  },

  // ---- EXAMINE ----
  2760(ctx, J) {
    switch (J) {
      case N_SERRA: ctx.msg('É elétrica e muito potente.'); return;
      case N_PILHA: ctx.msg('É de 1,5 V.'); return;
      case N_FOSFOROS: ctx.msg('A caixa está cheia.'); return;
      case N_COBERTOR: ctx.msg('É bem grosso.'); return;
      case N_FITA: ctx.msg('É uma fita de música.'); return;
      case N_GRAVADOR: ctx.msg('É de fitas cassete.'); return;
      case N_ROUPA: ctx.msg('É de borracha.'); return;
      case N_BEBIDA: ctx.msg('É pinga, e das boas!'); return;
      case N_CAMA: ctx.msg('É feita de tijolos.'); return;
      case N_GRADES: ctx.msg('São de aço muito resistente.'); return;
      case N_TOMADA: ctx.msg('É de 110V.'); return;
      case N_FOGO: ctx.msg('Você se queimou! Não devia examiná-lo!'); ctx.gameOver(); return;
      case N_POCO: ctx.msg('É muito fundo. Não dá para ver seu final.'); return;
      case N_CAES: ctx.msg('São cães policiais.'); return;
      case N_GUARDA: case N_PRESIDIARIO: case N_CARCEREIRO:
        ctx.msg('Você foi morto... Ele não gosta de ser examinado.');
        ctx.gameOver(); return;
      // ---- Alcatraz 2: exames dão pistas dos mecanismos (e dos perigos) ----
      case N_ARAME: ctx.msg('Fino e flexível. Pode servir como arma sorrateira.'); return;
      case N_FRAGMENTO: ctx.msg('Uma lasca de metal com um lado afiado.'); return;
      case N_CINTA: ctx.msg('Uma cinta de lona firme. Daria um bom cabo.'); return;
      case N_FACA: ctx.msg('Improvisada, mas letal em mãos decididas.'); return;
      case N_UNIFORME: ctx.msg('Um uniforme da ronda, quase do seu tamanho.'); return;
      case N_CARTAO:
        ctx.msg(ctx.state.x[11] === 1
          ? 'A credencial clonada pisca em verde.'
          : 'Um cartão de acesso comum, sem credencial gravada.');
        return;
      case N_CHIP: ctx.msg('Um chip gravador de credenciais, da sala de clonagem.'); return;
      case N_INIBIDOR:
        ctx.msg(ctx.state.x[12] === 1
          ? 'O inibidor está com carga. Falta só mantê-lo ligado.'
          : 'Um bloqueador de sensores. O compartimento da pilha está vazio.');
        return;
      case N_ALICATE: ctx.msg('Um alicate de corte reforçado, de manutenção.'); return;
      case N_PLANTA: ctx.msg('A planta mostra um duto descendo ao pátio das bombas e uma galeria inundada guardando equipamento.'); return;
      case N_DUTO: ctx.msg('Um duto de manutenção estreito. Parece dar passagem para fora do bloco.'); return;
      case N_RESPIRADOR: ctx.msg('Um respirador de mergulho industrial. O visor está gasto, mas veda bem.'); return;
      case N_FUSIVEL: ctx.msg('Um fusível industrial de alta corrente.'); return;
      case N_PAINEL:
        ctx.msg(ctx.state.x[16] === 1
          ? 'O circuito está fechado. O portão ao lado perdeu a energia.'
          : 'O soquete do fusível está vazio. O portão ao lado zumbe, eletrificado.');
        return;
      case N_MANIVELA: ctx.msg('Encaixa em algum mecanismo hidráulico próximo.'); return;
      case N_GANCHO: ctx.msg('Longo o bastante para alcançar travas altas.'); return;
      case N_ESCOTILHA: ctx.msg('A trava fica no alto, fora do alcance das mãos.'); return;
      case N_ISOLANTE: ctx.msg('Uma manta de borracha isolante.'); return;
      case N_FIO: ctx.msg('Está desencapado e vibra com a corrente. Não encoste sem isolamento.'); return;
      case N_ANTENA: ctx.msg('Uma antena dobrável de rádio de serviço.'); return;
      case N_RADIO:
        ctx.msg(ctx.state.x[19] === 1
          ? 'Com a antena, ele alcança a frequência da manutenção.'
          : 'O rádio de serviço está sem antena.');
        return;
      // ---- Ato 2 ----
      case N_MANGUEIRA: ctx.msg('Uma mangueira de incêndio comprida. Aguentaria seu peso.'); return;
      case N_MASTRO: ctx.msg('O mastro do rádio é firme, cravado na laje. Um bom ponto de ancoragem.'); return;
      case N_PEDRA: ctx.msg('Um seixo pesado, do tamanho do punho. Bom para um arremesso.'); return;
      case N_HOLOFOTE: ctx.msg('Gira no alto da torre, varrendo o costão em ciclos. Um arremesso certeiro o apagaria.'); return;
      case N_TABUA: ctx.msg('Uma tábua de destroços, comprida e firme.'); return;
      case N_FENDA: ctx.msg('Funda demais para saltar. Precisaria de algo que a atravesse.'); return;
      case N_REDE: ctx.msg('Uma rede de pesca pesada, com chumbadas nas bordas.'); return;
      case N_LANCHA: ctx.msg('A lancha de serviço, atracada de motor ligado. O piloto espera a equipe de manutenção.'); return;
      case N_MAR: ctx.msg('Gelado e traiçoeiro. Ninguém escapa de Alcatraz a nado.'); return;
      default: ctx.msg('É comum.'); return;
    }
  },

  // ---- AMEACE (threaten) ----
  2920(ctx, J) {
    if (J !== N_GUARDA && J !== N_PRESIDIARIO && J !== N_CARCEREIRO && J !== N_CAES) {
      ctx.msg('Só uma pessoa com sua mentalidade diria tal coisa.'); return;
    }
    ctx.msg('Você foi morto. Ele não gosta de ameaças.');
    ctx.gameOver();
  },

  // ---- QUEBRE (break) ----
  2940(ctx, J) {
    if (J < 22) { ctx.msg('Ok... Está feito...'); ctx.destroy(J); return; }
    ctx.msg('Não dá.');
  },

  // ---- ALCATRAZ 2 ----
  3100(ctx) { // VISTA UNIFORME
    if (!isAlcatraz2(ctx)) { ctx.msg('Isto não parece ajudar aqui.'); return; }
    ctx.state.x[10] = 1;
    ctx.setLoc(N_UNIFORME, '**');
    ctx.msg('O uniforme serve. De longe, você parece parte da ronda.');
  },
  3110(ctx) { // COLOQUE CHIP NO CARTAO
    if (!ctx.carried(N_CARTAO) || !ctx.carried(N_CHIP)) {
      ctx.msg('Você precisa carregar o cartão e o chip.');
      return;
    }
    ctx.state.x[11] = 1;
    ctx.destroy(N_CHIP);
    ctx.msg('O chip regravou o cartão. Agora ele imita uma credencial de serviço.');
    ctx.sound('unlock');
  },
  3120(ctx) { // COLOQUE PILHA NO INIBIDOR
    if (!ctx.carried(N_INIBIDOR) || !ctx.carried(N_PILHA)) {
      ctx.msg('Você precisa carregar a pilha e o inibidor.');
      return;
    }
    ctx.state.x[12] = 1;
    ctx.destroy(N_PILHA);
    ctx.msg('A pilha encaixou. O inibidor agora pode ser ligado.');
  },
  3130(ctx) { // LIGUE INIBIDOR
    if (ctx.state.x[12] === 0) { ctx.msg('Ele não tem energia.'); return; }
    ctx.state.x[13] = 1;
    ctx.msg('O inibidor começou a emitir um chiado baixo.');
    ctx.sound('ok');
  },
  3140(ctx) { // ABRA PORTA COM CARTAO
    if (!isAlcatraz2(ctx)) { ctx.msg('O cartão não pertence a esta prisão.'); return; }
    if (!ctx.carried(N_CARTAO)) { ctx.msg('Você não carrega o cartão.'); return; }
    if (ctx.state.x[11] === 0) { ctx.msg('O leitor recusou o cartão comum.'); return; }
    if (ctx.posCode() !== 'A@') { ctx.msg('Não há leitor magnético aqui.'); return; }
    setPassage(ctx, 5, 4, 'east', '0');
    ctx.msg('A porta magnética destravou.');
    ctx.sound('unlock');
  },
  3150(ctx) { // CORTE GRADES COM ALICATE
    if (!isAlcatraz2(ctx)) { ctx.msg('Estas grades não cedem desse jeito.'); return; }
    if (!ctx.carried(N_ALICATE)) { ctx.msg('Você não carrega o alicate.'); return; }
    if (ctx.posCode() !== 'GD') { ctx.msg('As grades daqui não são o ponto fraco.'); return; }
    setPassage(ctx, 11, 8, 'east', '0');
    ctx.msg('O alicate abriu um vão estreito nas grades.');
    ctx.sound('unlock');
  },
  3250(ctx) { // AMARRE FRAGMENTO COM CINTA
    if (!isAlcatraz2(ctx)) { ctx.msg('Nada útil saiu disso.'); return; }
    if (!ctx.carried(N_FRAGMENTO) || !ctx.carried(N_CINTA)) {
      ctx.msg('Você precisa carregar o fragmento e a cinta.');
      return;
    }
    ctx.destroy(N_FRAGMENTO);
    ctx.destroy(N_CINTA);
    ctx.setLoc(N_FACA, '**');
    ctx.msg('Você improvisou uma faca curta.');
    ctx.sound('ok');
  },
  3240(ctx) { // MATE GUARDA COM ARAME
    if (!isAtAlcatraz2GuardPost(ctx)) {
      if (isAtAlcatraz2SentryPost(ctx)) {
        ctx.sound('death');
        ctx.msg('O guarda reagiu antes que você pudesse agir. Você foi morto.');
        ctx.gameOver();
        return;
      }
      ctx.msg('Não há como fazer isso daqui.');
      return;
    }
    if (ctx.state.x[21] === 1) {
      ctx.msg('O posto já está vazio.');
      return;
    }
    if (!ctx.carried(N_ARAME)) {
      ctx.msg('Você não carrega o arame.');
      return;
    }
    ctx.sound('death');
    ctx.msg('O arame falhou. O guarda reagiu, a luta chamou a ronda e você morreu.');
    ctx.gameOver();
  },
  3260(ctx) { // MATE GUARDA COM FACA
    if (!isAtAlcatraz2GuardPost(ctx)) {
      if (isAtAlcatraz2SentryPost(ctx)) {
        ctx.sound('death');
        ctx.msg('O guarda reagiu antes que você pudesse agir. Você foi morto.');
        ctx.gameOver();
        return;
      }
      ctx.msg('Não há como fazer isso daqui.');
      return;
    }
    if (ctx.state.x[21] === 1) {
      ctx.msg('O posto já está vazio.');
      return;
    }
    if (!ctx.carried(N_FACA)) {
      ctx.msg('Você não carrega a faca.');
      return;
    }
    ctx.state.x[21] = 1;
    ctx.destroy(N_FACA);
    ctx.setLoc(N_UNIFORME, ctx.posCode());
    ctx.setLoc(N_CARTAO, ctx.posCode());
    ctx.setLoc(N_CHIP, ctx.posCode());
    setPassage(ctx, 4, 4, 'east', '0');
    ctx.msg('O ataque foi brutal e silencioso. O guarda caiu antes de acionar o alarme.');
    ctx.sound('unlock');
  },
  3160(ctx) { // ENTRE DUTO
    if (!isAlcatraz2(ctx) || ctx.posCode() !== 'IG') {
      ctx.msg('Não há duto acessível aqui.');
      return;
    }
    ctx.state.x[15] = 1;
    ctx.state.pc = 0;
    ctx.state.pl = 11;
    ctx.msg('O duto termina em outra ala. O caminho anterior continua marcado na sua memória.');
    ctx.sound('unlock');
  },
  3170(ctx) { // VISTA RESPIRADOR
    if (!isAlcatraz2(ctx)) { ctx.msg('Isto não parece ajudar aqui.'); return; }
    ctx.state.x[14] = 1;
    ctx.setLoc(N_RESPIRADOR, '**');
    ctx.msg('O respirador está vedado. Seu fôlego agora depende dele.');
  },
  3180(ctx) { // COLOQUE FUSIVEL NO PAINEL
    if (!isAlcatraz2(ctx)) { ctx.msg('O painel não responde.'); return; }
    if (ctx.posCode() !== '>F') { ctx.msg('Não há painel aberto aqui.'); return; }
    if (!ctx.carried(N_FUSIVEL)) { ctx.msg('Você não carrega o fusível.'); return; }
    ctx.state.x[16] = 1;
    ctx.destroy(N_FUSIVEL);
    setPassage(ctx, 2, 10, 'east', 'M');
    ctx.msg('O fusível fechou o circuito e o portão perdeu força.');
    ctx.sound('zap');
  },
  3190(ctx) { // PUXE MANIVELA
    if (!isAlcatraz2(ctx)) { ctx.msg('Nada ocorreu.'); return; }
    if (ctx.posCode() !== '?F' && ctx.posCode() !== '?E') {
      ctx.msg('Ela não aciona nada daqui.');
      return;
    }
    if (!ctx.carried(N_MANIVELA)) { ctx.msg('Você não carrega a manivela.'); return; }
    ctx.state.x[17] = 1;
    ctx.destroy(N_MANIVELA);
    setPassage(ctx, 3, 9, 'east', 'M');
    ctx.msg('A manivela rangeu. Uma comporta distante abriu caminho.');
    ctx.sound('unlock');
  },
  3195(ctx) { // ABRA ESCOTILHA (sem instrumento): dica
    if (!isAlcatraz2(ctx) || ctx.posCode() !== 'AE') {
      ctx.msg('Não há escotilha alcançável aqui.');
      return;
    }
    ctx.msg('A trava fica no alto, longe das mãos. Com algo comprido, talvez...');
  },
  3200(ctx) { // ABRA ESCOTILHA COM GANCHO
    if (!isAlcatraz2(ctx) || ctx.posCode() !== 'AE') {
      ctx.msg('Não há escotilha alcançável aqui.');
      return;
    }
    if (!ctx.carried(N_GANCHO)) { ctx.msg('Você não carrega o gancho.'); return; }
    ctx.state.x[20] = 1;
    ctx.state.pc = 6;
    ctx.state.pl = 9;
    ctx.msg('O gancho alcançou a trava. A escotilha abriu para uma área técnica no alto da prisão.');
    ctx.sound('unlock');
  },
  3210(ctx) { // COLOQUE ISOLANTE NO FIO
    if (!isAlcatraz2(ctx)) { ctx.msg('Isto não parece ajudar aqui.'); return; }
    if (ctx.posCode() !== 'CE') { ctx.msg('Não há fio exposto aqui.'); return; }
    if (!ctx.carried(N_ISOLANTE)) { ctx.msg('Você não carrega o isolante.'); return; }
    ctx.state.x[18] = 1;
    ctx.destroy(N_ISOLANTE);
    setPassage(ctx, 7, 9, 'east', 'O');
    ctx.msg('O isolante cobriu o fio energizado. Agora dá para passar.');
    ctx.sound('zap');
  },
  3220(ctx) { // COLOQUE ANTENA NO RADIO
    if (!isAlcatraz2(ctx)) { ctx.msg('Isto não parece ajudar aqui.'); return; }
    if (ctx.posCode() !== 'EG') { ctx.msg('O rádio não está aqui.'); return; }
    if (!ctx.carried(N_ANTENA)) { ctx.msg('Você não carrega a antena.'); return; }
    ctx.state.x[19] = 1;
    ctx.destroy(N_ANTENA);
    ctx.msg('A antena encaixou. O rádio finalmente consegue buscar sinal.');
    ctx.sound('ok');
  },
  3230(ctx) { // LIGUE RADIO - transmite o chamado falso (não encerra o jogo)
    if (!isAlcatraz2(ctx) || act(ctx) !== 1 || ctx.posCode() !== 'EG') {
      ctx.msg('Não há rádio operacional aqui.');
      return;
    }
    if (ctx.state.x[19] === 0) { ctx.msg('Só há estática. Falta alguma peça.'); return; }
    if (ctx.state.x[23] === 1) { ctx.msg('O chamado já foi feito. A lancha está a caminho do cais externo.'); return; }
    ctx.state.x[23] = 1;
    ctx.msg('O rádio transmitiu um falso chamado de manutenção. Uma lancha de serviço está a caminho do cais externo. Agora é preciso descer até lá.');
    ctx.sound('ok');
  },

  // ---- ATO 2: descida, costão e cais ----
  3300(ctx) { // AMARRE MANGUEIRA NO MASTRO
    if (!isAlcatraz2(ctx) || act(ctx) !== 1 || ctx.posCode() !== 'EG') {
      ctx.msg('Não há onde firmar a mangueira aqui.');
      return;
    }
    if (!ctx.carried(N_MANGUEIRA)) { ctx.msg('Você não carrega a mangueira.'); return; }
    ctx.destroy(N_MANGUEIRA);
    setPassage(ctx, 9, 11, 'south', 'V');
    ctx.msg('Você amarrou a mangueira no mastro e jogou a ponta pela borda sul. Ela balança contra a face externa do prédio.');
    ctx.sound('unlock');
  },
  3310(ctx) { // JOGUE PEDRA NO HOLOFOTE
    if (!isAlcatraz2(ctx) || act(ctx) !== 2) { ctx.msg('Não há holofote ao alcance.'); return; }
    if (ctx.posCode() !== '@@') { ctx.msg('Daqui o arremesso não alcança o holofote.'); return; }
    if (!ctx.carried(N_PEDRA)) { ctx.msg('Você não carrega a pedra.'); return; }
    ctx.destroy(N_PEDRA);
    setPassage(ctx, 4, 4, 'south', 'P');
    ctx.msg('O arremesso estilhaçou o holofote. O costão mergulhou no escuro.');
    ctx.sound('zap');
  },
  3340(ctx) { // JOGUE PEDRA NO GUARDA - falsa solução mortal
    if (!isAlcatraz2(ctx) || act(ctx) !== 2 || ctx.posCode() !== 'GF') {
      ctx.msg('Não há guarda ao alcance de um arremesso.');
      return;
    }
    if (!ctx.carried(N_PEDRA)) { ctx.msg('Você não carrega a pedra.'); return; }
    ctx.sound('death');
    ctx.msg('Ele desviou da pedra. O tiro veio em seguida.');
    ctx.gameOver();
  },
  3330(ctx) { // JOGUE REDE NO GUARDA - remove o guarda do píer
    if (!isAlcatraz2(ctx) || act(ctx) !== 2 || ctx.posCode() !== 'GF') {
      ctx.msg('Não há guarda ao alcance da rede.');
      return;
    }
    if (!ctx.carried(N_REDE)) { ctx.msg('Você não carrega a rede.'); return; }
    ctx.destroy(N_REDE);
    ctx.setLoc(N_GUARDA, '  ');
    setPassage(ctx, 11, 10, 'east', 'R');
    ctx.msg('A rede o envolveu com as chumbadas. Ele se debateu e despencou no mar escuro.');
    ctx.sound('unlock');
  },
  3320(ctx) { // COLOQUE TABUA NA FENDA
    if (!isAlcatraz2(ctx) || act(ctx) !== 2 || ctx.posCode() !== 'BB') {
      ctx.msg('Não há fenda para vencer aqui.');
      return;
    }
    if (!ctx.carried(N_TABUA)) { ctx.msg('Você não carrega a tábua.'); return; }
    ctx.destroy(N_TABUA);
    setPassage(ctx, 6, 6, 'east', 'R');
    ctx.msg('A tábua assentou firme sobre a fenda.');
    ctx.sound('ok');
  },
  3350(ctx) { // ENTRE LANCHA - final do jogo
    if (!isAlcatraz2(ctx) || act(ctx) !== 2 || ctx.posCode() !== 'HG') {
      ctx.msg('Não há lancha para abordar aqui.');
      return;
    }
    if (ctx.state.x[10] !== 1) {
      ctx.msg('O piloto reconheceu as roupas de presidiário e deu o alarme. Você foi capturado no cais.');
      ctx.gameOver();
      return;
    }
    ctx.msg('O piloto, enganado pelo chamado falso e pelo uniforme, deu partida sem perguntas.');
    ctx.win();
  },
};

// Mapa índice-de-ação -> handler. Os primeiros índices replicam as tabelas
// ON...GOSUB do BASIC original; os extras pertencem ao Alcatraz 2.
const ACTION_HANDLERS = [
  HANDLERS[1620], HANDLERS[1630], HANDLERS[1630], HANDLERS[1650], HANDLERS[1660],
  HANDLERS[1660], HANDLERS[1660], HANDLERS[1670], HANDLERS[1680], HANDLERS[1700],
  HANDLERS[1720], HANDLERS[1730], HANDLERS[1740], HANDLERS[1770], HANDLERS[1790],
  HANDLERS[1700], HANDLERS[1800], HANDLERS[1820], HANDLERS[1840], HANDLERS[1860],
  HANDLERS[1890], HANDLERS[1910], HANDLERS[1930], HANDLERS[1940], HANDLERS[1970],
  HANDLERS[1990], HANDLERS[2010], HANDLERS[2030], HANDLERS[2060], HANDLERS[1630],
  HANDLERS[1630], HANDLERS[1620], HANDLERS[2100], HANDLERS[2160], HANDLERS[2170],
  HANDLERS[2180], HANDLERS[2190], HANDLERS[2200], HANDLERS[2960], HANDLERS[2230],
  HANDLERS[2240], HANDLERS[2260], HANDLERS[2270], HANDLERS[2280], HANDLERS[2310],
  HANDLERS[3100], HANDLERS[3110], HANDLERS[3120], HANDLERS[3130], HANDLERS[3140],
  HANDLERS[3150], HANDLERS[3250], HANDLERS[3240], HANDLERS[3260], HANDLERS[3160],
  HANDLERS[3170], HANDLERS[3180], HANDLERS[3190], HANDLERS[3195],
  HANDLERS[3200], HANDLERS[3210], HANDLERS[3220], HANDLERS[3230],
  HANDLERS[3300], HANDLERS[3310], HANDLERS[3340], HANDLERS[3330],
  HANDLERS[3320], HANDLERS[3350],
  HANDLERS[2330], HANDLERS[2370], HANDLERS[2450], HANDLERS[2520], HANDLERS[2610],
  HANDLERS[2650], HANDLERS[2740], HANDLERS[2760], HANDLERS[2920], HANDLERS[2940],
];

// ---- Lógica dos 14 tiles de perigo (linhas 500-660: MENSAGENS DOS LOCAIS) ----
// Chamada ANTES de mover, com o código do tile na direção pretendida.
// Retorna 'move' (segue viagem), 'block' (não se move) ou 'dead' (fim de jogo).
function checkHazard(ctx, tileChar) {
  switch (tileChar) {
    case '0': return 'move';
    case '1': return 'block';
    case '2': ctx.msg('As grades da cela impedem sua passagem.'); return 'block';
    case '3':
      if (isAtAlcatraz2GuardPost(ctx) && ctx.state.x[21] === 0) {
        return guardBlockOrKill(ctx);
      }
      // No Ato 2 o guarda do píer conhece a tripulação: o uniforme NÃO engana.
      if (isAlcatraz2(ctx) && act(ctx) === 1 && ctx.state.x[10] === 1) {
        ctx.msg('O uniforme enganou a sentinela.');
        return 'move';
      }
      if (isAlcatraz2(ctx)) return guardBlockOrKill(ctx);
      ctx.msg('O guarda está aqui e não deixa você passar.'); return 'block';
    case '4': ctx.msg('Aqui há uma cadeira elétrica. Você foi eletrocutado.'); return 'dead';
    case '5': ctx.msg('Há uma porta fechada aqui.'); return 'block';
    case '6':
      if (ctx.state.x[7] === 1 && ctx.carried(N_LANTERNA)) return 'move';
      ctx.msg('Está muito escuro aqui. Você tropeçou e quebrou a perna.');
      return 'dead';
    case '7': ctx.msg('Você caiu no fogo que restou. Que modo horrível de morrer!'); return 'dead';
    case '8':
      if (isAlcatraz2(ctx) && ctx.state.x[13] === 1 && ctx.carried(N_INIBIDOR)) {
        ctx.msg('O inibidor embaralhou os sensores.');
        return 'move';
      }
      ctx.msg('Você disparou um alarme! Os guardas o pegaram! Você foi fuzilado.'); return 'dead';
    case '9':
      if (isAlcatraz2(ctx) && act(ctx) === 2) {
        ctx.msg('O holofote o flagrou! Tiros vieram da torre e você morreu.');
        return 'dead';
      }
      ctx.msg('Você passou por um feixe de luz que disparou outro alarme!'); return 'dead';
    case 'A':
      if (ctx.state.x[9] === 1 && ctx.carried(N_GRAVADOR)) { ctx.msg('Os cães dormem...'); return 'move'; }
      ctx.msg('Há cinco cães aqui. Você foi horrivelmente devorado!');
      return 'dead';
    case 'B': ctx.msg('A passagem aqui está bloqueada por terra.'); return 'block';
    case 'C':
      if (isAlcatraz2(ctx) && ctx.state.x[10] === 1) {
        ctx.msg('O disfarce evitou a abordagem do carcereiro.');
        return 'move';
      }
      ctx.msg('Você deu de cara com o carcereiro e ele o denunciou.'); return 'dead';
    case 'D': ctx.msg('Conseguimos sair do prédio, mas ainda falta transpor o pátio...'); return 'move';
    case 'F':
      if (isAlcatraz2(ctx) && ctx.state.x[14] === 1 && ctx.carried(N_RESPIRADOR)) {
        ctx.msg('Você avança submerso pela galeria escura.');
        return 'move';
      }
      ctx.msg('A galeria está inundada. Seu fôlego acabou no escuro.');
      return 'dead';
    case 'G':
      ctx.msg('O portão estava eletrificado! A descarga foi fulminante.');
      return 'dead';
    case 'H': ctx.msg('Uma comporta pesada está travada.'); return 'block';
    case 'I':
      ctx.msg('O fio desencapado descarregou em você. Morte instantânea!');
      return 'dead';
    case 'J': ctx.msg('O vento sacode a passarela, mas você passa sob a torre.'); return 'move';
    case 'K': ctx.msg('A borda do telhado despenca no escuro. Melhor não.'); return 'block';
    case 'M':
    case 'O': return 'move';
    case 'N': ctx.msg('A cerca externa bloqueia o caminho.'); return 'block';
    // ---- Ato 2: costão e cais ----
    case 'P':
    case 'R': return 'move';
    case 'Q':
      ctx.msg('Você escorregou para o mar gelado. A correnteza o engoliu.');
      return 'dead';
    case 'S': ctx.msg('A lancha de serviço está atracada aí, de motor ligado.'); return 'block';
    case 'T': ctx.msg('A torre de vigia se ergue ali. O holofote gira no alto.'); return 'block';
    case 'U': ctx.msg('Uma fenda funda corta o costão. As ondas estouram lá embaixo.'); return 'block';
    case 'V': // mangueira amarrada: descida para o Ato 2
      if (ctx.state.x[23] === 0) {
        ctx.msg('A mangueira está firme, mas descer sem a lancha a caminho seria se entregar.');
        return 'block';
      }
      beginAct2(ctx);
      ctx.msg('Você desceu pela face externa até a base do prédio. O costão segue escuro até o cais.');
      return 'warp';
    default: return 'block';
  }
}

// ---- Verificação de objetos citados (linhas 1520-1560) ----
// Confirma que os substantivos citados no comando estão acessíveis (aqui,
// carregados, ou cenário universal). PECA e TIRE dispensam essa checagem
// para o 1o substantivo (favor pedido / item já instalado/escondido).
function checkObjectsVisible(ctx, verbIdx, J, I) {
  if (J === -1) return { ok: true };
  const p = ctx.posCode();
  const accessible = (idx) => {
    if (idx === N_GUARDA && isAlcatraz2GuardVisible(ctx)) return true;
    const loc = ctx.loc(idx);
    return loc === p || loc === '**' || loc === '..';
  };
  if (isAtAlcatraz2GuardPost(ctx) && verbIdx === V_MATE && J === N_GUARDA && (I === N_ARAME || I === N_FACA)) {
    if (ctx.state.x[21] === 1) return { ok: true };
    return accessible(I) ? { ok: true } : { ok: false, idx: I };
  }
  if (isAtAlcatraz2GuardPost(ctx) && verbIdx === V_MATE && J === N_GUARDA && I === -1 && ctx.state.x[21] === 0) {
    return { ok: true };
  }
  if (isAtAlcatraz2GuardPost(ctx) && verbIdx === V_MATE && J === N_GUARDA && I !== -1 && ctx.state.x[21] === 0) {
    return accessible(I) ? { ok: true } : { ok: false, idx: I };
  }
  const skipFirst = verbIdx === 12 /* PECA */ || verbIdx === 7 /* TIRE */;
  if (!skipFirst && !accessible(J)) return { ok: false, idx: J };
  if (I === -1) return { ok: true };
  if (!accessible(I)) return { ok: false, idx: I };
  return { ok: true };
}
