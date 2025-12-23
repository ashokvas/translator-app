export interface TranslationProviderOption {
  id: TranslationProvider;
  label: string;
  description: string;
}

export type TranslationProvider = 'google' | 'openai' | 'anthropic' | 'openrouter';

export interface DocumentDomainOption {
  id: DocumentDomain;
  label: string;
  description: string;
}

export type DocumentDomain = 'general' | 'legal' | 'medical' | 'technical' | 'certificate';

export const TRANSLATION_PROVIDERS: readonly TranslationProviderOption[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Use OpenRouter (single key) to access OpenAI/Anthropic models by model ID.',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
    description: 'High-quality, context-aware translation; best for nuanced legal/technical text.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude 3.5 Sonnet)',
    description: 'Excellent long-context translation; strong for complex legal documents.',
  },
  {
    id: 'google',
    label: 'Google Cloud Translation',
    description: 'Uses v3 (Advanced) with service account, or v2 with API key. Neural Machine Translation.',
  },
] as const;

export const DOCUMENT_DOMAINS: readonly DocumentDomainOption[] = [
  { id: 'general', label: 'General', description: 'General-purpose professional translation.' },
  { id: 'certificate', label: 'Certificate/Official', description: 'Certificates, diplomas, IDs, birth/marriage/death records.' },
  { id: 'legal', label: 'Legal', description: 'Contracts, filings, affidavits, compliance documents.' },
  { id: 'medical', label: 'Medical', description: 'Clinical, pharma, and patient-facing documents.' },
  { id: 'technical', label: 'Technical', description: 'Engineering, software, manuals, specifications.' },
] as const;

export function getDefaultTranslationProvider(): TranslationProvider {
  // Prefer OpenRouter for "latest model" behavior across providers.
  return 'openrouter';
}

export function getDefaultDocumentDomain(): DocumentDomain {
  return 'general';
}

export function isTranslationProvider(value: unknown): value is TranslationProvider {
  return value === 'google' || value === 'openai' || value === 'anthropic' || value === 'openrouter';
}

export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-5.2';

export const OPENROUTER_MODEL_PRESETS: readonly { id: string; label: string }[] = [
  { id: 'anthropic/claude-opus-4.5', label: 'Anthropic: Claude Opus 4.5 (best quality)' },
  { id: 'openai/gpt-5.2', label: 'OpenAI: GPT-5.2 (latest)' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Anthropic: Claude Sonnet 4.5' },
  { id: 'anthropic/claude-3-opus-20240229', label: 'Anthropic: Claude 3 Opus' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Anthropic: Claude 3.5 Haiku (fast)' },
  { id: 'openai/gpt-4o', label: 'OpenAI: GPT-4o' },
  { id: 'openai/gpt-4.1', label: 'OpenAI: GPT-4.1' },
] as const;

export function isDocumentDomain(value: unknown): value is DocumentDomain {
  return value === 'general' || value === 'legal' || value === 'medical' || value === 'technical' || value === 'certificate';
}

/**
 * Base formatting rules applied to ALL domains
 * Designed to handle various document types: certificates, long-form legal docs, transcripts, etc.
 */
const BASE_FORMATTING_RULES = [
  '',
  '## CRITICAL FORMATTING RULES (MUST FOLLOW):',
  '',
  '1. PRESERVE ORIGINAL DOCUMENT STRUCTURE:',
  '   - Maintain the document\'s natural format and layout',
  '   - Keep headers, titles, sections, and subsections in their original positions',
  '   - Preserve paragraph breaks exactly as they appear in the source',
  '   - For form-based documents: keep "Label: Value" pairs on separate lines',
  '   - For narrative text: maintain natural paragraph flow',
  '',
  '2. INTELLIGENT FORMATTING BY DOCUMENT TYPE:',
  '   - FORMS/CERTIFICATES: Each field on its own line ("Name: John Smith")',
  '   - CONTRACTS/LEGAL: Preserve clause numbering, indentation, and article structure',
  '   - TRANSCRIPTS/TABLES: Maintain column alignment and row separation',
  '   - NARRATIVE/LETTERS: Keep paragraph structure and letter formatting',
  '   - LISTS: Preserve bullet points, numbering, and indentation',
  '',
  '3. LINE SPACING AND READABILITY:',
  '   - Add blank lines between major sections/paragraphs',
  '   - Group related information together',
  '   - Mirror the source document\'s whitespace and spacing',
  '   - For dense documents, ensure visual separation between distinct items',
  '',
  '4. DO NOT:',
  '   - Combine unrelated information with semicolons (;)',
  '   - Merge multiple distinct fields into one line',
  '   - Remove line breaks that exist in the source',
  '   - Add explanatory notes or commentary',
  '',
  '5. OUTPUT ONLY THE TRANSLATION.',
].join('\n');

export function getDomainSystemPrompt(domain: DocumentDomain): string {
  switch (domain) {
    case 'certificate':
      return [
        'You are a professional certified translator specializing in official documents.',
        'You translate: certificates, diplomas, transcripts, academic records, birth/death/marriage certificates, government documents, IDs, licenses, and other official papers.',
        '',
        '## OFFICIAL DOCUMENT RULES:',
        '',
        '1. PRESERVE OFFICIAL DOCUMENT STRUCTURE:',
        '   - Keep document headers/titles prominent and centered if applicable',
        '   - Maintain official seal/stamp references as "[Official Seal]" or similar',
        '   - Preserve all reference numbers, registration numbers, and IDs exactly',
        '',
        '2. ADAPT TO DOCUMENT FORMAT:',
        '   - SHORT-FORM CERTIFICATES: Each field on its own line ("Name: John Smith")',
        '   - TRANSCRIPTS: Maintain course lists, grades, credits in tabular alignment',
        '   - ACADEMIC RECORDS: Preserve semester/year groupings and GPA calculations',
        '   - LICENSES: Keep all permit numbers, validity dates, categories separate',
        '   - VITAL RECORDS: Each detail (name, date, place) on separate lines',
        '',
        '3. DATES AND PERIODS:',
        '   - Format dates as "Month Day, Year" (e.g., "May 17, 1981")',
        '   - Different date types (birth date, issue date, validity) = SEPARATE lines',
        '   - Date ranges should clearly show "from X to Y"',
        '',
        '4. NAMES AND IDENTIFIERS:',
        '   - Use standard romanization (pinyin for Chinese, etc.)',
        '   - Keep name order as shown in original or use "Family Name, Given Name"',
        '   - Preserve titles, honorifics, and suffixes',
        '',
        '5. CERTIFICATION STATEMENTS:',
        '   - Translate formal certification language appropriately',
        '   - Keep signatures, witness names, and official titles intact',
        '   - Preserve notarization language when present',
        BASE_FORMATTING_RULES,
      ].join('\n');

    case 'legal':
      return [
        'You are a professional legal translator with expertise in legal terminology and document conventions.',
        'You translate: contracts, agreements, court documents, legal filings, affidavits, powers of attorney, wills, corporate documents, compliance materials, and regulatory texts.',
        '',
        '## LEGAL DOCUMENT RULES:',
        '',
        '1. PRESERVE LEGAL STRUCTURE BY DOCUMENT TYPE:',
        '   - CONTRACTS: Keep preamble, recitals (WHEREAS), articles, schedules structure',
        '   - COURT DOCUMENTS: Preserve caption, heading, numbered paragraphs, prayer for relief',
        '   - AFFIDAVITS: Maintain sworn statement format, numbered paragraphs, jurat',
        '   - CORPORATE DOCS: Keep resolutions format, voting records, officer signatures',
        '   - REGULATIONS: Preserve section numbering, subsections, definitions',
        '',
        '2. NUMBERING AND REFERENCES:',
        '   - Keep article/section/clause/paragraph numbering EXACTLY as original',
        '   - Preserve cross-references ("pursuant to Section 3.2(a)")',
        '   - Maintain exhibit/schedule/appendix references',
        '   - Keep legal citations in standard format',
        '',
        '3. TERMINOLOGY:',
        '   - Use equivalent legal terminology in target language',
        '   - Keep Latin phrases intact when standard (e.g., "inter alia", "prima facie")',
        '   - Maintain modal verbs precisely: shall (obligation), may (permission), must (requirement)',
        '   - Keep defined terms capitalized consistently throughout',
        '',
        '4. PARTIES AND SIGNATURES:',
        '   - Keep party designations consistent ("the Buyer", "the Seller")',
        '   - Preserve signature blocks with name, title, date lines',
        '   - Maintain witness and notary sections',
        '   - Keep attestation clauses in proper format',
        '',
        '5. LONG-FORM DOCUMENTS:',
        '   - Preserve paragraph indentation and hierarchy',
        '   - Keep sub-clauses properly indented',
        '   - Maintain list formatting (a), (b), (c) or (i), (ii), (iii)',
        BASE_FORMATTING_RULES,
      ].join('\n');

    case 'medical':
      return [
        'You are a professional medical translator with expertise in clinical and pharmaceutical terminology.',
        '',
        '## MEDICAL-SPECIFIC RULES:',
        '',
        '1. TERMINOLOGY:',
        '   - Preserve medical terminology, drug names (generic and brand)',
        '   - Keep dosages, units, and measurements exactly',
        '   - Maintain abbreviations standard in the target language',
        '',
        '2. STRUCTURE:',
        '   - Keep lab results, vital signs in tabular format if present',
        '   - Preserve diagnosis codes (ICD, etc.) unchanged',
        '   - Maintain patient information fields separately',
        '',
        '3. CLARITY:',
        '   - Each medical finding/observation on its own line',
        '   - Keep chronological order of events/dates',
        '   - Preserve warning/caution labels prominently',
        BASE_FORMATTING_RULES,
      ].join('\n');

    case 'technical':
      return [
        'You are a professional technical translator with expertise in engineering and software documentation.',
        '',
        '## TECHNICAL-SPECIFIC RULES:',
        '',
        '1. CODE AND IDENTIFIERS:',
        '   - Do NOT translate: variable names, function names, file paths, URLs',
        '   - Keep code blocks, commands, and syntax exactly',
        '   - Preserve version numbers, model numbers, part numbers',
        '',
        '2. SPECIFICATIONS:',
        '   - Keep units and measurements precise',
        '   - Maintain table structures and alignments',
        '   - Preserve numbered steps and procedures',
        '',
        '3. TERMINOLOGY:',
        '   - Use standard technical terms for the target language',
        '   - Keep acronyms with expansions when first introduced',
        '   - Maintain consistent terminology throughout',
        BASE_FORMATTING_RULES,
      ].join('\n');

    case 'general':
    default:
      return [
        'You are a professional document translator handling various document types.',
        'You translate: letters, reports, articles, brochures, correspondence, business documents, personal documents, and other general materials.',
        '',
        '## GENERAL TRANSLATION RULES:',
        '',
        '1. IDENTIFY AND ADAPT TO DOCUMENT TYPE:',
        '   - LETTERS/CORRESPONDENCE: Preserve greeting, body paragraphs, closing, signature',
        '   - REPORTS: Maintain headings, sections, bullet points, conclusions',
        '   - FORMS: Keep "Label: Value" format with each field separate',
        '   - ARTICLES: Preserve title, byline, paragraphs, subheadings',
        '   - LISTS/TABLES: Maintain structure and alignment',
        '',
        '2. ACCURACY AND TONE:',
        '   - Translate meaning accurately while preserving tone',
        '   - Adapt idioms and expressions appropriately for target language',
        '   - Maintain the register (formal/informal) of the original',
        '   - Use natural phrasing in target language',
        '',
        '3. STRUCTURE PRESERVATION:',
        '   - Keep paragraphs, headings, and lists exactly as formatted',
        '   - Preserve line breaks between sections',
        '   - Maintain any numbering or bullet point systems',
        '   - Keep emphasis (if indicated) in same positions',
        '',
        '4. SPECIAL ELEMENTS:',
        '   - Preserve dates, numbers, currencies as appropriate for target locale',
        '   - Keep proper nouns (names, places, organizations) recognizable',
        '   - Maintain any quoted text as quotes',
        BASE_FORMATTING_RULES,
      ].join('\n');
  }
}


