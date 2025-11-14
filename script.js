/* fx-82MS emulator logic
   - immediate-execution style accumulator
   - SHIFT / ALPHA / HYP toggles
   - DEG/RAD mode for trig functions
   - memory, STO/RCL, M+/M-/MR/MC
   - Shift+AC -> OFF, ON button to turn on
*/

const keys = document.querySelectorAll('.key');
const exprEl = document.getElementById('expr');
const resultEl = document.getElementById('result');
const shiftInd = document.getElementById('shift-indicator');
const alphaInd = document.getElementById('alpha-indicator');
const hypInd = document.getElementById('hyp-indicator');
const modeInd = document.getElementById('mode-indicator');
const powerInd = document.getElementById('power-indicator');
const clickSound = document.getElementById('click-sound');

let state = {
  power: true,
  shift: false,
  alpha: false,
  hyp: false,
  mode: 'DEG',    // DEG or RAD
  acc: 0,         // accumulator
  pendingOp: null,
  current: '',    // current entry as string
  lastAns: 0,
  memory: 0,
  vars: {},       // ALPHA variables
};

function playClick() {
  // clone to handle rapid clicks
  const s = clickSound.cloneNode();
  s.volume = 0.35;
  s.play().catch(() => { });
}

function updateIndicators() {
  shiftInd.textContent = state.shift ? 'S' : '';
  alphaInd.textContent = state.alpha ? 'A' : '';
  hypInd.textContent = state.hyp ? 'HYP' : '';
  modeInd.textContent = state.mode;
  powerInd.textContent = state.power ? 'ON' : 'OFF';
}

function refreshScreen() {
  exprEl.textContent = state.pendingOp ? `${state.acc} ${state.pendingOp}` : '';
  resultEl.textContent = state.current === '' ? String(state.lastAns ?? 0) : state.current;
}

/* utilities */
function toNumber(s) { return s === '' ? 0 : Number(s); }

function applyUnary(fn) {
  if (!state.power) return;
  let val = toNumber(state.current || state.lastAns);
  let res;
  try { res = fn(val); } catch (e) { res = 'Error'; }
  state.current = (typeof res === 'number' && !isFinite(res)) ? 'Error' : String(res);
  refreshScreen();
  clearShifts();
}

function degToRad(v) {
  return v * Math.PI / 180;
}
function radToDeg(v) {
  return v * 180 / Math.PI;
}

/* trigonometric helper honors mode and hyp and inverse states */
function trigApply(kind) { // kind = 'sin'|'cos'|'tan'
  if (!state.power) return;
  let val = toNumber(state.current || state.lastAns);
  let result;
  const mode = state.mode;
  const isHyp = state.hyp;
  const isInv = state.shift; // SHIFT used as inverse for trig in this mapping

  // convert to radians if in DEG
  let inRad = (mode === 'DEG') ? degToRad(val) : val;

  if (isHyp) {
    // hyperbolic
    if (isInv) {
      // inverse hyperbolic
      if (kind === 'sin') result = Math.asinh(val);
      if (kind === 'cos') result = Math.acosh(val);
      if (kind === 'tan') result = Math.atanh(val);
      // convert result back to degrees if needed? hyperbolic inverses produce real numbers, keep them in units of function domain
    } else {
      if (kind === 'sin') result = Math.sinh(inRad);
      if (kind === 'cos') result = Math.cosh(inRad);
      if (kind === 'tan') result = Math.tanh(inRad);
      if (mode === 'DEG') { /* when displayed, user supplied degrees -> we used deg->rad */ }
    }
  } else {
    // normal trig
    if (isInv) {
      // inverse trig
      if (kind === 'sin') result = Math.asin(val);
      if (kind === 'cos') result = Math.acos(val);
      if (kind === 'tan') result = Math.atan(val);
      // result in radians; convert to degrees if mode == DEG
      if (mode === 'DEG') result = radToDeg(result);
    } else {
      // forward trig
      if (kind === 'sin') result = Math.sin(inRad);
      if (kind === 'cos') result = Math.cos(inRad);
      if (kind === 'tan') result = Math.tan(inRad);
    }
  }

  state.current = (typeof result === 'number' && !isFinite(result)) ? 'Error' : String(result);
  refreshScreen();
  clearShifts();
}

/* binary operation execution */
function executePending() {
  if (!state.pendingOp) {
    state.acc = toNumber(state.current || state.lastAns);
    state.current = '';
    return;
  }
  const a = state.acc;
  const b = toNumber(state.current === '' ? state.lastAns : state.current);
  let r;
  switch (state.pendingOp) {
    case '+': r = a + b; break;
    case '−': r = a - b; break;
    case '×': r = a * b; break;
    case '÷': r = (b === 0) ? 'Error' : a / b; break;
    case '%': r = a % b; break;
    default: r = b;
  }
  if (r === 'Error' || !isFinite(r)) {
    state.current = 'Error';
    state.acc = 0;
    state.pendingOp = null;
  } else {
    state.acc = r;
    state.lastAns = r;
    state.current = '';
  }
  refreshScreen();
}

/* clear shift/alpha/hyp after single use (typical Casio behavior) */
function clearShifts() {
  state.shift = false;
  state.alpha = false;
  // HYP is persistent until toggled off, so do NOT auto-clear hyp
  updateIndicators();
}

/* key handlers */
function handleKey(fn, el) {
  if (!state.power && fn !== 'on') return; // only ON works when powered off
  // Common key behaviors
  if (fn === 'on') {
    // power on
    state.power = true;
    state.current = '';
    refreshScreen();
    updateIndicators();
    return;
  }

  if (fn === 'shift') {
    state.shift = !state.shift;
    state.alpha = false;
    updateIndicators();
    return;
  }
  if (fn === 'alpha') {
    state.alpha = !state.alpha;
    state.shift = false;
    updateIndicators();
    return;
  }
  if (fn === 'hyp') {
    state.hyp = !state.hyp;
    updateIndicators();
    return;
  }
  if (fn === 'mode') {
    // cycle DEG -> RAD -> GRAD (we implement only DEG/RAD)
    state.mode = (state.mode === 'DEG') ? 'RAD' : 'DEG';
    updateIndicators();
    return;
  }
  if (fn === 'drg') {
    state.mode = (state.mode === 'DEG') ? 'RAD' : 'DEG';
    updateIndicators();
    return;
  }
  if (fn === 'ac') {
    // AC: clear; SHIFT+AC -> OFF
    if (state.shift) {
      // power off
      state.power = false;
      state.current = '';
      state.pendingOp = null;
      state.acc = 0;
      state.lastAns = 0;
      state.shift = false;
      state.alpha = false;
      updateIndicators();
      refreshScreen();
      return;
    }
    state.current = '';
    state.pendingOp = null;
    state.acc = 0;
    state.lastAns = 0;
    clearShifts();
    refreshScreen();
    return;
  }

  if (fn === 'del') {
    // delete last char
    if (state.current.length > 0) {
      state.current = state.current.slice(0, -1);
    } else {
      // nothing
    }
    refreshScreen();
    clearShifts();
    return;
  }

  if (fn === 'ans') {
    state.current = String(state.lastAns || 0);
    refreshScreen();
    clearShifts();
    return;
  }

  if (fn === 'pi') {
    state.current = String(Math.PI);
    refreshScreen();
    clearShifts();
    return;
  }

  if (fn === '%') {
    // behave like unary percent on current entry (divide by 100)
    applyUnary(v => v / 100);
    return;
  }

  if (fn === 'sqrt') {
    applyUnary(v => Math.sqrt(v));
    return;
  }
  if (fn === 'recip') {
    applyUnary(v => 1 / v);
    return;
  }
  if (fn === 'x2') {
    applyUnary(v => v * v);
    return;
  }
  if (fn === 'x3') {
    applyUnary(v => v * v * v);
    return;
  }
  if (fn === 'log') {
    // SHIFT + log -> 10^x; normal -> log10
    if (state.shift) { applyUnary(v => Math.pow(10, v)); }
    else applyUnary(v => Math.log10(v));
    return;
  }
  if (fn === 'ln') {
    if (state.shift) { applyUnary(v => Math.exp(v)); }
    else applyUnary(v => Math.log(v));
    return;
  }

  if (fn === 'sin' || fn === 'cos' || fn === 'tan') {
    // SHIFT modifies to inverse; HYP modifies to hyperbolic; combination possible
    // Implementation: SHIFT is inverse (sin^-1), HYP sets hyperbolic (sinh)
    // Handle inverse hyperbolic when SHIFT+HYP etc.
    trigApply(fn);
    return;
  }

  if (fn === 'x!') {
    // factorial (integer)
    applyUnary(v => {
      v = Math.floor(v);
      if (v < 0) return NaN;
      let res = 1;
      for (let i = 2; i <= v; i++) res *= i;
      return res;
    });
    return;
  }

  if (fn === 'equal') {
    // Evaluate pending operation
    executePending();
    // put result into lastAns
    state.lastAns = state.acc;
    state.current = '';
    state.pendingOp = null;
    refreshScreen();
    clearShifts();
    return;
  }

  if (fn === 'sto' || fn === 'rcl') {
    // ALPHA required to choose variable (A-F)
    if (state.alpha) {
      // Wait for next keypress to be an alphanumeric key; emulate by storing upcoming key value
      // Simplify: prompt for variable letter (A..F) using window.prompt (since ALPHA selection UI is extra)
      const name = prompt("Enter variable name (A-F):");
      if (!name) { clearShifts(); return; }
      const key = name.trim().toUpperCase().charAt(0);
      if (!/[A-F]/.test(key)) { alert('Use A-F'); clearShifts(); return; }
      if (fn === 'sto') {
        // store current or lastAns
        const v = toNumber(state.current === '' ? state.lastAns : state.current);
        state.vars[key] = v;
      } else {
        // recall
        if (state.vars.hasOwnProperty(key)) state.current = String(state.vars[key]);
        else alert('Empty');
      }
      refreshScreen(); clearShifts(); return;
    } else {
      // without ALPHA, STO / RCL functions might be used differently; just ignore
      alert('Use ALPHA before STO/RCL to select variable');
      clearShifts();
      return;
    }
  }

  /* Memory functions */
  if (fn === 'm+') { state.memory += toNumber(state.current || state.lastAns); clearShifts(); refreshScreen(); return; }
  if (fn === 'm-') { state.memory -= toNumber(state.current || state.lastAns); clearShifts(); refreshScreen(); return; }
  if (fn === 'mr') { state.current = String(state.memory); refreshScreen(); clearShifts(); return; }
  if (fn === 'mc') { state.memory = 0; clearShifts(); refreshScreen(); return; }

  if (fn === 'eng') { // ENG is complex in real device; we provide placeholder to toggle engineering notation
    // convert current to engineering notation (exponent multiple of 3)
    const v = toNumber(state.current || state.lastAns);
    if (v === 0) { state.current = '0'; refreshScreen(); clearShifts(); return; }
    const p = Math.floor(Math.log10(Math.abs(v)) / 3);
    const m = v / Math.pow(10, p * 3);
    state.current = `${m}e${p * 3}`;
    refreshScreen(); clearShifts(); return;
  }

  if (fn === 'rcl' || fn === 'sto') {
    // handled above
    return;
  }

  if (fn === 'm-' || fn === 'm+') {
    // handled above
    return;
  }

  // If we reached here, it's not a special fn handled above
  clearShifts();
}

/* numeric and operator key handling */
function handleNumKey(d) {
  if (!state.power) return;
  // append digit or dot
  if (d === '.' && state.current.includes('.')) return;
  if (state.current === '0' && d !== '.') state.current = d;
  else state.current += d;
  refreshScreen();
}

function handleOp(op) {
  if (!state.power) return;
  // if there is an existing pendingOp and there's a current, execute it
  if (state.pendingOp && state.current !== '') {
    executePending();
  } else if (state.current !== '') {
    state.acc = toNumber(state.current);
    state.current = '';
  }
  state.pendingOp = op;
  refreshScreen();
}

/* wire up the keys */
keys.forEach(k => {
  k.addEventListener('click', (e) => {
    const fn = k.dataset.fn;
    const num = k.dataset.num;
    const op = k.dataset.op;
    playClick();

    if (num !== undefined) { handleNumKey(num); return; }
    if (op !== undefined) { handleOp(op); return; }
    // fn exists
    if (fn) handleKey(fn, k);
  });
});

/* keyboard support */
window.addEventListener('keydown', (e) => {
  if (!state.power && e.key.toLowerCase() !== 'o') return; // only allow on
  if (/\d/.test(e.key) || e.key === '.') { handleNumKey(e.key); playClick(); return; }
  if (e.key === '+') { handleOp('+'); playClick(); return; }
  if (e.key === '-') { handleOp('−'); playClick(); return; }
  if (e.key === '*') { handleOp('×'); playClick(); return; }
  if (e.key === '/') { handleOp('÷'); playClick(); return; }
  if (e.key === 'Enter' || e.key === '=') { handleKey('equal'); playClick(); return; }
  if (e.key === 'Backspace') { handleKey('del'); playClick(); return; }
  if (e.key.toLowerCase() === 'c') { handleKey('ac'); playClick(); return; }
  if (e.key.toLowerCase() === 'o') { handleKey('on'); playClick(); return; } // on
});

/* init */
updateIndicators();
refreshScreen();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => console.log("Service Worker Registered"));
}