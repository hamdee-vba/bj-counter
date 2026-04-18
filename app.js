const APP_VERSION = "v3.0.3";
let masterData = [];
let currentList = [];
let cursor = 0;
let isPlaying = false;
let csvSource = "";
let statusFilter = "ALL";
const synth = window.speechSynthesis;
const VOICE_STORAGE_KEY = "bj_voice_pref";
let outletData = []; // Data outlet dari tabel_outlet.json

// Load outlet data from JSON file
fetch("tabel_outlet.json")
  .then((res) => res.json())
  .then((data) => (outletData = data))
  .catch((err) => console.error("Gagal load outlet data:", err));

window.onload = () => {
  // 2. Tambahkan baris ini untuk mengisi teks versi di layar awal
  if (document.getElementById("appVersionLanding")) {
    document.getElementById("appVersionLanding").innerText = APP_VERSION;
  }

  if (localStorage.getItem("bj_data")) {
    document.getElementById("restoreInfo").innerHTML =
      `Tersimpan <b>${JSON.parse(localStorage.getItem("bj_data")).length} data</b>.`;
    document.getElementById("restoreMsg").style.display = "block";
    document.getElementById("importArea").style.display = "none";
  }
  const voiceSel = document.getElementById("voiceSelector");
  if (voiceSel) {
    voiceSel.addEventListener("focus", () => {
      expandVoiceOptionsDetail();
    });
    voiceSel.addEventListener("mousedown", () => {
      expandVoiceOptionsDetail();
    });
    voiceSel.addEventListener("change", () => {
      const selected = voiceSel.options[voiceSel.selectedIndex];
      if (selected?.dataset?.voiceKey) {
        localStorage.setItem(VOICE_STORAGE_KEY, selected.dataset.voiceKey);
      }
      collapseSelectedVoiceLabel();
    });
    voiceSel.addEventListener("blur", () => {
      collapseSelectedVoiceLabel();
    });
  }
  loadVoices();
};

function buildVoiceKey(v) {
  return `${v.name}|${v.lang}|${v.localService ? "offline" : "online"}`;
}

function buildVoiceLabel(v) {
  const mode = v.localService ? "Offline" : "Online";
  const lang = v.lang || "Unknown";
  const isId = lang.toLowerCase().startsWith("id");
  if (isId) return `Indonesia • ${v.name} (${lang}) - ${mode}`;
  return `${v.name} (${lang}) - ${mode}`;
}

function buildVoiceShortLabel(v) {
  const lang = (v.lang || "UNK").toUpperCase();
  const mode = v.localService ? "OFF" : "ON";
  return `${lang} • ${mode}`;
}

function expandVoiceOptionsDetail() {
  const sel = document.getElementById("voiceSelector");
  if (!sel) return;
  Array.from(sel.options).forEach((opt) => {
    if (opt.dataset.fullLabel) opt.textContent = opt.dataset.fullLabel;
  });
}

function collapseSelectedVoiceLabel() {
  const sel = document.getElementById("voiceSelector");
  if (!sel || sel.selectedIndex < 0) return;
  const selected = sel.options[sel.selectedIndex];
  if (!selected || !selected.dataset.shortLabel) return;
  selected.textContent = selected.dataset.shortLabel;
}

function loadVoices() {
  let v = synth.getVoices();
  const sel = document.getElementById("voiceSelector");
  if (!sel || v.length === 0) return;

  const voiceList = v
    .map((voice, originalIndex) => ({ voice, originalIndex }))
    .sort((a, b) => {
      const aIsId = (a.voice.lang || "").toLowerCase().startsWith("id");
      const bIsId = (b.voice.lang || "").toLowerCase().startsWith("id");
      if (aIsId !== bIsId) return aIsId ? -1 : 1;
      return `${a.voice.lang}|${a.voice.name}`.localeCompare(
        `${b.voice.lang}|${b.voice.name}`,
      );
    });

  const savedVoiceKey = localStorage.getItem(VOICE_STORAGE_KEY);
  const prevSelected = sel.options[sel.selectedIndex]?.dataset?.voiceKey;
  const preferredKey = savedVoiceKey || prevSelected;
  sel.innerHTML = "";
  let selectedIndex = -1;
  let idFallbackIndex = -1;

  voiceList.forEach(({ voice: x, originalIndex }, index) => {
    const opt = document.createElement("option");
    const voiceKey = buildVoiceKey(x);
    const fullLabel = buildVoiceLabel(x);
    opt.textContent = fullLabel;
    opt.value = originalIndex;
    opt.dataset.voiceKey = voiceKey;
    opt.dataset.fullLabel = fullLabel;
    opt.dataset.shortLabel = buildVoiceShortLabel(x);
    opt.title = `${x.name} (${x.lang}) - ${x.localService ? "Offline" : "Online"}`;

    if (preferredKey && voiceKey === preferredKey) selectedIndex = index;
    if (idFallbackIndex === -1 && x.lang.toLowerCase().includes("id"))
      idFallbackIndex = index;

    sel.appendChild(opt);
  });

  if (selectedIndex === -1)
    selectedIndex = idFallbackIndex !== -1 ? idFallbackIndex : 0;
  if (selectedIndex >= 0) {
    sel.selectedIndex = selectedIndex;
    const selected = sel.options[selectedIndex];
    if (selected?.dataset?.voiceKey) {
      localStorage.setItem(VOICE_STORAGE_KEY, selected.dataset.voiceKey);
    }
    collapseSelectedVoiceLabel();
  }
}

if (speechSynthesis.onvoiceschanged !== undefined)
  speechSynthesis.onvoiceschanged = loadVoices;

async function processFiles() {
  const fA = document.getElementById("fileAktif").files[0];
  const fB = document.getElementById("fileBjdpl").files[0];
  if (!fA)
    return alert("Import file CSV Kredit Aktif dari Inquiry Kredit Passion!");

  masterData = [];
  await parseCSV(fA, "AKTIF");
  if (fB) await parseCSV(fB, "BJDPL");

  masterData.sort((a, b) => {
    if (a.dbType !== b.dbType) return a.dbType === "AKTIF" ? -1 : 1;
    if (a.dbType === "BJDPL") {
      let dateA = a.tgl.split("-").reverse().join("");
      let dateB = b.tgl.split("-").reverse().join("");
      if (dateA !== dateB) return dateA.localeCompare(dateB);
    }
    return a.no.localeCompare(b.no, undefined, { numeric: true });
  });

  localStorage.setItem("bj_source", csvSource);
  localStorage.setItem("bj_data", JSON.stringify(masterData));
  initApp();
}

function parseCSV(file, type) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/);
      if (lines.length > 1 && !csvSource) {
        csvSource = lines[1].split("|")[1]?.replace(/"/g, "").startsWith("6")
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
          if (csvSource === "KONVEN") {
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
          if (csvSource === "KONVEN") {
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
          masterData.push({
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
}

function restoreSession() {
  masterData = JSON.parse(localStorage.getItem("bj_data"));
  csvSource = localStorage.getItem("bj_source") || "KONVEN";
  initApp();
}

// Function to lookup outlet name by 5-digit code from tabel_outlet.js
// Function to lookup outlet name by 5-digit code from tabel_outlet.json
function getOutletName(kodeOutlet) {
  if (!kodeOutlet || kodeOutlet.length < 5 || outletData.length === 0)
    return null;
  const kode = kodeOutlet.substring(0, 5);
  const found = outletData.find((o) => o.kode_outlet === kode);
  return found ? found.nama_outlet : null;
}

function initApp() {
  document.getElementById("uploadOverlay").style.display = "none";
  ["topNav", "appMain", "appFooter"].forEach(
    (id) => (document.getElementById(id).style.display = "block"),
  );

  // Get outlet name from first data item
  let outletName = "";
  if (masterData.length > 0 && typeof outletData !== "undefined") {
    const kodeOutlet = masterData[0].no;
    const foundName = getOutletName(kodeOutlet);
    outletName = foundName ? ` | ${foundName}` : "";
  }

  document.getElementById("sourceBadge").textContent =
    `${csvSource}${outletName}`;
  document.getElementById("sourceBadge").className =
    "source-badge " +
    (csvSource === "SYARIAH" ? "source-syariah" : "source-konven");
  onDbTypeChange();
}

function parseDateParts(dateStr) {
  const parts = (dateStr || "").split("-");
  return {
    day: parts[0] || "",
    month: parts[1] || "",
    year: parts[2] || "",
  };
}

function getDateSortKey(dateStr) {
  const { day, month, year } = parseDateParts(dateStr);
  return `${year}${month}${day}`;
}

function setExtraFilterButtonState(isOpen) {
  const btn = document.getElementById("btnToggleExtraFilters");
  if (!btn) return;
  btn.textContent = isOpen ? "▾" : "▸";
}

function toggleExtraFilters() {
  const wrap = document.getElementById("extraFilterWrap");
  if (!wrap) return;
  wrap.classList.toggle("hidden");
  setExtraFilterButtonState(!wrap.classList.contains("hidden"));
}

function onDbTypeChange() {
  const type = document.getElementById("selDbType").value;
  const extraWrap = document.getElementById("extraFilterWrap");
  const pSel = document.getElementById("selPeriode");
  const ySel = document.getElementById("selTahun");
  const mSel = document.getElementById("selBulan");
  const extraBtn = document.getElementById("btnToggleExtraFilters");

  if (extraWrap) extraWrap.classList.add("hidden");
  setExtraFilterButtonState(false);
  if (extraBtn) extraBtn.style.display = "inline-flex";

  pSel.style.display = "none";
  ySel.style.display = "none";
  mSel.style.display = "none";

  if (type === "AKTIF") {
    ySel.style.display = "block";
    mSel.style.display = "block";
    const activeData = masterData.filter((d) => d.dbType === "AKTIF");

    const years = [
      ...new Set(
        activeData.map((d) => parseDateParts(d.tgl).year).filter(Boolean),
      ),
    ].sort((a, b) => Number(b) - Number(a));
    ySel.innerHTML = '<option value="ALL">Semua Tahun</option>';
    years.forEach(
      (y) => (ySel.innerHTML += `<option value="${y}">${y}</option>`),
    );

    const months = [
      ...new Set(
        activeData.map((d) => parseDateParts(d.tgl).month).filter(Boolean),
      ),
    ].sort((a, b) => Number(a) - Number(b));
    mSel.innerHTML = '<option value="ALL">Semua Bulan</option>';
    months.forEach(
      (m) => (mSel.innerHTML += `<option value="${m}">${m}</option>`),
    );
  }

  if (type === "BJDPL") {
    pSel.style.display = "block";
    const periods = [
      ...new Set(
        masterData.filter((d) => d.dbType === "BJDPL").map((d) => d.tgl),
      ),
    ].sort((a, b) => getDateSortKey(b).localeCompare(getDateSortKey(a)));
    pSel.innerHTML = '<option value="ALL">Semua Periode</option>';
    periods.forEach(
      (p) => (pSel.innerHTML += `<option value="${p}">${p}</option>`),
    );
  }
  const prodSel = document.getElementById("selProduk");
  const prods = [
    ...new Set(
      masterData.filter((d) => d.dbType === type).map((d) => d.produk),
    ),
  ].sort();
  prodSel.innerHTML = '<option value="ALL">Semua Produk</option>';
  prods.forEach(
    (p) => (prodSel.innerHTML += `<option value="${p}">${p}</option>`),
  );
  filterAndRender();
}

function setStatusFilter(st) {
  statusFilter = st;
  filterAndRender();
}

function filterAndRender() {
  const type = document.getElementById("selDbType").value;
  const period = document.getElementById("selPeriode").value;
  const year = document.getElementById("selTahun").value;
  const month = document.getElementById("selBulan").value;
  const prod = document.getElementById("selProduk").value;
  const gol = document.getElementById("selGolongan").value;
  currentList = masterData.filter((d) => {
    const { year: dYear, month: dMonth } = parseDateParts(d.tgl);
    return (
      d.dbType === type &&
      (type !== "AKTIF" || year === "ALL" || dYear === year) &&
      (type !== "AKTIF" || month === "ALL" || dMonth === month) &&
      (type !== "BJDPL" || period === "ALL" || d.tgl === period) &&
      (prod === "ALL" || d.produk === prod) &&
      (gol === "ALL" || d.gol === gol) &&
      (statusFilter === "ALL" || d.status === statusFilter)
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
      }[statusFilter],
    )
    .classList.add("active-filter");
  cursor = 0;
  render();
  updateStats();
}

function render() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";
  const isBjdpl = document.getElementById("selDbType").value === "BJDPL";

  currentList.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.id = `row-${idx}`;

    // Perbaikan UI/UX: Kitir di kiri, Detail di tengah, Tombol di kanan
    tr.innerHTML = `
            <td>
                <div class="kitir-wrap">
                    <span class="gol-badge gol-${item.gol}">${item.gol}</span>
                    <span class="kitir-txt ${isBjdpl ? "kitir-bjdpl" : "kitir-aktif"}">${item.digits}</span>
                </div>
            </td>
            <td>
                <span class="name-txt">${item.nama}</span>
                <span class="sub-info">${item.no}</span>
                <div class="sub-info">
                    <span class="date-accent">${item.tgl}</span>
                    <span>Rp ${item.nomStr}</span>
                </div>
            </td>
            <td style="text-align:center">
                <div style="display:flex; gap:6px; justify-content:center">
                    <button id="btn-a-${idx}" class="btn-status btn-ada ${item.status === "ADA" ? "active" : ""}" onclick="setStatus(${idx},'ADA')">✓</button>
                    <button id="btn-t-${idx}" class="btn-status btn-tidak ${item.status === "TIDAK" ? "active" : ""}" onclick="setStatus(${idx},'TIDAK')">✕</button>
                </div>
            </td>
        `;

    tr.onclick = (e) => {
      if (e.target.tagName !== "BUTTON" && !isPlaying) {
        cursor = idx;
        highlightRow(idx);
      }
    };

    tbody.appendChild(tr);
  });
}

function setStatus(idx, st) {
  const item = currentList[idx];
  const mIdx = masterData.findIndex(
    (m) => m.no === item.no && m.dbType === item.dbType,
  );
  if (mIdx !== -1) {
    masterData[mIdx].status = st;
    currentList[idx].status = st;
    localStorage.setItem("bj_data", JSON.stringify(masterData));
    updateStats();
    const btnA = document.getElementById(`btn-a-${idx}`);
    const btnT = document.getElementById(`btn-t-${idx}`);
    if (btnA) btnA.classList.toggle("active", st === "ADA");
    if (btnT) btnT.classList.toggle("active", st === "TIDAK");
  }
}

function highlightRow(idx) {
  document
    .querySelectorAll("tr")
    .forEach((r) => r.classList.remove("reading-now"));
  const t = document.getElementById(`row-${idx}`);
  if (t) {
    t.classList.add("reading-now");
    t.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function togglePlay() {
  if (isPlaying) {
    isPlaying = false;
    synth.cancel();
    document.getElementById("btnToggle").innerHTML = "▶ PLAY";
    document.getElementById("btnToggle").style.background = "var(--accent)";
  } else {
    isPlaying = true;
    document.getElementById("btnToggle").innerHTML = "⏸ PAUSE";
    document.getElementById("btnToggle").style.background = "#e74c3c";
    read();
  }
}

function read() {
  if (!isPlaying || cursor >= currentList.length) {
    if (cursor >= currentList.length) togglePlay();
    return;
  }
  highlightRow(cursor);
  const item = currentList[cursor];
  let text = item.digits;
  if (document.getElementById("chkShortMode").checked && cursor > 0) {
    if (
      item.digits.substring(0, 2) ===
      currentList[cursor - 1].digits.substring(0, 2)
    )
      text = item.digits.substring(2);
  }
  const utter = new SpeechSynthesisUtterance(text.split("").join(" "));
  utter.voice =
    synth.getVoices()[document.getElementById("voiceSelector").value];
  utter.rate = parseFloat(document.getElementById("speedRange").value);
  utter.onend = () => {
    if (isPlaying) {
      if (currentList[cursor].status === "BELUM") setStatus(cursor, "ADA");
      cursor++;
      read();
    }
  };
  synth.speak(utter);
}

function updateStats() {
  document.getElementById("sTotal").innerText = currentList.length;
  document.getElementById("sAda").innerText = currentList.filter(
    (i) => i.status === "ADA",
  ).length;
  document.getElementById("sTidak").innerText = currentList.filter(
    (i) => i.status === "TIDAK",
  ).length;
  document.getElementById("sBelum").innerText = currentList.filter(
    (i) => i.status === "BELUM",
  ).length;
  if (typeof updateEstimation === "function") updateEstimation();
}

function exportPDF() {
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
    masterData.length > 0 ? masterData[0].no.substring(0, 5) : "XXXXX";
  const outletName =
    masterData.length > 0 ? getOutletName(masterData[0].no) : null;
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
      total: {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        row: 0,
        ada: 0,
        tidak: 0,
        sisa: 0,
      },
    };
    const sub = masterData.filter((m) => m.dbType === db);
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

  let tidakAda = masterData
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

  const items = masterData.map((m, i) => [
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
}

function exportCSV() {
  let csv =
    "DATABASE|NOMOR KREDIT|NAMA|PRODUK|TANGGAL|PERIODE|GOL|NOMINAL|STATUS\n";
  masterData.forEach((i) => {
    csv += `${i.dbType}|${i.no}|${i.nama}|${i.produk}|${i.tgl}|${i.periode}|${i.gol}|${i.nomStr}|${i.status}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Result_HitungBJ_${new Date().getTime()}.csv`;
  a.click();
}

function confirmReset() {
  if (confirm("Hapus semua progress?")) clearSession();
}
function clearSession() {
  localStorage.clear();
  location.reload();
}

function updateEstimation() {
  const sisa = currentList.filter((i) => i.status === "BELUM").length;
  const speed = parseFloat(document.getElementById("speedRange").value);
  const estElem = document.getElementById("sEstimasi");
  if (!estElem) return;
  if (sisa === 0) {
    estElem.innerText = "";
    return;
  }
  const totalDetik = (sisa * 1.6) / speed;
  const m = Math.floor(totalDetik / 60);
  const s = Math.floor(totalDetik % 60);
  estElem.innerText = `± ${m > 0 ? m + "m " : ""}${s}s`;
}

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// LISTENER REMOTE BLUETOOTH
window.addEventListener("keydown", (e) => {
  if (document.getElementById("appMain").style.display === "none") return;

  switch (e.key) {
    case "Enter":
    case " ":
      e.preventDefault();
      togglePlay();
      break;

    case "ArrowDown":
    case "PageDown":
      e.preventDefault();
      if (!isPlaying && cursor < currentList.length - 1) {
        cursor++;
        highlightRow(cursor);
      }
      break;

    case "ArrowUp":
    case "PageUp":
      e.preventDefault();
      if (!isPlaying && cursor > 0) {
        cursor--;
        highlightRow(cursor);
      }
      break;

    case "ArrowRight": // Tombol untuk "ADA" (V)
      if (!isPlaying) {
        setStatus(cursor, "TIDAK");
        if (cursor < currentList.length - 1) {
          cursor++;
          highlightRow(cursor);
        }
      }
      break;

    case "ArrowLeft": // Tombol untuk "TIDAK" (X)
      if (!isPlaying) {
        setStatus(cursor, "ADA");
        if (cursor < currentList.length - 1) {
          cursor++;
          highlightRow(cursor);
        }
      }
      break;
  }
});
