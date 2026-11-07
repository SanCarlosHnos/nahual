// Revisor de idioma: comprueba que lo que Nahual le dice al usuario esté en español latinoamericano.
// No revisa el código, los comandos ni las rutas: solo la prosa.

const OTROS_ALFABETOS = /[Ѐ-ӿ֐-׿؀-ۿ฀-๿぀-ヿ㐀-䶿一-鿿가-힯]/;

const ESPANOL_DE_ESPANA =
  /(?<![\p{L}])(vosotros|vosotras|vuestr[oa]s?|ordenador(es)?|fichero(s)?|habéis|podéis|tenéis|queréis|sabéis|hacéis|estáis|decidme|mirad)(?![\p{L}])/iu;

/** Palabras inglesas que nunca aparecen en un texto técnico en español. */
const PALABRAS_INGLESAS = new Set([
  'the',
  'and',
  'with',
  'this',
  'that',
  'these',
  'those',
  'you',
  'your',
  'are',
  'is',
  'was',
  'were',
  'will',
  'would',
  'should',
  'could',
  'here',
  'there',
  "let's",
  "i'll",
  "i'm",
  "it's",
  "don't",
  'we',
  'our',
  'they',
  'now',
  'first',
  'then',
  'which',
  'what',
  'have',
  'been',
  'from',
  'into',
  'please',
  'sure',
  'okay',
  'also',
  'just',
  'need',
  'want',
  'of',
  'to',
  'for',
  'it',
  'be',
  'by',
  'an',
  'on',
  'file',
  'step',
  'next',
  'let',
  'going',
  'will',
  'done',
  'great',
  'now',
  'below',
  'above',
]);

export interface RevisionIdioma {
  ok: boolean;
  motivo: string;
}

/** Quita lo que no es prosa: bloques de código, código en línea, enlaces, rutas y nombres de archivo. */
export function quitarNoProsa(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+[\\/._:@=]\S+/g, ' ');
}

export function revisarIdioma(texto: string): RevisionIdioma {
  const prosa = quitarNoProsa(texto);
  if (!prosa.trim()) return { ok: true, motivo: '' };
  if (OTROS_ALFABETOS.test(prosa))
    return { ok: false, motivo: 'usaste caracteres de otro idioma (por ejemplo chino o ruso)' };
  const espana = prosa.match(ESPANOL_DE_ESPANA);
  if (espana)
    return {
      ok: false,
      motivo: `usaste español de España («${espana[0]}»); usa español latinoamericano`,
    };
  const palabras = prosa.toLowerCase().match(/[a-záéíóúñü']+/g) ?? [];
  const inglesas = palabras.filter((p) => PALABRAS_INGLESAS.has(p));
  const distintas = [...new Set(inglesas)];
  if (distintas.length >= 3 && inglesas.length / palabras.length >= 0.06) {
    return { ok: false, motivo: `escribiste en inglés («${distintas.slice(0, 4).join('», «')}»)` };
  }
  return { ok: true, motivo: '' };
}
