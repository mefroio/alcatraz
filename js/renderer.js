// Desenho em canvas: tiles 8x8 decodificados dos bitmaps/cores originais
// (paleta MSX1/TMS9918) e o logo vetorial da tela de título.
//
// IMPORTANTE: o jogo original NUNCA limpa a tela durante a exploração do
// labirinto (linhas 690-790). Cada célula visitada revela seu bloco 3x3 numa
// posição absoluta da tela (ver screenCol/screenRow em data.js), acumulando
// um mapa explorado — não um "viewport" fixo centralizado no jogador.
'use strict';

// No MSX real, cor de paleta 0 não é "não desenhar": é um valor especial
// que sempre mostra a cor de fundo/borda atual (COLOR fg,bg,borda). Por isso
// pintamos explicitamente com a cor de fundo em vez de pular o pixel — do
// contrário, "apagar" uma célula já desenhada deixaria o conteúdo antigo ali
// (foi exatamente o bug do "boneco fantasma" ao mover).
function drawTile(g, tileIdx, x, y, scale) {
  const bitmap = TILE_BITMAPS[tileIdx];
  const colors = TILE_COLORS[tileIdx];
  if (!bitmap) return;
  const backdrop = PALETTE[BACKGROUND_COLOR_IDX];
  for (let row = 0; row < 8; row++) {
    const byte = bitmap[row];
    const colorByte = colors[row];
    const fgIdx = (colorByte >> 4) & 0xF;
    const bgIdx = colorByte & 0xF;
    const fg = fgIdx === 0 ? backdrop : PALETTE[fgIdx];
    const bg = bgIdx === 0 ? backdrop : PALETTE[bgIdx];
    for (let col = 0; col < 8; col++) {
      const bit = (byte >> (7 - col)) & 1;
      g.fillStyle = bit ? fg : bg;
      g.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

function drawTileAtGrid(g, tileIdx, gridCol, gridRow) {
  drawTile(g, tileIdx, gridCol * NATIVE_TILE_PX, gridRow * NATIVE_TILE_PX, 1);
}

function markTile(canvas, gridCol, gridRow, tileIdx) {
  if (!canvas._tileGrid) return;
  if (!canvas._tileGrid[gridRow]) return;
  canvas._tileGrid[gridRow][gridCol] = tileIdx;
}

function drawTileTracked(canvas, g, tileIdx, gridCol, gridRow) {
  drawTileAtGrid(g, tileIdx, gridCol, gridRow);
  markTile(canvas, gridCol, gridRow, tileIdx);
}

function drawOrientedTileTracked(canvas, g, tileIdx, gridCol, gridRow, orientation) {
  drawOrientedTile(g, tileIdx, gridCol, gridRow, orientation);
  markTile(canvas, gridCol, gridRow, tileIdx);
}

function isTileRevealed(canvas, gridCol, gridRow) {
  return !!(canvas._tileGrid
    && canvas._tileGrid[gridRow]
    && canvas._tileGrid[gridRow][gridCol] !== null);
}

function drawTileIfUnrevealed(canvas, g, tileIdx, gridCol, gridRow) {
  if (isTileRevealed(canvas, gridCol, gridRow)) return;
  drawTileTracked(canvas, g, tileIdx, gridCol, gridRow);
}

function drawOrientedTileIfUnrevealed(canvas, g, tileIdx, gridCol, gridRow, orientation) {
  if (isTileRevealed(canvas, gridCol, gridRow)) return;
  drawOrientedTileTracked(canvas, g, tileIdx, gridCol, gridRow, orientation);
}

function drawActorOnTileTracked(canvas, g, actorTileIdx, baseTileIdx, gridCol, gridRow) {
  drawTileAtGrid(g, baseTileIdx, gridCol, gridRow);
  drawSpriteAtGrid(g, actorTileIdx, gridCol, gridRow);
  markTile(canvas, gridCol, gridRow, actorTileIdx);
}

function drawSceneSideTracked(canvas, g, state, tileIdx, gridCol, gridRow, orientation) {
  if (state && state.scenarioId === 'alcatraz2' && state.act === 2 && tileIdx === TILE.GUARD) {
    drawActorOnTileTracked(canvas, g, tileIdx, TILE.PIER_DECK, gridCol, gridRow);
    return;
  }
  drawOrientedTileTracked(canvas, g, tileIdx, gridCol, gridRow, orientation);
}

function drawSceneSideIfUnrevealed(canvas, g, state, tileIdx, gridCol, gridRow, orientation) {
  if (isTileRevealed(canvas, gridCol, gridRow)) return;
  drawSceneSideTracked(canvas, g, state, tileIdx, gridCol, gridRow, orientation);
}

function drawSpriteAtGrid(g, tileIdx, gridCol, gridRow) {
  const bitmap = TILE_BITMAPS[tileIdx];
  const colors = TILE_COLORS[tileIdx];
  if (!bitmap) return;
  const backdrop = PALETTE[BACKGROUND_COLOR_IDX];
  const x = gridCol * NATIVE_TILE_PX;
  const y = gridRow * NATIVE_TILE_PX;

  for (let row = 0; row < 8; row++) {
    const byte = bitmap[row];
    const colorByte = colors[row];
    const fgIdx = (colorByte >> 4) & 0xF;
    const fg = fgIdx === 0 ? backdrop : PALETTE[fgIdx];
    for (let col = 0; col < 8; col++) {
      if (((byte >> (7 - col)) & 1) === 0) continue;
      g.fillStyle = fg;
      g.fillRect(x + col, y + row, 1, 1);
    }
  }
}

function transformPixel(col, row, orientation) {
  switch (orientation) {
    case 'east':
    case 'west':
      return [7 - row, col];
    default: return [col, row];
  }
}

function drawOrientedTile(g, tileIdx, gridCol, gridRow, orientation) {
  if (tileIdx !== TILE.DOOR) {
    drawTileAtGrid(g, tileIdx, gridCol, gridRow);
    return;
  }

  const bitmap = TILE_BITMAPS[tileIdx];
  const colors = TILE_COLORS[tileIdx];
  const backdrop = PALETTE[BACKGROUND_COLOR_IDX];
  const x = gridCol * NATIVE_TILE_PX;
  const y = gridRow * NATIVE_TILE_PX;

  for (let row = 0; row < 8; row++) {
    const byte = bitmap[row];
    const colorByte = colors[row];
    const fgIdx = (colorByte >> 4) & 0xF;
    const bgIdx = colorByte & 0xF;
    const fg = fgIdx === 0 ? backdrop : PALETTE[fgIdx];
    const bg = bgIdx === 0 ? backdrop : PALETTE[bgIdx];
    for (let col = 0; col < 8; col++) {
      const bit = (byte >> (7 - col)) & 1;
      const [drawCol, drawRow] = transformPixel(col, row, orientation);
      g.fillStyle = bit ? fg : bg;
      g.fillRect(x + drawCol, y + drawRow, 1, 1);
    }
  }
}

function tileCharToIndex(tileChar) {
  return parseInt(tileChar, 36);
}

function playerTileForState(state) {
  return state.scenarioId === 'alcatraz2' && state.x[10] === 1
    ? TILE.DISGUISED_PLAYER
    : TILE.PLAYER;
}

function isPumpYardCell(pc, pl) {
  return (pl === 11 && pc >= 0 && pc <= 1)
    || (pl === 10 && pc >= 0 && pc <= 3)
    || (pl === 9 && pc >= 3 && pc <= 5);
}

// Galeria inundada: células submersas no fim do pátio (terreno = água).
function isFloodedGalleryCell(pc, pl) {
  return pl === 11 && (pc === 2 || pc === 3);
}

function isServiceDeckCell(pc, pl) {
  return (pl === 8 && pc === 6)
    || (pl === 9 && pc >= 6 && pc <= 8)
    || (pl === 10 && (pc === 8 || pc === 9))
    || (pl === 11 && pc === 9);
}

// Ato 2: costão de rocha e cais de madeira (chaves "pc,pl").
const ACT2_ROCK_CELLS = new Set([
  '1,2','2,2','2,3','3,3','4,3','3,4','4,4','3,5','4,5','5,5','6,5',
  '6,6','7,6','7,7','8,7','8,8','9,8','8,9','9,9',
]);
const ACT2_PIER_CELLS = new Set(['10,9','10,10','11,10','12,10','12,11']);

function terrainTileForCell(state, pc, pl) {
  if (!state || state.scenarioId !== 'alcatraz2') return TILE.EMPTY;
  if (state.act === 2) {
    const key = pc + ',' + pl;
    if (ACT2_PIER_CELLS.has(key)) return TILE.PIER_DECK;
    if (ACT2_ROCK_CELLS.has(key)) return TILE.ROCK_GROUND;
    return TILE.EMPTY;
  }
  if (isFloodedGalleryCell(pc, pl)) return TILE.WATER;
  if (isServiceDeckCell(pc, pl)) return TILE.SERVICE_DECK;
  if (isPumpYardCell(pc, pl)) return TILE.OUTDOOR_GROUND;
  return TILE.EMPTY;
}

function cornerTileForCell(state, pc, pl) {
  const terrainTile = terrainTileForCell(state, pc, pl);
  if (terrainTile === TILE.EMPTY || terrainTile === TILE.WATER || terrainTile === TILE.SEA) {
    return TILE.WALL;
  }
  return terrainTile;
}

function cornerTilesForCell(state, pc, pl) {
  const base = cornerTileForCell(state, pc, pl);
  const corners = { nw: base, ne: base, sw: base, se: base };
  if (state && state.scenarioId === 'alcatraz2' && state.act === 1) {
    if (pl === 10 && pc === 1) {
      corners.se = TILE.WALL;
    }
    if (pl === 10 && (pc === 2 || pc === 3)) {
      corners.sw = TILE.WALL;
      corners.se = TILE.WALL;
    }
    if (pl === 11 && pc === 1) {
      corners.ne = TILE.WALL;
      corners.se = TILE.WALL;
    }
  }
  if (state && state.scenarioId === 'alcatraz2' && state.act === 2) {
    if (pc === 10 && pl === 9) {
      corners.sw = TILE.SEA;
    }
    if (pc === 10 && pl === 10) {
      corners.nw = TILE.SEA;
      corners.sw = TILE.SEA;
    }
  }
  return corners;
}

function drawPlayerAtGrid(g, state, gridCol, gridRow, pc, pl) {
  const terrainTile = terrainTileForCell(state, pc, pl);
  if (terrainTile === TILE.EMPTY) {
    drawTileAtGrid(g, playerTileForState(state), gridCol, gridRow);
    return;
  }
  drawTileAtGrid(g, terrainTile, gridCol, gridRow);
  drawSpriteAtGrid(g, playerTileForState(state), gridCol, gridRow);
}

// Prepara o canvas do labirinto na resolução nativa MSX (256x192) e pinta o
// fundo com a cor de fundo original (COLOR1,5,5 = azul claro).
function initMazeCanvas(canvas) {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  canvas._tileGrid = Array.from({ length: SCREEN_ROWS }, () => Array(SCREEN_COLS).fill(null));
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = PALETTE[BACKGROUND_COLOR_IDX];
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

// Revela o bloco 3x3 de uma célula (jogador no centro, N/S/L/O da célula,
// cantos sempre tijolo fixo) na posição absoluta correspondente a (pc,pl).
// Fiel às linhas 740-780: não afeta nada fora desse bloco 3x3.
function revealCell(canvas, state, pc, pl, force = false) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const code = state.maze[pl - MAZE_ROW_OFFSET][pc];
  const north = tileCharToIndex(code[0]);
  const south = tileCharToIndex(code[1]);
  const east = tileCharToIndex(code[2]);
  const west = tileCharToIndex(code[3]);
  const col = screenCol(pc);
  const row = screenRow(pl);
  const corners = cornerTilesForCell(state, pc, pl);

  const overwriteCell = force
    || (state && state.scenarioId === 'alcatraz2' && state.act === 1 && isFloodedGalleryCell(pc, pl));
  const drawPlain = overwriteCell ? drawTileTracked : drawTileIfUnrevealed;
  const drawSide = overwriteCell ? drawSceneSideTracked : drawSceneSideIfUnrevealed;

  drawPlain(canvas, g, corners.nw, col - 1, row - 1);
  drawSide(canvas, g, state, north, col, row - 1, 'north');
  drawPlain(canvas, g, corners.ne, col + 1, row - 1);
  drawSide(canvas, g, state, west, col - 1, row, 'west');
  drawPlayerAtGrid(g, state, col, row, pc, pl);
  markTile(canvas, col, row, playerTileForState(state));
  drawSide(canvas, g, state, east, col + 1, row, 'east');
  drawPlain(canvas, g, corners.sw, col - 1, row + 1);
  drawSide(canvas, g, state, south, col, row + 1, 'south');
  drawPlain(canvas, g, corners.se, col + 1, row + 1);
}

// Ao sair de uma célula o centro deixa de mostrar o jogador (linha 730):
// volta a vazio — EXCETO nas três posições do corredor escuro (endereços de
// VRAM 6613/6677/6741 no original, ou seja PC=9 e PL=7/8/9), que voltam a
// ficar PRETAS (tile 6). É isso que mantém o corredor escuro atrás do
// jogador. Os vizinhos/cantos já revelados permanecem no mapa acumulado.
function clearCellCenter(canvas, state, pc, pl) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const ed = 6144 + pc * 2 + pl * 64 + 3; // BASE(10)+PC*2+PL*64+3
  const isDarkSpot = state && state.scenarioId === 'original'
    && (ed === 6613 || ed === 6677 || ed === 6741);
  const terrainTile = terrainTileForCell(state, pc, pl);
  drawTileTracked(canvas, g, isDarkSpot ? TILE.DARK : terrainTile, screenCol(pc), screenRow(pl));
}

// Traça o caminho vetorial do logo "ALCATRAZ" (GOSUB 3030) mapeando a janela
// [offsetX,offsetY,width,height] (em coordenadas originais 256x192) para todo
// o canvas informado. Usado tanto na tela de título quanto na faixa do jogo.
function drawLogoPath(canvas, view) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const scaleX = canvas.width / view.width;
  const scaleY = canvas.height / view.height;
  const tx = (x) => (x - view.x) * scaleX;
  const ty = (y) => (y - view.y) * scaleY;
  const fg = PALETTE[8]; // COLOR8 no original

  g.strokeStyle = fg;
  g.fillStyle = fg;
  g.lineWidth = Math.max(1, scaleX * 0.8);
  g.beginPath();
  for (let i = 0; i < TITLE_PATH.length; i += 2) {
    const x = tx(TITLE_PATH[i]);
    const y = ty(TITLE_PATH[i + 1]);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.stroke();

  g.beginPath();
  g.moveTo(tx(20), ty(114));
  g.lineTo(tx(208), ty(114));
  g.strokeStyle = PALETTE[15];
  g.stroke();
  return g;
}

function drawVariantMark(canvas, variantId, compact) {
  if (variantId !== 'alcatraz2') return;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const size = compact ? Math.floor(canvas.height * 0.55) : Math.floor(canvas.height * 0.32);
  g.font = `bold ${size}px "Courier New", monospace`;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.lineWidth = Math.max(2, Math.floor(size / 18));
  g.strokeStyle = '#000000';
  g.fillStyle = PALETTE[15];
  const x = canvas.width - Math.floor(canvas.width * 0.08);
  const y = compact ? canvas.height * 0.55 : canvas.height * 0.72;
  g.strokeText('2', x, y);
  g.fillText('2', x, y);
}

// Tela de título: logo completo sobre fundo preto, na janela original 256x192.
function drawTitleLogo(canvas, variantId) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#000000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  drawLogoPath(canvas, { x: 0, y: 0, width: 256, height: 192 });
  drawVariantMark(canvas, variantId, false);
}

// Faixa compacta só com o texto "ALCATRAZ" (recorte do bounding box real do
// desenho), para usar como cabeçalho acima do labirinto na tela de jogo.
const LOGO_BANNER_VIEW = { x: 12, y: 72, width: 232, height: 48 };
function drawLogoBanner(canvas, variantId) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  drawLogoPath(canvas, LOGO_BANNER_VIEW);
  drawVariantMark(canvas, variantId, true);
}
