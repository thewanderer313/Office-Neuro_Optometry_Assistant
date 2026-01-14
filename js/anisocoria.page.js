// js/anisocoria.page.js
import { sessionStore } from "./common.js";
import { initSidebar } from "./sidebar.js";
import { compute } from "./engine.js";

const $ = (id) => document.getElementById(id);

function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function formatMm(x) {
  if (x === null) return "—";
  return `${x.toFixed(1)} mm`;
}

// Clinical guidance hint functions (modeled after VF module)
function pupilLocalizationHint(f) {
  if (f.dominance === "light") {
    if (f.ptosis || f.diplopia) {
      return "Large pupil + ptosis/diplopia → CN III pathway rises (compressive vs ischemic). Check all EOM gazes.";
    }
    if (f.lnd || f.vermiform) {
      return "Large pupil + light-near dissociation/vermiform → Adie tonic pupil pattern rises.";
    }
    if (f.anticholinergic) {
      return "Large pupil + anticholinergic exposure → pharmacologic mydriasis most likely.";
    }
    return "Large pupil pattern (anisocoria greater in light) → the larger pupil is abnormal. Consider CN III, Adie, or pharmacologic.";
  }
  if (f.dominance === "dark") {
    if (f.dilationLag || f.anhidrosis || f.ptosis) {
      return "Small pupil + dilation lag/anhidrosis/ptosis → Horner syndrome rises. Localize: central vs preganglionic vs postganglionic.";
    }
    return "Small pupil pattern (anisocoria greater in dark) → the smaller pupil is abnormal. Consider Horner syndrome.";
  }
  if (f.dominance === "equal") {
    return "Equal anisocoria in light and dark → less localizing. Consider mechanical iris damage, prior surgery, or early pathology.";
  }
  return "Enter both light and dark pupil measurements to determine pattern (which pupil is abnormal).";
}

function pupilQualityHint(session) {
  const p = session.pupils || {};
  const hasLight = p.odLight !== null && p.osLight !== null;
  const hasDark = p.odDark !== null && p.osDark !== null;

  if (!hasLight && !hasDark) {
    return "Measure pupils in both light and dark conditions for accurate pattern determination.";
  }
  if (!hasLight) {
    return "Light measurements missing—needed to identify large pupil patterns (CN III, Adie, pharmacologic).";
  }
  if (!hasDark) {
    return "Dark measurements missing—needed to identify small pupil patterns (Horner syndrome).";
  }
  return "Light and dark measurements present. Confirm consistent technique and room lighting.";
}

function pupilNextDiscriminatorHint(f) {
  if (f.dominance === "light") {
    if (f.ptosis && (f.acute || f.painful)) {
      return "Acute painful large pupil + ptosis is CN III compression until proven otherwise. Emergent imaging indicated.";
    }
    if (f.lnd) {
      return "Light-near dissociation present. Check slit lamp for vermiform iris movements to support Adie diagnosis.";
    }
    if (!f.lnd && !f.vermiform && !f.anticholinergic) {
      return "Test light-near dissociation: does pupil constrict better to near target than light? Check for anticholinergic exposure.";
    }
    return "Consider dilute pilocarpine 0.125% testing—Adie pupil will constrict (denervation supersensitivity), pharmacologic will not.";
  }
  if (f.dominance === "dark") {
    if (f.acute || f.painful) {
      return "Acute/painful Horner: strongly consider carotid dissection. Ask about neck pain, recent trauma, and consider urgent CTA/MRA.";
    }
    if (!f.dilationLag) {
      return "Check for dilation lag: observe pupil for 15-20 seconds after lights off—delayed dilation supports Horner.";
    }
    return "Confirm with apraclonidine 0.5%: reversal of anisocoria (Horner pupil dilates) is diagnostic.";
  }
  return "Complete light/dark measurements, then check triage flags and special signs to refine the differential.";
}

function syncFromSession(session) {
  // triage
  $("acuteOnset").checked = !!session.triage.acuteOnset;
  $("painful").checked = !!session.triage.painful;
  $("neuroSx").checked = !!session.triage.neuroSx;
  $("trauma").checked = !!session.triage.trauma;

  // pupils
  $("odLight").value = session.pupils.odLight ?? "";
  $("osLight").value = session.pupils.osLight ?? "";
  $("odDark").value  = session.pupils.odDark ?? "";
  $("osDark").value  = session.pupils.osDark ?? "";

  $("odLightRxn").value = session.pupils.odLightRxn || "";
  $("osLightRxn").value = session.pupils.osLightRxn || "";

  $("dilationLag").checked = !!session.pupils.dilationLag;
  $("anhidrosis").checked = !!session.pupils.anhidrosis;
  $("lightNearDissociation").checked = !!session.pupils.lightNearDissociation;
  $("vermiform").checked = !!session.pupils.vermiform;
  $("anticholinergicExposure").checked = !!session.pupils.anticholinergicExposure;
  $("sympathomimeticExposure").checked = !!session.pupils.sympathomimeticExposure;

  // RAPD
  $("rapdOD").value = session.pupils.rapdOD || "";
  $("rapdOS").value = session.pupils.rapdOS || "";

  // local metrics display
  const odL = toNumOrNull(session.pupils.odLight);
  const osL = toNumOrNull(session.pupils.osLight);
  const odD = toNumOrNull(session.pupils.odDark);
  const osD = toNumOrNull(session.pupils.osDark);

  const anisL = (odL !== null && osL !== null) ? Math.abs(odL - osL) : null;
  const anisD = (odD !== null && osD !== null) ? Math.abs(odD - osD) : null;

  $("anisLight").textContent = formatMm(anisL);
  $("anisDark").textContent  = formatMm(anisD);

  // Update clinical guidance hints
  const out = compute(session);
  const f = out.features;

  const locEl = $("pupilLocalize");
  const qualEl = $("pupilQuality");
  const nextEl = $("pupilNext");

  if (locEl) locEl.textContent = pupilLocalizationHint(f);
  if (qualEl) qualEl.textContent = pupilQualityHint(session);
  if (nextEl) nextEl.textContent = pupilNextDiscriminatorHint(f);
}

function bind() {
  // triage checkboxes
  $("acuteOnset").addEventListener("change", e => sessionStore.set("triage.acuteOnset", e.target.checked));
  $("painful").addEventListener("change", e => sessionStore.set("triage.painful", e.target.checked));
  $("neuroSx").addEventListener("change", e => sessionStore.set("triage.neuroSx", e.target.checked));
  $("trauma").addEventListener("change", e => sessionStore.set("triage.trauma", e.target.checked));

  // pupil numbers
  $("odLight").addEventListener("input", e => sessionStore.set("pupils.odLight", toNumOrNull(e.target.value)));
  $("osLight").addEventListener("input", e => sessionStore.set("pupils.osLight", toNumOrNull(e.target.value)));
  $("odDark").addEventListener("input",  e => sessionStore.set("pupils.odDark",  toNumOrNull(e.target.value)));
  $("osDark").addEventListener("input",  e => sessionStore.set("pupils.osDark",  toNumOrNull(e.target.value)));

  // reactivity
  $("odLightRxn").addEventListener("change", e => sessionStore.set("pupils.odLightRxn", e.target.value));
  $("osLightRxn").addEventListener("change", e => sessionStore.set("pupils.osLightRxn", e.target.value));

  // signs/exposure
  $("dilationLag").addEventListener("change", e => sessionStore.set("pupils.dilationLag", e.target.checked));
  $("anhidrosis").addEventListener("change", e => sessionStore.set("pupils.anhidrosis", e.target.checked));
  $("lightNearDissociation").addEventListener("change", e => sessionStore.set("pupils.lightNearDissociation", e.target.checked));
  $("vermiform").addEventListener("change", e => sessionStore.set("pupils.vermiform", e.target.checked));
  $("anticholinergicExposure").addEventListener("change", e => sessionStore.set("pupils.anticholinergicExposure", e.target.checked));
  $("sympathomimeticExposure").addEventListener("change", e => sessionStore.set("pupils.sympathomimeticExposure", e.target.checked));

  // RAPD
  $("rapdOD").addEventListener("change", e => sessionStore.set("pupils.rapdOD", e.target.value));
  $("rapdOS").addEventListener("change", e => sessionStore.set("pupils.rapdOS", e.target.value));
}

function init() {
  initSidebar("./anisocoria.html");
  bind();

  // initial sync + keep page inputs in sync if another tab changes session
  syncFromSession(sessionStore.getSession());
  sessionStore.subscribe((s) => syncFromSession(s));
}

init();
