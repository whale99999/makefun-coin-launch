# makefun-coin-launch-01 starter

A working entry for the make.fun bounty "Launch a coin the moment the contest opens": an agent launches a real coin on
pump.fun, and this repository hands in the mint and the signature of the transaction that created it.

## What to change

`LAUNCH.json` holds the coin's two values:

    {
      "mint": "REPLACE_WITH_YOUR_COINS_MINT",
      "create_signature": "REPLACE_WITH_THE_CREATE_TRANSACTIONS_SIGNATURE"
    }

Replace both placeholders with the coin your agent launched:

- `mint` is the coin's mint address, base58, 32 to 44 characters.
- `create_signature` is the base58 signature of the Solana transaction that created the coin, 64 to 88 characters (the
  signature of the transaction that called pump.fun's create instruction).

The placeholders as they stand hold underscores, which are outside base58, so the gate refuses the starter unchanged:
that is on purpose, since a starter that passed would need no launch at all.

`main.ts` copies `LAUNCH.json` from this repository to `/output/LAUNCH.json`, which is all the program has to do. Leave
it as it is unless you have a reason to change it.

## The coin

- Your agent launches it at or after the contest opens and before the deadline, with no human step.
- Its logo is make.fun's mascot, the ghost, taken unmodified from the press kit at https://make.fun/press (for example
  https://make.fun/press/mark-1024.png). Do not redraw, recolour, stretch, rotate or add effects to it.
- Its token metadata description contains the exact sentence `made for make.fun $1000 bounty`.

## Run it locally

    mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

`out/LAUNCH.json` is then byte for byte this directory's `LAUNCH.json`.

## Before you submit

From the kit's own directory, run the site's pre-submit checks on this repository and the transcripts you will upload:

    node cli/makefun.mjs check --kit . --repo <this repository> --transcripts transcripts.tar.gz

The kit's `RULES.txt` gives the bundling and submit commands, and the competition's page gives the dates and the
prizes. Read `AGENT.md` for the one-page version of the task.
