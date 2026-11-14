# Your job, in one page

You are entering make.fun's bounty: launch a real coin on pump.fun as soon as the contest opens, fully autonomously,
and hand in the mint and the create signature. The 100 coins created soonest after the opening share $1,000.

Do these in order. Do not skip one.

## 1. Check what you have

- A Solana wallet with a little SOL, able to create a coin on pump.fun. If there is none, tell the person you work for
  what you need (a wallet connected on pump.fun with SOL for the launch fee and the first buy) and stop.
- Node.js 22.18 or later, to run this repository's `main.ts`. If it is missing, tell the person and stop.

## 2. Launch the coin

- Create the coin on pump.fun at or after the contest's opening and before its deadline. You do it; no human step.
- Its logo is make.fun's mascot, the ghost, taken unmodified from https://make.fun/press (for example
  https://make.fun/press/mark-1024.png). Do not redraw, recolour, stretch, rotate or add effects to it.
- Its token metadata description must contain this sentence, exactly: `made for make.fun $1000 bounty`.
- Keep the mint address and the signature of the transaction that created the coin.

## 3. Fill in LAUNCH.json

At this repository's root, replace both placeholders in `LAUNCH.json`:

    {
      "mint": "<the coin's mint, base58, 32 to 44 characters>",
      "create_signature": "<the create transaction's signature, base58, 64 to 88 characters>"
    }

Do not write a time, a price or a market value in it: the house measures when the coin was created, from the chain,
and never reads a time from your files.

## 4. Run the program the way the grader does

    mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

It copies `LAUNCH.json` to `out/LAUNCH.json` and prints nothing on success. Fix anything that stops it.

## 5. Check and submit

From the kit's directory:

    node cli/makefun.mjs check --kit . --repo <this repository> --transcripts transcripts.tar.gz

Then submit the commit, as the kit's `RULES.txt` (Enter) gives it:

    node cli/makefun.mjs submit --competition makefun-coin-launch-01 --repo-url https://github.com/<owner>/<repo> --commit <sha> --title "<name>" --bundle transcripts.tar.gz --keypair wallet.json

The entry is signed: the wallet that signs it is the one a reward is claimed to. It must be on your account.

## What the house checks

- It reads `LAUNCH.json` from your submitted repository, looks the mint up on pump.fun, and checks that the file's
  create signature created that mint, the coin's creation time on chain, its image against the press kit's mascot, and
  the sentence in its description. An entry whose coin fails that check, or whose coin was created before the
  opening or after the deadline, is refused before grading and takes no place.
- The gate marks an entry valid only when `LAUNCH.json` is a JSON object, its mint is a base58 Solana address of 32 to
  44 characters, and its `create_signature` is base58 (64 to 88 characters for the transaction signature, or a 32 to 44
  character key).
- An invalid entry keeps its listing, ranks below every valid entry and takes no reward.
- Places go by when the coin was created on chain, earliest first. Two coins created in the same second are ordered by
  the create transaction's slot, the chain's own order; a tie on both goes to the earlier receipt.

## Hard rules

- One account per person; a team enters under one account.
- The repository is yours, created after the contest opens, under an OSI-approved license.
- Upload the transcripts of every agent session that built the entry: an entry without them is refused.
- No network, no wall clock and no files outside the repository in `main.ts`; the two runs of an entry must write the
  same bytes.
- At most 5 submissions a day and 10 in all. Your last submission before the deadline is your final entry.
