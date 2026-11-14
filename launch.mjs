// make.fun coin launch (makefun-coin-launch-01) — pump.fun create, fully autonomous.
// Modes:
//   --check             print pubkey + balance only (no writes, no tx)
//   --prepare-metadata  upload logo+metadata to pump.fun IPFS, save metadata.json
//   --fire              create the coin on pump.fun, write launch-repo/LAUNCH.json + launch-state.json
import fs from 'node:fs';
import crypto from 'node:crypto';
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
const DESCRIPTION = 'Launched autonomously by an AI agent. made for make.fun $1000 bounty';
const MIN_BALANCE = 30_000_000; // 0.03 SOL gate

function loadPayer() {
  const raw = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  const kp = Array.isArray(raw) ? Keypair.fromSecretKey(Uint8Array.from(raw)) : null;
  if (!kp) throw new Error('wallet format not recognised');
  if (kp.publicKey.toBase58() !== EXPECTED_PUBKEY) throw new Error('pubkey mismatch: ' + kp.publicKey.toBase58());
  return kp;
}

const mode = process.argv[2] || '--check';
const conn = new Connection(RPC, 'confirmed');
const payer = loadPayer();

if (mode === '--check') {
  const bal = await conn.getBalance(payer.publicKey);
  console.log(JSON.stringify({ pubkey: payer.publicKey.toBase58(), lamports: bal, sol: bal / 1e9 }));
} else if (mode === '--prepare-metadata') {
  const img = fs.readFileSync(DIR + '/ghost.png');
  const form = new FormData();
  form.append('file', new Blob([img], { type: 'image/png' }), 'mark-1024.png');
  form.append('name', NAME);
  form.append('symbol', SYMBOL);
  form.append('description', DESCRIPTION);
  form.append('twitter', '');
  form.append('telegram', '');
  form.append('website', '');
  form.append('showName', 'true');
  const res = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: form });
  const text = await res.text();
  console.log('ipfs status', res.status);
  if (!res.ok) { console.error(text.slice(0, 500)); process.exit(1); }
  const j = JSON.parse(text);
  if (!j.metadataUri) { console.error('no metadataUri in response', text.slice(0, 500)); process.exit(1); }
  fs.writeFileSync(DIR + '/metadata.json', JSON.stringify({ metadataUri: j.metadataUri, name: NAME, symbol: SYMBOL, description: DESCRIPTION }, null, 2));
  console.log('metadataUri', j.metadataUri);
} else if (mode === '--fire') {
  const stateFile = DIR + '/launch-state.json';
  if (fs.existsSync(stateFile)) { console.log('ALREADY LAUNCHED', fs.readFileSync(stateFile, 'utf8')); process.exit(0); }
  const meta = JSON.parse(fs.readFileSync(DIR + '/metadata.json', 'utf8'));
  const bal = await conn.getBalance(payer.publicKey);
  console.log('balance lamports', bal);
  if (bal < MIN_BALANCE) { console.log('INSUFFICIENT_BALANCE'); process.exit(2); }

  const mint = Keypair.generate();
  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], PUMP_PROGRAM);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.publicKey.toBuffer()], PUMP_PROGRAM);
  const associatedBondingCurve = getAssociatedTokenAddressSync(mint.publicKey, bondingCurve, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [global] = PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_PROGRAM);
  const [metadata] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), MPL_METADATA.toBuffer(), mint.publicKey.toBuffer()], MPL_METADATA);
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_PROGRAM);

  const disc = crypto.createHash('sha256').update('global:create').digest().subarray(0, 8);
  const str = (s) => { const b = Buffer.from(s, 'utf8'); const len = Buffer.alloc(4); len.writeUInt32LE(b.length); return Buffer.concat([len, b]); };
  const data = Buffer.concat([disc, str(NAME), str(SYMBOL), str(meta.metadataUri), payer.publicKey.toBuffer()]);

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
  const ix = new TransactionInstruction({ programId: PUMP_PROGRAM, keys, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  tx.sign(payer, mint);
  const raw = tx.serialize();
  // Simulate first; only broadcast if simulation is clean.
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) { console.error('SIMULATION FAILED', JSON.stringify(sim.value.err), (sim.value.logs || []).slice(-8)); process.exit(3); }
  const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  console.log('sent', sig);
  const conf = await conn.confirmTransaction(sig, 'confirmed');
  if (conf.value.err) { console.error('TX FAILED ON CHAIN', JSON.stringify(conf.value.err)); process.exit(4); }
  const out = { mint: mint.publicKey.toBase58(), create_signature: sig };
  fs.writeFileSync(DIR + '/launch-repo/LAUNCH.json', JSON.stringify(out, null, 2));
  fs.writeFileSync(stateFile, JSON.stringify({ ...out, ts: new Date().toISOString() }, null, 2));
  console.log('LAUNCHED', JSON.stringify(out));
} else {
  console.error('unknown mode', mode); process.exit(1);
}
