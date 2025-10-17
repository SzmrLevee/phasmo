let ghosts = [];
let evidences = new Set();
let traits = new Set();
let excludedGhostNames = new Set(); // names of ghosts manually excluded (strike-through, not removed from data)

document.addEventListener("DOMContentLoaded", async () => {
  await loadGhosts();
  renderEvidenceOptions();
  renderTraitOptions();
  loadExcludedState();
  filterGhosts();
  
  // Wire reset button - reset EVERYTHING
  document.getElementById('resetBtn').addEventListener('click', () => {
    // Clear exclusions
    excludedGhostNames.clear();
    saveExcludedState();
    
    // Clear evidences
    evidences.clear();
    document.querySelectorAll('#evidenceList input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    // Clear traits
    traits.clear();
    document.querySelectorAll('#traitsList input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    // Reset timer
    resetTimer();
    
    // Re-render
    filterGhosts();
  });
});

async function loadGhosts() {
  let csvText = null;
  try {
    const response = await fetch("ghosts.csv");
    if (!response.ok) throw new Error('Fetch failed');
    csvText = await response.text();
    parseGhostCSV(csvText);
    // hide notice if any
    const notice = document.getElementById('fileNotice');
    if (notice) notice.classList.add('hidden');
    return;
  } catch (err) {
    // Could not fetch (often due to file:// restrictions). Show file picker.
    console.warn('Could not fetch ghosts.csv, falling back to manual file input', err);
    const notice = document.getElementById('fileNotice');
    if (notice) notice.classList.remove('hidden');
    const input = document.getElementById('csvFileInput');
    return new Promise((resolve) => {
      input.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return resolve();
        const reader = new FileReader();
        reader.onload = (e) => {
          csvText = e.target.result;
          parseGhostCSV(csvText);
          if (notice) notice.classList.add('hidden');
          renderEvidenceOptions();
          renderTraitOptions();
          filterGhosts();
          resolve();
        };
        reader.readAsText(file);
      }, { once: true });
    });
  }
}

function parseGhostCSV(csvText) {
  if (!csvText) return;
  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const headers = rows[0];
  ghosts = rows.slice(1).map(row => {
    let ghost = {};
    headers.forEach((h, i) => ghost[h.trim()] = row[i]?.trim());
    return ghost;
  });
}

function renderEvidenceOptions() {
  const evidenceSet = new Set();
  ghosts.forEach(g => {
    ["Evidence1", "Evidence2", "Evidence3", "ForcedEvidence"].forEach(e => {
      if (g[e] && g[e] !== "None") evidenceSet.add(g[e]);
    });
  });

  const container = document.getElementById("evidenceList");
  container.innerHTML = "";
  Array.from(evidenceSet)
    .sort()
    .forEach(ev => {
      const label = document.createElement("label");
      label.className = "inline-flex items-center gap-3 px-4 py-2 bg-slate-800/80 hover:bg-blue-600/30 border border-blue-500/30 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 hover:border-blue-400/60";
      // custom checkbox: hidden input + visual span
      label.innerHTML = `
        <input type="checkbox" value="${ev}" class="custom-checkbox-input hidden" />
        <span class="custom-checkbox w-5 h-5 flex items-center justify-center rounded-md"></span>
        <span class="text-sm font-medium">${ev}</span>
      `;
      const inputEl = label.querySelector('input');
      const box = label.querySelector('.custom-checkbox');
      // sync visual on change
      inputEl.addEventListener('change', function() { box.classList.toggle('bg-blue-500', this.checked); box.classList.toggle('border-blue-400', this.checked); toggleEvidence(this); });
      // clicking the visible box toggles the hidden input
      box.addEventListener('click', () => { inputEl.checked = !inputEl.checked; inputEl.dispatchEvent(new Event('change')); });
      container.appendChild(label);
    });
}

function renderTraitOptions() {
  const traitOptions = ["Fast", "Slow", "Normal", "Aggressive", "Calm", "Variable"];
  const container = document.getElementById("traitsList");
  container.innerHTML = "";

  traitOptions.forEach(t => {
    const label = document.createElement("label");
    label.className = "inline-flex items-center gap-3 px-4 py-2 bg-slate-800/80 hover:bg-blue-600/30 border border-blue-500/30 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 hover:border-blue-400/60";
    label.innerHTML = `
      <input type="checkbox" value="${t}" class="custom-checkbox-input hidden" />
      <span class="custom-checkbox w-5 h-5 flex items-center justify-center rounded-md"></span>
      <span class="text-sm font-medium">${t}</span>
    `;
    const inputEl = label.querySelector('input');
    const box = label.querySelector('.custom-checkbox');
    inputEl.addEventListener('change', function() { box.classList.toggle('bg-blue-500', this.checked); box.classList.toggle('border-blue-400', this.checked); toggleTrait(this); });
    box.addEventListener('click', () => { inputEl.checked = !inputEl.checked; inputEl.dispatchEvent(new Event('change')); });
    container.appendChild(label);
  });
}

function toggleEvidence(checkbox) {
  if (checkbox.checked) evidences.add(checkbox.value);
  else evidences.delete(checkbox.value);
  filterGhosts();
}

function toggleTrait(checkbox) {
  if (checkbox.checked) traits.add(checkbox.value);
  else traits.delete(checkbox.value);
  filterGhosts();
}

function filterGhosts() {
  let filtered = ghosts.filter(g => {
    // Evidence filter
    const ghostEvidences = [g.Evidence1, g.Evidence2, g.Evidence3, g.ForcedEvidence].filter(e => e && e !== "None");
    for (const ev of evidences) {
      if (!ghostEvidences.includes(ev)) return false;
    }

    // Trait filter
    const traitText = (g.Speed + " " + g.Aggressiveness + " " + g["Special Traits"]).toLowerCase();
    for (const t of traits) {
      if (!traitText.includes(t.toLowerCase())) return false;
    }

    return true;
  });

  renderGhostList(filtered);
  updateCounts(filtered);
  generateAIHelper(filtered.filter(g => !excludedGhostNames.has(g.Name)));
}

function updateCounts(filtered) {
  const filteredCount = filtered.filter(g => !excludedGhostNames.has(g.Name)).length;
  const excludedCount = excludedGhostNames.size;
  document.getElementById('filteredCount').textContent = filteredCount;
  document.getElementById('excludedCount').textContent = excludedCount;
}

function toggleExcludeGhost(name) {
  if (excludedGhostNames.has(name)) excludedGhostNames.delete(name);
  else excludedGhostNames.add(name);
  saveExcludedState();
  filterGhosts();
}

function saveExcludedState() {
  try {
    localStorage.setItem('excludedGhosts', JSON.stringify(Array.from(excludedGhostNames)));
  } catch (e) { console.warn('Could not save excluded state', e); }
}

function loadExcludedState() {
  try {
    const raw = localStorage.getItem('excludedGhosts');
    if (!raw) return;
    const arr = JSON.parse(raw);
    arr.forEach(n => excludedGhostNames.add(n));
  } catch (e) { console.warn('Could not load excluded state', e); }
}

function renderGhostList(filtered) {
  const container = document.getElementById("ghostList");
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<p class="col-span-full text-center text-gray-500">No ghosts match your current selection.</p>`;
    return;
  }

  filtered.forEach(g => {
    const isExcluded = excludedGhostNames.has(g.Name);
    const card = document.createElement("div");
    card.className = `relative bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur border border-blue-500/20 rounded-xl p-4 shadow-lg shadow-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 ${isExcluded ? 'opacity-50' : ''}`;
    
    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-cyan-400 mb-1 ${isExcluded ? 'line-through decoration-2 decoration-red-400' : ''}">${g.Name}</h3>
          <p class="text-sm text-blue-300/80">${g.Evidence1} • ${g.Evidence2} • ${g.Evidence3}</p>
        </div>
        <button class="exclude-btn flex-shrink-0 ml-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${isExcluded ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/30' : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30'}" data-name="${g.Name}">
          <span class="text-white font-bold text-lg">${isExcluded ? '✓' : '×'}</span>
        </button>
      </div>
      <div class="details hidden mt-3 pt-3 border-t border-blue-500/20 text-sm space-y-1">
        <p><strong class="text-blue-400">Speed:</strong> ${g.Speed}</p>
        <p><strong class="text-blue-400">Aggressiveness:</strong> ${g.Aggressiveness}</p>
        <p><strong class="text-blue-400">Traits:</strong> ${g["Special Traits"]}</p>
        ${g.ForcedEvidence && g.ForcedEvidence !== "None" ? `<p><strong class="text-blue-400">Forced Evidence:</strong> ${g.ForcedEvidence}</p>` : ""}
        <p><strong class="text-blue-400">How to Test:</strong> ${g.HowToTest}</p>
      </div>
    `;

    // Click header area (not button) to expand/collapse
    const header = card.querySelector('.flex.items-start');
    header.style.cursor = 'pointer';
    header.addEventListener('click', (ev) => {
      if (ev.target.closest('.exclude-btn')) return; // don't expand if clicking button
      const details = card.querySelector('.details');
      details.classList.toggle('hidden');
    });

    // Exclude/restore button
    const excludeBtn = card.querySelector('.exclude-btn');
    excludeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleExcludeGhost(g.Name);
    });

    container.appendChild(card);
  });
}

function generateAIHelper(filteredGhosts) {
  const adviceDiv = document.getElementById("aiAdvice");

  if (evidences.size !== 2) {
    adviceDiv.textContent = "Select two evidences to get tailored testing advice.";
    return;
  }

  if (filteredGhosts.length === 0) {
    adviceDiv.textContent = "No ghosts match your current evidences.";
    return;
  }

  // If only one ghost left
  if (filteredGhosts.length === 1) {
    const g = filteredGhosts[0];
    adviceDiv.innerHTML = `
      <strong>${g.Name}</strong> seems most likely.<br>
      ${g.HowToTest ? "👉 " + g.HowToTest : "No specific test known."}
    `;
    return;
  }

  // Multiple possible ghosts
  let tips = filteredGhosts
    .map(g => `<li><strong>${g.Name}:</strong> ${g.HowToTest || "No info available."}</li>`)
    .join("");

  adviceDiv.innerHTML = `
    <p>Here’s how you can narrow it down between the remaining ghosts:</p>
    <ul>${tips}</ul>
  `;
}


let timerInterval = null;
let remainingTime = 0;

function startTimer(type) {
  resetTimer();
  const timerDisplay = document.getElementById("timerDisplay");

  if (type === "smudge") remainingTime = 180;     // 3 minutes
  if (type === "crucifix") remainingTime = 60;    // 1 minute
  if (type === "demon") remainingTime = 20;       // 20 seconds

  updateTimerDisplay(remainingTime);

  timerInterval = setInterval(() => {
    remainingTime--;
    updateTimerDisplay(remainingTime);

    if (remainingTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerDisplay.textContent = "⏰ Time’s up!";
      timerDisplay.style.color = "#f87171";
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  remainingTime = 0;
  const timerDisplay = document.getElementById("timerDisplay");
  timerDisplay.textContent = "00:00";
  timerDisplay.style.color = "#e5e7eb";
}

function updateTimerDisplay(seconds) {
  const timerDisplay = document.getElementById("timerDisplay");
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent =
    `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
