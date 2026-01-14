// js/common.js
export const SESSION_KEY = "neuro_ophtho_session_v1";

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }
function nowISO() { return new Date().toISOString(); }

const defaultSession = () => ({
  meta: {
    createdAt: nowISO(),
    updatedAt: nowISO(),
    activePatientLabel: "Untitled"
  },
  triage: {
    acuteOnset: false,
    painful: false,
    neuroSx: false,
    trauma: false
  },
  pupils: {
    odLight: null, osLight: null,
    odDark: null, osDark: null,
    odLightRxn: "", osLightRxn: "",
    dilationLag: false,
    anhidrosis: false,
    lightNearDissociation: false,
    vermiform: false,
    anticholinergicExposure: false,
    sympathomimeticExposure: false,
    rapdOD: "",   // "", "none", "1+", "2+", "3+", "4+"
    rapdOS: ""    // "", "none", "1+", "2+", "3+", "4+"
  },
  eom: {
    diplopia: false,
    ptosis: false,
    comitant: null,             // true/false/null
    abductionDeficit: null,     // true/false/null
    adductionDeficit: null,     // true/false/null
    verticalLimitation: null,   // true/false/null
    fatigable: false,           // MG screening
    painOnMovement: false,      // orbital/inflammatory
    notes: ""
  },
  visualFields: {
    complaint: false,
    testType: "",
    reliability: "",
    newDefect: false,
    laterality: "",
    respectsVerticalMeridian: null,
    respectsHorizontalMeridian: null,
    homonymous: false,
    bitemporal: false,
    altitudinal: false,
    centralScotoma: false,
    congruity: "",
    notes: ""
  }

});

class SessionStore {
  constructor() {
    this._session = this._load();
    this._listeners = new Set();
  }

  _load() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return defaultSession();
    try {
      const parsed = JSON.parse(raw);
      const d = defaultSession();
      return {
        ...d,
        ...parsed,
        meta: { ...d.meta, ...(parsed.meta || {}) },
        triage: { ...d.triage, ...(parsed.triage || {}) },
        pupils: { ...d.pupils, ...(parsed.pupils || {}) },
        eom: { ...d.eom, ...(parsed.eom || {}) },
        visualFields: { ...d.visualFields, ...(parsed.visualFields || {}) }
      };
    } catch {
      return defaultSession();
    }
  }

  _save() {
    this._session.meta.updatedAt = nowISO();
    localStorage.setItem(SESSION_KEY, JSON.stringify(this._session));
  }

  getSession() {
    return deepClone(this._session);
  }

  set(path, value) {
    const parts = path.split(".");
    let obj = this._session;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!(k in obj)) obj[k] = {};
      obj = obj[k];
    }
    obj[parts[parts.length - 1]] = value;
    this._save();
    this._emit();
  }

  reset() {
    this._session = defaultSession();
    this._save();
    this._emit();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    const snapshot = this.getSession();
    this._listeners.forEach(fn => fn(snapshot));
    window.dispatchEvent(new CustomEvent("session:changed", { detail: snapshot }));
  }
}

export const sessionStore = new SessionStore();
