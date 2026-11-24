import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const RELEASE_DIR = path.join(ROOT, "release")
const PORTABLE_DIR = path.join(RELEASE_DIR, "hanseatic-ledger-portable")
const ZIP_PATH = path.join(RELEASE_DIR, "hanseatic-ledger-portable.zip")

console.log("1/4 Building production bundle (dist/)...")
execSync("npm run build", { stdio: "inherit" })

console.log("2/4 Assembling portable folder...")
fs.rmSync(PORTABLE_DIR, { recursive: true, force: true })
fs.rmSync(ZIP_PATH, { force: true })
fs.mkdirSync(PORTABLE_DIR, { recursive: true })
fs.cpSync(path.join(ROOT, "dist"), path.join(PORTABLE_DIR, "dist"), { recursive: true })

// Zero-dependency static server (Node built-ins only)
const serveJs = `import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, "dist")
const PORT = Number(process.env.PORT || 4180)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0])
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\\/+/, "")
  const filePath = path.resolve(DIST, rel)
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(DIST, "index.html")
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    fs.createReadStream(fallback).pipe(res)
    return
  }
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(\`Hanseatic Ledger running at http://127.0.0.1:\${PORT}\`)
  console.log("Press Ctrl+C to stop.")
})
`
fs.writeFileSync(path.join(PORTABLE_DIR, "serve.mjs"), serveJs)

// Windows zero-install double-click launcher (Node -> Python -> built-in PowerShell HTTP fallback)
const bat = `@echo off\r
title Hanseatic Ledger - Rise of the Hanse\r
cd /d "%~dp0"\r
where node >nul 2>nul\r
if %errorlevel%==0 (\r
  echo Starting Hanseatic Ledger with Node.js...\r
  start "" http://127.0.0.1:4180\r
  node serve.mjs\r
  pause\r
  exit /b\r
)\r
where python >nul 2>nul\r
if %errorlevel%==0 (\r
  echo Starting Hanseatic Ledger with Python...\r
  start "" http://127.0.0.1:4180\r
  python -m http.server 4180 --directory dist --bind 127.0.0.1\r
  pause\r
  exit /b\r
)\r
echo Starting Hanseatic Ledger with Windows PowerShell...\r
start "" http://127.0.0.1:4180\r
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l = New-Object System.Net.HttpListener; $l.Prefixes.Add('http://127.0.0.1:4180/'); $l.Start(); Write-Host 'Hanseatic Ledger running at http://127.0.0.1:4180 (Ctrl+C to stop)'; $mime = @{'.html'='text/html; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.svg'='image/svg+xml'}; $root = (Resolve-Path 'dist').Path; while ($l.IsListening) { $c = $l.GetContext(); $p = $c.Request.Url.AbsolutePath.TrimStart('/'); if (-not $p) { $p = 'index.html' }; $f = Join-Path $root $p; if (-not (Test-Path $f -PathType Leaf)) { $f = Join-Path $root 'index.html' }; $b = [System.IO.File]::ReadAllBytes($f); $e = [System.IO.Path]::GetExtension($f).ToLower(); $c.Response.ContentType = if ($mime[$e]) { $mime[$e] } else { 'application/octet-stream' }; $c.Response.ContentLength64 = $b.Length; $c.Response.OutputStream.Write($b,0,$b.Length); $c.Response.Close() }"\r
pause\r
`
fs.writeFileSync(path.join(PORTABLE_DIR, "play-hanse.bat"), bat)

// macOS / Linux launcher
const sh = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
URL="http://127.0.0.1:4180"
if command -v open >/dev/null 2>&1; then (sleep 1 && open "$URL") &
elif command -v xdg-open >/dev/null 2>&1; then (sleep 1 && xdg-open "$URL") &
fi
if command -v node >/dev/null 2>&1; then
  exec node serve.mjs
elif command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 4180 --directory dist --bind 127.0.0.1
else
  echo "Please install Node.js or Python 3, or serve the dist/ folder statically."
  exit 1
fi
`
fs.writeFileSync(path.join(PORTABLE_DIR, "play-hanse.sh"), sh)

const readme = [
  "HANSEATIC LEDGER · RISE OF THE HANSE — PORTABLE EDITION",
  "========================================================",
  "",
  "Built with TypeScript, @typeonce/ritmo ECS, and Three.js (Inkline 3D style).",
  "100% offline, zero npm install required.",
  "",
  "HOW TO PLAY:",
  "  Windows:    Double-click play-hanse.bat",
  "              (Uses Node.js, Python, or built-in Windows PowerShell automatically.)",
  "  macOS/Linux: Run ./play-hanse.sh (or `node serve.mjs` / `python3 -m http.server 4180 --directory dist`)",
  "  Static Web:  Upload the `dist/` folder directly to any static host (GitHub Pages, Netlify, etc.).",
  "",
  "CONTROLS:",
  "  - Left-click port/ship: Select",
  "  - Right-click port:     Sail selected ship there",
  "  - Double-click port / M: Enter / exit 3D Town Waterfront view",
  "  - Click 3D buildings:   Open Market, Kontor, Tavern, Werft (Shipyard), or Town Hall",
  "  - Drag / Scroll:        Pan & zoom orthographic chart (Shift+Drag to orbit)",
  "  - P / 1 / 2 / 3:        Pause, 1x, 2x, 4x simulation speed",
  ""
].join("\n")
fs.writeFileSync(path.join(PORTABLE_DIR, "README-PORTABLE.txt"), readme)

console.log("3/4 Creating portable ZIP archive...")
if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${PORTABLE_DIR}' -DestinationPath '${ZIP_PATH}' -Force"`,
    { stdio: "inherit" }
  )
} else {
  execSync(`cd "${RELEASE_DIR}" && zip -r "${path.basename(ZIP_PATH)}" "${path.basename(PORTABLE_DIR)}"`, {
    stdio: "inherit"
  })
}

const sizeKB = Math.round(fs.statSync(ZIP_PATH).size / 1024)
console.log(`4/4 Portable ZIP ready (${sizeKB} KB): ${ZIP_PATH}`)
