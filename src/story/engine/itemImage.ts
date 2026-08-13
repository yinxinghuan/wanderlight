import type { InventoryItem, StoryCartridge } from '../types'

export function inventoryImagePrompt(item: InventoryItem, cartridge: StoryCartridge): string {
  const direction = cartridge.itemImageDirection ?? 'elegant in-world artifact study with tactile natural materials and restrained directional light'
  const content = item.imagePrompt ?? `A single inventory object from ${cartridge.copy.title}: ${item.label}. ${item.detail ?? ''} ${item.effect ?? ''} ${item.lore ?? ''}`
  return `Create an inventory artifact plate for ${cartridge.copy.title}. Content brief: ${content}. Art direction: ${direction}. Follow only this text-defined medium, line treatment, palette, surface texture, lighting contrast, and degree of realism. Do not borrow any location, landmark, character, composition, or prop from the game's cover or opening scene. One object or one tightly grouped item set only, centered still life, square composition, no people, no hands, no text, no letters, no numerals, no symbols, no labels, no logo, no UI. Any token, page, cover, sign-like surface or stamp face must remain completely blank and featureless.`
}
