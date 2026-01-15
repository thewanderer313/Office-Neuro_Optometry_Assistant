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

// Visual pupil diagram state
let currentLighting = "light"; // "light" or "dark"

// Clinical guidance hint functions
function pupilLocalizationHint(f) {
  if (f.dominance === "light") {
    if (f.ptosis || f.diplopia) {
      return "Large pupil + ptosis/diplopia: CN III pathway rises (compressive vs ischemic). Check all EOM gazes.";
    }
    if (f.lnd || f.vermiform) {
      return "Large pupil + light-near dissociation/vermiform: Adie tonic pupil pattern rises.";
    }
    if (f.anticholinergic) {
      return "Large pupil + anticholinergic exposure: pharmacologic mydriasis most likely.";
    }
    return "Large pupil pattern (anisocoria greater in light): the larger pupil is abnormal. Consider CN III, Adie, or pharmacologic.";
  }
  if (f.dominance === "dark") {
    if (f.dilationLag || f.anhidrosis || f.ptosis) {
      return "Small pupil + dilation lag/anhidrosis/ptosis: Horner syndrome rises. Localize: central vs preganglionic vs postganglionic.";
    }
    return "Small pupil pattern (anisocoria greater in dark): the smaller pupil is abnormal. Consider Horner syndrome.";
  }
  if (f.dominance === "equal") {
    return "Equal anisocoria in light and dark: less localizing. Consider mechanical iris damage, prior surgery, or early pathology.";
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
    return "Light measurements missing: needed to identify large pupil patterns (CN III, Adie, pharmacologic).";
  }
  if (!hasDark) {
    return "Dark measurements missing: needed to identify small pupil patterns (Horner syndrome).";
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
    return "Consider dilute pilocarpine 0.125% testing: Adie pupil will constrict (denervation supersensitivity), pharmacologic will not.";
  }
  if (f.dominance === "dark") {
    if (f.acute || f.painful) {
      return "Acute/painful Horner: strongly consider carotid dissection. Ask about neck pain, recent trauma, consider urgent CTA/MRA.";
    }
    if (!f.dilationLag) {
      return "Check for dilation lag: observe pupil for 15-20 seconds after lights off. Delayed dilation supports Horner.";
    }
    return "Confirm with apraclonidine 0.5%: reversal of anisocoria (Horner pupil dilates) is diagnostic.";
  }
  return "Complete light/dark measurements, then check triage flags and special signs to refine the differential.";
}

// Update visual pupil diagram
function updatePupilDiagram(session) {
  const p = session.pupils || {};

  // Get pupil sizes based on current lighting
  let odSize, osSize;
  if (currentLighting === "light") {
    odSize = toNumOrNull(p.odLight);
    osSize = toNumOrNull(p.osLight);
  } else {
    odSize = toNumOrNull(p.odDark);
    osSize = toNumOrNull(p.osDark);
  }

  // Update pupil visual sizes (scale: 1mm = ~6px, max iris ~70px)
  const pupilOD = $("pupilOD");
  const pupilOS = $("pupilOS");
  const sizeOD = $("pupilSizeOD");
  const sizeOS = $("pupilSizeOS");

  if (odSize !== null) {
    const pxSize = Math.min(Math.max(odSize * 6, 8), 60);
    pupilOD.style.width = `${pxSize}px`;
    pupilOD.style.height = `${pxSize}px`;
    sizeOD.textContent = `${odSize.toFixed(1)} mm`;
  } else {
    pupilOD.style.width = "20px";
    pupilOD.style.height = "20px";
    sizeOD.textContent = "— mm";
  }

  if (osSize !== null) {
    const pxSize = Math.min(Math.max(osSize * 6, 8), 60);
    pupilOS.style.width = `${pxSize}px`;
    pupilOS.style.height = `${pxSize}px`;
    sizeOS.textContent = `${osSize.toFixed(1)} mm`;
  } else {
    pupilOS.style.width = "20px";
    pupilOS.style.height = "20px";
    sizeOS.textContent = "— mm";
  }

  // Update lighting toggle active state
  $("lightingLight").classList.toggle("active", currentLighting === "light");
  $("lightingDark").classList.toggle("active", currentLighting === "dark");

  // Update eye background based on lighting
  const eyeOD = $("eyeOD");
  const eyeOS = $("eyeOS");
  if (currentLighting === "dark") {
    eyeOD.classList.add("dark-mode");
    eyeOS.classList.add("dark-mode");
  } else {
    eyeOD.classList.remove("dark-mode");
    eyeOS.classList.remove("dark-mode");
  }
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

  // Optic nerve findings
  const on = session.opticNerve || {};
  $("discPallorOD").checked = !!on.discPallorOD;
  $("discPallorOS").checked = !!on.discPallorOS;
  $("discEdemaOD").checked = !!on.discEdemaOD;
  $("discEdemaOS").checked = !!on.discEdemaOS;
  $("colorDeficitOD").checked = !!on.colorDeficitOD;
  $("colorDeficitOS").checked = !!on.colorDeficitOS;
  $("vaReducedOD").checked = !!on.vaReducedOD;
  $("vaReducedOS").checked = !!on.vaReducedOS;
  $("optociliaryShunts").checked = !!on.optociliaryShunts;
  $("cupping").checked = !!on.cupping;
  $("discHemorrhages").checked = !!on.hemorrhages;
  $("opticNerveNotes").value = on.notes || "";

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

  // Update visual diagram
  updatePupilDiagram(session);

  // Update optic nerve status
  const opticStatus = $("opticNerveStatus");
  if (opticStatus) {
    const findings = [];
    if (on.discPallorOD || on.discPallorOS) {
      findings.push(`Disc pallor ${on.discPallorOD && on.discPallorOS ? "OU" : on.discPallorOD ? "OD" : "OS"}`);
    }
    if (on.discEdemaOD || on.discEdemaOS) {
      findings.push(`Disc edema ${on.discEdemaOD && on.discEdemaOS ? "OU" : on.discEdemaOD ? "OD" : "OS"}`);
    }
    if (on.colorDeficitOD || on.colorDeficitOS) {
      findings.push(`Color deficit ${on.colorDeficitOD && on.colorDeficitOS ? "OU" : on.colorDeficitOD ? "OD" : "OS"}`);
    }
    if (on.vaReducedOD || on.vaReducedOS) {
      findings.push(`VA reduced ${on.vaReducedOD && on.vaReducedOS ? "OU" : on.vaReducedOD ? "OD" : "OS"}`);
    }
    if (on.optociliaryShunts) findings.push("Optociliary shunts");
    if (on.cupping) findings.push("Cupping");
    if (on.hemorrhages) findings.push("Disc hemorrhages");

    if (f.hasRAPD) {
      findings.push(`RAPD ${f.rapdEye || ""} ${f.rapdODGrade > 0 ? f.rapdOD : f.rapdOS}`);
    }

    opticStatus.textContent = findings.length > 0 ? findings.join("; ") : "No findings entered";
  }
}

// Quick preset functions
function applyPreset(presetType) {
  switch (presetType) {
    case "physiologic":
      // Physiologic anisocoria: stable ~0.4mm difference, both conditions similar
      sessionStore.set("pupils.odLight", 3.5);
      sessionStore.set("pupils.osLight", 3.1);
      sessionStore.set("pupils.odDark", 5.5);
      sessionStore.set("pupils.osDark", 5.1);
      sessionStore.set("pupils.odLightRxn", "brisk");
      sessionStore.set("pupils.osLightRxn", "brisk");
      break;

    case "horner":
      // Small pupil pattern: OS smaller, greater anisocoria in dark
      // Typical Horner: ~2mm miosis with dilation lag
      sessionStore.set("pupils.odLight", 3.5);
      sessionStore.set("pupils.osLight", 2.5);
      sessionStore.set("pupils.odDark", 6.0);
      sessionStore.set("pupils.osDark", 4.0);
      sessionStore.set("pupils.odLightRxn", "brisk");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("pupils.dilationLag", true);
      sessionStore.set("eom.ptosis", true);
      break;

    case "cn3":
      // Large pupil pattern: OD larger, greater anisocoria in light
      // Fixed dilated pupil with ptosis
      sessionStore.set("pupils.odLight", 6.0);
      sessionStore.set("pupils.osLight", 3.0);
      sessionStore.set("pupils.odDark", 7.0);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "none");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("eom.ptosis", true);
      sessionStore.set("eom.diplopia", true);
      sessionStore.set("eom.adductionDeficit", true);
      sessionStore.set("eom.verticalLimitation", true);
      break;

    case "adie":
      // Large pupil pattern: OD larger, light-near dissociation
      // Sluggish reaction, no ptosis
      sessionStore.set("pupils.odLight", 5.5);
      sessionStore.set("pupils.osLight", 3.5);
      sessionStore.set("pupils.odDark", 6.5);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "sluggish");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("pupils.lightNearDissociation", true);
      sessionStore.set("pupils.vermiform", true);
      break;

    case "pharmacologic":
      // Large fixed pupil: unilateral mydriasis
      // No ptosis, no diplopia
      sessionStore.set("pupils.odLight", 7.0);
      sessionStore.set("pupils.osLight", 3.0);
      sessionStore.set("pupils.odDark", 7.5);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "none");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("pupils.anticholinergicExposure", true);
      break;

    case "aion":
      // AION pattern: RAPD, disc edema, altitudinal defect
      sessionStore.set("pupils.odLight", 3.5);
      sessionStore.set("pupils.osLight", 3.5);
      sessionStore.set("pupils.odDark", 5.5);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "brisk");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("pupils.rapdOD", "3+");
      sessionStore.set("opticNerve.discEdemaOD", true);
      sessionStore.set("opticNerve.vaReducedOD", true);
      sessionStore.set("opticNerve.colorDeficitOD", true);
      sessionStore.set("triage.acuteOnset", true);
      sessionStore.set("visualFields.altitudinal", true);
      sessionStore.set("visualFields.respectsHorizontalMeridian", true);
      sessionStore.set("visualFields.laterality", "mono");
      break;

    case "opticNeuritis":
      // Optic neuritis: RAPD, pain on movement, central scotoma
      sessionStore.set("pupils.odLight", 3.5);
      sessionStore.set("pupils.osLight", 3.5);
      sessionStore.set("pupils.odDark", 5.5);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "brisk");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("pupils.rapdOD", "2+");
      sessionStore.set("opticNerve.colorDeficitOD", true);
      sessionStore.set("opticNerve.vaReducedOD", true);
      sessionStore.set("eom.painOnMovement", true);
      sessionStore.set("triage.acuteOnset", true);
      sessionStore.set("triage.painful", true);
      sessionStore.set("visualFields.centralScotoma", true);
      sessionStore.set("visualFields.laterality", "mono");
      break;

    case "papilledema":
      // Papilledema: bilateral disc edema, no RAPD initially
      sessionStore.set("pupils.odLight", 3.5);
      sessionStore.set("pupils.osLight", 3.5);
      sessionStore.set("pupils.odDark", 5.5);
      sessionStore.set("pupils.osDark", 5.5);
      sessionStore.set("pupils.odLightRxn", "brisk");
      sessionStore.set("pupils.osLightRxn", "brisk");
      sessionStore.set("opticNerve.discEdemaOD", true);
      sessionStore.set("opticNerve.discEdemaOS", true);
      sessionStore.set("opticNerve.hemorrhages", true);
      sessionStore.set("triage.neuroSx", true);
      break;
  }
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

  // Optic nerve findings
  $("discPallorOD").addEventListener("change", e => sessionStore.set("opticNerve.discPallorOD", e.target.checked));
  $("discPallorOS").addEventListener("change", e => sessionStore.set("opticNerve.discPallorOS", e.target.checked));
  $("discEdemaOD").addEventListener("change", e => sessionStore.set("opticNerve.discEdemaOD", e.target.checked));
  $("discEdemaOS").addEventListener("change", e => sessionStore.set("opticNerve.discEdemaOS", e.target.checked));
  $("colorDeficitOD").addEventListener("change", e => sessionStore.set("opticNerve.colorDeficitOD", e.target.checked));
  $("colorDeficitOS").addEventListener("change", e => sessionStore.set("opticNerve.colorDeficitOS", e.target.checked));
  $("vaReducedOD").addEventListener("change", e => sessionStore.set("opticNerve.vaReducedOD", e.target.checked));
  $("vaReducedOS").addEventListener("change", e => sessionStore.set("opticNerve.vaReducedOS", e.target.checked));
  $("optociliaryShunts").addEventListener("change", e => sessionStore.set("opticNerve.optociliaryShunts", e.target.checked));
  $("cupping").addEventListener("change", e => sessionStore.set("opticNerve.cupping", e.target.checked));
  $("discHemorrhages").addEventListener("change", e => sessionStore.set("opticNerve.hemorrhages", e.target.checked));
  $("opticNerveNotes").addEventListener("input", e => sessionStore.set("opticNerve.notes", e.target.value));

  // Quick presets
  $("presetPhysiologic").addEventListener("click", () => applyPreset("physiologic"));
  $("presetHorner").addEventListener("click", () => applyPreset("horner"));
  $("presetCN3").addEventListener("click", () => applyPreset("cn3"));
  $("presetAdie").addEventListener("click", () => applyPreset("adie"));
  $("presetPharmaco").addEventListener("click", () => applyPreset("pharmacologic"));
  $("presetAION").addEventListener("click", () => applyPreset("aion"));
  $("presetOpticNeuritis").addEventListener("click", () => applyPreset("opticNeuritis"));
  $("presetPapilledema").addEventListener("click", () => applyPreset("papilledema"));

  // Lighting toggle for pupil diagram
  $("lightingLight").addEventListener("click", () => {
    currentLighting = "light";
    updatePupilDiagram(sessionStore.getSession());
  });
  $("lightingDark").addEventListener("click", () => {
    currentLighting = "dark";
    updatePupilDiagram(sessionStore.getSession());
  });
}

function init() {
  initSidebar("./anisocoria.html");
  bind();

  // initial sync + keep page inputs in sync if another tab changes session
  syncFromSession(sessionStore.getSession());
  sessionStore.subscribe((s) => syncFromSession(s));
}

init();
