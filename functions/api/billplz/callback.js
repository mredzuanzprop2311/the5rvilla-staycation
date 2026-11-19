import { verifySandboxPayment } from "../../../server/billplz.mjs";

export async function onRequestPost({ request, env }) {
  if (env.BILLPLZ_SANDBOX_ENABLED !== "true" || !env.BILLPLZ_SANDBOX_DB) {
    return new Response(null, { status: 404 });
  }
  if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    return new Response(null, { status: 415 });
  }
  const payload = await request.text();
  if (payload.length > 16_384) return new Response(null, { status: 413 });
  const params = new URLSearchParams(payload);
  const billId = params.get("id");
  if (!await verifySandboxPayment(env, params, billId)) {
    return new Response(null, { status: 400 });
  }
  const db = env.BILLPLZ_SANDBOX_DB;
  const row = await db.prepare(
    "SELECT status FROM billplz_sandbox_payments WHERE bill_id = ?"
  ).bind(billId).first();
  if (!row) return new Response(null, { status: 404 });
  await db.prepare(
    "UPDATE billplz_sandbox_payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE bill_id = ? AND status = 'pending'"
  ).bind(billId).run();
  return new Response(null, { status: 204 });
}
