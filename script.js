const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzDI81CmN2pDIu4yJMWfs3BpRH9bS4YUTC3vHKQsLHr10_19HfjmAV5_7e6QqYiMZU/exec";

// Opsional: Isi jika ingin notifikasi otomatis masuk ke Telegram
const TELEGRAM_BOT_TOKEN = ""; 
const TELEGRAM_CHAT_ID = "";   

const form = document.getElementById("formLaporan");
const btnSubmit = document.getElementById("btnSubmit");
const notif = document.getElementById("notifikasi");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Mengirim laporan...";

  const payload = {
    pelapor: document.getElementById("pelapor").value,
    alat: document.getElementById("alat").value,
    urgensi: document.getElementById("urgensi").value,
    deskripsi: document.getElementById("deskripsi").value
  };

  try {
    // 1. Simpan ke Google Sheets
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    // 2. Kirim Notifikasi Telegram (jika token diisi)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const pesan = `🚨 *LAPORAN GANGGUAN ALAT*\n` +
                    `No Tiket: *${result.tiket}*\n` +
                    `Alat: ${payload.alat}\n` +
                    `Urgensi: ${payload.urgensi}\n` +
                    `Pelapor: ${payload.pelapor}\n` +
                    `Kendala: ${payload.deskripsi}`;
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: pesan,
          parse_mode: "Markdown"
        })
      });
    }

    notif.textContent = `Berhasil! Nomor Tiket Anda: ${result.tiket}. Tim teknisi telah dinotifikasi.`;
    notif.classList.remove("hidden");
    form.reset();
    muatTiket(); 
  } catch (err) {
    alert("Terjadi kesalahan saat mengirim laporan: " + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Kirim Laporan Gangguan";
  }
});

async function muatTiket() {
  const container = document.getElementById("daftarTiket");
  container.innerHTML = "Memuat data...";
  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = "<p>Belum ada laporan gangguan.</p>";
      return;
    }

    container.innerHTML = data.map(item => `
      <div class="tiket-item">
        <div class="tiket-top">
          <span>${item.tiket} — ${item.alat}</span>
          <span class="badge ${item.status === 'OPEN' ? 'badge-open' : 'badge-done'}">${item.status}</span>
        </div>
        <div class="tiket-meta">Pelapor: ${item.pelapor} | Urgensi: ${item.urgensi} | ${item.waktu}</div>
        <div>${item.deskripsi}</div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "<p>Gagal memuat riwayat tiket.</p>";
  }
}

muatTiket();