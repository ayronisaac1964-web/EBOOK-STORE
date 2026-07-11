# AuthorShelf — Ebook Storefront

Direct-to-reader ebook storefront for an independent author. Static frontend + serverless
backend (Vercel functions + MongoDB Atlas + Paystack + Resend + Cloudinary).

## Live buyer flow
Landing → Storefront → Book detail → Cart → Checkout → Paystack popup → server-verified
payment → confirmation email with download link → secure download.

## Structure

```
/public                        ← deploy root (Vercel "publish directory")
  index.html                    Landing page
  /pages
    storefront.html             Catalog
    book-detail.html            Single book
    cart.html                   Cart
    checkout.html               Checkout + Paystack popup
    about.html                  About the author
    privacy.html                Privacy policy
    terms.html                  Terms of sale
  /admin
    login.html                  Admin login
    dashboard.html               Stats overview
    add-book.html                Add a book (Cloudinary direct upload)
    edit-books.html              Edit / deactivate books
    orders.html                   Order list
  /assets/css, /assets/js        Shared + per-page styles/scripts

/api                           Serverless functions (Vercel Node.js, (req, res) style)
  books.js                      GET  /api/books
  books/[id].js                 GET  /api/books/:id
  create-transaction.js         POST /api/create-transaction
  verify-transaction.js         GET  /api/verify-transaction?reference=...
  paystack-webhook.js           POST /api/paystack-webhook   (Paystack calls this)
  download/[token].js           GET  /api/download/:token
  admin/login.js                POST /api/admin/login
  admin/dashboard.js            GET  /api/admin/dashboard
  admin/orders.js                GET  /api/admin/orders
  admin/books.js                 GET/POST /api/admin/books
  admin/books/[id].js            PATCH/DELETE /api/admin/books/:id
  admin/cloudinary-sign.js       POST /api/admin/cloudinary-sign
  lib/                           mongodb.js, paystack.js, mailer.js, tokens.js, files.js,
                                  fulfill.js, adminAuth.js
```

## Environment variables

Copy `.env.example` to `.env` for local dev, and set the same keys in your Vercel
project's Environment Variables dashboard for Production + Preview.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name (optional if included in URI) |
| `PAYSTACK_SECRET_KEY` | Server-side only — initializes/verifies transactions, checks webhook signature |
| `PAYSTACK_PUBLIC_KEY` | Not required by the current checkout flow (Popup v2 resumes by access_code), kept for reference/future use |
| `RESEND_API_KEY` | Sends order confirmation emails |
| `RESEND_FROM_EMAIL` | From address for those emails |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Book cover + ebook file storage |
| `SITE_URL` | Full production URL, no trailing slash — used to build download links in emails |
| `DOWNLOAD_TOKEN_TTL_DAYS` | Days a download link stays valid (default 30) |
| `DOWNLOAD_TOKEN_MAX_USES` | Max redemptions per link (default 5) |
| `ADMIN_PASSWORD` | The one password that unlocks `/admin/*` |
| `ADMIN_SESSION_SECRET` | HMAC secret signing admin session tokens — generate with `openssl rand -hex 32` |
| `ADMIN_SESSION_TTL_HOURS` | How long an admin session lasts after login (default 12) |

## Run locally

```bash
npm install
npx vercel dev
```

`vercel dev` serves `/public` as static files and runs everything in `/api` as serverless
functions on the same origin, matching production routing. Needs a `.env` file (or `vercel
env pull`) with the variables above.

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import the repo in the Vercel dashboard, or run `vercel` from the project root.
3. Add every variable from the table above under Project Settings → Environment Variables
   (Production and Preview).
4. Deploy. Vercel auto-detects `/public` as static output and `/api/**.js` (including the
   `[id].js` / `[token].js` bracket files) as serverless functions — no extra config beyond
   the `vercel.json` already in this repo.
5. In the Paystack dashboard, set the webhook URL to
   `https://<your-domain>/api/paystack-webhook` and use your **live** secret key once you're
   ready to go live (test keys during development).
6. Set `SITE_URL` to the final production URL so emailed download links point to the right
   place.

### Why Vercel and not Netlify

`netlify.toml` is present but the `/api` functions are written as Vercel-style handlers
(`module.exports = async (req, res) => {...}`, plus bracket files like `[id].js` for dynamic
routes). Netlify Functions use a different handler signature (`(event, context)`) and don't
support bracket-file dynamic routing without extra redirect rules — so as-is, this backend
only works on Vercel. Porting to Netlify would mean rewriting each handler's signature and
adding `netlify.toml` redirects for the dynamic routes; out of scope unless you specifically
need Netlify.

## Security notes

- Ebook files live in Cloudinary as private "authenticated" raw resources. The only way to
  reach one is a signed URL minted for ~60 seconds at the moment of a validated download —
  never a public link.
- Every `/api/admin/*` route calls `requireAdmin()` first and rejects with 401 if the bearer
  token is missing, malformed, expired, or incorrectly signed.
- Order totals are always computed server-side in `create-transaction.js` from the database
  price, never from whatever the browser sends.
- The Paystack webhook checks the `x-paystack-signature` header via HMAC-SHA512 before
  processing anything, and is idempotent with the frontend's fast-path verify call.
- No secret ever appears in frontend code — everything server-side reads from
  `process.env`.

## Design tokens (`assets/css/variables.css`)

Color, type, and spacing variables live here and are the only place a hex value should be
defined. Reusable classes (`.btn`, `.container`, `.section`, `.site-header`, `.site-footer`,
`.placeholder`, etc.) live in `style.css` and are shared across every page.
