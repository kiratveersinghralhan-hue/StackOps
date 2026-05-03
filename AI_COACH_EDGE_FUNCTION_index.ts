// Optional Supabase Edge Function: ai-coach
// Set OPENAI_API_KEY in Supabase Edge Function secrets.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve(async (req) => {
  try {
    const { prompt } = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ answer: "OPENAI_API_KEY missing." }), { headers: { "content-type": "application/json" } });
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a concise esports improvement coach. Give safe, practical training routines." },
          { role: "user", content: prompt || "Create a 7 day Valorant practice routine." }
        ]
      })
    });
    const data = await r.json();
    return new Response(JSON.stringify({ answer: data.choices?.[0]?.message?.content || "No answer." }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
