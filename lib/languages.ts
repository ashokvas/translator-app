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

// Exact list requested (plus Auto-detect handled separately)
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'lv', name: 'Latvian', flag: '🇱🇻' },
  { code: 'et', name: 'Estonian', flag: '🇪🇪' },
  { code: 'ga', name: 'Irish', flag: '🇮🇪' },
  { code: 'mt', name: 'Maltese', flag: '🇲🇹' },
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

