/** Canonical insurance domain enum shared by frontend and backend. */
export enum InsuranceDomain {
  PYME = 'pyme',
  AUTOS = 'autos',
  COPROPIEDADES = 'copropiedades',
  VIDA_GRUPO = 'vida_grupo',
  SALUD = 'salud',
  CUMPLIMIENTO = 'cumplimiento',
  TRANSPORTE = 'transporte',
  HOGAR = 'hogar',
  EQUIPO_MAQUINARIA = 'equipo_maquinaria',
  CASCO_EMBARCACION = 'casco_embarcacion',
}

/** Literal-union type equivalent — freely assignable with domain strings. */
export type InsuranceDomainType = `${InsuranceDomain}`;
