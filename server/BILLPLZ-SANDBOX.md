# Deposit tempahan 5R · Billplz Sandbox

Deposit ujian RM200. Laluan ini untuk ujian terkawal oleh admin. Data bayaran
simulasi direkodkan dalam D1 dan tidak dikira sebagai tempahan sebenar.

1. Sediakan pangkalan data D1 ujian, jalankan billplz-schema.sql dan ikat
   pangkalan data sebagai BILLPLZ_SANDBOX_DB pada projek ujian Cloudflare Pages.
2. Tetapkan BILLPLZ_SANDBOX_ENABLED=true dan BILLPLZ_SANDBOX_CALLBACK_URL kepada
   URL HTTPS projek ujian dengan laluan /api/billplz/callback.
3. Tetapkan BILLPLZ_COLLECTION_ID kepada ID Collection Sandbox. Masukkan
   BILLPLZ_API_KEY, BILLPLZ_X_SIGNATURE_KEY dan BILLPLZ_SANDBOX_ADMIN_TOKEN
   dalam tetapan rahsia projek ujian. Gunakan akaun Sandbox dan aktifkan
   tandatangan callback. Token admin perlu dijana secara rawak.
4. Dari klien API admin, hantar POST ke /api/billplz/checkout dengan
   Authorization: Bearer <token> dan Content-Type: application/json.
   Hantar objek JSON dengan id (ID tempahan ujian), name dan email.
   Buka paymentUrl yang dipulangkan untuk menjalankan simulasi bayaran.
5. Semak status paid di D1. Panggilan semula dengan ID yang sama memulangkan
   bil sedia ada atau status paid. Jika status tersekat pada creating,
   semak Booking ID di dashboard Billplz sebelum membenarkan cubaan semula.

Sambungan seterusnya memerlukan rekod tempahan dan kalendar sebenar dalam
transaksi yang sama ketika mengesahkan ketersediaan dan mengunci malam.
