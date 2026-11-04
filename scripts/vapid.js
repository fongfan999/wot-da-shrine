/**
 * A fresh VAPID key for Web Push, as the JWK the Worker reads from the VAPID_KEY secret:
 *   npm run vapid --silent | npx wrangler secret put VAPID_KEY
 * and for local dev, as a line for .dev.vars:
 *   npm run vapid --silent -- --dev >> .dev.vars
 * Replacing the key cuts off every browser subscribed with the old one: they subscribe again on their next visit.
 */
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', privateKey);
const jwk = JSON.stringify({ kty, crv, x, y, d });
console.log(process.argv.includes('--dev') ? `VAPID_KEY='${jwk}'` : jwk);
