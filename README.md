# dreamdex-perps-feedback

Feedback on the dreamDEX Perps API and SDK on Somnia Tokyo testnet (Hideki, chain ID 50383), for the [dreamDEX Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty).

## Layout

- `feedback/`: one file per issue, `NNN-short-kebab-title.md`
- `scripts/`: minimal reproduction scripts linked from the reports (`cd scripts && npm install && node <script>.ts`, Node >= 22.6). Most are read-only and need no key. Scripts that place, cancel or simulate orders as a bot linked with Link a Bot (`op.ts`, `self-match.ts`, `expiry-test.ts`, `slot-reuse.ts`, `batch-test.ts`, `edge-sims.ts`, `max-size-check.ts`, `amend-sims.ts`, `watch-latency.ts`, `018-perp-amendorders-gap.ts`, `019-stop-orders-need-operator-registry.ts`) need `BOT_PRIVATE_KEY` and run as `node --env-file=../.env <script>.ts`. `008-cancel-finished-order.ts` uses it when present and otherwise simulates from the owner address.
- `notes/surface.md`: perps API / SDK inventory
- `notes/log.md`: what was tested and the result

## Setup

Scripts that sign read `BOT_PRIVATE_KEY` from a local `.env`. `.env` is gitignored and must never be committed.
