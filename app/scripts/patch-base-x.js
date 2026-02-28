#!/usr/bin/env node
/**
 * Post-install patches for Hermes (React Native) compatibility.
 *
 * Hermes breaks `instanceof Uint8Array` for Buffer polyfill subclasses.
 * This script patches the libraries that rely on instanceof checks:
 *   1. @noble/hashes isBytes() — used by @solana/web3.js crypto
 *   2. base-x v3 — used by bs58 (redirected via Metro, but patch as backup)
 */
const fs = require('fs');
const path = require('path');

// ── Patch @noble/hashes isBytes ──────────────────────────────────────────
const NOBLE_TARGET = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'utils.js');
const NOBLE_OLD = `function isBytes(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}`;
const NOBLE_NEW = `function isBytes(a) {
    if (a instanceof Uint8Array) return true;
    if (a == null) return false;
    if (a.constructor && a.constructor.name === 'Buffer') return true;
    if (a.constructor && a.constructor.name === 'Uint8Array') return true;
    return (typeof a.length === 'number' && typeof a.byteLength === 'number' && typeof a.BYTES_PER_ELEMENT === 'number' && a.BYTES_PER_ELEMENT === 1);
}`;

if (fs.existsSync(NOBLE_TARGET)) {
  let nobleSrc = fs.readFileSync(NOBLE_TARGET, 'utf8');
  if (nobleSrc.includes("a.constructor.name === 'Buffer'")) {
    console.log('[patch] @noble/hashes isBytes already patched');
  } else if (nobleSrc.includes(NOBLE_OLD)) {
    nobleSrc = nobleSrc.replace(NOBLE_OLD, NOBLE_NEW);
    fs.writeFileSync(NOBLE_TARGET, nobleSrc, 'utf8');
    console.log('[patch] @noble/hashes isBytes patched for Hermes');
  } else {
    console.log('[patch] @noble/hashes pattern not found — may have been updated');
  }
} else {
  console.log('[patch] @noble/hashes not found, skipping');
}

// ── Patch @noble/hashes ESM randomBytes — stale crypto snapshot ──────────
const NOBLE_ESM = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'esm', 'utils.js');
if (fs.existsSync(NOBLE_ESM)) {
  let esmSrc = fs.readFileSync(NOBLE_ESM, 'utf8');
  if (esmSrc.includes('globalThis.crypto || crypto')) {
    console.log('[patch] @noble/hashes ESM randomBytes already patched');
  } else {
    // replace the module-scoped crypto read with a globalThis.crypto fallback
    const oldRB = `    if (crypto && typeof crypto.getRandomValues === 'function') {
        return crypto.getRandomValues(new Uint8Array(bytesLength));
    }`;
    const newRB = `    const _c = globalThis.crypto || crypto;
    if (_c && typeof _c.getRandomValues === 'function') {
        return _c.getRandomValues(new Uint8Array(bytesLength));
    }`;
    if (esmSrc.includes(oldRB)) {
      esmSrc = esmSrc.replace(oldRB, newRB);
      // also patch the node compat path
      esmSrc = esmSrc.replace(
        `    if (crypto && typeof crypto.randomBytes === 'function') {\n        return Uint8Array.from(crypto.randomBytes(bytesLength));`,
        `    if (_c && typeof _c.randomBytes === 'function') {\n        return Uint8Array.from(_c.randomBytes(bytesLength));`
      );
      fs.writeFileSync(NOBLE_ESM, esmSrc, 'utf8');
      console.log('[patch] @noble/hashes ESM randomBytes patched for Hermes');
    } else {
      console.log('[patch] @noble/hashes ESM randomBytes pattern not found');
    }
  }
}

// ── Patch @noble/hashes CJS randomBytes — same stale crypto issue ────────
const NOBLE_CJS = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'utils.js');
if (fs.existsSync(NOBLE_CJS)) {
  let cjsSrc = fs.readFileSync(NOBLE_CJS, 'utf8');
  if (cjsSrc.includes('globalThis.crypto || crypto_1.crypto')) {
    console.log('[patch] @noble/hashes CJS randomBytes already patched');
  } else {
    const oldCJS = `    if (crypto_1.crypto && typeof crypto_1.crypto.getRandomValues === 'function') {\n        return crypto_1.crypto.getRandomValues(new Uint8Array(bytesLength));\n    }`;
    const newCJS = `    const _c = globalThis.crypto || crypto_1.crypto;\n    if (_c && typeof _c.getRandomValues === 'function') {\n        return _c.getRandomValues(new Uint8Array(bytesLength));\n    }`;
    if (cjsSrc.includes(oldCJS)) {
      cjsSrc = cjsSrc.replace(oldCJS, newCJS);
      cjsSrc = cjsSrc.replace(
        `    if (crypto_1.crypto && typeof crypto_1.crypto.randomBytes === 'function') {\n        return Uint8Array.from(crypto_1.crypto.randomBytes(bytesLength));`,
        `    if (_c && typeof _c.randomBytes === 'function') {\n        return Uint8Array.from(_c.randomBytes(bytesLength));`
      );
      fs.writeFileSync(NOBLE_CJS, cjsSrc, 'utf8');
      console.log('[patch] @noble/hashes CJS randomBytes patched for Hermes');
    } else {
      console.log('[patch] @noble/hashes CJS randomBytes pattern not found');
    }
  }
}

// ── Patch base-x v3 (backup — Metro resolver redirects to shim) ─────────
const BASEX_TARGET = path.join(__dirname, '..', 'node_modules', 'base-x', 'src', 'index.js');

if (fs.existsSync(BASEX_TARGET)) {
  let bxSrc = fs.readFileSync(BASEX_TARGET, 'utf8');
  const BX_OLD = "if (!_Buffer.isBuffer(source)) { throw new TypeError('Expected Buffer') }";
  const BX_NEW = "if (!_Buffer.isBuffer(source) && !(source instanceof Uint8Array)) { throw new TypeError('Expected Buffer') }";
  if (bxSrc.includes(BX_NEW)) {
    console.log('[patch] base-x already patched');
  } else if (bxSrc.includes(BX_OLD)) {
    bxSrc = bxSrc.replace(BX_OLD, BX_NEW);
    fs.writeFileSync(BASEX_TARGET, bxSrc, 'utf8');
    console.log('[patch] base-x patched for Hermes');
  } else {
    console.log('[patch] base-x pattern not found');
  }
} else {
  console.log('[patch] base-x not found, skipping');
}
