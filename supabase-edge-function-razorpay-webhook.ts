// Supabase Edge Function: razorpay-webhook
// Deploy this function and use its URL in Razorpay Webhooks.
// Required secrets:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// RAZORPAY_WEBHOOK_SECRET

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function planReward(planKey: string | null) {
  const key = planKey || "premium";
  const map: Record<string, { title: string; badge: string; xp: number; days: number }> = {
    bronze: { title: "Bronze Operator", badge: "Bronze Spark", xp: 150, days: 30 },
    silver: { title: "Silver Duelist", badge: "Silver Pulse", xp: 300, days: 30 },
    gold: { title: "Gold Commander", badge: "Gold Protocol", xp: 600, days: 30 },
    diamond: { title: "Diamond Strategist", badge: "Diamond Core", xp: 1200, days: 60 },
    legend: { title: "Legend Operator", badge: "Legend Crest", xp: 2500, days: 90 },
    premium: { title: "Premium Operator", badge: "Premium Crest", xp: 500, days: 30 }
  };
  return map[key] || map.premium;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";
  const signature = req.headers.get("x-razorpay-signature") || "";
  const body = await req.text();

  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  const expected = await hmacSha256Hex(webhookSecret, body);
  if (expected !== signature) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(body);
  const eventName = event?.event || "unknown";
  const payment = event?.payload?.payment?.entity;

  if (!payment) return new Response("No payment entity", { status: 200 });

  const stackopsPaymentId = payment?.notes?.stackops_payment_id;
  const itemType = payment?.notes?.item_type || "service";
  const planKey = payment?.notes?.plan_key || null;
  const userId = payment?.notes?.stackops_user_id || null;
  const amountInr = Math.round(Number(payment?.amount || 0) / 100);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const audit = async (message: string, paymentId?: string | null) => {
    await supabase.from("payment_audit_log").insert({
      payment_id: paymentId || null,
      event_name: eventName,
      provider_payment_id: payment?.id || null,
      message,
      payload: event
    });
  };

  if (!stackopsPaymentId) {
    await audit("Missing stackops_payment_id in Razorpay notes", null);
    return new Response("Missing StackOps payment id", { status: 200 });
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("id,buyer_id,item_type,plan_key,amount_inr,status")
    .eq("id", stackopsPaymentId)
    .maybeSingle();

  if (!existing) {
    await audit("Payment row not found", stackopsPaymentId);
    return new Response("Payment row not found", { status: 200 });
  }

  const buyerId = existing.buyer_id || userId;
  const isCaptured = eventName === "payment.captured" || payment?.status === "captured";

  await supabase.from("payments").update({
    provider_payment_id: payment.id,
    provider_order_id: payment.order_id || null,
    status: isCaptured ? "captured" : (payment.status || eventName),
    razorpay_event: eventName,
    raw_response: payment,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", stackopsPaymentId);

  if (!isCaptured || !buyerId) {
    await audit("Payment verified but not captured/unlockable yet", stackopsPaymentId);
    return new Response("verified-no-unlock", { status: 200 });
  }

  const finalItemType = existing.item_type || itemType;
  const finalPlanKey = existing.plan_key || planKey || "premium";

  if (finalItemType === "plan") {
    const reward = planReward(finalPlanKey);
    const until = new Date(Date.now() + reward.days * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("profiles").update({
      plan_key: finalPlanKey,
      premium_until: until,
      is_verified: true,
      title: reward.title,
      badge: reward.badge
    }).eq("id", buyerId);

    // XP increment separately because PostgREST update cannot do xp + reward.xp directly.
    const { data: profile } = await supabase.from("profiles").select("xp,coins").eq("id", buyerId).maybeSingle();
    await supabase.from("profiles").update({
      xp: Number(profile?.xp || 0) + reward.xp,
      coins: Number(profile?.coins || 0) + Math.floor(amountInr / 10)
    }).eq("id", buyerId);

    await supabase.from("payment_entitlements").upsert({
      payment_id: stackopsPaymentId,
      user_id: buyerId,
      entitlement_type: "plan",
      entitlement_key: finalPlanKey,
      status: "active",
      ends_at: until
    }, { onConflict: "payment_id,entitlement_type,entitlement_key" });
  } else if (finalItemType === "seller_fee") {
    await supabase.from("profiles").update({ is_verified: true }).eq("id", buyerId);
    await supabase.from("payment_entitlements").upsert({
      payment_id: stackopsPaymentId,
      user_id: buyerId,
      entitlement_type: "seller_application",
      entitlement_key: "paid_application",
      status: "active"
    }, { onConflict: "payment_id,entitlement_type,entitlement_key" });
  } else {
    await supabase.from("payment_entitlements").upsert({
      payment_id: stackopsPaymentId,
      user_id: buyerId,
      entitlement_type: finalItemType,
      entitlement_key: payment?.notes?.item_name || "service",
      status: "active"
    }, { onConflict: "payment_id,entitlement_type,entitlement_key" });
  }

  await supabase.from("payments").update({
    status: "unlocked",
    unlocked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", stackopsPaymentId);

  await audit("Payment captured and entitlement unlocked", stackopsPaymentId);
  return new Response("ok", { status: 200 });
});
