# dreamdex-perps-feedback

Feedback on the dreamDEX Perps API and SDK on Somnia Tokyo testnet (Hideki, chain ID 50383), for the [dreamDEX Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty).

## Layout

- `feedback/`: one file per issue, `NNN-short-kebab-title.md`
- `scripts/`: minimal reproduction scripts linked from the reports (`cd scripts && npm install && node <script>.ts`, Node >= 22.6). The current ones are read-only and need no key.
- `notes/surface.md`: perps API / SDK inventory
- `notes/log.md`: what was tested and the result

## Setup

Scripts that sign read `TESTNET_PRIVATE_KEY` from a local `.env`. `.env` is gitignored and must never be committed.
