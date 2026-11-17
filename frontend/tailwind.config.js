/** @type {import('tailwindcss').Config} */
import defaultColors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

// Tema som i Volymstudie: alla färger är CSS-variabler, ljust/mörkt.
// Mörkt följer systemet om inget är valt; html[data-tema="ljus"|"mork"] sätts av temaknappen.
// Befintliga Tailwind-klasser (bg-white, text-gray-600, bg-blue-50 …) följer därför temat automatiskt.

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

// Neutral skala = Volymstudies ytor/text/linjer
const NEUTRAL_LIGHT = {
  50: '#f7f8fa', 100: '#eef0f3', 200: '#e6e8ec', 300: '#d4d7dd', 400: '#9aa0aa', 500: '#6a707c',
  600: '#555b66', 700: '#3b4049', 800: '#252830', 900: '#16181d', 950: '#0f1115',
}
const NEUTRAL_DARK = {
  50: '#1d2129', 100: '#242a34', 200: '#262b34', 300: '#333a46', 400: '#6b7280', 500: '#9aa1ad',
  600: '#b3b9c3', 700: '#c9cdd5', 800: '#dde0e5', 900: '#e8eaee', 950: '#f4f5f7',
}
// Accent (blå) = Volymstudies --accent #2f6fed / mörkt #5b8cff
const ACCENT_LIGHT = {
  50: '#f0f5ff', 100: '#e8efff', 200: '#cddcfd', 300: '#a6c0fb', 400: '#6f97f5', 500: '#4a82f2',
  600: '#2f6fed', 700: '#2459c9', 800: '#1f49a3', 900: '#1d3d80', 950: '#152752',
}
const ACCENT_DARK = {
  50: '#1a2233', 100: '#1e2a45', 200: '#25365c', 300: '#304a80', 400: '#5b8cff', 500: '#5b8cff',
  600: '#5b8cff', 700: '#8eb0ff', 800: '#b7cdff', 900: '#dbe6ff', 950: '#eef3ff',
}

const BASE = {
  light: { white: '#ffffff', black: '#16181d', bg: '#f4f5f7' },
  dark: { white: '#16191f', black: '#e8eaee', bg: '#0f1115' },
}
const PANEL_DARK = BASE.dark.white

const NEUTRALS = ['gray', 'slate', 'zinc', 'neutral', 'stone']
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const channels = (hex) => hexToRgb(hex).join(' ')
const mix = (a, b, t) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)]
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
}

// Mörk variant av en Tailwind-färgskala: ljusa toner blir svaga toningar mot panelen, mörka toner blir ljusa.
const darkHue = (h) => ({
  50: mix(h[500], PANEL_DARK, 0.12), 100: mix(h[500], PANEL_DARK, 0.18), 200: mix(h[500], PANEL_DARK, 0.28),
  300: mix(h[500], PANEL_DARK, 0.45), 400: h[500], 500: h[400], 600: h[400], 700: h[300], 800: h[200],
  900: h[100], 950: h[50],
})

const vars = { light: {}, dark: {} }
const colors = { transparent: 'transparent', current: 'currentColor', inherit: 'inherit' }
const ref = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

for (const key of ['white', 'black']) {
  vars.light[`--c-${key}`] = channels(BASE.light[key])
  vars.dark[`--c-${key}`] = channels(BASE.dark[key])
  colors[key] = ref(key)
}
const addScale = (name, light, dark) => {
  colors[name] = {}
  for (const s of SHADES) {
    vars.light[`--c-${name}-${s}`] = channels(light[s])
    vars.dark[`--c-${name}-${s}`] = channels(dark[s])
    colors[name][s] = ref(`${name}-${s}`)
  }
}
for (const n of NEUTRALS) addScale(n, NEUTRAL_LIGHT, NEUTRAL_DARK)
addScale('blue', ACCENT_LIGHT, ACCENT_DARK)
for (const h of HUES) addScale(h, defaultColors[h], darkHue(defaultColors[h]))

// Semantiska variabler (samma namn som i Volymstudie) för egen CSS, kartan och diagram
const SEMANTIC = {
  light: {
    '--bg': BASE.light.bg, '--panel': '#ffffff', '--yta': '#f7f8fa', '--yta-hover': '#eef0f3', '--text': '#16181d',
    '--muted': '#6a707c', '--svag': '#9aa0aa', '--line': '#e6e8ec', '--line-stark': '#d4d7dd', '--accent': '#2f6fed',
    '--accent-text': '#ffffff', '--accent-soft': '#e8efff', '--fara': '#d92d20', '--ok': '#067647',
    '--skugga': '0 1px 2px rgba(16, 24, 40, 0.06), 0 4px 16px rgba(16, 24, 40, 0.08)',
    '--skugga-liten': '0 1px 2px rgba(16, 24, 40, 0.08)', 'color-scheme': 'light',
  },
  dark: {
    '--bg': BASE.dark.bg, '--panel': '#16191f', '--yta': '#1d2129', '--yta-hover': '#242a34', '--text': '#e8eaee',
    '--muted': '#9aa1ad', '--svag': '#6b7280', '--line': '#262b34', '--line-stark': '#333a46', '--accent': '#5b8cff',
    '--accent-text': '#0b0d12', '--accent-soft': '#1e2a45', '--fara': '#f97066', '--ok': '#47cd89',
    '--skugga': '0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 20px rgba(0, 0, 0, 0.35)',
    '--skugga-liten': '0 1px 2px rgba(0, 0, 0, 0.4)', 'color-scheme': 'dark',
  },
}

const temaPlugin = plugin(({ addBase }) => {
  const light = { ...vars.light, ...SEMANTIC.light }
  const dark = { ...vars.dark, ...SEMANTIC.dark }
  addBase({
    ':root': light,
    // Utskrift är alltid ljus
    '@media screen and (prefers-color-scheme: dark)': { ':root:not([data-tema="ljus"])': dark },
    '@media screen': { ':root[data-tema="mork"]': dark },
  })
})

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors,
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        md: '7px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        sm: 'var(--skugga-liten)',
        DEFAULT: 'var(--skugga)',
        md: 'var(--skugga)',
        lg: 'var(--skugga)',
      },
    },
  },
  plugins: [temaPlugin],
}
