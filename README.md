## SplitReceipt (Upstage API Demo)

Simple web app to **scan a receipt with Upstage Document AI** and **split the bill** between friends.

- **Upload a receipt** image or PDF.
- **Scan** via Upstage Document AI Receipt Extraction.
- **Add people** at the table.
- **Assign items** to each person (supports shared items).
- **See the split** with per‑person totals and charts.

## Live Demo / Hosting

You can deploy this easily on Vercel:

1. Import this GitHub repo into Vercel.
2. Framework preset: **“Other / Static HTML”** (or equivalent).
3. Build command: **none** (static).
4. Output directory: **root** (where `main.html` lives).

## Using Your Upstage API Key

1. Go to the deployed site (or open `main.html` locally).
2. Paste your **Upstage API key** (e.g. `up_xxx...`) into the **API Key** field at the top.
3. Upload a receipt and click **“Scan Receipt →”**.

The key is **not stored in the repo**; it’s only used in your browser to call:

- `POST https://api.upstage.ai/v1/document-ai/extraction/receipt`

with `Authorization: Bearer <YOUR_KEY>`.

## Local Development

Just open `main.html` in a browser:

```bash
open main.html
```

or serve it with any static server.
