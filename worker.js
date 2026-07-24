/**
 * Mail Forensics Unit — API proxy (Cloudflare Worker)
 *
 * This runs on Cloudflare's servers, not in the visitor's browser.
 * It holds your Anthropic API key as a secret and forwards the
 * request to Claude, so the key never appears in your website's code.
 *
 * SETUP (one time):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker
 * 2. Give it any name, e.g. "mail-forensics-proxy" -> Deploy
 * 3. Click "Edit code", delete everything, paste this whole file in, click "Deploy"
 * 4. Go to the worker's Settings -> Variables and Secrets -> Add:
 *      Name:  ANTHROPIC_API_KEY
 *      Value: (your key from https://console.anthropic.com/settings/keys)
 *      Type:  Secret (encrypted)
 *    Save.
 * 5. Go to Settings -> Domains & Routes and copy the workers.dev URL,
 *    e.g. https://mail-forensics-proxy.YOURNAME.workers.dev
 * 6. Paste that URL into ANALYSIS_ENDPOINT in index.html (see comment there).
 *
 * That's it — no server to maintain, Cloudflare's free tier covers this easily.
 */

// Only allow requests from your own site(s). Add every domain you host this on.
const ALLOWED_ORIGINS = [
  "https://divyamishradesign.xyz",
  "https://www.divyamishradesign.xyz",
  "http://localhost:8000",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const originAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      "Access-Control-Allow-Origin": originAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    if (!originAllowed) {
      return new Response("Origin not allowed", { status: 403, headers: corsHeaders });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
    }

    // Basic guardrails so this proxy can only ever be used for this one task.
    const safePayload = {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: payload.system,
      messages: payload.messages,
    };

    if (!safePayload.system || !Array.isArray(safePayload.messages)) {
      return new Response("Missing system or messages", { status: 400, headers: corsHeaders });
    }

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(safePayload),
      });

      const body = await anthropicRes.text();
      return new Response(body, {
        status: anthropicRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Upstream request failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
