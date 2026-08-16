export const INPUT_FORMATS = ['json', 'yaml'] as const;

export type InputFormat = (typeof INPUT_FORMATS)[number];
