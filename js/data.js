// Dados portados diretamente das linhas DATA do ALCATRAZ.BAS original.
// Ver reference/ALCATRAZ.BAS.txt para conferência linha a linha.
'use strict';

const GAME_TITLE = 'ALCATRAZ - A Fuga Impossível';
const GAME_AUTHOR = 'Programa de Wilson F. Martins';

// Labirinto: 10 linhas (PL 2..11) x 14 colunas (PC 0..13).
// Cada célula é uma string de 4 dígitos hex = tile [Norte, Sul, Leste, Oeste].
const MAZE = [
  ['1001','1010','1001','1100','1100','1009','1100','1100','1100','1100','1010','10C1','1100','1010'],
  ['0011','0011','0101','1100','1010','0011','1001','1010','1011','1011','0011','0101','1010','0011'],
  ['0011','0011','1101','1100','0110','0011','5011','0101','0110','0011','0011','1011','0011','0011'],
  ['0011','0011','1001','1000','1010','8011','0001','1100','1100','0010','0011','0011','0011','0011'],
  ['0111','0101','0010','0011','0011','0011','0011','1101','1100','0612','0011','0101','0010','0011'],
  ['1001','1010','0011','0011','0011','0011','0001','1102','1110','6611','0011','1011','0011','0111'],
  ['0011','0011','0111','0011','0101','0110','0101','1340','1111','6611','0011','0101','0100','1010'],
  ['0011','0011','1001','7000','1010','1101','1100','0100','1010','6111','0011','1001','1100','0B10'],
  ['0011','0011','0011','5011','0101','1100','1100','1110','0011','1001','0110','0011','1001','0110'],
  ['0111','0101','0110','0101','1100','1100','1100','1100','0110','01A1','11DA','0110','0101','1110'],
];

const MAZE_ROW_OFFSET = 2; // PL inicial da matriz (linha 0 = PL 2)
const START_PC = 8;
const START_PL = 7;

// Layout da tela MSX Screen 2 (256x192 px = 32x24 blocos de 8x8).
// O original NUNCA limpa a tela durante o jogo: cada célula visitada revela
// seu bloco 3x3 numa posição ABSOLUTA (ED=BASE(10)+PC*2+PL*64+3), acumulando
// um mapa explorado. Aqui replicamos esse layout absoluto (linhas 690-790).
const NATIVE_TILE_PX = 8;
const SCREEN_COLS = 32;
const SCREEN_ROWS = 24;
const SCREEN_W = SCREEN_COLS * NATIVE_TILE_PX; // 256
const SCREEN_H = SCREEN_ROWS * NATIVE_TILE_PX; // 192
const MAZE_BASE_COL = 3; // ED=BASE(10)+PC*2+PL*64+3 -> coluna da tela = PC*2+3 (idêntico ao original)
const MAZE_BASE_ROW = 4; // e linha da tela = PL*2 (PL começa em 2 -> linha 4)
const BACKGROUND_COLOR_IDX = 5; // COLOR1,5,5: fundo/borda = azul claro (linha 230)

function screenCol(pc) { return MAZE_BASE_COL + pc * 2; }
function screenRow(pl) { return MAZE_BASE_ROW + (pl - MAZE_ROW_OFFSET) * 2; }

// Significado de cada dígito de tile (0-F), usado tanto no labirinto quanto
// como índice do desenho/cor do bloco 8x8.
const TILE = {
  EMPTY: 0, WALL: 1, BARS: 2, GUARD: 3, ELECTRIC_CHAIR: 4, DOOR: 5,
  DARK: 6, FIRE: 7, ALARM_TRAP: 8, LIGHT_BEAM: 9, DOGS: 10, DIRT: 11,
  JAILER: 12, SECRET_PASSAGE: 13, PLAYER: 14, WATER: 15,
  POWER_GATE: 16, SLUICE_GATE: 17, LIVE_WIRE: 18, RADIO_MAST: 19,
  ROOF_EDGE: 20, DISGUISED_PLAYER: 21, OUTDOOR_GROUND: 22,
  CHAIN_FENCE: 23, SERVICE_DECK: 24,
  // Ato 2 do Alcatraz 2 (costão + cais): chars P..V no labirinto
  ROCK_GROUND: 25, SEA: 26, PIER_DECK: 27, BOAT: 28, WATCHTOWER: 29,
  CREVICE: 30, ROPE: 31,
};

// Substantivos: [códigoLocalInicial, nome]. Códigos especiais:
// "**" = carregado pelo jogador, ".." = cenário universal (sempre acessível),
// "JJ" = não existe ainda (criado durante o jogo), "  " = destruído/removido.
const NOUNS = [
  ['JJ', 'COMIDA'], ['JJ', 'TIRAS'], ['JJ', 'CORDA'], ['JJ', 'CHAVE'],
  ['DC', 'LENCOL'], ['IG', 'DINHEIRO'], ['AE', 'LANTERNA'], ['E?', 'SERRA'],
  ['D?', 'PILHA'], ['EE', 'FOSFOROS'], ['AG', 'JORNAL'], ['CB', 'COBERTOR'],
  ['<G', 'AGUA'], ['AE', 'REVOLVER'], ['<B', 'FITA'], ['>@', 'GRAVADOR'],
  ['G@', 'PA'], ['>D', 'OSSO'], ['D?', 'BARALHO'], ['FA', 'ROUPA'],
  ['GC', 'BEBIDA'], ['CF', 'ESPELHO'], ['CC', 'GUARDA'], ['DC', 'CAMA'],
  ['..', 'GRADES'], ['CB', 'PRESIDIARIO'], ['B@', 'TOMADA'], ['..', 'PORTA'],
  ['?E', 'FOGO'], ['IC', 'POCO'], ['G>', 'CARCEREIRO'], ['IE', 'TERRA'],
  ['EG', 'CAES'], ['AA', 'ALARME'], ['A>', 'LUZ'],
  ['  ', 'UNIFORME'], ['  ', 'CARTAO'], ['  ', 'CHIP'], ['  ', 'INIBIDOR'],
  ['  ', 'ALICATE'], ['  ', 'PLANTA'], ['  ', 'DUTO'], ['  ', 'RESPIRADOR'],
  ['  ', 'FUSIVEL'], ['  ', 'PAINEL'], ['  ', 'MANIVELA'], ['  ', 'GANCHO'],
  ['  ', 'ESCOTILHA'], ['  ', 'ISOLANTE'], ['  ', 'FIO'], ['  ', 'ANTENA'],
  ['  ', 'RADIO'], ['  ', 'ARAME'], ['  ', 'FRAGMENTO'], ['  ', 'CINTA'],
  ['  ', 'FACA'],
  ['  ', 'MANGUEIRA'], ['  ', 'MASTRO'], ['  ', 'PEDRA'], ['  ', 'HOLOFOTE'],
  ['  ', 'TABUA'], ['  ', 'FENDA'], ['  ', 'REDE'], ['  ', 'LANCHA'],
  ['  ', 'MAR'],
];
// Índices de nouns (para referência ao ler as ações abaixo)
const N_COMIDA=0, N_TIRAS=1, N_CORDA=2, N_CHAVE=3, N_LENCOL=4, N_DINHEIRO=5,
  N_LANTERNA=6, N_SERRA=7, N_PILHA=8, N_FOSFOROS=9, N_JORNAL=10, N_COBERTOR=11,
  N_AGUA=12, N_REVOLVER=13, N_FITA=14, N_GRAVADOR=15, N_PA=16, N_OSSO=17,
  N_BARALHO=18, N_ROUPA=19, N_BEBIDA=20, N_ESPELHO=21, N_GUARDA=22, N_CAMA=23,
  N_GRADES=24, N_PRESIDIARIO=25, N_TOMADA=26, N_PORTA=27, N_FOGO=28, N_POCO=29,
  N_CARCEREIRO=30, N_TERRA=31, N_CAES=32, N_ALARME=33, N_LUZ=34,
  N_UNIFORME=35, N_CARTAO=36, N_CHIP=37, N_INIBIDOR=38, N_ALICATE=39,
  N_PLANTA=40, N_DUTO=41, N_RESPIRADOR=42, N_FUSIVEL=43, N_PAINEL=44,
  N_MANIVELA=45, N_GANCHO=46, N_ESCOTILHA=47, N_ISOLANTE=48, N_FIO=49,
  N_ANTENA=50, N_RADIO=51, N_ARAME=52, N_FRAGMENTO=53, N_CINTA=54,
  N_FACA=55,
  N_MANGUEIRA=56, N_MASTRO=57, N_PEDRA=58, N_HOLOFOTE=59, N_TABUA=60,
  N_FENDA=61, N_REDE=62, N_LANCHA=63, N_MAR=64;

// Formas acentuadas de NOUNS, na mesma ordem/índices, só para a legenda.
const NOUNS_DISPLAY = [
  'COMIDA', 'TIRAS', 'CORDA', 'CHAVE', 'LENÇOL', 'DINHEIRO', 'LANTERNA', 'SERRA',
  'PILHA', 'FÓSFOROS', 'JORNAL', 'COBERTOR', 'ÁGUA', 'REVÓLVER', 'FITA', 'GRAVADOR',
  'PÁ', 'OSSO', 'BARALHO', 'ROUPA', 'BEBIDA', 'ESPELHO', 'GUARDA', 'CAMA',
  'GRADES', 'PRESIDIÁRIO', 'TOMADA', 'PORTA', 'FOGO', 'POÇO', 'CARCEREIRO', 'TERRA',
  'CÃES', 'ALARME', 'LUZ',
  'UNIFORME', 'CARTAO', 'CHIP', 'INIBIDOR', 'ALICATE', 'PLANTA', 'DUTO',
  'RESPIRADOR', 'FUSIVEL', 'PAINEL', 'MANIVELA', 'GANCHO', 'ESCOTILHA',
  'ISOLANTE', 'FIO', 'ANTENA', 'RADIO', 'ARAME', 'FRAGMENTO', 'CINTA',
  'FACA',
  'MANGUEIRA', 'MASTRO', 'PEDRA', 'HOLOFOTE', 'TÁBUA', 'FENDA', 'REDE',
  'LANCHA', 'MAR',
];

const VERBS = [
  'RASGUE', 'AMARRE', 'PUXE', 'COMA', 'COLOQUE', 'LIGUE', 'CORTE', 'TIRE',
  'CAVE', 'DISPARE', 'VISTA', 'ENTRE', 'PECA', 'JOGUE', 'QUEIME', 'PEGUE',
  'SOLTE', 'DE', 'MATE', 'EXAMINE', 'AMEACE', 'QUEBRE', 'BEBA', 'ABRA',
];

// Formas acentuadas de VERBS/NOUNS, usadas SOMENTE para exibição na legenda
// (mesma ordem/índices). O parser continua casando as formas sem acento
// acima, exatamente como o jogador digita — isto não muda a mecânica.
const VERBS_DISPLAY = [
  'RASGUE', 'AMARRE', 'PUXE', 'COMA', 'COLOQUE', 'LIGUE', 'CORTE', 'TIRE',
  'CAVE', 'DISPARE', 'VISTA', 'ENTRE', 'PEÇA', 'JOGUE', 'QUEIME', 'PEGUE',
  'SOLTE', 'DÊ', 'MATE', 'EXAMINE', 'AMEACE', 'QUEBRE', 'BEBA', 'ABRA',
];

// Ações na ordem de checagem. As ações exatas vêm primeiro; no final ficam
// as ações genéricas por verbo, que preservam a tabela do BASIC original.
const V_AMARRE = 1, V_PUXE = 2, V_COLOQUE = 4, V_LIGUE = 5, V_CORTE = 6, V_VISTA = 10,
  V_ENTRE = 11, V_JOGUE = 13, V_MATE = 18, V_ABRA = 23;

function dataCodeChar(idx) { return String.fromCharCode(idx + 50); }
function dataActionCode(verbIdx, noun1Idx = -1, noun2Idx = -1) {
  let code = dataCodeChar(verbIdx);
  if (noun1Idx !== -1) code += dataCodeChar(noun1Idx);
  if (noun2Idx !== -1) code += dataCodeChar(noun2Idx);
  return code;
}

const GENERIC_ACTION_CODES = ['>','?','@','A','B','C','D','E','F','G'];

const ACTION_CODES = [
  '23','24','26','27','2<','2=','2D','2E','33','34O','34I','34J','44','52','5C',
  '64O','66I','6:8','6:A','6<M','6=N','6>N','6@A','6GT','69L','6>S','78','79','7A',
  '86','84','83','8M9','99L','9:8','9@A','9:A',':QB',';?','<E','=O','H>','HF','IJ5','IM',
  dataActionCode(V_VISTA, N_UNIFORME),
  dataActionCode(V_COLOQUE, N_CHIP, N_CARTAO),
  dataActionCode(V_COLOQUE, N_PILHA, N_INIBIDOR),
  dataActionCode(V_LIGUE, N_INIBIDOR),
  dataActionCode(V_ABRA, N_PORTA, N_CARTAO),
  dataActionCode(V_CORTE, N_GRADES, N_ALICATE),
  dataActionCode(V_AMARRE, N_CINTA, N_FRAGMENTO),
  dataActionCode(V_MATE, N_GUARDA, N_ARAME),
  dataActionCode(V_MATE, N_GUARDA, N_FACA),
  dataActionCode(V_ENTRE, N_DUTO),
  dataActionCode(V_VISTA, N_RESPIRADOR),
  dataActionCode(V_COLOQUE, N_FUSIVEL, N_PAINEL),
  dataActionCode(V_PUXE, N_MANIVELA),
  dataActionCode(V_ABRA, N_ESCOTILHA), // sem instrumento: só a dica
  dataActionCode(V_ABRA, N_ESCOTILHA, N_GANCHO),
  dataActionCode(V_COLOQUE, N_ISOLANTE, N_FIO),
  dataActionCode(V_COLOQUE, N_ANTENA, N_RADIO),
  dataActionCode(V_LIGUE, N_RADIO),
  // ---- Ato 2 (descida, costão e cais) ----
  dataActionCode(V_AMARRE, N_MANGUEIRA, N_MASTRO),
  dataActionCode(V_JOGUE, N_PEDRA, N_HOLOFOTE),
  dataActionCode(V_JOGUE, N_PEDRA, N_GUARDA),
  dataActionCode(V_JOGUE, N_REDE, N_GUARDA),
  dataActionCode(V_COLOQUE, N_TABUA, N_FENDA),
  dataActionCode(V_ENTRE, N_LANCHA),
  ...GENERIC_ACTION_CODES,
];
const AS_LIMIT = ACTION_CODES.length - GENERIC_ACTION_CODES.length - 1;

// Paleta MSX1 / TMS9918 (índice -> cor CSS)
const PALETTE = [
  'transparent', '#000000', '#3EB849', '#74D07D', '#5955E0', '#8076F1',
  '#B95E51', '#65DBEF', '#DB6559', '#FF897D', '#CCC35E', '#DED087',
  '#3AA241', '#B766B5', '#CCCCCC', '#FFFFFF',
];

// Bitmaps 8x8 (um byte por linha, MSB=pixel mais à esquerda) e cor por linha
// (nibble alto = cor de frente, nibble baixo = cor de fundo), para os tiles 0-14.
// Extraídos das linhas DATA 3480-3770 do BASIC original.
const TILE_BITMAPS = [
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00], // 0 EMPTY
  [0x01,0x01,0x01,0xFF,0x10,0x10,0x10,0xFF], // 1 WALL
  [0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18], // 2 BARS
  [0x18,0x18,0x3C,0x5A,0x99,0x18,0x24,0x24], // 3 GUARD
  [0x02,0x02,0x02,0x02,0x3E,0x3E,0x22,0x22], // 4 ELECTRIC_CHAIR
  [0x00,0x81,0xFF,0xFF,0x02,0x06,0x00,0x00], // 5 DOOR
  [0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF], // 6 DARK
  [0x08,0x28,0x3A,0x7A,0x7E,0x7E,0x3E,0x1C], // 7 FIRE
  [0x07,0x0F,0x05,0x07,0x07,0x00,0x00,0x00], // 8 ALARM_TRAP
  [0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18], // 9 LIGHT_BEAM
  [0x18,0x3C,0x7E,0xFF,0xE7,0xC3,0xC3,0xC3], // A DOGS
  [0x06,0x0E,0x1F,0x7D,0xDF,0xF6,0xBB,0xEF], // B DIRT
  [0x18,0x18,0x3C,0x5A,0x99,0x18,0x24,0x24], // C JAILER
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00], // D SECRET_PASSAGE
  [0x18,0x18,0x3C,0x5A,0x99,0x18,0x24,0x24], // E PLAYER
  [0x00,0x00,0x3C,0x42,0x81,0x00,0x3C,0x42], // F WATER (ondas simples sobre agua funda)
  [0x92,0x92,0x92,0xFF,0xFF,0x92,0x92,0x92], // G POWER_GATE (barras verticais + travessas energizadas)
  [0xFF,0x81,0xBD,0xA5,0xA5,0xBD,0x81,0xFF], // H SLUICE_GATE (placa com moldura dupla)
  [0x00,0x44,0x11,0xFF,0x88,0x22,0x00,0x00], // I LIVE_WIRE (fio central com faiscas)
  [0x10,0x38,0x54,0x92,0x10,0x10,0x10,0x38], // J RADIO_MAST (antena, haste e base)
  [0xFF,0xFF,0x24,0x24,0x24,0x24,0x24,0x24], // K ROOF_EDGE (corrimao com montantes)
  [0x18,0x18,0x3C,0x5A,0x99,0x18,0x24,0x24], // L DISGUISED_PLAYER
  [0x00,0x10,0x00,0x02,0x00,0x40,0x00,0x08], // M OUTDOOR_GROUND (concreto pontilhado)
  [0x99,0x66,0x66,0x99,0x99,0x66,0x66,0x99], // N CHAIN_FENCE (malha de losangos)
  [0xFF,0x00,0x99,0x00,0xFF,0x00,0x99,0x00], // O SERVICE_DECK (grade metalica)
  [0x00,0x44,0x00,0x09,0x20,0x00,0x92,0x00], // P ROCK_GROUND (pedras irregulares)
  [0x00,0x99,0x66,0x00,0x99,0x66,0x00,0x00], // Q SEA (mar noturno)
  [0xFF,0xFF,0x00,0xFF,0xFF,0x00,0xFF,0xFF], // R PIER_DECK (tabuas do cais)
  [0x10,0x10,0x38,0x7C,0xFE,0xFF,0x7E,0x00], // S BOAT (mastro e casco da lancha)
  [0x38,0x28,0x38,0x10,0x38,0x54,0x92,0xFE], // T WATCHTOWER (torre com lampada)
  [0x18,0x3C,0x3C,0x7E,0x7E,0x3C,0x3C,0x18], // U CREVICE (fenda escura nas rochas)
  [0x10,0x18,0x08,0x18,0x10,0x18,0x08,0x18], // V ROPE (mangueira pendurada)
];
const TILE_COLORS = [
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00], // 0
  [0xE6,0xE6,0xE6,0xE6,0xE6,0xE6,0xE6,0xE6], // 1
  [0x10,0x40,0x10,0x40,0x10,0x40,0x10,0x40], // 2
  [0x10,0xD0,0x10,0x10,0x10,0x10,0x10,0x10], // 3
  [0xE0,0xE0,0xE0,0xE0,0xF0,0xE0,0xE0,0xE0], // 4
  [0x10,0x10,0x10,0xC0,0x10,0x10,0x10,0x10], // 5
  [0x10,0x10,0x10,0x10,0x10,0x10,0x10,0x10], // 6
  [0x60,0x60,0x60,0x80,0x80,0x80,0x90,0x90], // 7
  [0x10,0x10,0x10,0x10,0x10,0x10,0x10,0x10], // 8
  [0x70,0x70,0x70,0x70,0x70,0x70,0x70,0x70], // 9
  [0x90,0xD0,0x80,0x60,0xF1,0xF1,0xF1,0xF1], // A
  [0x90,0x90,0x90,0x90,0x91,0x91,0x91,0x91], // B
  [0x10,0xD0,0xF0,0xF0,0xF0,0xF0,0xF0,0xF0], // C
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00], // D
  [0xF0,0x60,0x10,0xF0,0x10,0xF0,0x10,0xF0], // E
  [0x74,0x74,0x74,0x74,0x74,0x74,0x74,0x74], // F ciano sobre azul escuro (agua funda)
  [0xA1,0xB1,0xA1,0xB1,0xA1,0xB1,0xA1,0xB1], // G amarelos alternados sobre preto (energizado)
  [0xE4,0xE4,0xE4,0xE4,0xE4,0xE4,0xE4,0xE4], // H cinza sobre azul escuro (comporta na agua)
  [0xB1,0xB1,0xB1,0xF1,0xB1,0xB1,0xB1,0xB1], // I faiscas amarelas, fio branco, sobre preto
  [0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E], // J silhueta preta sobre cinza do telhado
  [0xE1,0xE1,0xE1,0xE1,0xE1,0xE1,0xE1,0xE1], // K corrimao cinza sobre o vazio escuro
  [0x10,0xD0,0x10,0x10,0x10,0x10,0x10,0x10], // L
  [0xFE,0xFE,0xFE,0xFE,0xFE,0xFE,0xFE,0xFE], // M
  [0xE0,0xE0,0xE0,0xE0,0xE0,0xE0,0xE0,0xE0], // N
  [0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E], // O
  [0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E], // P pedras escuras sobre cinza
  [0x71,0x71,0x71,0x71,0x71,0x71,0x71,0x71], // Q cristas cianas sobre o negro do mar
  [0xA6,0xA6,0xA6,0xA6,0xA6,0xA6,0xA6,0xA6], // R madeira (amarelo escuro sobre marrom)
  [0xF4,0xF4,0xF4,0xF4,0xF4,0xF4,0xF4,0xF4], // S lancha branca sobre a agua escura
  [0xE1,0xE1,0xE1,0xE1,0xE1,0xE1,0xE1,0xE1], // T torre cinza contra a noite
  [0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E,0x1E], // U fenda negra no cinza da rocha
  [0xB1,0xB1,0xB1,0xB1,0xB1,0xB1,0xB1,0xB1], // V mangueira amarela contra a parede
];

// Percurso vetorial do logo do título (GOSUB 3030 do original): ponto inicial
// seguido de 66 pares (x,y) desenhados como linha contínua LINE(x,y)-(a,b).
const TITLE_PATH = [
  44,78, 44,78, 16,114, 28,114, 36,103, 36,114, 44,114, 44,78,
  48,78, 48,114, 72,114, 64,106, 64,106, 56,106, 56,78, 48,78,
  72,78, 72,114, 96,114, 88,106, 80,106, 80,86, 88,86, 96,78, 72,78,
  124,78, 96,114, 108,114, 116,103, 116,114, 124,114, 124,78,
  124,78, 132,86, 136,86, 136,114, 144,114, 144,86, 148,86, 156,78, 124,78,
  156,78, 156,114, 164,114, 164,98, 172,114, 180,114, 172,98, 180,98, 172,78, 156,78,
  208,78, 180,114, 192,114, 200,103, 200,114, 208,114, 208,78,
  208,78, 240,78, 224,106, 232,106, 240,114, 208,114, 224,86, 216,86, 208,78,
];
// Coordenadas X para o preenchimento (PAINT) de cada letra, Y fixo em 80.
const TITLE_FILL_X = [43, 49, 73, 123, 127, 159, 207, 220];
const TITLE_FILL_Y = 80;

// ---- Cenários jogáveis ----

const ORIGINAL_NOUN_COUNT = N_LUZ + 1;
const ORIGINAL_NOUN_LOCS = NOUNS.map(([loc]) => loc);

// Área externa (3 últimas linhas + anexo no telhado):
// - Pátio das Bombas (chão M, cercas N): duto em (0,11), alcove do respirador
//   em (0,10), painel em (2,10), portão energizado G, manivela em (3,10),
//   comporta H entre (3,9)-(4,9), sensor externo 8 entre (4,9)-(5,9),
//   escotilha em (5,9).
// - Galeria inundada (links F, células submersas): (1,11)-E->(2,11)-E->(3,11);
//   gancho no meio (2,11) e fusível no fundo (3,11). Exige respirador vestido
//   na ida E na volta.
// - Telhado (grade O, bordas K): pouso da escotilha em (6,9), anexo com
//   isolante em (6,8), fio energizado I entre (7,9)-(8,9), antena em (8,10),
//   mastro J entre (9,10)-(9,11), rádio em (9,11).
const ALCATRAZ2_MAZE = [
  ['1111','1101','1000','1000','1000','1010','1111','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','0001','0010','0011','0111','1111','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','0101','0100','0130','1153','1135','1003','1180','1008','1010','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','0101','1010','0011','0011','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','0101','0100','0180','1018','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','0011','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','KOKK','1111','1111','1111','1111','0121','1012','1111'],
  ['1111','1111','1111','NMHN','NN8H','NN18','OKO1','KKIO','KOKI','1111','1111','1111','0101','1010'],
  ['NMNN','NMMN','N1GM','M1NG','1111','1111','1111','1111','OKOK','KJKO','1111','1111','1111','0011'],
  ['MNMN','M1FM','11FF','111F','1111','1111','1111','1111','1111','JKKK','1111','1111','1111','0111'],
];

function makeNounLocs(overrides) {
  const locs = NOUNS.map(() => '  ');
  for (const [idx, loc] of Object.entries(overrides)) locs[Number(idx)] = loc;
  return locs;
}

const ALCATRAZ2_NOUN_LOCS = makeNounLocs({
  [N_PILHA]: 'C@',
  [N_GRADES]: '..',
  [N_PORTA]: '..',
  [N_UNIFORME]: 'JJ',
  [N_CARTAO]: 'JJ',
  [N_CHIP]: 'JJ',
  [N_INIBIDOR]: 'C@',
  [N_ALICATE]: 'DB',
  [N_PLANTA]: 'CA',
  [N_ARAME]: '>>',
  [N_FRAGMENTO]: '@>',
  [N_CINTA]: '??',
  [N_FACA]: 'JJ',
  [N_DUTO]: 'IG',
  [N_RESPIRADOR]: '<F', // alcove ao norte da saída do duto (fora do caminho óbvio)
  [N_FUSIVEL]: '?G',    // fundo da galeria inundada
  [N_PAINEL]: '>F',     // lado seco do pátio — exige mergulho de ida e volta
  [N_MANIVELA]: '?F',
  [N_GANCHO]: '>G',     // meio da galeria inundada
  [N_ESCOTILHA]: 'AE',
  [N_ISOLANTE]: 'BD',   // anexo do telhado, antes do fio energizado
  [N_FIO]: 'CE',
  [N_ANTENA]: 'DF',
  [N_RADIO]: 'EG',
  [N_MANGUEIRA]: 'BD',  // caixa de incêndio no anexo do telhado
  [N_MASTRO]: 'EG',     // o mastro fica junto do rádio
});

// ---- Ato 2 do Alcatraz 2: face externa, costão e cais ----
// Ao descer pela mangueira a tela é limpa e este mapa substitui o anterior.
// Terrenos: P=rocha (costão), R=madeira (cais), Q=mar (morte), 9=holofote
// (morte até ser quebrado), U=fenda (bloqueia até a tábua), T=torre,
// 3=guarda do píer (bloqueia/mata na insistência), S=lancha atracada.
const ALCATRAZ2_MAZE_ACT2 = [
  ['1111','11P1','1P1P','1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','P1P1','1PPP','1P1P','1111','1111','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','1111','P111','P9T1','1111','1111','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','1111','11P1','91PP','11PP','1P1P','1111','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','P1U1','1P1U','1111','1111','1111','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','P1P1','1P1P','1111','1111','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','PPP1','111P','1111','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','PQP1','1QRP','1RQR','1111','1111','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','RQRQ','QQ3R','QRQ3','1111'],
  ['1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','1111','RQSQ','1111'],
];
const A2_ACT2_START_PC = 1;
const A2_ACT2_START_PL = 2;

// Objetos posicionados ao entrar no Ato 2 (o que não estiver carregado fica
// para trás na prisão; ver beginAct2 em actions.js).
const ALCATRAZ2_ACT2_NOUN_LOCS = {
  [N_PEDRA]: '?@',    // pedras soltas num desvio do costão
  [N_HOLOFOTE]: '..', // visível do costão inteiro (fica no alto da torre)
  [N_TABUA]: '?A',    // destroços perto da zona varrida pelo holofote
  [N_FENDA]: 'BB',    // fenda nas rochas
  [N_REDE]: 'ED',     // barraca de pesca abandonada
  [N_GUARDA]: 'GF',   // guarda do píer
  [N_LANCHA]: 'HG',   // lancha atracada na ponta do cais
  [N_MAR]: '..',
};

const ALCATRAZ_SCENARIOS = {
  original: {
    id: 'original',
    title: 'ALCATRAZ',
    subtitle: 'A fuga impossivel',
    label: 'Original MSX',
    year: '1986',
    credit: 'Programa original para MSX de Wilson F. Martins (1986) - port HTML/JavaScript por Rodrigo G.M. Garcia',
    description: 'A aventura original, com mapa, objetos, perigos e truques preservados do BASIC de 1986.',
    introMessage: 'Você está preso em Alcatraz. As setas do teclado movem seu personagem.',
    maze: MAZE,
    startPc: START_PC,
    startPl: START_PL,
    nounLocs: ORIGINAL_NOUN_LOCS,
    nounIndexes: Array.from({ length: ORIGINAL_NOUN_COUNT }, (_, idx) => idx),
    takeableNouns: [],
  },
  alcatraz2: {
    id: 'alcatraz2',
    title: 'ALCATRAZ 2',
    subtitle: 'A fuga ainda mais impossivel',
    label: 'Alcatraz 2',
    year: '2026',
    credit: 'Sequência não oficial criada por Rodrigo G.M. Garcia sobre a mecânica do clássico de Wilson F. Martins.',
    description: 'Uma nova prisão, mais severa e menos previsível. Nada do que funcionou antes garante a fuga agora.',
    introMessage: 'Alcatraz foi reativada. Você acorda em um setor desconhecido, cercado por rotinas novas e perigos invisíveis.',
    maze: ALCATRAZ2_MAZE,
    startPc: 1,
    startPl: 2,
    nounLocs: ALCATRAZ2_NOUN_LOCS,
    nounIndexes: [
      N_UNIFORME, N_CARTAO, N_CHIP, N_PILHA, N_INIBIDOR, N_ALICATE, N_PLANTA,
      N_DUTO, N_RESPIRADOR, N_FUSIVEL, N_PAINEL, N_MANIVELA, N_GANCHO,
      N_ESCOTILHA, N_ISOLANTE, N_FIO, N_ANTENA, N_RADIO, N_ARAME,
      N_FRAGMENTO, N_CINTA, N_FACA,
      N_MANGUEIRA, N_MASTRO, N_PEDRA, N_HOLOFOTE, N_TABUA, N_FENDA, N_REDE,
      N_LANCHA, N_MAR,
      N_GRADES, N_PORTA, N_ALARME, N_GUARDA,
    ],
    takeableNouns: [
      N_UNIFORME, N_CARTAO, N_CHIP, N_INIBIDOR, N_ALICATE, N_PLANTA,
      N_RESPIRADOR, N_FUSIVEL, N_MANIVELA, N_GANCHO, N_ISOLANTE, N_ANTENA,
      N_ARAME, N_FRAGMENTO, N_CINTA, N_FACA,
      N_MANGUEIRA, N_PEDRA, N_TABUA, N_REDE,
    ],
  },
};
