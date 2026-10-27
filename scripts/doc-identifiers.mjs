// Inline-code identifiers in the docs shipped inside the installed SDK package that never appear in the package's code.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
const root = "node_modules/@somnia-chain/markets-sdk"
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const code = walk(join(root, "dist")).filter((f) => /\.(js|d\.ts)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n")
const docs = (process.argv[2] ?? "PERPS.md,EXCHANGE.md,ACCOUNTS.md").split(",")
for (const doc of docs) {
  const text = readFileSync(join(root, "docs", doc), "utf8")
  const ids = new Set()
  for (const [, inner] of text.matchAll(/`([^`\n]+)`/g)) for (const [, id] of inner.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]{5,})\b/g)) ids.add(id)
  const missing = [...ids].filter((id) => !new RegExp("\\b" + id + "\\b").test(code))
  console.log(`${doc}: ${ids.size} identifiers in inline code; not found anywhere in dist: ${missing.length}`)
  console.log("  " + missing.join(", "))
}
