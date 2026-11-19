import { createSandboxBill } from "../../../server/billplz.mjs";

export async function onRequestPost({ request, env }) {
  if (env.BILLPLZ_SANDBOX_ENABLED !== "true" || !env.BILLPLZ_SANDBOX_DB ||
      !env.BILLPLZ_SANDBOX_ADMIN_TOKEN || !env.BILLPLZ_API_KEY ||
      !env.BILLPLZ_COLLECTION_ID || !env.BILLPLZ_X_SIGNATURE_KEY ||
      !env.BILLPLZ_SANDBOX_CALLBACK_URL) {
    return new Response(null, { status: 404 });
  }

  const encode = value => new TextEncoder().encode(value);
  const hash = value => crypto.subtle.digest("SHA-256", encode(value));
  const expected = await hash("Bearer " + env.BILLPLZ_SANDBOX_ADMIN_TOKEN);
  const received = await hash(request.headers.get("Authorization") ?? "");
  if (!crypto.subtle.timingSafeEqual(expected, received)) {
    return new Response(null, { status: 401 });
  }

  const booking = await request.json().catch(() => null);
  if (!booking || typeof booking.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(booking.id) ||
      typeof booking.name !== "string" || !booking.name.trim() || booking.name.length > 100 ||
      typeof booking.email !== "string" || booking.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) {
    return Response.json({ error: "ID tempahan, nama atau e-mel tidak sah." }, { status: 400 });
  }

  const db = env.BILLPLZ_SANDBOX_DB;
  const reservation = await db.prepare(
    "INSERT INTO billplz_sandbox_payments (booking_id, status) VALUES (?, 'creating') ON CONFLICT(booking_id) DO NOTHING"
  ).bind(booking.id).run();
  if (reservation.meta.changes === 0) {
    const row = await db.prepare(
      "SELECT payment_url, status FROM billplz_sandbox_payments WHERE booking_id = ?"
    ).bind(booking.id).first();
    if (row?.status === "paid") return Response.json({ status: "paid" });
    if (row?.payment_url) return Response.json({ paymentUrl: row.payment_url, status: "pending" });
    return Response.json({ error: "Semak bil di Billplz Sandbox sebelum mencuba semula." }, { status: 409 });
  }

  try {
    const bill = await createSandboxBill(env, booking, env.BILLPLZ_SANDBOX_CALLBACK_URL);
    await db.prepare(
      "UPDATE billplz_sandbox_payments SET bill_id = ?, payment_url = ?, status = 'pending' WHERE booking_id = ? AND status = 'creating'"
    ).bind(bill.billId, bill.paymentUrl, booking.id).run();
    return Response.json({ paymentUrl: bill.paymentUrl, status: "pending" }, { status: 201 });
  } catch {
    // A timeout may occur after Billplz created the bill. Keep the reservation
    // until the operator reconciles the Booking ID in the Sandbox dashboard.
    return Response.json({ error: "Bil belum dapat disahkan. Semak Billplz Sandbox." }, { status: 502 });
  }
}
