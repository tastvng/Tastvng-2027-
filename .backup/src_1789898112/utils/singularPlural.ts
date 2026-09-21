/**
 * Retorna el texto singular o plural según el conteo
 * @param count número a evaluar
 * @param singular texto singular (ej: "inscrit")
 * @param plural texto plural (ej: "inscrits")
 * @returns string singular o plural
 */
export const singularPlural = (count: number, singular: string, plural: string): string => {
  return count === 1 ? singular : plural;
};
