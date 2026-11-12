export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  const html = await response.text();
  if (!html.includes('id="customerBookingForm"')) {
    return new Response(html, response);
  }

  const injected = `
<script type="module" id="vPublicBookingRequestFirebaseFix">
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const cfg = {
  apiKey:"AIzaSyCFL1cy0n6GrzAXRh8prnyOiaLKBUUXkzM",
  authDomain:"the-5r-villa-v2.firebaseapp.com",
  projectId:"the-5r-villa-v2",
  storageBucket:"the-5r-villa-v2.firebasestorage.app",
  messagingSenderId:"907809196867",
  appId:"1:907809196867:web:b030f3636e6dcef3f83df6",
  measurementId:"G-0BH80KPN87"
};

const fixApp = initializeApp(cfg, "the5rPublicBookingRequestFixV1");
const fixDb = getFirestore(fixApp);
const ADMIN_URL = "https://the5rvilla-admin.pages.dev/";
const ADMIN_WHATSAPP = "60122544639";

function nightsBetween(a,b){
  const x=new Date(a+"T00:00:00"), y=new Date(b+"T00:00:00");
  return Math.round((y-x)/86400000);
}
function overlaps(checkIn,checkOut){
  const rows = Array.isArray(window.the5rPublicAvailability) ? window.the5rPublicAvailability : [];
  return rows.some(r=>{
    const status=String(r?.status||"booked").toLowerCase();
    if(["cancelled","canceled","rejected"].includes(status)) return false;
    const ci=String(r?.checkIn||"").slice(0,10), co=String(r?.checkOut||"").slice(0,10);
    return ci && co && checkIn < co && checkOut > ci;
  });
}
function el(id){return document.getElementById(id);}
function init(){
  const form=el("customerBookingForm");
  if(!form || form.dataset.firebaseRequestFix==="1") return;
  form.dataset.firebaseRequestFix="1";

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();

    const name=String(el("customerName")?.value||"").trim();
    const phone=String(el("customerPhone")?.value||"").trim();
    const residence=String(el("customerResidence")?.value||"").trim();
    const checkIn=String(el("customerCheckIn")?.value||"").slice(0,10);
    const checkOut=String(el("customerCheckOut")?.value||"").slice(0,10);
    const guests=Math.max(1,Number(el("customerGuests")?.value||1));
    const nights=nightsBetween(checkIn,checkOut);
    const btn=e.submitter || form.querySelector('[type="submit"]');
    const oldLabel=btn?.innerHTML;

    if(!name||!phone||!residence||!checkIn||!checkOut||!Number.isFinite(nights)||nights<1){
      alert("Sila lengkapkan nama, telefon, tempat tinggal dan tarikh tempahan.");
      return;
    }
    if(window.the5rCalendarReady!==true){
      alert("Live Calendar belum siap. Sila tunggu sebentar dan cuba lagi.");
      return;
    }
    if(overlaps(checkIn,checkOut)){
      alert("🔴 TARIKH SUDAH BOOKED. Sila pilih tarikh lain.");
      window.updateCustomerLiveStatus?.();
      return;
    }

    if(btn){btn.disabled=true;btn.textContent="Menyimpan ke Guest Requests...";}

    try{
      if(overlaps(checkIn,checkOut)) throw new Error("Tarikh baru sahaja ditempah. Sila pilih tarikh lain.");

      const ref=await addDoc(collection(fixDb,"bookingRequests"),{
        guestName:name,
        phone,
        residence,
        guests,
        adults:guests,
        children:0,
        vehicles:0,
        checkIn,
        checkOut,
        nights,
        platform:"Direct",
        platformSource:"Direct",
        status:"Pending",
        source:"THE 5R VILLA Public Website",
        notes:"Guest booking request dari public website",
        note:"Guest booking request dari public website",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });

      const requestId=ref.id;
      const adminRequestUrl=ADMIN_URL+"?request="+encodeURIComponent(requestId);
      const message=[
        "🏡 *BOOKING ENQUIRY – THE 5R VILLA*",
        "",
        "Hi Admin, saya ingin membuat tempahan.",
        "",
        "👤 *Nama:* "+name,
        "📞 *Telefon:* "+phone,
        "📍 *Tinggal di:* "+residence,
        "",
        "📅 *Check-in:* "+checkIn,
        "📅 *Check-out:* "+checkOut,
        "🌙 *Jumlah malam:* "+nights,
        "👥 *Jumlah tetamu:* "+guests,
        "",
        "🟢 Tarikh telah disemak melalui Live Calendar THE 5R VILLA semasa borang dihantar.",
        "",
        "📝 *REQUEST ID:* "+requestId.slice(0,8).toUpperCase(),
        "🟡 *STATUS: PENDING*",
        "Data telah dihantar ke Admin. Tidak perlu isi semula.",
        "",
        "🔔 *ADMIN: BOOKING BARU MENUNGGU TINDAKAN*",
        "Sila semak di Guest Requests.",
        "",
        "👉 *BUKA ADMIN BOOKING:*",
        adminRequestUrl
      ].join("\\n");

      form.reset();
      window.updateCustomerLiveStatus?.();
      alert("✅ Permintaan telah masuk Guest Requests. WhatsApp Admin akan dibuka.");
      window.location.href="https://wa.me/"+ADMIN_WHATSAPP+"?text="+encodeURIComponent(message);
    }catch(err){
      console.error("Public booking Firebase save failed",err);
      alert("❌ Permintaan belum dihantar kerana rekod Guest Requests gagal disimpan. Sila cuba lagi.\\n\\n"+(err?.message||err));
    }finally{
      if(btn){btn.disabled=false;if(oldLabel!==undefined)btn.innerHTML=oldLabel;}
    }
  }, true);

  window.THE5R_PUBLIC_BOOKING_REQUEST_FIX="V1_FIREBASE_BEFORE_WHATSAPP";
  console.log("THE 5R VILLA public booking request fix active");
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();
</script>`;

  const out = html.includes("</body>") ? html.replace("</body>", injected + "\n</body>") : html + injected;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control","no-store");
  return new Response(out, { status: response.status, statusText: response.statusText, headers });
}
