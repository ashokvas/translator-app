export interface LanguageOption {
  code: string;
  name: string;
  flag: string; // emoji flag
}

export const AUTO_DETECT_LANGUAGE: LanguageOption = {
  code: 'auto',
  name: 'Auto-detect',
  flag: '🌐',
};

// Languages sorted alphabetically A→Z by name
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'et', name: 'Estonian', flag: '🇪🇪' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ga', name: 'Irish', flag: '🇮🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ku', name: 'Kurdish', flag: '🇮🇶' },
  { code: 'lv', name: 'Latvian', flag: '🇱🇻' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹' },
  { code: 'mt', name: 'Maltese', flag: '🇲🇹' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'ps', name: 'Pashto', flag: '🇦🇫' },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
] as const;

export function getLanguageName(code: string): string {
  if (code === AUTO_DETECT_LANGUAGE.code) return AUTO_DETECT_LANGUAGE.name;
  return LANGUAGES.find((lang) => lang.code === code)?.name || code;
}

export function getLanguageLabel(code: string): string {
  if (code === AUTO_DETECT_LANGUAGE.code) {
    return `${AUTO_DETECT_LANGUAGE.flag} ${AUTO_DETECT_LANGUAGE.name}`;
  }
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.name}` : code;
}

/**
 * Get the display name for the source language, preferring the detected language over 'auto'
 * @param sourceLanguage - The stored source language code (may be 'auto')
 * @param detectedSourceLanguage - The detected source language code (if available)
 * @returns The display name for the source language
 */
export function getSourceLanguageDisplay(
  sourceLanguage: string,
  detectedSourceLanguage?: string | null
): string {
  // If we have a detected language and the original was 'auto', use the detected one
  if (sourceLanguage === AUTO_DETECT_LANGUAGE.code && detectedSourceLanguage) {
    return getLanguageName(detectedSourceLanguage);
  }
  return getLanguageName(sourceLanguage);
}