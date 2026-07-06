// Estado do jogo, entrada do teclado/mouse, log de mensagens e painel de
// legendas fixo. Liga data.js + parser.js + actions.js + renderer.js.
'use strict';

let activeScenario = ALCATRAZ_SCENARIOS.original;

function initState() {
  return {
    scenarioId: activeScenario.id,
    act: 1, // Alcatraz 2 tem dois atos (prisão -> costão/cais)
    pc: activeScenario.startPc,
    pl: activeScenario.startPl,
    objLoc: activeScenario.nounLocs.slice(),
    x: new Array(24).fill(0),
    maze: activeScenario.maze.map((row) => row.slice()),
    gameOver: false,
    won: false,
  };
}

let state = initState();
let titleDismissed = false;

// ---- DOM ----
let els = {};

function cacheEls() {
  els = {
    titleScreen: document.getElementById('titleScreen'),
    titleCanvas: document.getElementById('titleCanvas'),
    titleCredit: document.getElementById('titleCredit'),
    titlePrompt: document.getElementById('titlePrompt'),
    scenarioDescription: document.getElementById('scenarioDescription'),
    scenarioButtons: document.querySelectorAll('[data-scenario]'),
    btnStartGame: document.getElementById('btnStartGame'),
    gameScreen: document.getElementById('gameScreen'),
    logoBanner: document.getElementById('logoBanner'),
    mazeCanvas: document.getElementById('mazeCanvas'),
    messageLog: document.getElementById('messageLog'),
    commandInput: document.getElementById('commandInput'),
    btnLook: document.getElementById('btnLook'),
    btnInventory: document.getElementById('btnInventory'),
    endScreen: document.getElementById('endScreen'),
    endTitle: document.getElementById('endTitle'),
    endSubtitle: document.getElementById('endSubtitle'),
    btnRestart: document.getElementById('btnRestart'),
    legendVerbs: document.getElementById('legendVerbs'),
  };
}

// ---- Log de mensagens (histórico rolável; o original limpava 3 linhas fixas
// a cada rodada, aqui preferimos manter o histórico visível) ----
let lastMsg = ''; // guarda a última mensagem (ex.: causa da morte) para a tela de fim

function msg(text) {
  lastMsg = text;
  const p = document.createElement('p');
  p.textContent = text;
  els.messageLog.appendChild(p);
  els.messageLog.scrollTop = els.messageLog.scrollHeight;
}

function posCode() { return String.fromCharCode(state.pc + 60) + String.fromCharCode(state.pl + 60); }

function listObjectsAt(locCode, label) {
  const names = [];
  for (let n = 0; n < NOUNS.length; n++) {
    if (state.objLoc[n] === locCode) names.push(NOUNS_DISPLAY[n]);
  }
  const inAct1 = state.act === 1; // no Ato 2 o guarda do píer tem localização própria em objLoc
  if (inAct1 && state.scenarioId === 'alcatraz2' && state.x[21] === 0 && (locCode === '@@' || locCode === 'A@')) {
    names.push(NOUNS_DISPLAY[N_GUARDA]);
  }
  if (inAct1 && state.scenarioId === 'alcatraz2' && (locCode === 'B@' || locCode === 'C@')) {
    names.push(NOUNS_DISPLAY[N_GUARDA]);
  }
  msg(label + (names.length ? names.join(', ') : 'Nada Importante'));
}
function showObjectsHere() { listObjectsAt(posCode(), 'Aqui tem: '); }
function showInventory() { listObjectsAt('**', 'Você tem: '); }

// ---- Som (opcional, best-effort via WebAudio; original usava SOUND/PLAY do PSG) ----
let audioCtx = null;
function playSound(kind) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ac = audioCtx;
    const now = ac.currentTime;
    const seqs = {
      ok: [[880, 0.08]],
      unlock: [[660, 0.07], [880, 0.09]],
      zap: [[220, 0.05], [110, 0.12]],
      death: [[180, 0.15], [140, 0.15], [90, 0.35]],
      win: [[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.3]],
    };
    const seq = seqs[kind] || [[440, 0.08]];
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = kind === 'death' ? 'sawtooth' : kind === 'zap' ? 'square' : 'triangle';
    osc.connect(gain);
    gain.connect(ac.destination);
    let t = now;
    gain.gain.setValueAtTime(0.0001, t);
    for (const [freq, dur] of seq) {
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      t += dur;
    }
    osc.start(now);
    osc.stop(t + 0.05);
  } catch (e) { /* áudio é apenas cosmético */ }
}

// ---- Contexto de ações ----
function callbacks() {
  return { msg, gameOver: triggerGameOver, win: triggerWin, sound: playSound };
}

// ---- Movimento (linhas 470-790) ----
// O mapa é acumulado (nunca limpo): ao sair de uma célula seu centro volta a
// vazio, e a nova célula revela seu bloco 3x3 com o jogador ao centro.
function attemptMove(dir) {
  if (state.gameOver || state.won) return;
  const code = state.maze[state.pl - MAZE_ROW_OFFSET][state.pc];
  const tileChar = code[dir - 1];
  const ctx = makeActionContext(state, callbacks());
  const result = checkHazard(ctx, tileChar);
  if (result === 'dead') { triggerGameOver(); return; }
  if (result === 'block') return;
  if (result === 'warp') {
    // Mudança de ato (descida para o costão): o mapa antigo sai da tela e o
    // novo começa a ser revelado do ponto de chegada.
    initMazeCanvas(els.mazeCanvas);
    revealCell(els.mazeCanvas, state, state.pc, state.pl);
    return;
  }
  clearCellCenter(els.mazeCanvas, state, state.pc, state.pl);
  if (dir === 1) state.pl -= 1;
  else if (dir === 2) state.pl += 1;
  else if (dir === 3) state.pc += 1;
  else if (dir === 4) state.pc -= 1;
  state.x[6] = 0; state.x[8] = 0; // linha 790: serra desliga/desconecta ao mover
  state.x[22] = 0; // A2: afastar-se acalma o guarda (zera o contador de insistência)
  revealCell(els.mazeCanvas, state, state.pc, state.pl);
}

// Redesenha apenas a célula atual (usado após ações que alteram o labirinto,
// ex: cavar/queimar/curto-circuitar abrindo uma passagem).
function redrawMaze() { revealCell(els.mazeCanvas, state, state.pc, state.pl, true); }

// ---- Comandos digitados (linhas 1010-1360) ----
function codeChar(idx) { return String.fromCharCode(idx + 50); }

function findAction(verbIdx, noun1Idx, noun2Idx) {
  let code = codeChar(verbIdx);
  if (noun1Idx !== -1) code += codeChar(noun1Idx);
  if (noun2Idx !== -1) code += codeChar(noun2Idx);
  for (let n = 0; n <= AS_LIMIT; n++) if (ACTION_CODES[n] === code) return n;
  if (code.length === 1) return -1;
  for (let n = AS_LIMIT + 1; n < ACTION_CODES.length; n++) if (ACTION_CODES[n] === code[0]) return n;
  return -1;
}

function submitCommand(text) {
  if (state.gameOver || state.won) return;
  const parsed = parseCommand(text);
  if (!parsed.ok) {
    if (parsed.error === 'empty') return;
    msg(`O que é ${parsed.word}?`);
    return;
  }
  const { verbIdx, noun1Idx, noun2Idx } = parsed;
  const ctx = makeActionContext(state, callbacks());
  if (noun1Idx !== -1) {
    const check = checkObjectsVisible(ctx, verbIdx, noun1Idx, noun2Idx);
    if (!check.ok) { msg(`Não estou vendo ${NOUNS_DISPLAY[check.idx].toLowerCase()}.`); return; }
  }
  const actionIdx = findAction(verbIdx, noun1Idx, noun2Idx);
  if (actionIdx === -1) { msg('Isto não é possível.'); return; }
  const beforePc = state.pc;
  const beforePl = state.pl;
  ACTION_HANDLERS[actionIdx](ctx, noun1Idx, noun2Idx);
  if (state.pc !== beforePc || state.pl !== beforePl) {
    clearCellCenter(els.mazeCanvas, state, beforePc, beforePl);
    revealCell(els.mazeCanvas, state, state.pc, state.pl);
  } else {
    redrawMaze();
  }
}

// ---- Fim de jogo (linhas 1430-1490) ----
// O original deixa a mensagem da morte na tela, toca a marcha fúnebre, espera
// alguns segundos e só então pergunta "Quer jogar novamente (S/N) ?".
// Replicamos a pausa e mostramos a CAUSA real da morte no prompt.
let endOverlayTimer = null;

function triggerGameOver() {
  state.gameOver = true;
  playSound('death');
  const causeOfDeath = lastMsg;
  endOverlayTimer = setTimeout(() => {
    showEndScreen(causeOfDeath, 'Quer jogar novamente (S/N) ?');
  }, 2500);
}
function triggerWin() {
  state.won = true;
  const winTitle = activeScenario.id === 'alcatraz2'
    ? 'Você tomou a lancha de serviço e escapou de ALCATRAZ 2!'
    : 'Você saiu por uma passagem secreta! Você escapou de ALCATRAZ!';
  const winSubtitle = activeScenario.id === 'alcatraz2'
    ? 'A fuga ainda mais impossível foi vencida. Quer jogar novamente (S/N) ?'
    : 'Parabéns! Quer jogar novamente (S/N) ?';
  msg(winTitle);
  playSound('win');
  endOverlayTimer = setTimeout(() => {
    showEndScreen(winTitle, winSubtitle);
  }, 2500);
}
function showEndScreen(title, subtitle) {
  els.endTitle.textContent = title;
  els.endSubtitle.textContent = subtitle;
  els.endScreen.classList.remove('hidden');
}
function restartGame() {
  if (endOverlayTimer) { clearTimeout(endOverlayTimer); endOverlayTimer = null; }
  state = initState();
  els.messageLog.innerHTML = '';
  els.endScreen.classList.add('hidden');
  els.commandInput.value = '';
  initMazeCanvas(els.mazeCanvas); // apaga o mapa acumulado da tentativa anterior
  revealCell(els.mazeCanvas, state, state.pc, state.pl);
  msg('Uma nova tentativa de fuga começa...');
}

// Segredo do original (linha 1480): tecla W na tela de morte retoma o jogo
// exatamente de onde parou (a morte não altera posição nem inventário).
function resumeAfterDeath() {
  if (!state.gameOver || state.won) return;
  if (endOverlayTimer) { clearTimeout(endOverlayTimer); endOverlayTimer = null; }
  state.gameOver = false;
  els.endScreen.classList.add('hidden');
}

// ---- Tela de título ----
function dismissTitle() {
  if (titleDismissed) return;
  titleDismissed = true;
  els.titleScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  msg(activeScenario.introMessage);
  els.commandInput.focus();
  els.commandInput.blur();
}

// ---- Legenda fixa (todos os comandos suportados) ----
function buildLegend() {
  els.legendVerbs.textContent = VERBS_DISPLAY.join(', ');
}

function updateScenarioUi() {
  document.title = `${activeScenario.title} - ${activeScenario.subtitle}`;
  if (els.titleCredit) els.titleCredit.textContent = activeScenario.credit;
  if (els.titlePrompt) els.titlePrompt.textContent = 'Escolha uma versão e pressione ESPAÇO ou Começar';
  if (els.scenarioDescription) els.scenarioDescription.textContent = activeScenario.description;
  els.scenarioButtons.forEach((button) => {
    const selected = button.dataset.scenario === activeScenario.id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function selectScenario(id) {
  if (titleDismissed) return;
  activeScenario = ALCATRAZ_SCENARIOS[id] || ALCATRAZ_SCENARIOS.original;
  state = initState();
  lastMsg = '';
  if (els.messageLog) els.messageLog.innerHTML = '';
  if (els.mazeCanvas) {
    initMazeCanvas(els.mazeCanvas);
    revealCell(els.mazeCanvas, state, state.pc, state.pl);
  }
  drawTitleLogo(els.titleCanvas, activeScenario.id);
  drawLogoBanner(els.logoBanner, activeScenario.id);
  buildLegend();
  updateScenarioUi();
}

// ---- Entrada de teclado ----
function onKeyDown(e) {
  if (!titleDismissed) {
    if (e.code === 'Space') {
      if (e.target && e.target.matches && e.target.matches('[data-scenario]')) return;
      e.preventDefault();
      dismissTitle();
    }
    return;
  }
  if (state.gameOver || state.won) {
    if (e.key === 's' || e.key === 'S') restartGame();
    else if (e.key === 'w' || e.key === 'W') resumeAfterDeath();
    return;
  }

  if (e.key === 'Tab') { e.preventDefault(); showObjectsHere(); return; }
  if (e.key === 'Escape') { e.preventDefault(); showInventory(); return; }

  const typing = document.activeElement === els.commandInput;
  if (typing) return; // deixa o campo de texto tratar teclas normalmente

  switch (e.key) {
    case 'ArrowUp': e.preventDefault(); attemptMove(1); return;
    case 'ArrowDown': e.preventDefault(); attemptMove(2); return;
    case 'ArrowRight': e.preventDefault(); attemptMove(3); return;
    case 'ArrowLeft': e.preventDefault(); attemptMove(4); return;
  }
  if (/^[a-zA-ZÁÀÂÃÉÈÊÍÌÓÒÔÕÚÙÜÇáàâãéèêíìóòôõúùüç]$/.test(e.key)) {
    e.preventDefault(); // sem isso o navegador digita a mesma tecla de novo no input recém-focado (efeito "AA")
    els.commandInput.value = e.key.toUpperCase();
    els.commandInput.focus();
    requestAnimationFrame(() => {
      const len = els.commandInput.value.length;
      els.commandInput.setSelectionRange(len, len);
    });
  }
}

// Aceita letras acentuadas do português enquanto digita (ex: LENÇOL, ÁGUA,
// PEÇA); a normalização/remoção de acento acontece só na hora de interpretar
// o comando (parser.js), então o campo mostra exatamente o que foi digitado.
function onCommandInput() {
  const filtered = els.commandInput.value.toUpperCase().replace(/[^A-ZÁÀÂÃÉÈÊÍÌÓÒÔÕÚÙÜÇ ]/g, '');
  if (filtered !== els.commandInput.value) els.commandInput.value = filtered;
}

function onCommandKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = els.commandInput.value;
    els.commandInput.value = '';
    els.commandInput.blur();
    submitCommand(text);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    els.commandInput.value = '';
    els.commandInput.blur();
    showInventory();
  }
}

function init() {
  cacheEls();
  selectScenario(activeScenario.id);

  document.addEventListener('keydown', onKeyDown);
  els.commandInput.addEventListener('input', onCommandInput);
  els.commandInput.addEventListener('keydown', onCommandKeyDown);
  els.scenarioButtons.forEach((button) => {
    button.addEventListener('click', () => selectScenario(button.dataset.scenario));
  });
  els.btnStartGame.addEventListener('click', dismissTitle);
  els.titleCanvas.addEventListener('click', dismissTitle);
  els.btnLook.addEventListener('click', () => { if (titleDismissed && !state.gameOver && !state.won) showObjectsHere(); });
  els.btnInventory.addEventListener('click', () => { if (titleDismissed && !state.gameOver && !state.won) showInventory(); });
  els.btnRestart.addEventListener('click', restartGame);

  console.info('[Alcatraz] Modo debug disponível no console: alcatrazDebug.stages()');
}

document.addEventListener('DOMContentLoaded', init);

// ---- Modo debug (console do navegador) ----
// Pula direto a pontos do jogo com estado pronto (flags, inventário, mapa):
//   alcatrazDebug.stages()        lista os estágios disponíveis
//   alcatrazDebug.stage('ato2')   vai direto ao Ato 2 (costão/cais)
//   alcatrazDebug.give('FACA')    põe um item no inventário
//   alcatrazDebug.goto(4, 4)      teleporta para a célula (pc, pl)
//   alcatrazDebug.where()         posição/ato atual
//   alcatrazDebug.flags()         flags X() do estado
const DEBUG_STAGES = {
  original: {
    desc: 'Cenário original de 1986, do início',
    scenario: 'original',
    setup() {},
  },
  inicio: {
    desc: 'Alcatraz 2, do início (Bloco Ômega)',
    setup() {},
  },
  guarda: {
    desc: 'Diante do guarda do gargalo, com faca e arame no inventário',
    setup(st) {
      st.pc = 4; st.pl = 4;
      st.objLoc[N_FACA] = '**';
      st.objLoc[N_ARAME] = '**';
    },
  },
  sentinela: {
    desc: 'Guarda morto, uniforme vestido e cartão clonado, diante da porta magnética',
    setup(st, ctx) {
      st.pc = 5; st.pl = 4;
      st.x[21] = 1; st.x[10] = 1; st.x[11] = 1;
      st.objLoc[N_UNIFORME] = '**';
      st.objLoc[N_CARTAO] = '**';
      setPassage(ctx, 4, 4, 'east', '0'); // posto do guarda já vazio
    },
  },
  duto: {
    desc: 'Na célula do duto, com inibidor ligado e uniforme vestido',
    setup(st) {
      st.pc = 13; st.pl = 11;
      st.x[21] = 1; st.x[10] = 1;
      st.x[12] = 1; st.x[13] = 1;
      st.objLoc[N_UNIFORME] = '**';
      st.objLoc[N_INIBIDOR] = '**';
    },
  },
  patio: {
    desc: 'Pátio das Bombas (pós-duto), pronto para o mergulho',
    setup(st) {
      DEBUG_STAGES.duto.setup(st);
      st.pc = 0; st.pl = 11;
    },
  },
  telhado: {
    desc: 'Pouso do telhado (pós-escotilha)',
    setup(st) {
      DEBUG_STAGES.duto.setup(st);
      st.pc = 6; st.pl = 9;
    },
  },
  radio: {
    desc: 'Célula do rádio com antena instalada e mangueira no inventário',
    setup(st) {
      DEBUG_STAGES.duto.setup(st);
      st.pc = 9; st.pl = 11;
      st.x[18] = 1; st.x[19] = 1;
      st.objLoc[N_MANGUEIRA] = '**';
    },
  },
  ato2: {
    desc: 'Ato 2: base do prédio, chamado feito e uniforme vestido',
    setup(st, ctx) {
      st.x[10] = 1; st.x[23] = 1;
      st.objLoc[N_UNIFORME] = '**';
      beginAct2(ctx);
    },
  },
  cais: {
    desc: 'Ato 2: diante do guarda do píer, com rede e pedra',
    setup(st, ctx) {
      DEBUG_STAGES.ato2.setup(st, ctx);
      st.pc = 11; st.pl = 10;
      st.objLoc[N_REDE] = '**';
      st.objLoc[N_PEDRA] = '**';
    },
  },
};

function debugRefreshView(note) {
  if (!titleDismissed) {
    titleDismissed = true;
    els.titleScreen.classList.add('hidden');
    els.gameScreen.classList.remove('hidden');
  }
  if (endOverlayTimer) { clearTimeout(endOverlayTimer); endOverlayTimer = null; }
  els.endScreen.classList.add('hidden');
  initMazeCanvas(els.mazeCanvas);
  revealCell(els.mazeCanvas, state, state.pc, state.pl);
  if (note) msg('[DEBUG] ' + note);
}

const alcatrazDebug = {
  stages() {
    console.table(Object.fromEntries(
      Object.entries(DEBUG_STAGES).map(([name, s]) => [name, s.desc])
    ));
    return Object.keys(DEBUG_STAGES);
  },
  stage(name) {
    const stage = DEBUG_STAGES[name];
    if (!stage) {
      console.warn('Estágio desconhecido:', name, '— veja alcatrazDebug.stages()');
      return;
    }
    activeScenario = ALCATRAZ_SCENARIOS[stage.scenario || 'alcatraz2'];
    state = initState();
    stage.setup(state, makeActionContext(state, callbacks()));
    els.messageLog.innerHTML = '';
    drawLogoBanner(els.logoBanner, activeScenario.id);
    updateScenarioUi();
    debugRefreshView(stage.desc + '.');
    return this.where();
  },
  goto(pc, pl) {
    const row = state.maze[pl - MAZE_ROW_OFFSET];
    if (!row || !row[pc]) {
      console.warn('Célula fora do mapa:', pc, pl);
      return;
    }
    state.pc = pc; state.pl = pl;
    debugRefreshView('Teleportado para (' + pc + ',' + pl + ').');
    return this.where();
  },
  give(name) {
    const wanted = stripAccents(String(name).toUpperCase().trim());
    const idx = NOUNS.findIndex(([, n]) => n === wanted);
    if (idx === -1) {
      console.warn('Objeto desconhecido:', name);
      return;
    }
    state.objLoc[idx] = '**';
    msg('[DEBUG] ' + NOUNS_DISPLAY[idx] + ' adicionado ao inventário.');
    return NOUNS_DISPLAY[idx];
  },
  setFlag(i, v) { state.x[i] = v; return state.x.slice(); },
  flags() { return state.x.slice(); },
  where() {
    return {
      cenario: state.scenarioId, ato: state.act,
      pc: state.pc, pl: state.pl, posCode: posCode(),
      celula: state.maze[state.pl - MAZE_ROW_OFFSET][state.pc],
    };
  },
  state() { return state; },
  win() { triggerWin(); },
};
window.alcatrazDebug = alcatrazDebug;
