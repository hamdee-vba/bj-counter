/**
 * data-manager.js
 * Semua logika pengolahan data, state management, dan parsing
 */

// ==================== STATE VARIABLES ====================
window.masterData = [];
window.currentList = [];
window.cursor = 0;
window.csvSource = "";
window.statusFilter = "ALL";
window.outletData = []; // Data outlet dari tabel_outlet.json

// ==================== CONSTANTS ====================
window.VOICE_STORAGE_KEY = "bj_voice_pref";
window.READ_NAME_STORAGE_KEY = "bj_read_name_pref";

// ==================== OUTLET DATA LOADING ====================
// Load outlet data from JSON file
fetch("tabel_outlet.json")
  .then((res) => res.json())
  .then((data) => (window.outletData = data))
  .catch((err) => console.error("Gagal load outlet data:", err));

// ==================== CSV PARSING ====================
window.parseCSV = function (file, type) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/);
      if (lines.length > 1 && !window.csvSource) {
        window.csvSource = lines[1]
          .split("|")[1]
          ?.replace(/"/g, "")
          .startsWith("6")
          ? "SYARIAH"
          : "KONVEN";
      }
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split("|");
        const clean = (idx) => cols[idx]?.replace(/"/g, "").trim() || "";
        if (cols.length < 5) continue;

        let noK, nama, prod, tgl, nom;
        if (type === "AKTIF") {
          noK = clean(1);
          if (window.csvSource === "KONVEN") {
            nama = clean(3);
            prod = clean(4);
            tgl = clean(5);
            nom = clean(10);
          } else {
            nama = clean(5);
            prod = clean(6);
            tgl = clean(7);
            nom = clean(13);
          }
        } else {
          noK = clean(1);
          if (window.csvSource === "KONVEN") {
            nama = clean(3);
            prod = clean(4);
            tgl = clean(7);
            nom = clean(10);
          } else {
            nama = clean(4);
            prod = clean(5);
            tgl = clean(8);
            nom = clean(11);
          }
        }

        if (noK) {
          const nVal = Math.trunc(parseFloat(nom.replace(/[^\d.-]/g, ""))) || 0;
          const period = tgl.split("-").slice(1).reverse().join("-");
          window.masterData.push({
            no: noK,
            nama: nama,
            produk: prod,
            tgl: tgl,
            periode: period,
            nomStr: new Intl.NumberFormat("en-US").format(nVal),
            gol:
              nVal <= 500000
                ? "A"
                : nVal <= 5000000
                  ? "B"
                  : nVal <= 20000000
                    ? "C"
                    : "D",
            status: "BELUM",
            digits: noK.slice(-5, -1),
            dbType: type,
          });
        }
      }
      resolve();
    };
    reader.readAsText(file);
  });
};

window.processFiles = async function () {
  const fA = document.getElementById("fileAktif").files[0];
  const fB = document.getElementById("fileBjdpl").files[0];
  if (!fA)
    return alert("Import file CSV Kredit Aktif dari Inquiry Kredit Passion!");

  window.masterData = [];
  await window.parseCSV(fA, "AKTIF");
  if (fB) await window.parseCSV(fB, "BJDPL");

  window.masterData.sort((a, b) => {
    if (a.dbType !== b.dbType) return a.dbType === "AKTIF" ? -1 : 1;
    if (a.dbType === "BJDPL") {
      let dateA = a.tgl.split("-").reverse().join("");
      let dateB = b.tgl.split("-").reverse().join("");
      if (dateA !== dateB) return dateA.localeCompare(dateB);
    }
    return a.no.localeCompare(b.no, undefined, { numeric: true });
  });

  localStorage.setItem("bj_source", window.csvSource);
  localStorage.setItem("bj_data", JSON.stringify(window.masterData));
  window.initApp();
};

window.restoreSession = function () {
  window.masterData = JSON.parse(localStorage.getItem("bj_data"));
  window.csvSource = localStorage.getItem("bj_source") || "KONVEN";
  window.initApp();
};

// ==================== OUTLET LOOKUP ====================
window.getOutletName = function (kodeOutlet) {
  if (!kodeOutlet || kodeOutlet.length < 5 || window.outletData.length === 0)
    return null;
  const kode = kodeOutlet.substring(0, 5);
  const found = window.outletData.find((o) => o.kode_outlet === kode);
  return found ? found.nama_outlet : null;
};

// ==================== DATE HELPERS ====================
window.parseDateParts = function (dateStr) {
  const parts = (dateStr || "").split("-");
  return {
    day: parts[0] || "",
    month: parts[1] || "",
    year: parts[2] || "",
  };
};

window.getDateSortKey = function (dateStr) {
  const { day, month, year } = window.parseDateParts(dateStr);
  return `${year}${month}${day}`;
};

// ==================== FILTERING ====================
window.setStatusFilter = function (st) {
  window.statusFilter = st;
  window.filterAndRender();
};

window.filterAndRender = function () {
  const type = document.getElementById("selDbType").value;
  const period = document.getElementById("selPeriode").value;
  const year = document.getElementById("selTahun").value;
  const month = document.getElementById("selBulan").value;
  const prod = document.getElementById("selProduk").value;
  const gol = document.getElementById("selGolongan").value;

  window.currentList = window.masterData.filter((d) => {
    const { year: dYear, month: dMonth } = window.parseDateParts(d.tgl);
    return (
      d.dbType === type &&
      (type !== "AKTIF" || year === "ALL" || dYear === year) &&
      (type !== "AKTIF" || month === "ALL" || dMonth === month) &&
      (type !== "BJDPL" || period === "ALL" || d.tgl === period) &&
      (prod === "ALL" || d.produk === prod) &&
      (gol === "ALL" || d.gol === gol) &&
      (window.statusFilter === "ALL" || d.status === window.statusFilter)
    );
  });

  document
    .querySelectorAll(".stat-box")
    .forEach((b) => b.classList.remove("active-filter"));
  document
    .getElementById(
      {
        ALL: "boxTotal",
        ADA: "boxAda",
        TIDAK: "boxTidak",
        BELUM: "boxBelum",
      }[window.statusFilter],
    )
    .classList.add("active-filter");

  window.cursor = 0;
  window.render();
  window.updateStats();
};

// ==================== STATUS MANAGEMENT ====================
window.setStatus = function (idx, st) {
  const item = window.currentList[idx];
  const mIdx = window.masterData.findIndex(
    (m) => m.no === item.no && m.dbType === item.dbType,
  );
  if (mIdx !== -1) {
    window.masterData[mIdx].status = st;
    window.currentList[idx].status = st;
    localStorage.setItem("bj_data", JSON.stringify(window.masterData));
    window.updateStats();
    const btnA = document.getElementById(`btn-a-${idx}`);
    const btnT = document.getElementById(`btn-t-${idx}`);
    if (btnA) btnA.classList.toggle("active", st === "ADA");
    if (btnT) btnT.classList.toggle("active", st === "TIDAK");
  }
};

// ==================== CUSTOMER NAME CLEANING (3-HURUF RULE) ====================
window.getCleanedCustomerName = function (name) {
  // 1. Hilangkan semua tanda baca lalu trim
  let cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim(); // Mendukung karakter Unicode
  if (!cleaned) return "";

  const words = cleaned.split(/\s+/);
  if (words.length === 0) return "";

  // 2. Jika nama nasabah lebih dari 1 kata, baca hanya kata pertama
  // 3. Jika kata pertama kurang dari 3 huruf, baca kata selanjutnya
  let nameToRead = words[0];
  if (words.length > 1 && words[0].length < 3) {
    nameToRead = words[1];
  }

  // 4. Convert ke lowercase agar TTS membaca sebagai kata, bukan singkatan
  return nameToRead.toLowerCase();
};

// ==================== EXPORT FUNCTIONS ====================
window.exportPDF = function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ][today.getMonth()];
  const now = `${dd} ${bulan} ${yyyy}`;
  const outletCode =
    window.masterData.length > 0
      ? window.masterData[0].no.substring(0, 5)
      : "XXXXX";
  const outletName =
    window.masterData.length > 0
      ? window.getOutletName(window.masterData[0].no)
      : null;
  const outletDisplay = outletName
    ? `${outletName} (${outletCode})`
    : outletCode;

  doc.setFontSize(14);
  doc.text("BERITA ACARA PERHITUNGAN FISIK JAMINAN", 105, 15, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.text(`OUTLET: ${outletDisplay} | TANGGAL: ${now}`, 105, 22, {
    align: "center",
  });

  let pivot = {};
  const dbTypes = ["AKTIF", "BJDPL"];
  dbTypes.forEach((db) => {
    pivot[db] = {
      products: {},
      total: { A: 0, B: 0, C: 0, D: 0, row: 0, ada: 0, tidak: 0, sisa: 0 },
    };
    const sub = window.masterData.filter((m) => m.dbType === db);
    [...new Set(sub.map((m) => m.produk))].sort().forEach((p) => {
      pivot[db].products[p] = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        row: 0,
        ada: 0,
        tidak: 0,
        sisa: 0,
      };
      sub
        .filter((m) => m.produk === p)
        .forEach((m) => {
          pivot[db].products[p][m.gol]++;
          pivot[db].products[p].row++;
          if (m.status === "ADA") pivot[db].products[p].ada++;
          else if (m.status === "TIDAK") pivot[db].products[p].tidak++;
          else pivot[db].products[p].sisa++;
          pivot[db].total[m.gol]++;
          pivot[db].total.row++;
          if (m.status === "ADA") pivot[db].total.ada++;
          else if (m.status === "TIDAK") pivot[db].total.tidak++;
          else pivot[db].total.sisa++;
        });
    });
  });

  let rows = [];
  let gt = { A: 0, B: 0, C: 0, D: 0, row: 0, ada: 0, tidak: 0, sisa: 0 };
  dbTypes.forEach((db) => {
    rows.push([
      { content: db, styles: { fontStyle: "bold" } },
      pivot[db].total.A,
      pivot[db].total.B,
      pivot[db].total.C,
      pivot[db].total.D,
      pivot[db].total.row,
      pivot[db].total.ada,
      pivot[db].total.tidak,
      pivot[db].total.sisa,
    ]);
    for (let p in pivot[db].products) {
      let d = pivot[db].products[p];
      rows.push(["   " + p, d.A, d.B, d.C, d.D, d.row, d.ada, d.tidak, d.sisa]);
    }
    for (let k in gt) gt[k] += pivot[db].total[k];
  });
  rows.push([
    { content: "GRAND TOTAL", styles: { fontStyle: "bold" } },
    gt.A,
    gt.B,
    gt.C,
    gt.D,
    gt.row,
    gt.ada,
    gt.tidak,
    gt.sisa,
  ]);

  doc.autoTable({
    startY: 28,
    head: [
      [
        "Produk / Golongan",
        "A",
        "B",
        "C",
        "D",
        "Total",
        "ADA",
        "TIDAK",
        "SISA",
      ],
    ],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0 },
  });

  let tidakAda = window.masterData
    .filter((m) => m.status === "TIDAK")
    .map((m, idx) => [
      idx + 1,
      m.nama.substring(0, 25),
      m.no,
      m.produk,
      m.dbType,
      m.tgl,
    ]);

  doc.setFontSize(10);
  doc.text(
    "DAFTAR BARANG JAMINAN TIDAK DITEMUKAN:",
    14,
    doc.lastAutoTable.finalY + 10,
  );

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 14,
    head: [["No", "Nama Nasabah", "No. Kredit", "Produk", "Status", "Tgl"]],
    body: tidakAda.length ? tidakAda : [["-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0 },
  });

  let currY = doc.lastAutoTable.finalY + 10;
  if (currY > 230) {
    doc.addPage();
    currY = 20;
  }

  doc.setFontSize(9);
  doc.text("CATATAN:", 14, currY);
  doc.rect(14, currY + 2, 182, 35);

  const signY = currY + 45;
  doc.text(`___________, ${now}`, 150, signY);
  doc.text("Yang Melakukan Perhitungan,", 150, signY + 5);
  doc.text("__________________________", 150, signY + 25);

  doc.addPage();
  doc.setFontSize(11);
  doc.text("LAMPIRAN DATA", 105, 12, { align: "center" });

  const items = window.masterData.map((m, i) => [
    i + 1,
    m.dbType,
    m.nama.substring(0, 14),
    m.no,
    m.status === "ADA" ? "V" : m.status === "TIDAK" ? "X" : "-",
  ]);

  const rowsPerCol = 82;
  const totalPerPage = rowsPerCol * 3;

  for (let i = 0; i < items.length; i += totalPerPage) {
    if (i > 0) doc.addPage();
    const pageData = items.slice(i, i + totalPerPage);
    const col1 = pageData.slice(0, rowsPerCol);
    const col2 = pageData.slice(rowsPerCol, rowsPerCol * 2);
    const col3 = pageData.slice(rowsPerCol * 2, rowsPerCol * 3);

    const tableConfigs = [
      { data: col1, x: 14 },
      { data: col2, x: 78 },
      { data: col3, x: 142 },
    ];

    tableConfigs.forEach((cfg) => {
      if (cfg.data.length > 0) {
        doc.autoTable({
          startY: 18,
          margin: { left: cfg.x },
          tableWidth: 60,
          head: [["No", "Status", "Nama", "No. Kredit", "Check"]],
          body: cfg.data,
          theme: "plain",
          styles: {
            fontSize: 5,
            cellPadding: 0.4,
            rowHeight: 3,
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
          },
          headStyles: {
            fontStyle: "bold",
            fillColor: [255, 255, 255],
            textColor: 0,
          },
          columnStyles: {
            0: { cellWidth: 6 },
            1: { cellWidth: 9 },
            2: { cellWidth: 20 },
            3: { cellWidth: 19 },
            4: { cellWidth: 6 },
          },
        });
      }
    });
  }
  doc.save(`BA_HitungBJ_${outletCode}_${dd}${mm}${yyyy}.pdf`);
};

window.exportCSV = function () {
  let csv =
    "DATABASE|NOMOR KREDIT|NAMA|PRODUK|TANGGAL|PERIODE|GOL|NOMINAL|STATUS\n";
  window.masterData.forEach((i) => {
    csv += `${i.dbType}|${i.no}|${i.nama}|${i.produk}|${i.tgl}|${i.periode}|${i.gol}|${i.nomStr}|${i.status}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Result_HitungBJ_${new Date().getTime()}.csv`;
  a.click();
};

window.confirmReset = function () {
  if (confirm("Hapus semua progress?")) window.clearSession();
};

window.clearSession = function () {
  localStorage.clear();
  location.reload();
};
