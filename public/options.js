const DEFAULTS = { position: 'bottom-right', startCollapsed: false, contextFillPct: 60 };

const fillSlider = document.getElementById('fill-pct');
const fillDisplay = document.getElementById('fill-pct-display');
fillSlider.addEventListener('input', () => {
  fillDisplay.textContent = `${fillSlider.value}%`;
});

async function loadAndRender() {
  const saved = await chrome.storage.local.get(DEFAULTS);

  const posRadio = document.querySelector(`input[name="position"][value="${saved.position}"]`);
  if (posRadio) posRadio.checked = true;

  const modeRadio = document.querySelector(
    `input[name="startCollapsed"][value="${String(saved.startCollapsed)}"]`,
  );
  if (modeRadio) modeRadio.checked = true;

  fillSlider.value = saved.contextFillPct;
  fillDisplay.textContent = `${saved.contextFillPct}%`;

  const manifest = chrome.runtime.getManifest();
  document.getElementById('ext-version').textContent = manifest.version;
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const posEl = document.querySelector('input[name="position"]:checked');
  const modeEl = document.querySelector('input[name="startCollapsed"]:checked');

  const settings = {
    position: posEl ? posEl.value : DEFAULTS.position,
    startCollapsed: modeEl ? modeEl.value === 'true' : DEFAULTS.startCollapsed,
    contextFillPct: Number(fillSlider.value),
  };

  await chrome.storage.local.set(settings);

  const feedback = document.getElementById('save-feedback');
  feedback.classList.add('visible');
  setTimeout(() => feedback.classList.remove('visible'), 2000);
});

loadAndRender();
