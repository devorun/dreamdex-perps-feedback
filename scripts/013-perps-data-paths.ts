// Where perps data actually lives: introspects the Hideki indexer's GraphQL schema for perp entities and
// subscriptions, and counts perp coverage in the dreamDEX developer docs pages that describe APIs.
const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql"
const PAGES = [
  "developers/http-api", "developers/http-api/market-data", "developers/http-api/trading", "developers/http-api/portfolio",
  "developers/websocket-api", "developers/websocket-api/real-time-feed", "developers/websocket-api/operations",
  "developers/libraries/ccxt", "developers/contracts/functions", "developers/contracts/types", "developers/contracts/errors",
]
const s = (await fetch(INDEXER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "{ __schema { queryType { fields { name } } subscriptionType { fields { name } } } }" }) }).then((r) => r.json())).data.__schema
const perpRe = /perp|funding|liquidat|margin|openinterest|insurance/i
const q = s.queryType.fields.map((f: any) => f.name).filter((n: string) => perpRe.test(n) && !/_aggregate$|_by_pk$/.test(n))
const sub = s.subscriptionType.fields.map((f: any) => f.name).filter((n: string) => perpRe.test(n) && !/_aggregate$|_by_pk$|_stream$/.test(n))
console.log(`indexer ${INDEXER}: ${q.length} perp query roots, ${sub.length} perp subscription roots`)
console.log(`  e.g. ${q.slice(0, 12).join(", ")}`)
for (const p of PAGES) {
  const html = await fetch(`https://app.testnet.dreamdex.io/docs/${p}`, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text())
  const main = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ")
  const body = main.slice(main.indexOf("Search docs") + 1) // drop nothing structural; count in the whole page text minus nav below
  const article = body.split(/©\s*2026/)[0].split(/I got scammed or hacked/).pop() ?? ""
  const count = (re: RegExp) => (article.match(re) ?? []).length
  console.log(`docs/${p.padEnd(42)} perp ${count(/perp/gi)} | MarginBank ${count(/MarginBank/g)} | Hideki/50383 ${count(/Hideki|50383/g)} | Shannon/50312 ${count(/Shannon|50312/g)}`)
  await new Promise((r) => setTimeout(r, 500))
}
