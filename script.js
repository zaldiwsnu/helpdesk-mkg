const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxma_ZJhWqxEuDsrVUZ3tcQKRYnDOU-PWcw5P1zM2BfRnQ45b2t2BqSvzOWGQ7dRE/exec";

// Konfigurasi Bot Telegram & PIN Teknisi
const TELEGRAM_BOT_TOKEN = "8895071679:AAHCntKQ8EOd04nRgXyty7PLyKurZtCnBJs";
const TELEGRAM_CHAT_ID = "8350319262";
const PIN_TEKNISI = "1234";

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
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const pesan = `🚨 *LAPORAN GANGGUAN ALAT MKG*\n\n` +
                    `No Tiket: *${result.tiket}*\n` +
                    `Alat: *${payload.alat}*\n` +
                    `Urgensi: *${payload.urgensi}*\n` +
                    `Pelapor: ${payload.pelapor}\n` +
                    `Kendala: ${payload.deskripsi}`;

      await kirimTelegram(pesan);
    }

    notif.textContent = `Berhasil! Nomor Tiket Anda: ${result.tiket}. Notifikasi telah dikirim ke Telegram teknisi.`;
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

async function tandaiSelesai(noTiket, namaAlat) {
  const inputPin = prompt(`Masukkan PIN Teknisi untuk menyelesaikan tiket ${noTiket}:`);
  if (inputPin === null) return;
  if (inputPin !== PIN_TEKNISI) {
    alert("PIN salah! Hanya teknisi yang dapat mengubah status tiket.");
    return;
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "selesai", tiket: noTiket })
    });
    const result = await res.json();

    if (result.status === "updated") {
      await kirimTelegram(`✅ *TIKET SELESAI DITANGANI*\n\nNo Tiket: *${noTiket}*\nAlat: *${namaAlat}*\nStatus: *SELESAI*`);
      muatTiket();
    } else {
      alert("Tiket tidak ditemukan di database.");
    }
  } catch (err) {
    alert("Gagal memperbarui status: " + err.message);
  }
}

async function kirimTelegram(pesan) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
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
          <span class="badge ${item.status === 'OPEN' ? 'badge-open' : 'badge-done'}">${item.status === 'OPEN' ? 'BELUM SELESAI' : 'SELESAI'}</span>
        </div>
        <div class="tiket-meta">
          Pelapor: ${item.pelapor} | Urgensi: ${item.urgensi}<br>
          Lapor: ${item.waktu} ${item.status === 'SELESAI' ? `| Selesai: ${item.waktuSelesai}` : ''}
        </div>
        <div>${item.deskripsi}</div>
        ${item.status === 'OPEN' ? `
          <button type="button" class="btn-selesai" onclick="tandaiSelesai('${item.tiket}', '${item.alat}')">
            ✓ Tandai Selesai
          </button>
        ` : ''}
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "<p>Gagal memuat riwayat tiket.</p>";
  }
}

muatTiket();
