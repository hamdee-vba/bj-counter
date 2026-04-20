/**
 * voice-engine.js
 * Semua logika audio, TTS, dan kontrol speechSynthesis
 */

// ==================== STATE VARIABLES ====================
window.isPlaying = false;
let currentVoiceIndex = 0;

// ==================== SPEECH SYNTHESIS INSTANCE ====================
const synth = window.speechSynthesis;

// ==================== VOICE BUILDERS ====================
window.buildVoiceKey = function (v) {
  return `${v.name}|${v.lang}|${v.localService ? "offline" : "online"}`;
};

window.buildVoiceLabel = function (v) {
  const mode = v.localService ? "Offline" : "Online";
  const lang = v.lang || "Unknown";
  const isId = lang.toLowerCase().startsWith("id");
  if (isId) return `Indonesia • ${v.name} (${lang}) - ${mode}`;
  return `${v.name} (${lang}) - ${mode}`;
};

window.buildVoiceShortLabel = function (v) {
  const lang = (v.lang || "UNK").toUpperCase();
  const mode = v.localService ? "OFF" : "ON";
  return `${lang} • ${mode}`;
};

// ==================== VOICE LOADING ====================
window.loadVoices = function () {
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

  const savedVoiceKey = localStorage.getItem(window.VOICE_STORAGE_KEY);
  const prevSelected = sel.options[sel.selectedIndex]?.dataset?.voiceKey;
  const preferredKey = savedVoiceKey || prevSelected;
  sel.innerHTML = "";
  let selectedIndex = -1;
  let idFallbackIndex = -1;

  voiceList.forEach(({ voice: x, originalIndex }, index) => {
    const opt = document.createElement("option");
    const voiceKey = window.buildVoiceKey(x);
    const fullLabel = window.buildVoiceLabel(x);
    opt.textContent = fullLabel;
    opt.value = originalIndex;
    opt.dataset.voiceKey = voiceKey;
    opt.dataset.fullLabel = fullLabel;
    opt.dataset.shortLabel = window.buildVoiceShortLabel(x);
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
      localStorage.setItem(window.VOICE_STORAGE_KEY, selected.dataset.voiceKey);
    }
    window.collapseSelectedVoiceLabel();
  }
};

// Voice expand/collapse for mobile display
window.expandVoiceOptionsDetail = function () {
  const sel = document.getElementById("voiceSelector");
  if (!sel) return;
  Array.from(sel.options).forEach((opt) => {
    if (opt.dataset.fullLabel) opt.textContent = opt.dataset.fullLabel;
  });
};

window.collapseSelectedVoiceLabel = function () {
  const sel = document.getElementById("voiceSelector");
  if (!sel || sel.selectedIndex < 0) return;
  const selected = sel.options[sel.selectedIndex];
  if (!selected || !selected.dataset.shortLabel) return;
  selected.textContent = selected.dataset.shortLabel;
};

// Setup voices changed listener
if (speechSynthesis.onvoiceschanged !== undefined)
  speechSynthesis.onvoiceschanged = window.loadVoices;

// ==================== VOICE MODAL FUNCTIONS ====================
window.openVoiceModal = function () {
  const modal = document.getElementById("voiceModal");
  const loading = document.getElementById("voiceLoading");
  const listContainer = document.getElementById("voiceListContainer");
  const empty = document.getElementById("voiceEmpty");

  modal.style.display = "flex";
  loading.style.display = "block";
  listContainer.style.display = "none";
  empty.style.display = "none";

  window.loadVoicesForModal();
};

window.closeVoiceModal = function (event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("voiceModal").style.display = "none";
};

window.refreshVoices = function () {
  const loading = document.getElementById("voiceLoading");
  const listContainer = document.getElementById("voiceListContainer");
  const empty = document.getElementById("voiceEmpty");

  loading.style.display = "block";
  listContainer.style.display = "none";
  empty.style.display = "none";

  setTimeout(() => {
    window.loadVoicesForModal();
  }, 500);
};

window.loadVoicesForModal = function () {
  const loading = document.getElementById("voiceLoading");
  const listContainer = document.getElementById("voiceListContainer");
  const list = document.getElementById("voiceList");
  const empty = document.getElementById("voiceEmpty");

  let v = synth.getVoices();

  if (v.length === 0) {
    setTimeout(() => {
      v = synth.getVoices();
      if (v.length === 0) {
        loading.style.display = "none";
        empty.style.display = "block";
      } else {
        window.populateVoiceList(v);
      }
    }, 1000);
    return;
  }

  window.populateVoiceList(v);
};

window.populateVoiceList = function (voices) {
  const loading = document.getElementById("voiceLoading");
  const listContainer = document.getElementById("voiceListContainer");
  const list = document.getElementById("voiceList");
  const empty = document.getElementById("voiceEmpty");

  const savedVoiceKey = localStorage.getItem(window.VOICE_STORAGE_KEY);

  const sortedVoices = voices
    .map((voice, index) => ({ voice, index }))
    .sort((a, b) => {
      const aIsId = (a.voice.lang || "").toLowerCase().startsWith("id");
      const bIsId = (b.voice.lang || "").toLowerCase().startsWith("id");
      if (aIsId !== bIsId) return aIsId ? -1 : 1;
      return `${a.voice.lang}|${a.voice.name}`.localeCompare(
        `${b.voice.lang}|${b.voice.name}`,
      );
    });

  list.innerHTML = "";

  sortedVoices.forEach(({ voice, index }) => {
    const voiceKey = window.buildVoiceKey(voice);
    const isSelected = voiceKey === savedVoiceKey;
    const isId = (voice.lang || "").toLowerCase().startsWith("id");
    const mode = voice.localService ? "Offline" : "Online";

    const item = document.createElement("div");
    item.innerHTML = `
      <div
        onclick="selectVoice(${index}, '${voiceKey.replace(/'/g, "\\'")}')"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid ${isSelected ? "var(--accent)" : "var(--border)"};
          background: ${isSelected ? "#f0f9ff" : "#f8fafc"};
          cursor: pointer;
          transition: 0.2s;
        "
        onmouseover="this.style.background='${isSelected ? "#e0f2fe" : "#f1f5f9"}'"
        onmouseout="this.style.background='${isSelected ? "#f0f9ff" : "#f8fafc"}'"
      >
        <div>
          <div style="font-weight: 600; font-size: 0.9em; color: #1e293b">
            ${isId ? "🇮🇩 " : "🌐 "}${voice.name}
          </div>
          <div style="font-size: 0.75em; color: #64748b">
            ${voice.lang?.toUpperCase() || "UNK"} • ${mode}
          </div>
        </div>
        <div style="color: ${isSelected ? "var(--accent)" : "#cbd5e1"}">
          ${isSelected ? "✓" : "○"}
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  loading.style.display = "none";
  listContainer.style.display = "block";
};

window.selectVoice = function (index, voiceKey) {
  localStorage.setItem(window.VOICE_STORAGE_KEY, voiceKey);
  currentVoiceIndex = index;

  const voices = synth.getVoices();
  const selectedVoice = voices.find(
    (v) => window.buildVoiceKey(v) === voiceKey,
  );
  if (selectedVoice) {
    const btnText = document.getElementById("voiceBtnText");
    const btnIcon = document.getElementById("voiceBtnIcon");
    const isId = (selectedVoice.lang || "").toLowerCase().startsWith("id");
    btnIcon.textContent = isId ? "🇮🇩" : "🌐";
    btnText.textContent =
      selectedVoice.name.length > 12
        ? selectedVoice.name.substring(0, 12) + "..."
        : selectedVoice.name;
  }

  window.loadVoicesForModal();
  window.closeVoiceModal();
};

// ==================== TTS PLAYBACK ====================
window.togglePlay = function () {
  if (window.isPlaying) {
    window.isPlaying = false;
    synth.cancel();
    document.getElementById("btnToggle").innerHTML = "▶ PLAY";
    document.getElementById("btnToggle").style.background = "var(--accent)";
  } else {
    window.isPlaying = true;
    document.getElementById("btnToggle").innerHTML = "⏸ PAUSE";
    document.getElementById("btnToggle").style.background = "#e74c3c";
    window.read();
  }
};

window.stopSpeech = function () {
  synth.cancel();
  window.isPlaying = false;
  document.getElementById("btnToggle").innerHTML = "▶ PLAY";
  document.getElementById("btnToggle").style.background = "var(--accent)";
};

window.read = function () {
  if (!window.isPlaying || window.cursor >= window.currentList.length) {
    if (window.cursor >= window.currentList.length) window.togglePlay();
    return;
  }

  window.highlightRow(window.cursor);
  const item = window.currentList[window.cursor];
  let text = item.digits;

  // SHORT mode: lewati 2 digit pertama jika sama dengan sebelumnya
  if (document.getElementById("chkShortMode").checked && window.cursor > 0) {
    if (
      item.digits.substring(0, 2) ===
      window.currentList[window.cursor - 1].digits.substring(0, 2)
    )
      text = item.digits.substring(2);
  }

  // Proses pembacaan: nomor per digit, nama per kata
  let utterText = "";

  // Baca nomor per digit (misal: "123" -> "1 2 3")
  const digitsOnly = text.replace(/\D/g, "");
  if (digitsOnly) {
    utterText = digitsOnly.split("").join(" ");
  }

  // Tambahkan nama (baca sebagai kata utuh, bukan per karakter)
  if (document.getElementById("chkReadName").checked) {
    const cleanedName = window.getCleanedCustomerName(item.nama);
    if (cleanedName) {
      utterText += ` ${cleanedName}`;
    }
  }

  const utter = new SpeechSynthesisUtterance(utterText);

  // Get voice from saved preference
  const savedVoiceKey = localStorage.getItem(window.VOICE_STORAGE_KEY);
  const voices = synth.getVoices();
  if (savedVoiceKey) {
    utter.voice =
      voices.find((v) => window.buildVoiceKey(v) === savedVoiceKey) || null;
  }
  if (!utter.voice && voices.length > 0) {
    utter.voice = voices[0];
  }

  // Speed dari slider
  utter.rate = parseFloat(document.getElementById("speedRange").value);

  // Set bahasa Indonesia agar TTS membaca dengan benar
  utter.lang = "id-ID";

  // Event: setelah selesai bicara, lanjut ke item berikutnya
  utter.onend = () => {
    if (window.isPlaying) {
      if (window.currentList[window.cursor].status === "BELUM")
        window.setStatus(window.cursor, "ADA");
      window.cursor++;
      window.read();
    }
  };

  synth.speak(utter);
};

// ==================== ESTIMATION ====================
window.updateEstimation = function () {
  const sisa = window.currentList.filter((i) => i.status === "BELUM").length;
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
};
