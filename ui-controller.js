/**
 * ui-controller.js
 * File utama: interaksi UI, event listeners, rendering, dan Bluetooth Remote
 */

// ==================== APP VERSION ====================
const APP_VERSION = "v3.0.42";

// ==================== WINDOW ONLOAD ====================
window.onload = () => {
  // Isi teks versi di layar awal
  if (document.getElementById("appVersionLanding")) {
    document.getElementById("appVersionLanding").innerText = APP_VERSION;
  }

  // Tampilkan info restore jika ada data tersimpan
  if (localStorage.getItem("bj_data")) {
    document.getElementById("restoreInfo").innerHTML =
      `Tersimpan <b>${JSON.parse(localStorage.getItem("bj_data")).length} data</b>.`;
    document.getElementById("restoreMsg").style.display = "block";
    document.getElementById("importArea").style.display = "none";
  }

  // Initialize chkReadName based on localStorage
  const chkReadName = document.getElementById("chkReadName");
  if (chkReadName) {
    chkReadName.checked =
      localStorage.getItem(window.READ_NAME_STORAGE_KEY) === "true";
    chkReadName.addEventListener("change", () => {
      localStorage.setItem(window.READ_NAME_STORAGE_KEY, chkReadName.checked);
    });
  }

  // Voice selector event listeners
  const voiceSel = document.getElementById("voiceSelector");
  if (voiceSel) {
    voiceSel.addEventListener("focus", () => window.expandVoiceOptionsDetail());
    voiceSel.addEventListener("mousedown", () =>
      window.expandVoiceOptionsDetail(),
    );
    voiceSel.addEventListener("change", () => {
      const selected = voiceSel.options[voiceSel.selectedIndex];
      if (selected?.dataset?.voiceKey) {
        localStorage.setItem(
          window.VOICE_STORAGE_KEY,
          selected.dataset.voiceKey,
        );
      }
      window.collapseSelectedVoiceLabel();
    });
    voiceSel.addEventListener("blur", () =>
      window.collapseSelectedVoiceLabel(),
    );
  }

  // Load voices
  window.loadVoices();
};

// ==================== INIT APP ====================
window.initApp = function () {
  document.getElementById("uploadOverlay").style.display = "none";
  ["topNav", "appMain", "appFooter"].forEach(
    (id) => (document.getElementById(id).style.display = "block"),
  );

  // Get outlet name from first data item
  let outletName = "";
  if (
    window.masterData.length > 0 &&
    typeof window.outletData !== "undefined"
  ) {
    const kodeOutlet = window.masterData[0].no;
    const foundName = window.getOutletName(kodeOutlet);
    outletName = foundName ? ` | ${foundName}` : "";
  }

  document.getElementById("sourceBadge").textContent =
    `${window.csvSource}${outletName}`;
  document.getElementById("sourceBadge").className =
    "source-badge " +
    (window.csvSource === "SYARIAH" ? "source-syariah" : "source-konven");

  window.onDbTypeChange();
};

// ==================== FILTER UI ====================
window.setExtraFilterButtonState = function (isOpen) {
  const btn = document.getElementById("btnToggleExtraFilters");
  if (!btn) return;
  btn.textContent = isOpen ? "▾" : "▸";
};

window.toggleExtraFilters = function () {
  const wrap = document.getElementById("extraFilterWrap");
  if (!wrap) return;
  wrap.classList.toggle("hidden");
  window.setExtraFilterButtonState(!wrap.classList.contains("hidden"));
};

window.onDbTypeChange = function () {
  const type = document.getElementById("selDbType").value;
  const extraWrap = document.getElementById("extraFilterWrap");
  const pSel = document.getElementById("selPeriode");
  const ySel = document.getElementById("selTahun");
  const mSel = document.getElementById("selBulan");
  const extraBtn = document.getElementById("btnToggleExtraFilters");

  if (extraWrap) extraWrap.classList.add("hidden");
  window.setExtraFilterButtonState(false);
  if (extraBtn) extraBtn.style.display = "inline-flex";

  pSel.style.display = "none";
  ySel.style.display = "none";
  mSel.style.display = "none";

  if (type === "AKTIF") {
    ySel.style.display = "block";
    mSel.style.display = "block";
    const activeData = window.masterData.filter((d) => d.dbType === "AKTIF");

    const years = [
      ...new Set(
        activeData
          .map((d) => window.parseDateParts(d.tgl).year)
          .filter(Boolean),
      ),
    ].sort((a, b) => Number(b) - Number(a));
    ySel.innerHTML = '<option value="ALL">Semua Tahun</option>';
    years.forEach(
      (y) => (ySel.innerHTML += `<option value="${y}">${y}</option>`),
    );

    const months = [
      ...new Set(
        activeData
          .map((d) => window.parseDateParts(d.tgl).month)
          .filter(Boolean),
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
        window.masterData.filter((d) => d.dbType === "BJDPL").map((d) => d.tgl),
      ),
    ].sort((a, b) =>
      window.getDateSortKey(b).localeCompare(window.getDateSortKey(a)),
    );
    pSel.innerHTML = '<option value="ALL">Semua Periode</option>';
    periods.forEach(
      (p) => (pSel.innerHTML += `<option value="${p}">${p}</option>`),
    );
  }

  const prodSel = document.getElementById("selProduk");
  const prods = [
    ...new Set(
      window.masterData.filter((d) => d.dbType === type).map((d) => d.produk),
    ),
  ].sort();
  prodSel.innerHTML = '<option value="ALL">Semua Produk</option>';
  prods.forEach(
    (p) => (prodSel.innerHTML += `<option value="${p}">${p}</option>`),
  );

  window.filterAndRender();
};

// ==================== RENDER TABLE ====================
window.render = function () {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";
  const isBjdpl = document.getElementById("selDbType").value === "BJDPL";

  window.currentList.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.id = `row-${idx}`;

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
      if (e.target.tagName !== "BUTTON" && !window.isPlaying) {
        window.cursor = idx;
        window.highlightRow(idx);
      }
    };

    tbody.appendChild(tr);
  });
};

// ==================== HIGHLIGHT ROW ====================
window.highlightRow = function (idx) {
  document
    .querySelectorAll("tr")
    .forEach((r) => r.classList.remove("reading-now"));
  const t = document.getElementById(`row-${idx}`);
  if (t) {
    t.classList.add("reading-now");
    t.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

// ==================== UPDATE STATS ====================
window.updateStats = function () {
  document.getElementById("sTotal").innerText = window.currentList.length;
  document.getElementById("sAda").innerText = window.currentList.filter(
    (i) => i.status === "ADA",
  ).length;
  document.getElementById("sTidak").innerText = window.currentList.filter(
    (i) => i.status === "TIDAK",
  ).length;
  document.getElementById("sBelum").innerText = window.currentList.filter(
    (i) => i.status === "BELUM",
  ).length;
  if (typeof window.updateEstimation === "function") window.updateEstimation();
};

// ==================== BLUETOOTH REMOTE (TOMSIS) LISTENER ====================
window.addEventListener("keydown", (e) => {
  if (document.getElementById("appMain").style.display === "none") return;

  switch (e.key) {
    case "Enter":
    case " ":
      e.preventDefault(); // Mencegah scrolling saat tekan Enter/Space
      window.togglePlay();
      break;

    case "ArrowDown":
    case "PageDown":
      e.preventDefault(); // Mencegah scrolling
      if (!window.isPlaying && window.cursor < window.currentList.length - 1) {
        window.cursor++;
        window.highlightRow(window.cursor);
      }
      break;

    case "ArrowUp":
    case "PageUp":
      e.preventDefault(); // Mencegah scrolling
      if (!window.isPlaying && window.cursor > 0) {
        window.cursor--;
        window.highlightRow(window.cursor);
      }
      break;

    case "ArrowRight": // Tombol untuk "TIDAK" (X)
      if (!window.isPlaying) {
        window.setStatus(window.cursor, "TIDAK");
        if (window.cursor < window.currentList.length - 1) {
          window.cursor++;
          window.highlightRow(window.cursor);
        }
      }
      break;

    case "ArrowLeft": // Tombol untuk "ADA" (V)
      if (!window.isPlaying) {
        window.setStatus(window.cursor, "ADA");
        if (window.cursor < window.currentList.length - 1) {
          window.cursor++;
          window.highlightRow(window.cursor);
        }
      }
      break;
  }
});

// ==================== PWA SERVICE WORKER ====================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
