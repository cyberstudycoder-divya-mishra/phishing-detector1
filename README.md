# Mail Forensics Unit — deployment guide

You have two files:

- **`phishing-detector.html`** — the website itself. Upload this to your live server exactly as it is, no edits needed until step 5.
- **`worker.js`** — a small proxy that holds your Anthropic API key safely. It runs on Cloudflare, not on your website.

Why you need the proxy: a browser page can never hold a secret API key safely — anyone could open dev tools and steal it. The proxy sits between your site and Claude, keeping the key server-side.

## Step 1 — Get an Anthropic API key
1. Go to https://console.anthropic.com/settings/keys
2. Create a key, copy it somewhere safe. You'll paste it once, in step 3.
3. Note: API usage is billed separately from any Claude.ai subscription — check current pricing at https://docs.claude.com if you want to estimate cost per scan.

## Step 2 — Create the Cloudflare Worker
1. Go to https://dash.cloudflare.com (free account is fine) → **Workers & Pages** → **Create** → **Worker**
2. Give it a name, e.g. `mail-forensics-proxy` → **Deploy** (it'll deploy a default "Hello World", that's fine for now)
3. Click **Edit code**
4. Delete everything in the editor, paste in the entire contents of `worker.js`
5. Click **Deploy**

## Step 3 — Add your API key as a secret
1. On the Worker's page, go to **Settings → Variables and Secrets**
2. Click **Add** →
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste the key from Step 1
   - Type: **Secret** (so it's encrypted, not plain text)
3. Save. The Worker redeploys automatically.

## Step 4 — Copy your Worker's URL
Still on the Worker's page, under **Settings → Domains & Routes**, copy the `workers.dev` URL. It looks like:

```
https://mail-forensics-proxy.yourname.workers.dev
```

## Step 5 — Connect the website to the Worker
1. Open `phishing-detector.html` in any text editor (Notepad, TextEdit, VS Code — anything)
2. Find this line near the top of the `<script>` section:
   ```js
   const ANALYSIS_ENDPOINT = "";
   ```
3. Paste your Worker URL between the quotes:
   ```js
   const ANALYSIS_ENDPOINT = "https://mail-forensics-proxy.yourname.workers.dev";
   ```
4. Save the file, upload it to your live server.

## Step 6 — Allow your domain
Open `worker.js` again in the editor (either locally, or directly in the Cloudflare dashboard's **Edit code** screen) and check this section near the top:

```js
const ALLOWED_ORIGINS = [
  "https://divyamishradesign.xyz",
  "https://www.divyamishradesign.xyz",
  "http://localhost:8000"
];
```

This list is a safety gate — it stops random other websites from using your Worker (and your API key) for free. Add or edit the domain(s) to match exactly where you're hosting `phishing-detector.html`, then redeploy in Cloudflare if you changed anything.

## Done
Once both pieces are live, uploading a `.eml` on your site will call your Worker, which calls Claude, and the report renders as before — just like it did inside the Claude chat preview, except now it works on your own domain.

## If something doesn't work
- **"Origin not allowed"** → the domain in `ALLOWED_ORIGINS` doesn't exactly match your site's URL (check `http` vs `https`, and `www.` vs no `www.`).
- **"Analysis failed" still** → double check the API key was saved as type *Secret*, and that you copied the whole Worker URL correctly (no typos, no trailing slash).
- Cloudflare's free tier includes 100,000 requests/day, far more than a Campus Ambassador-scale site would need.
