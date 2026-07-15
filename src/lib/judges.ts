/**
 * The pool of judges who may assess the ESLessonCraftMY booth at an exhibition.
 *
 * At any given assessment session, 3 of these 9 judges participate. The judge
 * assessment screen shows 3 cards; each card's name selector lists these names
 * (minus any names already selected in the other cards) so each judge can be
 * picked only once across the 3 cards.
 */
export const JUDGE_NAMES = [
  'DR. KUMARAN A/L GENGATHARAN',
  'DR. TENGKU NURLIDA BINTI TENGKU ZAINUL ABIDIN',
  'DR. MAZNAH BINTI SALLEH',
  'DR. KHOR AIK KEONG',
  'PN. SYAIDATUL ROZLIANNA BINTI LAILATUL KADIR',
  'Ts. MOHD HAZLIE BIN MUHAMAD',
  'DR SAMRI BIN CONGO',
  'DR. MASYITHOH BINTI MD ZUBER',
  'DR. FAIRUZ BIN SAMSUDIN',
] as const

export type JudgeName = (typeof JUDGE_NAMES)[number]
