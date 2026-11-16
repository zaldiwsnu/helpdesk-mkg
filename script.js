const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywIIcj4e3b4SHzbGdZipVTGH3YAIYrkGqSsaIpgKoHXyqTAaLHKbvsAjHlF2JEjd0/exec";

// PIN Teknisi
const PIN_TEKNISI = "1234";

const form = document.getElementById("formLaporan");
const btnSubmit = document.getElementById("btnSubmit");
const notif = document.getElementById("notifikasi");

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
      alat: document.getElementById("alat").value,
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
