export type InklineThemeId = "sage" | "vellum" | "blueprint"

export interface InklineTheme {
  readonly id: InklineThemeId
  readonly label: string
  readonly paperBg: string
  readonly paperCard: string
  readonly paperRecessed: string
  readonly paperShadow: string
  readonly seaSurface: string
  readonly seaDeep: string
  readonly seaWaveInk: string
  readonly landTop: string
  readonly landSide: string
  readonly inkPrimary: string
  readonly inkDeep: string
  readonly inkMuted: string
  readonly borderLine: string
  readonly borderSoft: string
  readonly accentBlue: string
  readonly accentBlueWash: string
  readonly accentBlueBorder: string
  readonly accentRed: string
  readonly accentRedWash: string
  readonly accentGreen: string
  readonly accentGreenWash: string
  readonly accentOchre: string
  readonly accentOchreWash: string
  readonly pirateFill: string
}

export const INKLINE_THEMES: Record<InklineThemeId, InklineTheme> = {
  sage: {
    id: "sage",
    label: "Sage Paper",
    paperBg: "#f0f2ec",
    paperCard: "#faf7ec",
    paperRecessed: "#e8ece3",
    paperShadow: "#d5dad0",
    seaSurface: "#cfdfd8",
    seaDeep: "#d9e3de",
    seaWaveInk: "#819c94",
    landTop: "#eee9d7",
    landSide: "#cec7ac",
    inkPrimary: "#3d4943",
    inkDeep: "#25302b",
    inkMuted: "#748079",
    borderLine: "#c6ccc2",
    borderSoft: "#dfe3da",
    accentBlue: "#2f5a9c",
    accentBlueWash: "#eef3fb",
    accentBlueBorder: "#c5d4ec",
    accentRed: "#b04a39",
    accentRedWash: "#faefed",
    accentGreen: "#4f8a3e",
    accentGreenWash: "#eef6eb",
    accentOchre: "#b38436",
    accentOchreWash: "#faf4e6",
    pirateFill: "#2a332f"
  },
  vellum: {
    id: "vellum",
    label: "Hanse Vellum",
    paperBg: "#f3eee3",
    paperCard: "#faf7f0",
    paperRecessed: "#ebe4d6",
    paperShadow: "#d6ccb8",
    seaSurface: "#d5dfd7",
    seaDeep: "#dcd9cc",
    seaWaveInk: "#a59e8d",
    landTop: "#f3e5c6",
    landSide: "#dfd7c5",
    inkPrimary: "#453a2f",
    inkDeep: "#2b231b",
    inkMuted: "#7d7163",
    borderLine: "#cbc1ae",
    borderSoft: "#e2dacb",
    accentBlue: "#34598a",
    accentBlueWash: "#edf2f8",
    accentBlueBorder: "#c2d0e4",
    accentRed: "#a84432",
    accentRedWash: "#f9ece8",
    accentGreen: "#4c7d3c",
    accentGreenWash: "#edf5ea",
    accentOchre: "#b57e2a",
    accentOchreWash: "#fbf2df",
    pirateFill: "#312922"
  },
  blueprint: {
    id: "blueprint",
    label: "Chart Cyan",
    paperBg: "#e9f0f7",
    paperCard: "#f5f9fd",
    paperRecessed: "#dfe9f4",
    paperShadow: "#c4d4e6",
    seaSurface: "#cbdfe8",
    seaDeep: "#cfe0f0",
    seaWaveInk: "#8ea8c4",
    landTop: "#f3f8fc",
    landSide: "#d3e1ef",
    inkPrimary: "#233f63",
    inkDeep: "#152942",
    inkMuted: "#5e7696",
    borderLine: "#b4c7de",
    borderSoft: "#d4e1ef",
    accentBlue: "#1d5fbf",
    accentBlueWash: "#e4effd",
    accentBlueBorder: "#b0cdf2",
    accentRed: "#b8483c",
    accentRedWash: "#faeae8",
    accentGreen: "#2f7d57",
    accentGreenWash: "#e7f5ee",
    accentOchre: "#a87e32",
    accentOchreWash: "#f7f1e1",
    pirateFill: "#1a2f4a"
  }
}

export function applyThemeCssVars(theme: InklineTheme): void {
  const root = document.documentElement
  root.style.setProperty("--paper-bg", theme.paperBg)
  root.style.setProperty("--paper-card", theme.paperCard)
  root.style.setProperty("--paper-recessed", theme.paperRecessed)
  root.style.setProperty("--paper-shadow", theme.paperShadow)
  root.style.setProperty("--ink-primary", theme.inkPrimary)
  root.style.setProperty("--ink-deep", theme.inkDeep)
  root.style.setProperty("--ink-muted", theme.inkMuted)
  root.style.setProperty("--border-line", theme.borderLine)
  root.style.setProperty("--border-soft", theme.borderSoft)
  root.style.setProperty("--accent-blue", theme.accentBlue)
  root.style.setProperty("--accent-blue-wash", theme.accentBlueWash)
  root.style.setProperty("--accent-blue-border", theme.accentBlueBorder)
  root.style.setProperty("--accent-red", theme.accentRed)
  root.style.setProperty("--accent-red-wash", theme.accentRedWash)
  root.style.setProperty("--accent-green", theme.accentGreen)
  root.style.setProperty("--accent-green-wash", theme.accentGreenWash)
  root.style.setProperty("--accent-ochre", theme.accentOchre)
  root.style.setProperty("--accent-ochre-wash", theme.accentOchreWash)
}
