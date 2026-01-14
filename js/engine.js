// js/engine.js
// Shared differential engine (starter): Anisocoria + basic EOM + Visual Fields
// Threshold requirement: anisocoria >= 0.5 mm

export const CONFIG = { ANISO_THRESHOLD_MM: 0.5 };

function num(x) {
  if (x === "" || x === null || x === undefined) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function absDiff(a, b) {
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

function hasLightPair(session) {
  const p = session.pupils || {};
  return (p.odLight !== null && p.odLight !== "" && p.odLight !== undefined) &&
    (p.osLight !== null && p.osLight !== "" && p.osLight !== undefined);
}
function hasDarkPair(session) {
  const p = session.pupils || {};
  return (p.odDark !== null && p.odDark !== "" && p.odDark !== undefined) &&
    (p.osDark !== null && p.osDark !== "" && p.osDark !== undefined);
}
function hasFullPupilDataset(session) {
  return hasLightPair(session) && hasDarkPair(session);
}

export function deriveFeatures(session) {
  const t = session.triage || {};
  const p = session.pupils || {};
  const e = session.eom || {};
  const vf = session.visualFields || {};

  // Pupils
  const odL = num(p.odLight), osL = num(p.osLight);
  const odD = num(p.odDark), osD = num(p.osDark);

  const anisL = absDiff(odL, osL);
  const anisD = absDiff(odD, osD);

  const Lmeets = anisL !== null && anisL >= CONFIG.ANISO_THRESHOLD_MM;
  const Dmeets = anisD !== null && anisD >= CONFIG.ANISO_THRESHOLD_MM;

  // dominance: which lighting condition produces larger anisocoria (when meeting threshold)
  let dominance = null; // "light" | "dark" | "equal" | null
  if (Lmeets || Dmeets) {
    if (anisL !== null && anisD !== null) {
      if (anisL > anisD) dominance = "light";
      else if (anisD > anisL) dominance = "dark";
      else dominance = "equal";
    } else if (Lmeets) dominance = "light";
    else if (Dmeets) dominance = "dark";
  }

  return {
    // global triage
    acute: !!t.acuteOnset,
    painful: !!t.painful,
    neuroSx: !!t.neuroSx,
    trauma: !!t.trauma,

    // pupils
    anisL,
    anisD,
    dominance,
    dilationLag: !!p.dilationLag,
    anhidrosis: !!p.anhidrosis,
    lnd: !!p.lightNearDissociation,
    vermiform: !!p.vermiform,
    anticholinergic: !!p.anticholinergicExposure,
    sympathomimetic: !!p.sympathomimeticExposure,
    rapdOD: p.rapdOD || "",
    rapdOS: p.rapdOS || "",
    hasRAPD: !!(p.rapdOD && p.rapdOD !== "none") || !!(p.rapdOS && p.rapdOS !== "none"),

    // EOM basics (starter)
    diplopia: !!e.diplopia,
    ptosis: !!e.ptosis,
    comitant: e.comitant ?? null,
    abductionDeficit: e.abductionDeficit ?? null,
    adductionDeficit: e.adductionDeficit ?? null,
    verticalLimitation: e.verticalLimitation ?? null,
    fatigable: !!e.fatigable,
    painOnMovement: !!e.painOnMovement,

    // Visual Fields
    vf_symptoms: !!vf.complaint,
    vf_test_type: vf.testType || "",
    vf_reliability: vf.reliability || "",
    vf_new_defect: !!vf.newDefect,
    vf_laterality: vf.laterality || "", // "mono" | "binocular" | "unknown" | ""
    vf_respects_vertical: vf.respectsVerticalMeridian === true,
    vf_respects_horizontal: vf.respectsHorizontalMeridian === true,
    vf_homonymous: !!vf.homonymous,
    vf_bitemporal: !!vf.bitemporal,
    vf_altitudinal: !!vf.altitudinal,
    vf_central_scotoma: !!vf.centralScotoma,
    vf_congruity: vf.congruity || "" // "low" | "moderate" | "high" | ""
  };
}

export function scoreDifferential(f) {
  const dx = [];
  const add = (name, score, why, nextSteps = []) => dx.push({ name, score, why, nextSteps });

  const largePattern = f.dominance === "light"; // anisocoria larger in light → large pupil abnormal
  const smallPattern = f.dominance === "dark";  // anisocoria larger in dark → small pupil abnormal

  // Physiologic anisocoria (only score when pupil data exists)
  {
    let s = 0; const why = [];

    const hasAnyPupilMeasure = (f.anisL !== null) || (f.anisD !== null);

    // Only consider physiologic if we actually have enough data to compute anisocoria
    if (hasAnyPupilMeasure) {
      // Only if anisocoria is not meeting the threshold-based "pattern" logic
      // (i.e., dominance not called)
      if (f.dominance === null) {
        s += 3;
        why.push(`Anisocoria does not meet ${CONFIG.ANISO_THRESHOLD_MM.toFixed(1)} mm threshold-based pattern criteria`);

        // If no other red flags selected, nudge upward (but only once we have data)
        if (!f.acute && !f.painful && !f.neuroSx && !f.diplopia && !f.ptosis) {
          s += 1;
          why.push("No acute/pain/neuro/EOM flags");
        }
      }
    }

    if (s > 0) add("Physiologic anisocoria", s, why, [
      "Confirm measurements in consistent lighting",
      "Review old photos if available to confirm chronicity"
    ]);
  }


  // Horner syndrome
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (smallPattern) { s += 4; why.push("Greater in dark → small pupil abnormal pattern"); }
    if (f.dilationLag) { s += 2; why.push("Dilation lag"); }
    if (f.ptosis) { s += 2; why.push("Ptosis"); }
    if (f.anhidrosis) { s += 1; why.push("Anhidrosis"); }
    if (f.acute || f.painful) { s += 1; why.push("Acute/painful context"); }

    // Context-sensitive next steps
    if (s > 0) {
      nextSteps.push("Consider apraclonidine 0.5% or cocaine testing to confirm");
      if (f.acute || f.painful) {
        nextSteps.push("If acute + pain/headache: strongly consider urgent carotid imaging (CTA/MRA) to exclude dissection");
      }
      nextSteps.push("If confirmed: hydroxyamphetamine to localize (preganglionic vs postganglionic)");
    }
    add("Horner syndrome", s, why, nextSteps);
  }

  // Compressive 3rd nerve palsy concern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (largePattern) { s += 4; why.push("Greater in light → large pupil abnormal pattern"); }
    if (f.ptosis) { s += 2; why.push("Ptosis"); }
    if (f.diplopia) { s += 2; why.push("Diplopia/EOM concern"); }
    if (f.acute) { s += 2; why.push("Acute onset"); }
    if (f.painful) { s += 2; why.push("Pain/headache"); }
    if (f.neuroSx) { s += 2; why.push("Other neuro symptoms"); }

    // Context-sensitive next steps
    if (s > 0) {
      if (f.acute || f.painful || f.neuroSx) {
        nextSteps.push("Strongly consider emergent CTA/MRA head to exclude aneurysm (especially PComm)");
      }
      nextSteps.push("Assess extraocular movements in all gazes");
      nextSteps.push("Check for aberrant regeneration signs if chronic");
    }
    add("Compressive 3rd nerve palsy concern", s, why, nextSteps);
  }

  // Adie / tonic pupil
  {
    let s = 0; const why = [];
    if (largePattern) { s += 2; why.push("Large pupil pattern"); }
    if (f.lnd) { s += 3; why.push("Light–near dissociation"); }
    if (f.vermiform) { s += 2; why.push("Segmental/vermiform movement"); }
    add("Adie / tonic pupil", s, why, [
      "Examine iris at slit lamp for segmental vermiform movements",
      "Test accommodation—may be intact with slow re-dilation",
      "Consider dilute pilocarpine 0.125% for denervation supersensitivity"
    ]);
  }

  // Pharmacologic mydriasis
  {
    let s = 0; const why = [];
    if (largePattern) { s += 2; why.push("Large pupil pattern"); }
    if (f.anticholinergic) { s += 4; why.push("Anticholinergic exposure"); }
    if (f.sympathomimetic) { s += 2; why.push("Sympathomimetic exposure"); }
    add("Pharmacologic mydriasis", s, why, [
      "Review medication list and recent exposures",
      "Ask about eye drops, scopolamine patches, motion sickness meds",
      "Pupil typically fixed—will not constrict to 1% pilocarpine if pharmacologic"
    ]);
  }

  // Starter EOM hook: CN VI pattern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.diplopia && f.abductionDeficit === true) { s += 3; why.push("Diplopia + abduction deficit"); }
    if (f.comitant === false) { s += 1; why.push("Incomitant deviation"); }

    if (s > 0) {
      nextSteps.push("Quantify deviation with prism cover testing");
      if (f.acute) {
        nextSteps.push("If acute/isolated: consider MRI brain with attention to skull base");
      }
      nextSteps.push("If microvascular risk factors + isolated CN VI: may observe 3 months");
    }
    if (s > 0) add("CN VI palsy pattern (EOM-based starter)", s, why, nextSteps);
  }

  // Myasthenia gravis pattern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.fatigable) { s += 4; why.push("Fatigable weakness"); }
    if (f.ptosis && f.diplopia) { s += 3; why.push("Ptosis + diplopia combination"); }
    else if (f.ptosis) { s += 1; why.push("Ptosis present"); }
    else if (f.diplopia) { s += 1; why.push("Diplopia present"); }
    // Pupil-sparing pattern boosts MG
    if ((f.ptosis || f.diplopia) && !f.dominance) { s += 1; why.push("Pupil-sparing pattern"); }

    if (s > 0) {
      nextSteps.push("Assess for fatigue: sustained upgaze 1-2 minutes for ptosis worsening");
      nextSteps.push("Consider ice pack test (improvement with cooling)");
      nextSteps.push("Check anti-AChR and anti-MuSK antibodies");
      nextSteps.push("If confirmed: CT chest to evaluate for thymoma");
    }
    if (s > 0) add("Myasthenia gravis pattern", s, why, nextSteps);
  }

  // Orbital inflammatory / pain-on-movement pattern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.painOnMovement) { s += 4; why.push("Pain on eye movement"); }
    if (f.diplopia && f.painOnMovement) { s += 2; why.push("Diplopia + pain combination"); }
    if (f.painful) { s += 1; why.push("General pain/headache context"); }

    if (s > 0) {
      nextSteps.push("Examine for proptosis, chemosis, and lid edema");
      nextSteps.push("Consider MRI orbits with contrast for orbital inflammation");
      if (f.vf_central_scotoma || f.hasRAPD) {
        nextSteps.push("Central scotoma/RAPD: consider optic neuritis—MRI brain/orbits with contrast");
      }
    }
    if (s > 0) add("Orbital inflammatory / optic neuritis pattern", s, why, nextSteps);
  }

  // =========================
  // Visual Field rules (starter)
  // =========================

  // Reliability penalty helper
  const relPenalty = (f.vf_reliability === "poor") ? -2 : 0;
  const relNote = (f.vf_reliability === "poor") ? "Poor reliability reduces weight" : null;

  // Chiasmal process / sellar compression pattern
  {
    let s = 0; const why = [];
    if (f.vf_bitemporal) { s += 6; why.push("Bitemporal field pattern"); }
    if (f.vf_respects_vertical) { s += 2; why.push("Respects vertical meridian"); }
    if (f.vf_laterality === "binocular") { s += 1; why.push("Binocular / both eyes"); }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }
    if (s > 0) add("Chiasmal process / sellar compression pattern (VF-based)", s, why, [
      "Strongly consider MRI pituitary/sella with contrast",
      "Check pituitary hormones: prolactin, TSH, ACTH, IGF-1",
      "Refer to neuro-ophthalmology and/or neurosurgery"
    ]);
  }

  // Retrochiasmal lesion pattern (tract/radiations/occipital)
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.vf_homonymous) { s += 6; why.push("Homonymous pattern"); }
    if (f.vf_respects_vertical) { s += 2; why.push("Respects vertical meridian"); }
    if (f.vf_congruity === "high") { s += 2; why.push("High congruity"); }
    if (f.vf_congruity === "low") { s += 1; why.push("Lower congruity"); }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      if (f.acute) {
        nextSteps.push("If acute: consider stroke protocol, check last known well time");
      }
      nextSteps.push("MRI brain with attention to optic tract, radiations, occipital lobe");
      if (f.vf_congruity === "high") {
        nextSteps.push("High congruity suggests occipital cortex localization");
      } else if (f.vf_congruity === "low") {
        nextSteps.push("Low congruity suggests optic tract or anterior radiations");
      }
    }
    if (s > 0) add("Retrochiasmal lesion pattern (VF-based)", s, why, nextSteps);
  }

  // Optic nerve / anterior ischemic-type pattern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.vf_altitudinal && f.vf_respects_horizontal) {
      s += 6; why.push("Altitudinal + respects horizontal meridian");
    } else if (f.vf_altitudinal) {
      s += 4; why.push("Altitudinal pattern");
    }
    if (f.vf_laterality === "mono") { s += 1; why.push("Monocular pattern"); }
    if (f.hasRAPD) { s += 2; why.push("RAPD present—supports anterior pathway"); }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("Examine optic disc for edema (acute AION) or pallor (prior event)");
      nextSteps.push("Check ESR/CRP urgently if age >50 to exclude GCA");
      if (!f.hasRAPD) {
        nextSteps.push("Assess RAPD—expected in anterior optic nerve pathology");
      }
    }
    if (s > 0) add("Optic nerve / anterior pathway pattern (VF-based)", s, why, nextSteps);
  }

  // Central scotoma / papillomacular bundle pattern
  {
    let s = 0; const why = [];
    const nextSteps = [];
    if (f.vf_central_scotoma) { s += 6; why.push("Central scotoma"); }
    if (f.vf_laterality === "mono") { s += 1; why.push("Monocular pattern"); }
    if (f.vf_symptoms) { s += 1; why.push("Visual complaint present"); }
    if (f.vf_new_defect) { s += 1; why.push("New vs baseline"); }
    if (f.hasRAPD) { s += 2; why.push("RAPD present—suggests optic nerve over macula"); }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("Check visual acuity and color vision (red desaturation)");
      if (!f.hasRAPD) {
        nextSteps.push("Examine for RAPD—if present, suggests optic nerve over macular cause");
      }
      nextSteps.push("Consider OCT RNFL/GCC and macular imaging");
      if (f.painOnMovement) {
        nextSteps.push("Pain on eye movement present: strongly consider optic neuritis—MRI orbits/brain");
      } else {
        nextSteps.push("If pain on eye movement: consider optic neuritis, may need MRI orbits/brain");
      }
    }
    if (s > 0) add("Central scotoma pattern (macula/optic nerve) (VF-based)", s, why, nextSteps);
  }

  // Sort and return top list
  dx.sort((a, b) => b.score - a.score);
  return dx.filter(d => d.score > 0).slice(0, 8);
}

export function compute(session) {
  const features = deriveFeatures(session);

  // Gate: don’t show pupil-driven differentials until light+dark pairs exist
  const pupilReady = hasFullPupilDataset(session);

  // Compute differential only if we have enough data OR if a non-pupil module
  // is strongly populated later (we’ll expand this logic as EOM/VF grow).
  const differential = pupilReady ? scoreDifferential(features) : [];

  // Unified global urgency banner (starter)
  let urgency = {
    level: "none",
    text: "Enter findings to build a live differential."
  };

  if (!pupilReady) {
    urgency = {
      level: "none",
      text: "Pupils: enter BOTH light and dark measurements to generate pupil-based differentials."
    };
  }

  // Urgency hierarchy: critical > danger > warn > info > none
  // CRITICAL: Immediate action required (aneurysm, dissection)
  if (features.dominance === "light" && features.ptosis &&
    (features.acute || features.painful) && (features.diplopia || features.neuroSx)) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Pattern suggests compressive CN III palsy. Strongly consider emergent CTA/MRA head to exclude aneurysm (especially PComm)."
    };
  } else if (features.dominance === "dark" && (features.acute && features.painful) &&
    (features.dilationLag || features.ptosis || features.anhidrosis)) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Acute painful Horner syndrome. Strongly consider emergent carotid imaging (CTA/MRA) to exclude dissection."
    };
  }
  // DANGER: High concern, urgent workup
  else if (features.dominance === "light" && (features.ptosis || features.diplopia) &&
    (features.acute || features.painful || features.neuroSx)) {
    urgency = {
      level: "danger",
      text: "High concern: Large pupil pattern with acute/pain/neuro + ptosis/diplopia. Consider compressive CN III—imaging may be indicated."
    };
  } else if (features.dominance === "dark" && (features.dilationLag || features.ptosis || features.anhidrosis) &&
    (features.acute || features.painful || features.neuroSx)) {
    urgency = {
      level: "warn",
      text: "Elevated concern: Small pupil pattern with acute/pain/neuro + supportive sympathetic signs. Consider Horner workup including vascular imaging if acute."
    };
  }
  // INFO: Notable patterns requiring attention
  else if (features.vf_bitemporal && features.vf_reliability !== "poor") {
    urgency = {
      level: "info",
      text: "VF pattern flagged: Bitemporal pattern raises chiasmal considerations. Strongly consider MRI pituitary if confirmed."
    };
  } else if (features.vf_homonymous && features.acute) {
    urgency = {
      level: "warn",
      text: "Acute homonymous field defect: Consider stroke protocol. Check last known well time and vascular risk factors."
    };
  } else if (features.acute || features.painful || features.neuroSx) {
    urgency = {
      level: "info",
      text: "Acute/pain/neuro symptoms selected. Use discriminators across modules to tighten localization."
    };
  }

  return { features, differential, urgency };
}

