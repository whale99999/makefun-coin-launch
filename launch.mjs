// Launch program for the make.fun coin-launch bounty entry "MakeFun Ghost" (GHOST).
// Creates a coin on pump.fun (Solana mainnet) with a hand-built create instruction,
// then records the mint and the create signature in LAUNCH.json for the entry.
//
// Modes:
//   --check   print the payer pubkey and its SOL balance, nothing else
//   --fire    create the coin: simulate, broadcast, confirm by HTTP polling,
//             then write launch-repo/LAUNCH.json and coinlaunch/launch-state.json
//
// Two fixes are baked in from the first live launch on 14 Nov 2026:
//   1. The mint keypair is saved to disk BEFORE broadcasting, so a dropped
//      confirmation can never lose the mint address again.
//   2. Confirmation polls getSignatureStatuses over plain HTTPS. Websocket
//      subscriptions die behind this machine's egress proxy (wss EPROTO),
//      which made confirmTransaction time out on a transaction that had
//      in fact already finalized.
import fs from 'node:fs';
import {
  Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY,
  Transaction, TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const DIR = '/home/hatch/workspace/makefun/coinlaunch';
const WALLET_FILE = '/home/hatch/workspace/makefun/wallet.json';
const EXPECTED_PUBKEY = 'HEk6sC5gTuR8oMxqUvKyDDNNf1SThZVvn9ReCBXHfkxS';
const RPC = 'https://api.mainnet-beta.solana.com';
const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const MPL_METADATA = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const NAME = 'MakeFun Ghost';
const SYMBOL = 'GHOST';
const MIN_BALANCE = 30_000_000; // 0.03 SOL gate before firing
// Anchor discriminator of pump.fun `create`, read from the program's on-chain IDL.
// The instruction takes four arguments: name, symbol, uri, creator (a pubkey).
const CREATE_DISC = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);

function loadPayer() {
  const raw = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('wallet format not recognised');
  const kp = Keypair.fromSecretKey(Uint8Array.from(raw));
  if (kp.publicKey.toBase58() !== EXPECTED_PUBKEY) {
    throw new Error('pubkey mismatch: ' + kp.publicKey.toBase58());
  }
  return kp;
}

function borshString(s) {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

async function pollConfirmed(conn, sig, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
    if (st) {
      if (st.err) throw new Error('transaction failed on chain: ' + JSON.stringify(st.err));
      if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') return st;
    }
    // 1.5 s between polls: tight enough for a race, gentle enough for the public RPC.
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('confirmation timed out (poll the signature before re-firing)');
}

const mode = process.argv[2] || '--check';
const conn = new Connection(RPC, 'confirmed');
const payer = loadPayer();

if (mode === '--check') {
  const bal = await conn.getBalance(payer.publicKey);
  console.log(JSON.stringify({ pubkey: payer.publicKey.toBase58(), lamports: bal, sol: bal / 1e9 }));
} else if (mode === '--fire') {
  const stateFile = DIR + '/launch-state.json';
  if (fs.existsSync(stateFile)) {
    console.log('ALREADY LAUNCHED', fs.readFileSync(stateFile, 'utf8'));
    process.exit(0);
  }
  const meta = JSON.parse(fs.readFileSync(DIR + '/metadata.json', 'utf8'));
  const bal = await conn.getBalance(payer.publicKey);
  console.log('balance lamports', bal);
  if (bal < MIN_BALANCE) { console.log('INSUFFICIENT_BALANCE'); process.exit(2); }

  // Save the mint keypair first: from here on the mint survives any crash.
  const mint = Keypair.generate();
  fs.writeFileSync(DIR + '/mint-keypair.json', JSON.stringify(Array.from(mint.secretKey)), { mode: 0o600 });
  console.log('mint', mint.publicKey.toBase58());

  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], PUMP_PROGRAM);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.publicKey.toBuffer()], PUMP_PROGRAM);
  const associatedBondingCurve = getAssociatedTokenAddressSync(mint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [global] = PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_PROGRAM);
  const [metadata] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), MPL_METADATA.toBuffer(), mint.publicKey.toBuffer()], MPL_METADATA);
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_PROGRAM);

  const data = Buffer.concat([
    CREATE_DISC,
    borshString(NAME),
    borshString(SYMBOL),
    borshString(meta.metadataUri),
    payer.publicKey.toBuffer(),
  ]);
  const keys = [
    { pubkey: mint.publicKey, isSigner: true, isWritable: true },
    { pubkey: mintAuthority, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: global, isSigner: false, isWritable: false },
    { pubkey: MPL_METADATA, isSigner: false, isWritable: false },
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
  ];
  const tx = new Transaction().add(new TransactionInstruction({ programId: PUMP_PROGRAM, keys, data }));
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  tx.sign(payer, mint);

  // Simulate first; broadcast only on a clean simulation.
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) {
    console.error('SIMULATION FAILED', JSON.stringify(sim.value.err), (sim.value.logs || []).slice(-8));
    process.exit(3);
  }
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  console.log('sent', sig);
  await pollConfirmed(conn, sig);

  const out = { mint: mint.publicKey.toBase58(), create_signature: sig };
  fs.writeFileSync(DIR + '/launch-repo/LAUNCH.json', JSON.stringify(out, null, 2) + '\n');
  fs.writeFileSync(stateFile, JSON.stringify({ ...out, ts: new Date().toISOString() }, null, 2));
  console.log('LAUNCHED', JSON.stringify(out));
} else {
  console.error('unknown mode', mode);
  process.exit(1);
}
