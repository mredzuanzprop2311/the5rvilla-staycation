// Server-side only. Pass a booking and bill ID from trusted storage.
export const BOOKING_DEPOSIT_SEN = 20_000;
const sandboxOrigin = "https://www.billplz-sandbox.com";

export async function createSandboxBill(env, booking, callbackUrl) {
  const { id, name, email } = booking;
  const amountSen = BOOKING_DEPOSIT_SEN;
  if (!id || !name || !email) {
    throw new Error("Rekod tempahan tidak lengkap.");
  }
  if (!env.BILLPLZ_API_KEY || !env.BILLPLZ_COLLECTION_ID) {
    throw new Error("Tetapan Billplz Sandbox belum lengkap.");
  }
  if (new URL(callbackUrl).protocol !== "https:") {
    throw new Error("URL callback mesti menggunakan HTTPS.");
  }

  const body = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    description: "Deposit tempahan THE 5R VILLA (Sandbox)",
    amount: String(amountSen),
    name,
    email,
    reference_1_label: "Booking ID",
    reference_1: id,
    callback_url: callbackUrl,
    deliver: "false",
  });
  const response = await fetch(sandboxOrigin + "/api/v3/bills", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(env.BILLPLZ_API_KEY + ":") },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Billplz Sandbox HTTP " + response.status);

  const bill = await response.json();
  const paymentUrl = new URL(bill.url);
  if (!/^[a-z0-9]+$/i.test(bill.id ?? "") ||
      bill.collection_id !== env.BILLPLZ_COLLECTION_ID ||
      bill.amount !== amountSen || bill.state !== "due" ||
      paymentUrl.href !== sandboxOrigin + "/bills/" + bill.id) {
    throw new Error("Respons bil Sandbox tidak sepadan dengan tempahan.");
  }
  return { billId: bill.id, paymentUrl: paymentUrl.href };
}

export async function verifySandboxPayment(env, params, expectedBillId) {
  const signature = params.get("x_signature");
  if (!env.BILLPLZ_X_SIGNATURE_KEY || !env.BILLPLZ_COLLECTION_ID ||
      !expectedBillId || !/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;

  const fields = new Map();
  for (const [key, value] of params) {
    // Reject duplicate and ambiguous delimiter-separated callback fields.
    if (fields.has(key) || !/^[a-z0-9_]+$/i.test(key) || value.includes("|")) return false;
    fields.set(key, value);
  }
  fields.delete("x_signature");

  const source = [...fields].map(([key, value]) => key + value).sort((a, b) => {
    const left = a.toLowerCase();
    const right = b.toLowerCase();
    return left < right ? -1 : Number(left > right);
  }).join("|");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.BILLPLZ_X_SIGNATURE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair, 16));
  if (!await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(source))) return false;

  return fields.get("id") === expectedBillId &&
    fields.get("collection_id") === env.BILLPLZ_COLLECTION_ID &&
    fields.get("paid") === "true" && fields.get("state") === "paid" &&
    fields.get("amount") === String(BOOKING_DEPOSIT_SEN) &&
    fields.get("paid_amount") === String(BOOKING_DEPOSIT_SEN);
}
