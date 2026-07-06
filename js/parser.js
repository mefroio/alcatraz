// Interpretador de comandos: replica a gramática do BASIC original
// (linhas 1010-1230): VERBO [SUBSTANTIVO [preposições... SUBSTANTIVO2]]
// Casamento sempre exato (sem abreviação); tudo entre o 1o substantivo e a
// última palavra é ignorado (tratado como preposição, ex: "COM", "NO", "DA").
'use strict';

// Remove acentos (ex: "LENÇOL"/"PEÇA"/"ÁGUA" -> "LENCOL"/"PECA"/"AGUA") para
// que o jogador possa digitar com ou sem acentuação correta; o vocabulário
// interno (VERBS/NOUNS) é sempre sem acento, então normalizamos a entrada
// antes de comparar — isso não muda quais palavras são aceitas, só aceita
// também a grafia acentuada correta.
function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function splitWords(text) {
  return text.split(' ').filter((w) => w.length > 0);
}

function findVerb(word) {
  return VERBS.indexOf(word);
}

function findNoun(word) {
  return NOUNS.findIndex(([, name]) => name === word);
}

// Recebe o texto já em maiúsculas (sobra de espaços duplicados não importa,
// splitWords ignora tokens vazios). Retorna:
//   { ok:true, verbIdx, noun1Idx, noun2Idx }   (noun1Idx/noun2Idx = -1 se ausente)
//   { ok:false, error:'empty' }
//   { ok:false, error:'verb'|'noun1'|'noun2', word:'...' }
function parseCommand(rawText) {
  const trimmed = stripAccents(rawText).replace(/\s+$/, '');
  if (trimmed === '') return { ok: false, error: 'empty' };

  const words = splitWords(trimmed);
  const verbIdx = findVerb(words[0]);
  if (verbIdx === -1) return { ok: false, error: 'verb', word: words[0] };

  if (words.length === 1) {
    return { ok: true, verbIdx, noun1Idx: -1, noun2Idx: -1 };
  }

  const noun1Idx = findNoun(words[1]);
  if (noun1Idx === -1) return { ok: false, error: 'noun1', word: words[1] };

  if (words.length === 2) {
    return { ok: true, verbIdx, noun1Idx, noun2Idx: -1 };
  }

  // Última palavra = 2o substantivo; palavras entre noun1 e ela são preposições ignoradas.
  const lastWord = words[words.length - 1];
  const noun2Idx = findNoun(lastWord);
  if (noun2Idx === -1) return { ok: false, error: 'noun2', word: lastWord };

  return { ok: true, verbIdx, noun1Idx, noun2Idx };
}
