# SplitReceipt (Upstage API)

SplitReceipt is a small Next.js app that lets you upload a receipt image, automatically extract line items using the Upstage Information Extraction API, then interactively split the bill among people. It supports tax, service charge / rounding adjustments, and up to 18 people per bill.

## Tech stack

- Next.js 14 (Pages Router)
- React 18
- API route using:
  - `formidable` for file uploads
  - `form-data` and `node-fetch` to call the Upstage API

## How it works

1. Upload a photo/PDF of a receipt.
2. The Next.js API route (`/api/scan`) sends the file to Upstage’s Information Extraction API (`receipt-extraction-3.2.0`).
3. The response is parsed into:
   - Menu items (name + price)
   - Tax
   - Service charge / rounding (when present)
4. In the UI you can:
   - Add up to 18 people
   - Assign who ate what (shared items are split automatically)
   - See per-person totals, a bar chart, and a pie-style share breakdown.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the project root:

```bash
UPSTAGE_API_KEY=your_real_upstage_key_here
```

3. Start the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Environment variables

- **`UPSTAGE_API_KEY`** (required): Your Upstage Information Extraction API key.

In production (e.g. on Vercel), set this in the project’s **Settings → Environment Variables**. Do **not** commit this value to Git.

## Deployment (Vercel)

1. Push this repository to GitHub.
2. In Vercel, create a new project from this GitHub repo.
3. In the project’s **Settings → Environment Variables**, add:

   - Name: `UPSTAGE_API_KEY`  
   - Value: your real Upstage API key  
   - Environment: Production (and Preview/Development if desired)

4. Trigger a deployment (or let Vercel auto-deploy from `main`).

