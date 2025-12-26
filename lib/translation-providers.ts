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
  { id: 'openai/gpt-5.2', label: 'OpenAI: GPT-5.2 (best quality)' },
  { id: 'openai/gpt-4o', label: 'OpenAI: GPT-4o (fast & reliable)' },
  { id: 'openai/gpt-4.1', label: 'OpenAI: GPT-4.1' },
  { id: 'anthropic/claude-sonnet-4', label: 'Anthropic: Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus-20240229', label: 'Anthropic: Claude 3 Opus' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Anthropic: Claude 3.5 Haiku (fast)' },
  { id: 'google/gemini-pro-1.5', label: 'Google: Gemini Pro 1.5' },
] as const;

export function isDocumentDomain(value: unknown): value is DocumentDomain {
  return value === 'general' || value === 'legal' || value === 'medical' || value === 'technical' || value === 'certificate';
}

/**
 * Domain-specific terminology guidance for LLM-based translations
 * These serve as "soft glossaries" - instructing the model to use
 * consistent, domain-appropriate terminology
 */
export function getDomainTerminologyGuidance(domain: DocumentDomain): string {
  switch (domain) {
    case 'certificate':
      return [
        '',
        '## TERMINOLOGY GUIDANCE (Use consistent translations for these terms):',
        '',
        '### Academic/Educational Terms:',
        '- Transcript / Academic Record / Grade Report → Use target language\'s standard term for official academic records',
        '- Credits / Credit Hours / ECTS → Use target country\'s standard credit unit terminology',
        '- GPA / Grade Point Average → Keep as "GPA" or use local equivalent',
        '- Degree Course / Core Course / Required → Distinguish from electives clearly',
        '- Elective / Optional Course → Use consistent term throughout',
        '- Semester / Term / Academic Year → Use appropriate academic period term',
        '- Pass / Fail / Passed / Failed → Use standard pass/fail terminology',
        '- Excellent / Good / Satisfactory / Average → Use standard grade descriptors',
        '',
        '### Official Document Terms:',
        '- Certificate / Diploma / Degree → Distinguish between these document types',
        '- Certified Copy / True Copy → Use formal certification language',
        '- Official Seal / University Seal / Registrar\'s Seal → Note seal types appropriately',
        '- Registrar / Academic Office / Dean → Use appropriate title translations',
        '- Date of Issue / Issue Date → Use consistent date label',
        '- Registration Number / Student ID / Roll Number → Preserve ID format',
        '',
      ].join('\n');

    case 'legal':
      return [
        '',
        '## TERMINOLOGY GUIDANCE (Use consistent legal translations):',
        '',
        '### Contract Terms:',
        '- Party / Parties → Use formal party designation',
        '- Whereas / Recitals → Use target language\'s equivalent formal preamble language',
        '- Hereby / Herein / Hereto → Use appropriate formal connectors',
        '- Shall (obligation) / May (permission) / Must (requirement) → Maintain modal precision',
        '- Notwithstanding / Subject to → Use proper conditional language',
        '- In witness whereof → Use formal attestation language',
        '',
        '### Legal Document Types:',
        '- Affidavit → Sworn statement',
        '- Power of Attorney → Use target jurisdiction\'s term',
        '- Notarized / Notarization → Use local notary terminology',
        '- Apostille → Keep as "Apostille" (international term)',
        '- Jurisdiction → Legal authority term',
        '',
        '### Parties and Roles:',
        '- Plaintiff / Defendant / Petitioner / Respondent → Use correct procedural terms',
        '- Lessor / Lessee → Landlord / Tenant equivalents',
        '- Assignor / Assignee → Transfer party terms',
        '',
      ].join('\n');

    case 'medical':
      return [
        '',
        '## TERMINOLOGY GUIDANCE (Use standard medical translations):',
        '',
        '### Clinical Terms:',
        '- Diagnosis / Prognosis → Use correct medical terms',
        '- Prescription / Rx → Use local prescription terminology',
        '- Dosage / Dose → Medication amount terms',
        '- Contraindication → Use medical warning term',
        '- Side effects / Adverse effects → Use appropriate term',
        '',
        '### Medical Records:',
        '- Patient / Subject → Use appropriate person reference',
        '- Medical History / Clinical History → Use standard history term',
        '- Chief Complaint / Presenting Complaint → Use intake terminology',
        '- Physical Examination / Clinical Examination → Use exam terminology',
        '- Laboratory Results / Lab Values → Use test result terms',
        '',
        '### Pharmaceutical:',
        '- Generic Name / INN → International nonproprietary name',
        '- Brand Name / Trade Name → Commercial name',
        '- Active Ingredient → Drug substance term',
        '- Excipient → Inactive ingredient term',
        '',
        '### Units (PRESERVE EXACTLY):',
        '- mg, g, kg, mL, L, IU, mmol/L, mg/dL → Keep units unchanged',
        '',
      ].join('\n');

    case 'technical':
      return [
        '',
        '## TERMINOLOGY GUIDANCE (Use standard technical translations):',
        '',
        '### Technical Terms:',
        '- Specification / Specs → Use formal specification term',
        '- Tolerance / Variance → Use engineering precision terms',
        '- Calibration → Use measurement standardization term',
        '- Compliance / Conformity → Use regulatory adherence terms',
        '',
        '### Software/IT Terms:',
        '- Interface / API → Keep technical terms or use local equivalent',
        '- Configuration / Settings → Use appropriate term',
        '- Installation / Setup → Use software deployment term',
        '- Troubleshooting → Use problem-solving term',
        '',
        '### DO NOT TRANSLATE:',
        '- Variable names, function names, code identifiers',
        '- File paths, URLs, email addresses',
        '- Version numbers, model numbers, part numbers',
        '- Code blocks and commands',
        '- Acronyms that are industry-standard (API, HTTP, SQL, etc.)',
        '',
      ].join('\n');

    case 'general':
    default:
      return [
        '',
        '## TERMINOLOGY GUIDANCE:',
        '',
        '- Use natural, fluent language in the target language',
        '- Adapt idioms and expressions appropriately',
        '- Maintain the register (formal/informal) of the original',
        '- Use standard terminology for common concepts',
        '- Preserve proper nouns (names, places, organizations)',
        '',
      ].join('\n');
  }
}

/**
 * Base formatting rules applied to ALL domains
 * Designed to handle various document types: certificates, long-form legal docs, transcripts, etc.
 */
const BASE_FORMATTING_RULES = [
  '',
  '## CRITICAL FORMATTING RULES (MUST FOLLOW):',
  '',
  '1. MATCH ORIGINAL DOCUMENT EXACTLY:',
  '   - Same number of columns as original',
  '   - Same number of rows as original',
  '   - For forms: "Label: Value" pairs on separate lines',
  '',
  '2. TABLE ALIGNMENT (CRITICAL):',
  '',
  '   **COLUMNS MUST ALIGN VERTICALLY**',
  '   All | characters in a column must line up from top to bottom!',
  '',
  '   **CORRECT (aligned):**',
  '   | Course Name          | Credits | Grade |',
  '   |----------------------|---------|-------|',
  '   | English              | 4       | 72    |',
  '   | Advanced Mathematics | 5       | 67    |',
  '',
  '   **HOW TO ALIGN:**',
  '   - Find longest text in each column',
  '   - Pad ALL cells in that column to match that width',
  '   - Use spaces: "English" → "English              "',
  '   - Separator dashes must match column width',
  '',
  '3. ROW COUNT:',
  '   - Count rows in original',
  '   - Output SAME number of rows',
  '',
  '4. DO NOT:',
  '   - Change column count',
  '   - Change row count', 
  '   - Leave columns misaligned',
  '   - Add commentary',
  '',
  '5. OUTPUT ONLY THE TRANSLATION.',
].join('\n');

export function getDomainSystemPrompt(domain: DocumentDomain): string {
  switch (domain) {
    case 'certificate':
      return [
        'You are a professional certified translator specializing in official documents.',
        'You translate: certificates, diplomas, transcripts, academic records, mark sheets, grade reports, birth/death/marriage certificates, government documents, IDs, licenses, and other official papers.',
        '',
        '## CRITICAL: PRODUCE PROPERLY ALIGNED TABLES',
        '',
        '1. MATCH ORIGINAL EXACTLY:',
        '   - Same number of columns as original',
        '   - Same number of rows as original',
        '   - Preserve side-by-side layouts if present',
        '',
        '2. TABLE ALIGNMENT (CRITICAL):',
        '',
        '   **ALL | CHARACTERS MUST ALIGN VERTICALLY!**',
        '',
        '   CORRECT FORMAT:',
        '   | Course Name          | Credits | Grade | Type     | Date       |',
        '   |----------------------|---------|-------|----------|------------|',
        '   | English              | 4       | 72    | Required | 2000-01-13 |',
        '   | Advanced Mathematics | 5       | 67    | Required | 2000-01-13 |',
        '   | Physical Education   | 1       | 74    | Required | 2000-01-13 |',
        '',
        '   HOW TO ALIGN:',
        '   - Find LONGEST text in each column',
        '   - Pad ALL cells in that column to match that width',
        '   - Use spaces for padding',
        '   - Separator dashes (---) must match column width',
        '',
        '3. FOR SIDE-BY-SIDE LAYOUTS:',
        '   | Left Course          | Cr | Grade | Date       | Right Course         | Cr | Grade | Date       |',
        '   |----------------------|----|-------|------------|----------------------|----|-------|------------|',
        '   | English              | 4  | 72    | 2000-01-13 | Physics              | 4  | 68    | 2000-07-06 |',
        '',
        '4. HEADER INFO (before table):',
        '   Student ID: XXXXX',
        '   Name: XXXXX',
        '   Major: XXXXX',
        '',
        '5. FOOTER (after table):',
        '   Total Credits: XXX',
        '   [Official Seal]',
        '',
        '## OTHER DOCUMENTS:',
        '   - CERTIFICATES: "Label: Value" on separate lines',
        '   - LICENSES: Keep numbers, dates separate',
        '',
        '## SEALS:',
        '   - Mark as [Official Seal] or [University Seal]',
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


