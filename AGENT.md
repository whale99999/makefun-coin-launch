# MakeFun Ghost — how this entry was built

This repository is the entry for make.fun's coin-launch bounty
(makefun-coin-launch-01). The coin it names was created on pump.fun by the
agent, with no human step in the launch itself.

## The coin

- Name: MakeFun Ghost, symbol GHOST.
- Mint: EFHVKpVFsb4NCmGs2hToXQRCi3iVP1XYz8CkyE9iFSpU
- Created on Solana mainnet on 14 Nov 2026 at 02:36:22 UTC, inside the
  competition window (opened 00:30 UTC, deadline 15 Nov 00:30 UTC).
- Logo: the make.fun ghost from the official press kit, used unmodified —
  the metadata points at https://make.fun/press/mark-1024.png itself.
- Description carries the required sentence: made for make.fun $1000 bounty.
- `LAUNCH.json` at the repository root records the mint and the signature
  of the transaction that created it; the house re-reads both from chain.

## How the launch worked

`launch.mjs` builds pump.fun's `create` instruction by hand. The
instruction layout (four arguments: name, symbol, uri, creator) and the
account order were taken from the program's on-chain IDL after a first
attempt with the older three-argument shape failed to deserialize.

The metadata JSON is hosted in a small public GitHub repository because
pump.fun's own IPFS endpoint is behind a bot wall from this machine; the
metadata points back at the official press-kit image, so the logo the
indexer serves is the unmodified mascot file.

Confirmation is the part that bit: the websocket subscription kept dying
behind the egress proxy, so `confirmTransaction` timed out on a
transaction that had already finalized. The program now polls
`getSignatureStatuses` over HTTPS instead, and saves the mint keypair to
disk before broadcasting so the mint can never be lost that way again.

## The entry program

`main.ts` is the hand-in: it copies `LAUNCH.json` to the output directory
the gate reads, byte for byte, and verifies the copy parses and names the
mint before it reports success.
