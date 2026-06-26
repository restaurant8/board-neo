/**
 * List of available font names (visit the url `/settings/appearance`).
 * This array is used to generate dynamic font classes (e.g., `font-inter`, `font-manrope`).
 *
 * 📝 How to Add a New Font (Tailwind v4+):
 * 1. Add the font name here.
 * 2. Update the `<link>` tag in 'index.html' to include the new font from Google Fonts (or any other source).
 * 3. Add the new font family to 'index.css' using the `@theme inline` and `font-family` CSS variable.
 *
 * Example:
 * fonts.ts           → Add 'roboto' to this array.
 * index.html         → Add Google Fonts link for Roboto.
 * index.css          → Add the new font in the CSS, e.g.:
 *   @theme inline {
 *      // ... other font families
 *      --font-roboto: 'Roboto', var(--font-sans);
 *   }
 */
// 默认（数组首项）使用 system：中文友好的系统字体栈，对齐原版观感
export const fonts = ['system', 'inter', 'manrope'] as const
