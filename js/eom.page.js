// js/eom.page.js
import { sessionStore } from "./common.js";
import { initSidebar } from "./sidebar.js";
import { compute } from "./engine.js";

const $ = (id) => document.getElementById(id);

function boolOrNullFromSelect(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

// Clinical guidance hint functions
function eomLocalizationHint(f, e) {
  // Check for CN III pattern
  if (f.dominance === "light" && f.ptosis) {
    if (f.adductionDeficit || f.verticalLimitation) {
      return "Large pupil + ptosis + adduction/vertical deficit → CN III palsy pattern. Rule out compressive lesion (aneurysm).";
    }
    return "Large pupil + ptosis → partial CN III involvement possible. Assess all extraocular movements.";
  }

  // CN VI pattern
  if (f.abductionDeficit && f.diplopia) {
    if (f.comitant === false) {
      return "Abduction deficit + diplopia + incomitant → CN VI palsy rises. Consider skull base, cavernous sinus, or microvascular.";
    }
    return "Abduction deficit + diplopia → CN VI palsy pattern. Quantify with prism cover testing.";
  }

  // CN IV pattern
  if (f.verticalLimitation && !f.ptosis && !f.abductionDeficit) {
    return "Isolated vertical limitation (especially with head tilt compensation) → consider CN IV palsy. Check for hypertropia worse in contralateral gaze.";
  }

  // Ptosis without pupil
  if (f.ptosis && f.dominance !== "light") {
    if (f.diplopia) {
      return "Ptosis + diplopia without pupil involvement → consider myasthenia gravis, partial CN III, or levator dehiscence.";
    }
    return "Isolated ptosis → consider MG, Horner (check pupil in dark), levator dehiscence, or mechanical ptosis.";
  }

  // General diplopia
  if (f.diplopia) {
    if (f.comitant === true) {
      return "Comitant deviation + diplopia → less likely cranial nerve palsy. Consider decompensated phoria or thyroid eye disease.";
    }
    return "Diplopia present. Determine which movements are limited to localize the cranial nerve(s) involved.";
  }

  return "Enter EOM findings to generate localization guidance.";
}

function eomQualityHint(e) {
  const hasDeficit = e.abductionDeficit || e.adductionDeficit || e.verticalLimitation;
  const hasComitance = e.comitant !== null && e.comitant !== undefined;

  if (!e.diplopia && !e.ptosis && !hasDeficit) {
    return "No EOM symptoms or signs entered yet.";
  }
  if (e.diplopia && !hasDeficit) {
    return "Diplopia reported but no motility deficits marked. Perform cover testing and ductions in all gazes.";
  }
  if (hasDeficit && !hasComitance) {
    return "Motility deficit marked. Assess comitance (same deviation in all gazes vs worse in certain directions).";
  }
  return "EOM data entered. Consider quantifying deviation with prism and alternating cover test.";
}

function eomNextDiscriminatorHint(f, e) {
  // Urgent CN III
  if (f.dominance === "light" && f.ptosis && (f.acute || f.painful)) {
    return "Acute painful CN III with pupil → aneurysm until proven otherwise. Strongly consider emergent CTA/MRA.";
  }

  // MG screening
  if (f.ptosis && f.diplopia && !f.dominance) {
    return "Ptosis + diplopia without pupil involvement: assess for fatigue (sustained upgaze), ice pack test, or anti-AChR antibodies for MG.";
  }

  // CN VI workup
  if (f.abductionDeficit && f.diplopia) {
    if (f.acute) {
      return "Acute CN VI: if isolated with vascular risk factors, may observe. Otherwise, MRI brain with attention to skull base.";
    }
    return "CN VI palsy: check for papilledema (IIH), history of head trauma, or lumbar puncture if recent.";
  }

  // Incomplete exam
  if (f.diplopia && !e.abductionDeficit && !e.adductionDeficit && !e.verticalLimitation) {
    return "Diplopia without specific deficits: perform full motility exam including versions, ductions, and cover testing.";
  }

  if (f.ptosis && !f.diplopia) {
    return "Isolated ptosis: check levator function (MRD1), fatigue with sustained upgaze, and lid crease height.";
  }

  return "Complete EOM assessment and triage flags to refine guidance.";
}

function syncFromSession(session) {
  $("diplopia").checked = !!session.eom.diplopia;
  $("ptosis").checked = !!session.eom.ptosis;
  $("fatigable").checked = !!session.eom.fatigable;
  $("painOnMovement").checked = !!session.eom.painOnMovement;

  $("abductionDeficit").checked = session.eom.abductionDeficit === true;
  $("adductionDeficit").checked = session.eom.adductionDeficit === true;
  $("verticalLimitation").checked = session.eom.verticalLimitation === true;

  $("comitant").value =
    session.eom.comitant === true ? "true" :
    session.eom.comitant === false ? "false" : "";

  $("eomNotes").value = session.eom.notes || "";

  // Update clinical guidance hints
  const out = compute(session);
  const f = out.features;
  const e = session.eom || {};

  const locEl = $("eomLocalize");
  const qualEl = $("eomQuality");
  const nextEl = $("eomNext");

  if (locEl) locEl.textContent = eomLocalizationHint(f, e);
  if (qualEl) qualEl.textContent = eomQualityHint(e);
  if (nextEl) nextEl.textContent = eomNextDiscriminatorHint(f, e);
}

function bind() {
  $("diplopia").addEventListener("change", e => sessionStore.set("eom.diplopia", e.target.checked));
  $("ptosis").addEventListener("change", e => sessionStore.set("eom.ptosis", e.target.checked));
  $("fatigable").addEventListener("change", e => sessionStore.set("eom.fatigable", e.target.checked));
  $("painOnMovement").addEventListener("change", e => sessionStore.set("eom.painOnMovement", e.target.checked));

  $("abductionDeficit").addEventListener("change", e => sessionStore.set("eom.abductionDeficit", e.target.checked ? true : null));
  $("adductionDeficit").addEventListener("change", e => sessionStore.set("eom.adductionDeficit", e.target.checked ? true : null));
  $("verticalLimitation").addEventListener("change", e => sessionStore.set("eom.verticalLimitation", e.target.checked ? true : null));

  $("comitant").addEventListener("change", e => sessionStore.set("eom.comitant", boolOrNullFromSelect(e.target.value)));
  $("eomNotes").addEventListener("input", e => sessionStore.set("eom.notes", e.target.value));
}

function init() {
  initSidebar("./eom.html");
  bind();
  syncFromSession(sessionStore.getSession());
  sessionStore.subscribe((s) => syncFromSession(s));
}

init();
