/**
 * Legal Content and Regulatory Policies for Comparador CSA
 * Compliance: Colombia - Ley 1581 de 2012, Decreto 1377 de 2013, Circular Externa SFC
 */

export interface LegalSection {
  id: string;
  title: string;
  content: string[];
}

export interface LegalDocument {
  id: 'terms' | 'privacy' | 'security' | 'disclaimer';
  title: string;
  shortTitle: string;
  lastUpdated: string;
  version: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS_OF_SERVICE: LegalDocument = {
  id: 'terms',
  title: 'Términos y Condiciones de Uso de la Plataforma Comparador CSA',
  shortTitle: 'Términos y Condiciones',
  lastUpdated: 'Octubre 2026',
  version: '2.1',
  summary:
    'Condiciones generales que regulan el acceso, licencias de uso, responsabilidades y alcances operativos del software Comparador CSA para intermediarios, corredores y agencias de seguros.',
  sections: [
    {
      id: 'terms-1',
      title: '1. Objeto y Naturaleza del Servicio',
      content: [
        'Comparador CSA es una plataforma de software como servicio (SaaS) diseñada para brindar asistencia técnica, cotejo analítico, extracción estructurada mediante modelos de lenguaje (LLM) y auditoría documental de pólizas y cotizaciones de seguros multiramo en la República de Colombia.',
        'La plataforma está dirigida exclusivamente a profesionales del sector asegurador: corredores, agencias colocadoras, agentes independientes y administradores de riesgos debidamente registrados o vinculados a entidades autorizadas.',
      ],
    },
    {
      id: 'terms-2',
      title: '2. Principio de Supervisión Humana (Human-In-The-Loop)',
      content: [
        'Los análisis comparativos, matrices de deducibles, tablas de amparos y resúmenes ejecutivos generados por el sistema constituyen una herramienta técnica de apoyo preliminar. En ningún caso sustituyen el criterio profesional, legal ni la auditoría obligatoria que el intermediario o corredor de seguros debe ejercer sobre las condiciones contractuales originales.',
        'El intermediario o usuario asume la responsabilidad exclusiva de revisar, validar y corroborar los resultados generados frente a los textos y anexos definitivos de las aseguradoras antes de su entrega formal a tomadores o asegurados.',
      ],
    },
    {
      id: 'terms-3',
      title: '3. Cuentas de Usuario, Aliados y Credenciales',
      content: [
        'El acceso al sistema está restringido a usuarios autorizados mediante invitaciones emitidas por la Plataforma Global o por los Administradores de cada Organización Aliada.',
        'El usuario es el único custodio de sus credenciales de acceso y contraseñas. Queda terminantemente prohibido ceder, transferir o compartir credenciales entre personas distintas a la autorizada.',
        'Cualquier actividad realizada desde una cuenta autenticada se considerará efectuada por su titular, salvo notificación previa de compromiso o suplantación.',
      ],
    },
    {
      id: 'terms-4',
      title: '4. Propiedad Intelectual y Licencia de Uso',
      content: [
        'Todos los algoritmos de extracción RAG, tesauros ontológicos normativos, interfaces, diseños y códigos fuente son propiedad exclusiva de Comparador CSA y sus licenciatarios.',
        'Se otorga al usuario una licencia de uso no exclusiva, intransferible, revocable y limitada al plazo de su suscripción o autorización corporativa.',
        'Los documentos PDF y cotizaciones cargados por los usuarios continúan siendo propiedad de sus respectivos titulares y emisores; la plataforma sólo adquiere los derechos necesarios para su procesamiento y visualización conforme a estos términos.',
      ],
    },
    {
      id: 'terms-5',
      title: '5. Limitación de Responsabilidad',
      content: [
        'Comparador CSA implementa las mejores prácticas tecnológicas y modelos de inteligencia artificial avanzados para garantizar exactitud. No obstante, no garantiza la infalibilidad absoluta ante cotizaciones con escaneos de baja resolución, mutilaciones de texto o formatos atípicos no estandarizados.',
        'En ningún caso Comparador CSA será responsable por pérdidas comerciales, rechazos de siniestros, lucro cesante o controversias contractuales que surjan entre aseguradoras, tomadores e intermediarios derivadas del uso de la información procesada.',
      ],
    },
    {
      id: 'terms-6',
      title: '6. Ley Aplicable y Jurisdicción',
      content: [
        'Los presentes términos se rigen e interpretan de conformidad con las leyes de la República de Colombia. Cualquier controversia que no pueda resolverse de forma directa será sometida a la jurisdicción ordinaria o al Centro de Arbitraje y Conciliación correspondiente en la ciudad de Bogotá D.C.',
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Política de Tratamiento y Protección de Datos Personales (Habeas Data)',
  shortTitle: 'Política de Privacidad',
  lastUpdated: 'Octubre 2026',
  version: '2.1',
  summary:
    'Lineamientos de tratamiento, finalidades, seguridad y procedimiento de ejercicio de derechos de los titulares de la información de acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.',
  sections: [
    {
      id: 'priv-1',
      title: '1. Marco Normativo y Responsable del Tratamiento',
      content: [
        'La presente política da estricto cumplimiento a la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y las directrices de la Superintendencia de Industria y Comercio (SIC) de Colombia.',
        'Comparador CSA, en calidad de Responsable y Encargado del Tratamiento, garantiza la confidencialidad, integridad y disponibilidad de la información personal almacenada en sus bases de datos.',
      ],
    },
    {
      id: 'priv-2',
      title: '2. Datos Recolectados y Finalidades del Tratamiento',
      content: [
        'Los datos personales recolectados a través de la plataforma incluyen: nombres y apellidos de usuarios, correos electrónicos corporativos, números telefónicos, número de identificación tributaria (NIT) o documento de identidad, razón social de la correduría y datos de contacto de clientes corporativos asociados a cotizaciones.',
        'Finalidades principales: (a) Autenticación y gestión de acceso a la plataforma; (b) Extracción, comparación y estructuración de condiciones asegurables; (c) Emisión de invitaciones y administración de perfiles técnicos; (d) Envío de notificaciones de seguridad, recuperación de credenciales y auditoría de sesiones.',
      ],
    },
    {
      id: 'priv-3',
      title: '3. Tratamiento de Cotizaciones y Datos de Terceros',
      content: [
        'El intermediario de seguros o cliente aliado que cargue documentos contentivos de datos personales de terceros (asegurados, beneficiarios o tomadores) declara y garantiza que cuenta con la correspondiente autorización de dichos titulares conforme al régimen colombiano de Habeas Data, o que el tratamiento se encuentra amparado en una relación contractual o precontractual legítima.',
        'La plataforma procesa estos datos de manera automatizada y bajo estrictos esquemas de aislamiento multi-tenant por organización (Row-Level Security), impidiendo cualquier cruce o acceso por parte de terceros no autorizados.',
      ],
    },
    {
      id: 'priv-4',
      title: '4. Derechos de los Titulares de la Información',
      content: [
        'De conformidad con el artículo 8 de la Ley 1581 de 2012, el titular de los datos personales tiene derecho a: (a) Conocer, actualizar y rectificar sus datos personales; (b) Solicitar prueba de la autorización otorgada; (c) Ser informado del uso dado a sus datos; (d) Presentar quejas ante la SIC; (e) Revocar la autorización o solicitar la supresión del dato cuando no medie deber legal o contractual de permanencia.',
      ],
    },
    {
      id: 'priv-5',
      title: '5. Procedimiento para el Ejercicio de Derechos (PQR)',
      content: [
        'Para ejercer los derechos de consulta, actualización, rectificación o revocatoria, el titular puede enviar una comunicación formal al correo oficial de protección de datos: privacidad@comparadorcsa.com.',
        'Las consultas serán atendidas en un término máximo de diez (10) días hábiles y los reclamos dentro de los quince (15) días hábiles siguientes a su recepción, según lo dispuesto en los artículos 14 y 15 de la Ley 1581 de 2012.',
      ],
    },
  ],
};

export const SECURITY_POLICY: LegalDocument = {
  id: 'security',
  title: 'Política de Seguridad de la Información y Gestión Confidencial',
  shortTitle: 'Seguridad de la Información',
  lastUpdated: 'Octubre 2026',
  version: '2.0',
  summary:
    'Estándares de cifrado, controles de acceso, aislamiento de tenencia multi-empresa y protección de secretos comerciales aplicados a la infraestructura de Comparador CSA.',
  sections: [
    {
      id: 'sec-1',
      title: '1. Cifrado y Protección Criptográfica',
      content: [
        'Toda la información transmitida entre el navegador del usuario y los servidores de Comparador CSA viaja cifrada bajo protocolos TLS 1.3 / HTTPS con certificados de alta seguridad.',
        'Los datos almacenados en reposo, incluyendo metadatos de cotizaciones y archivos PDF en los repositorios de Supabase Storage, se encuentran protegidos mediante algoritmos de cifrado simétrico AES-256.',
      ],
    },
    {
      id: 'sec-2',
      title: '2. Aislamiento Multi-Tenant (Seguridad por Filas - RLS)',
      content: [
        'La arquitectura de base de datos aplica políticas obligatorias de Row Level Security (RLS) en PostgreSQL. Cada consulta y operación está circunscrita exclusivamente al ID de la organización a la que pertenece el usuario autenticado.',
        'Ningún aliado comercial o técnico puede visualizar, exportar o inferir cotizaciones, pólizas o clientes pertenecientes a otra entidad intermediaria.',
      ],
    },
    {
      id: 'sec-3',
      title: '3. Gestión de Claves, Hashes y Deduplicación Segura',
      content: [
        'Las contraseñas de los usuarios no se almacenan en texto plano en ningún componente; se emplean funciones de derivación de claves criptográficas robustas con salt (Argon2 / Bcrypt) gestionadas por el motor de autenticación GoTrue.',
        'La deduplicación de clausulados generales opera mediante el cálculo de resúmenes criptográficos SHA-256 sobre el contenido binario del PDF, asegurando la inmutabilidad y verificabilidad de las condiciones cargadas.',
      ],
    },
  ],
};

export const REGULATORY_DISCLAIMER: LegalDocument = {
  id: 'disclaimer',
  title: 'Aviso Legal y Exención de Responsabilidad Regulatoria (SFC)',
  shortTitle: 'Aviso Legal Regulatorio',
  lastUpdated: 'Octubre 2026',
  version: '2.0',
  summary:
    'Aclaración expresa sobre la no intermediación directa, independencia tecnológica y cumplimiento frente al Estatuto Orgánico del Sistema Financiero de Colombia.',
  sections: [
    {
      id: 'disc-1',
      title: '1. No Intermediación Directa ni Asunción de Riesgo',
      content: [
        'Comparador CSA es una empresa proveedora de tecnología y herramientas de software. No es una compañía de seguros, reaseguradora, ni entidad financiera sujeta a la vigilancia directa de la Superintendencia Financiera de Colombia en calidad de emisora.',
        'La plataforma no expide pólizas de seguros, no cobra primas de aseguramiento, no asume riesgos amparados ni sustituye los contratos de seguros definitivos suscritos entre los tomadores y las aseguradoras legalmente establecidas.',
      ],
    },
    {
      id: 'disc-2',
      title: '2. Responsabilidad Profesional del Intermediario',
      content: [
        'Los intermediarios, agentes o corredores que utilicen Comparador CSA mantienen de forma indelegable la responsabilidad legal y profesional frente a sus clientes de asesorar adecuadamente y confirmar las coberturas vigentes.',
        'La comparación paramétrica entregada por la herramienta no constituye dictamen pericial ni asesoría jurídica vinculante; es un análisis preliminar computacional para optimizar la productividad de la correduría.',
      ],
    },
  ],
};

export const ALL_LEGAL_DOCUMENTS: LegalDocument[] = [
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  SECURITY_POLICY,
  REGULATORY_DISCLAIMER,
];

export const DATA_CONSENT_TEXT = {
  shortCheckbox:
    'He leído y acepto los Términos y Condiciones de Uso y la Política de Tratamiento de Datos Personales (Habeas Data - Ley 1581 de 2012).',
  authorizationNotice:
    'Autorizo de manera libre, previa, expresa e informada a Comparador CSA para recolectar, almacenar y tratar mis datos personales y corporativos exclusivamente para la prestación de los servicios analíticos, soporte técnico y gestión de la cuenta.',
  legalVersion: '2026.1',
};
