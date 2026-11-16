const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDArVIzo8mhZfGORkaTk4WwxoNRepJZND98j-wbl2pm5katEiRQj7UA99VituY8EI/exec";

// PIN Teknisi
const PIN_TEKNISI = "1234";

const form = document.getElementById("formLaporan");
const btnSubmit = document.getElementById("btnSubmit");
const notif = document.getElementById("notifikasi");
const alatSelect = document.getElementById("alat");
const alatLainnyaField = document.getElementById("alatLainnyaField");
const alatLainnyaInput = document.getElementById("alatLainnya");

function perbaruiFieldAlatLainnya() {
  const pilihLainnya = alatSelect.value === "Lainnya";
  alatLainnyaField.classList.toggle("hidden", !pilihLainnya);
  alatLainnyaInput.required = pilihLainnya;
  if (!pilihLainnya) alatLainnyaInput.value = "";
}

alatSelect.addEventListener("change", perbaruiFieldAlatLainnya);
perbaruiFieldAlatLainnya();

// Fungsi kompresi foto di browser sebelum dikirim
function kompresGambar(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Mengirim laporan & foto...";

  try {
    let fotoBase64 = "";
    const fileInput = document.getElementById("foto");
    if (fileInput?.files.length) {
      fotoBase64 = await kompresGambar(fileInput.files[0]);
    }

    const payload = {
      pelapor: document.getElementById("pelapor").value,
      alat: alatSelect.value === "Lainnya"
        ? alatLainnyaInput.value.trim()
        : alatSelect.value,
      urgensi: document.getElementById("urgensi").value,
      deskripsi: document.getElementById("deskripsi").value,
      fotoBase64
    };

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok || result.status !== "success") {
      throw new Error(result.message || "Laporan tidak berhasil disimpan.");
    }

    const fotoGagal = result.urlFoto?.startsWith("Gagal unggah foto:");
    notif.textContent = fotoGagal
      ? `Tiket ${result.tiket} tersimpan, tetapi foto gagal diunggah: ${result.urlFoto.replace("Gagal unggah foto:", "").trim()}`
      : `Tiket ${result.tiket} berhasil disimpan${fotoBase64 ? " bersama foto" : ""}.`;
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
      muatTiket();
    } else {
      alert("Tiket tidak ditemukan di database.");
    }
  } catch (err) {
    alert("Gagal memperbarui status: " + err.message);
  }
}

async function unduhRekapBulanIni() {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Izinkan pop-up untuk membuka rekap yang siap dicetak.");
    return;
  }

  reportWindow.document.write("<p style='font:16px Arial;padding:24px'>Menyiapkan rekap...</p>");

  try {
    const response = await fetch(SCRIPT_URL);
    if (!response.ok) throw new Error("Data tiket gagal dimuat.");

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(data.message || "Format data tiket tidak sesuai.");
    }

    const sekarang = new Date();
    const bulanIni = bulanJakarta_(sekarang);
    const tickets = data
      .map((item) => ({ ...item, waktuLaporDate: parseWaktuLogbook_(item.waktu) }))
      .filter((item) => item.waktuLaporDate && bulanJakarta_(item.waktuLaporDate) === bulanIni);
    const selesai = tickets.filter((item) => item.status === "SELESAI").length;
    const periode = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    }).format(sekarang);

    const tableRows = tickets.length
      ? tickets.map((item, index) => {
          const waktuSelesai = item.status === "SELESAI"
            ? parseWaktuLogbook_(item.waktuSelesai)
            : null;
          const akhirDowntime = waktuSelesai || sekarang;
          const downtime = formatDurasi_(akhirDowntime - item.waktuLaporDate);
          const foto = typeof item.foto === "string" && /^https?:\/\//i.test(item.foto)
            ? `<a href="${escapeHtml_(item.foto)}">Lihat foto</a>`
            : "—";

          return `<tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml_(item.tiket)}</strong></td>
            <td>${escapeHtml_(item.waktu)}</td>
            <td>${escapeHtml_(item.pelapor)}</td>
            <td>${escapeHtml_(item.alat)}</td>
            <td>${escapeHtml_(item.urgensi)}</td>
            <td>${escapeHtml_(item.deskripsi)}</td>
            <td>${downtime}</td>
            <td>${item.status === "SELESAI" ? "Selesai" : "Belum selesai"}</td>
            <td>${item.status === "SELESAI" ? escapeHtml_(item.waktuSelesai || "—") : "—"}</td>
            <td>${foto}</td>
          </tr>`;
        }).join("")
      : '<tr><td colspan="11" class="empty">Belum ada laporan pada bulan ini.</td></tr>';

    const html = `<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Rekap Logbook MKG - ${escapeHtml_(periode)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 28px; color: #172a3d; font: 12px Arial, sans-serif; }
          h1 { margin: 0 0 5px; font-size: 21px; }
          .subtitle { margin: 0 0 18px; color: #586c7d; }
          .summary { margin-bottom: 14px; padding: 10px 12px; border: 1px solid #d9e4eb; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 7px; border: 1px solid #cbd5df; text-align: left; vertical-align: top; }
          th { background: #eaf2f6; color: #173a56; }
          td { overflow-wrap: anywhere; }
          .empty { padding: 20px; text-align: center; color: #718196; }
          a { color: #176b91; }
          .note { margin-top: 12px; color: #66798a; font-size: 10px; }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { margin: 0; } a { color: #173a56; text-decoration: underline; } }
        </style>
      </head>
      <body>
        <h1>Rekap Logbook Pemeliharaan Alat MKG</h1>
        <p class="subtitle">Periode ${escapeHtml_(periode)} · Unit Instrumentasi &amp; Operasional</p>
        <div class="summary">Total laporan: <strong>${tickets.length}</strong> &nbsp;|&nbsp; Selesai: <strong>${selesai}</strong> &nbsp;|&nbsp; Belum selesai: <strong>${tickets.length - selesai}</strong></div>
        <table>
          <thead><tr><th>No.</th><th>No. Tiket</th><th>Waktu Lapor</th><th>Pelapor</th><th>Alat</th><th>Urgensi</th><th>Gangguan</th><th>Estimasi Downtime</th><th>Status</th><th>Waktu Selesai</th><th>Foto</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p class="note">Estimasi downtime dihitung sejak waktu laporan sampai waktu tiket selesai. Untuk tiket yang masih terbuka, perhitungan sampai waktu rekap dibuat.</p>
        <script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
      </body>
      </html>`;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  } catch (err) {
    reportWindow.close();
    alert("Rekap gagal dibuat: " + err.message);
  }
}

function parseWaktuLogbook_(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();
  const indonesia = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2})[.:](\d{1,2})[.:](\d{1,2}))?$/);
  if (indonesia) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = indonesia;
    return new Date(Date.UTC(+year, +month - 1, +day, +hour - 7, +minute, +second));
  }

  const isoLocal = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoLocal;
    return new Date(Date.UTC(+year, +month - 1, +day, +hour - 7, +minute, +second));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bulanJakarta_(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Jakarta"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  return `${year}-${month}`;
}

function formatDurasi_(milliseconds) {
  const totalMenit = Math.max(0, Math.floor(milliseconds / 60000));
  const hari = Math.floor(totalMenit / 1440);
  const jam = Math.floor((totalMenit % 1440) / 60);
  const menit = totalMenit % 60;
  return `${hari} hari ${jam} jam ${menit} menit`;
}

function escapeHtml_(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
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
        ${item.foto && item.foto.startsWith('http') ? `
          <div style="margin-top: 8px;">
            <a href="${item.foto}" target="_blank" style="font-size: 0.85rem; color: #0284c7; text-decoration: none; font-weight: 600;">
              📷 Lihat Foto Bukti Kerusakan ↗
            </a>
          </div>
        ` : ''}
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
