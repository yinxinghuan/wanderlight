import { wanderlight, wanderlightEn } from './wanderlight'
import type { Locale, StoryCartridge } from '../types'

export const DEFAULT_CARTRIDGE_ID = 'wanderlight'
export const CARTRIDGES: Record<string, StoryCartridge> = { 'wanderlight': wanderlight }
export const CARTRIDGES_EN: Record<string, StoryCartridge> = { 'wanderlight': wanderlightEn }
export function listCartridges(locale: Locale): StoryCartridge[] { return [locale === 'en' ? wanderlightEn : wanderlight] }
export function resolveCartridge(_id: string | null | undefined, locale: Locale = 'zh'): StoryCartridge { return locale === 'en' ? wanderlightEn : wanderlight }
