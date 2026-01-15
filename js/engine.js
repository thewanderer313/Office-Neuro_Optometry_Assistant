// js/engine.js
// Comprehensive differential engine for Neuro-Ophthalmology
// Covers: Anisocoria, EOM/Cranial nerve palsies, Visual Field patterns, Optic Nerve assessment
// Evidence-based scoring with clinical decision support and procedural testing recommendations

export const CONFIG = {
  ANISO_THRESHOLD_MM: 0.5,
  // Scoring thresholds for tier classification
  STRONG_MATCH_THRESHOLD: 8,
  MODERATE_MATCH_THRESHOLD: 5
};

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

// Check if EOM module has meaningful data entered
function hasEOMData(session) {
  const e = session.eom || {};
  return e.diplopia || e.ptosis || e.fatigable || e.painOnMovement ||
    e.abductionDeficit === true || e.adductionDeficit === true ||
    e.verticalLimitation === true || e.comitant !== null;
}

// Check if VF module has meaningful data entered
function hasVFData(session) {
  const vf = session.visualFields || {};
  return vf.homonymous || vf.bitemporal || vf.altitudinal || vf.centralScotoma ||
    vf.respectsVerticalMeridian !== null || vf.respectsHorizontalMeridian !== null;
}

// Check if optic nerve module has meaningful data entered
function hasOpticNerveData(session) {
  const on = session.opticNerve || {};
  return on.discPallorOD || on.discPallorOS || on.discEdemaOD || on.discEdemaOS ||
    on.colorDeficitOD || on.colorDeficitOS || on.vaReducedOD || on.vaReducedOS ||
    on.optociliaryShunts || on.cupping || on.hemorrhages;
}

export function deriveFeatures(session) {
  const t = session.triage || {};
  const p = session.pupils || {};
  const on = session.opticNerve || {};
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

  // Determine which eye is larger/smaller
  const largerPupilOD = odL !== null && osL !== null && odL > osL;
  const smallerPupilOD = odD !== null && osD !== null && odD < osD;

  // Pupil reactivity analysis
  const odReactive = p.odLightRxn === "brisk";
  const osReactive = p.osLightRxn === "brisk";
  const odSluggish = p.odLightRxn === "sluggish";
  const osSluggish = p.osLightRxn === "sluggish";
  const odFixed = p.odLightRxn === "none";
  const osFixed = p.osLightRxn === "none";
  const anyFixedPupil = odFixed || osFixed;
  const anySluggishPupil = odSluggish || osSluggish;

  // RAPD grading (numeric for comparison)
  // Reference: Thompson HS, Corbett JJ, Cox TA. How to measure the relative afferent pupillary defect.
  const rapdGrade = (val) => {
    if (!val || val === "none") return 0;
    if (val === "1+") return 1;
    if (val === "2+") return 2;
    if (val === "3+") return 3;
    if (val === "4+") return 4;
    return 0;
  };
  const rapdODGrade = rapdGrade(p.rapdOD);
  const rapdOSGrade = rapdGrade(p.rapdOS);
  const hasRAPD = rapdODGrade > 0 || rapdOSGrade > 0;
  const significantRAPD = rapdODGrade >= 2 || rapdOSGrade >= 2;
  const severeRAPD = rapdODGrade >= 3 || rapdOSGrade >= 3;
  // Which eye has the RAPD (afferent defect is on the side with RAPD)
  const rapdEye = rapdODGrade > rapdOSGrade ? "OD" : (rapdOSGrade > rapdODGrade ? "OS" : null);

  // Optic nerve findings
  const discPallor = on.discPallorOD || on.discPallorOS;
  const discPallorOD = !!on.discPallorOD;
  const discPallorOS = !!on.discPallorOS;
  const discEdema = on.discEdemaOD || on.discEdemaOS;
  const discEdemaOD = !!on.discEdemaOD;
  const discEdemaOS = !!on.discEdemaOS;
  const colorDeficit = on.colorDeficitOD || on.colorDeficitOS;
  const colorDeficitOD = !!on.colorDeficitOD;
  const colorDeficitOS = !!on.colorDeficitOS;
  const vaReduced = on.vaReducedOD || on.vaReducedOS;
  const vaReducedOD = !!on.vaReducedOD;
  const vaReducedOS = !!on.vaReducedOS;
  const optociliaryShunts = !!on.optociliaryShunts;
  const cupping = !!on.cupping;
  const discHemorrhages = !!on.hemorrhages;

  // Derived optic nerve patterns
  // Unilateral disc pallor with ipsilateral RAPD suggests optic neuropathy
  const unilateralPallorWithRAPD = (discPallorOD && !discPallorOS && rapdODGrade > 0) ||
                                   (discPallorOS && !discPallorOD && rapdOSGrade > 0);
  // Color-VA dissociation (color worse than VA suggests optic nerve, not macular)
  const suspectedOpticNeuropathy = hasRAPD || discPallor || colorDeficit;

  return {
    // global triage
    acute: !!t.acuteOnset,
    painful: !!t.painful,
    neuroSx: !!t.neuroSx,
    trauma: !!t.trauma,

    // pupils - measurements
    anisL,
    anisD,
    dominance,
    odL, osL, odD, osD,
    largerPupilOD,
    smallerPupilOD,

    // pupils - reactivity
    odReactive, osReactive,
    odSluggish, osSluggish,
    odFixed, osFixed,
    anyFixedPupil,
    anySluggishPupil,

    // pupils - signs
    dilationLag: !!p.dilationLag,
    anhidrosis: !!p.anhidrosis,
    lnd: !!p.lightNearDissociation,
    vermiform: !!p.vermiform,
    anticholinergic: !!p.anticholinergicExposure,
    sympathomimetic: !!p.sympathomimeticExposure,

    // RAPD (enhanced)
    rapdOD: p.rapdOD || "",
    rapdOS: p.rapdOS || "",
    rapdODGrade,
    rapdOSGrade,
    hasRAPD,
    significantRAPD,
    severeRAPD,
    rapdEye,

    // Optic nerve findings
    discPallor,
    discPallorOD,
    discPallorOS,
    discEdema,
    discEdemaOD,
    discEdemaOS,
    colorDeficit,
    colorDeficitOD,
    colorDeficitOS,
    vaReduced,
    vaReducedOD,
    vaReducedOS,
    optociliaryShunts,
    cupping,
    discHemorrhages,
    unilateralPallorWithRAPD,
    suspectedOpticNeuropathy,

    // EOM
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

// =====================================
// PROCEDURAL TESTING RECOMMENDATIONS
// =====================================
// Generates context-aware testing recommendations based on the combination of findings
// Reference: AAO Preferred Practice Patterns, Walsh & Hoyt's Clinical Neuro-Ophthalmology

export function generateTestingRecommendations(f, differential) {
  const tests = [];

  // Helper to add test with priority and rationale
  const addTest = (name, priority, rationale, technique = null) => {
    // Avoid duplicates
    if (!tests.find(t => t.name === name)) {
      tests.push({ name, priority, rationale, technique });
    }
  };

  // ===== AFFERENT PATHWAY TESTING =====

  // RAPD Testing - Always recommend if any optic nerve concern
  if (f.suspectedOpticNeuropathy || f.vf_central_scotoma || f.vf_altitudinal ||
      f.discPallor || f.colorDeficit || f.vaReduced) {
    if (!f.hasRAPD) {
      addTest("Swinging Flashlight Test (RAPD Assessment)", "high",
        "Optic nerve pathology suspected - RAPD is the most sensitive clinical sign of unilateral or asymmetric optic neuropathy",
        "In dim room, swing light between eyes every 2-3 seconds. Watch for paradoxical dilation when light shines on affected eye. Grade 1+ to 4+.");
    }
  }

  // Color Vision Testing
  // Reference: Trobe JD. The evaluation of optic neuropathy.
  if (f.hasRAPD || f.discPallor || f.vf_central_scotoma || f.trauma) {
    addTest("Red Cap Desaturation Test", "high",
      "Quick bedside screen for optic neuropathy - color vision affected early and often disproportionately to VA",
      "Hold red target at equal distance from both eyes. Ask patient to rate 'redness' of each eye as percentage. >25% asymmetry suggests optic neuropathy.");

    addTest("Ishihara or HRR Color Plates", "high",
      "Quantitative color vision assessment - dyschromatopsia in optic neuropathy typically red-green (acquired) vs blue-yellow (macular)",
      "Test each eye separately in good lighting. Document number of plates correct. Compare to expected for VA level.");
  }

  // If RAPD present with disc pallor
  if (f.hasRAPD && f.discPallor) {
    addTest("OCT RNFL Analysis", "high",
      "RAPD + disc pallor indicates optic nerve damage - OCT quantifies RNFL loss and helps localize (sectoral vs diffuse)",
      "Standard circumpapillary RNFL scan. Look for thinning pattern: temporal in ON, superior/inferior in glaucoma, band atrophy in chiasmal.");

    addTest("OCT Ganglion Cell Analysis", "moderate",
      "GCL-IPL thinning may precede visible pallor and correlates with visual field loss",
      "Macular cube scan with GCC/GCL analysis. Compare to normative database.");
  }

  // Traumatic optic neuropathy workup
  if (f.trauma && (f.hasRAPD || f.discPallor || f.colorDeficit || f.vaReduced)) {
    addTest("Red Cap Desaturation Test", "critical",
      "URGENT: Traumatic optic neuropathy suspected - early identification critical for potential intervention",
      "Compare red saturation between eyes. Document baseline for serial monitoring.");

    addTest("Monocular Color Vision (Ishihara)", "critical",
      "Quantify color deficit in each eye separately - important baseline for monitoring recovery or progression",
      "Test each eye monocularly. Record number correct out of total plates.");

    addTest("Visual Acuity with Refraction", "critical",
      "Document best-corrected VA in each eye - pinhole if refraction not available",
      "Snellen or ETDRS. Document lighting conditions and testing distance.");

    addTest("CT Orbits and Optic Canal", "critical",
      "Assess for optic canal fracture, orbital hemorrhage, or bone fragment impingement",
      "Thin-cut CT (1-2mm) through orbits and optic canals. Axial and coronal reformats.");
  }

  // ===== PUPIL-SPECIFIC TESTING =====

  // Large pupil pattern (CN III, Adie, pharmacologic)
  if (f.dominance === "light") {
    if (f.ptosis || f.diplopia || f.acute || f.painful) {
      addTest("Complete Cranial Nerve Exam", "critical",
        "Large pupil + ptosis/diplopia - must rule out CN III compression (aneurysm)",
        "Test all EOMs in 9 positions of gaze. Check CN V sensation, VII function.");
    }

    if (f.lnd || f.vermiform) {
      addTest("Dilute Pilocarpine Test (0.0625-0.125%)", "high",
        "Light-near dissociation suggests Adie pupil - test for denervation supersensitivity",
        "Instill dilute pilocarpine in both eyes. Adie pupil constricts more than normal due to cholinergic supersensitivity. Wait 30-45 min.");
    }

    if (!f.ptosis && !f.diplopia && !f.lnd) {
      addTest("Pilocarpine 1% Test", "high",
        "To differentiate Adie vs pharmacologic mydriasis",
        "Adie pupil constricts to pilocarpine 1%; pharmacologically blocked pupil (atropine) does NOT. Wait 30-45 min.");
    }
  }

  // Small pupil pattern (Horner)
  if (f.dominance === "dark") {
    addTest("Apraclonidine 0.5% Test", "high",
      "Confirm Horner syndrome - denervation supersensitivity causes Horner pupil to dilate, reversing anisocoria",
      "Instill in both eyes, wait 45-60 min. Reversal of anisocoria (affected pupil dilates more) confirms Horner. Sensitivity ~90%.");

    addTest("Cocaine 4-10% Test", "moderate",
      "Alternative Horner confirmation - blocks NE reuptake; normal pupil dilates, Horner pupil fails to dilate",
      "Instill both eyes, wait 45-60 min. Anisocoria ≥1mm confirms Horner. Gold standard but cocaine availability limited.");

    if (f.acute || f.painful) {
      addTest("CTA or MRA Head/Neck", "critical",
        "URGENT: Acute painful Horner - must rule out carotid dissection",
        "CTA from aortic arch through circle of Willis. Look for: dissection flap, intramural hematoma, luminal stenosis.");
    }
  }

  // ===== OPTIC NERVE / DISC TESTING =====

  if (f.discEdema) {
    addTest("Fundus Photography", "high",
      "Document disc edema for baseline and serial comparison",
      "Stereo disc photos if available. Document blurring of disc margins, elevation, hemorrhages, cotton wool spots.");

    addTest("B-scan Ultrasonography", "moderate",
      "Assess for papilledema vs pseudopapilledema - look for drusen, elevated nerve sheath",
      "30-degree test: pseudopapilledema maintains brightness on tilting; true edema does not. Check for drusen signal.");

    if (!f.painful) {
      addTest("MRI Brain with MRV", "high",
        "Bilateral disc edema without pain - evaluate for increased ICP, venous sinus thrombosis",
        "Look for empty sella, optic nerve sheath dilation, venous sinus stenosis/thrombosis.");
    }
  }

  if (f.optociliaryShunts) {
    addTest("MRI Orbits with Contrast", "critical",
      "Optociliary shunt vessels suggest chronic optic nerve compression - rule out optic nerve sheath meningioma",
      "Thin cuts through orbits with gadolinium. Look for enhancing mass, 'tram-track' sign.");
  }

  // ===== EOM / DIPLOPIA TESTING =====

  if (f.diplopia) {
    addTest("Cover/Uncover and Alternating Cover Test", "high",
      "Quantify and characterize the deviation - tropia vs phoria",
      "Primary position and 8 cardinal gazes. Note comitance pattern.");

    addTest("Prism Cover Testing", "high",
      "Quantify deviation in prism diopters for monitoring and treatment planning",
      "Measure in primary, up, down, left, right gazes. Document near and distance.");
  }

  if (f.fatigable) {
    addTest("Sustained Upgaze Test", "high",
      "Screen for myasthenia gravis - fatigable ptosis worsens over 1-2 minutes",
      "Have patient look up at target for 2 minutes. Watch for progressive ptosis. Positive if ptosis worsens.");

    addTest("Ice Pack Test", "high",
      "Bedside MG test - cooling improves neuromuscular transmission",
      "Apply ice pack to closed lid for 2 minutes. Measure ptosis before/after. Improvement ≥2mm suggests MG.");

    addTest("Anti-AChR Antibodies", "high",
      "Serologic confirmation of MG - positive in ~50% of ocular MG",
      "Also consider anti-MuSK antibodies if AChR negative and clinical suspicion high.");
  }

  if (f.verticalLimitation && !f.ptosis && !f.abductionDeficit) {
    addTest("Parks-Bielschowsky Three-Step Test", "high",
      "Localize which oblique/vertical rectus is affected in CN IV palsy",
      "Step 1: Which eye higher? Step 2: Worse in R or L gaze? Step 3: Worse with R or L head tilt?");

    addTest("Double Maddox Rod Test", "moderate",
      "Quantify torsion - important in CN IV palsy diagnosis",
      "Red and white Maddox rods. Measure cyclotorsion in degrees.");
  }

  // ===== VISUAL FIELD PATTERN-SPECIFIC =====

  if (f.vf_bitemporal) {
    addTest("MRI Pituitary with Contrast", "critical",
      "Bitemporal hemianopia indicates chiasmal compression until proven otherwise",
      "Dedicated pituitary protocol with thin cuts. Assess for adenoma, meningioma, craniopharyngioma.");

    addTest("Pituitary Hormone Panel", "high",
      "Assess for endocrine dysfunction from pituitary mass",
      "Prolactin, TSH, free T4, cortisol (AM), ACTH, IGF-1, LH, FSH, testosterone/estradiol.");
  }

  if (f.vf_homonymous && f.acute) {
    addTest("STAT MRI Brain (or CT if MRI unavailable)", "critical",
      "Acute homonymous defect - stroke until proven otherwise",
      "DWI/ADC for acute stroke. Establish last known well time for treatment decisions.");
  }

  if (f.vf_altitudinal && f.hasRAPD) {
    addTest("ESR and CRP (STAT if age >50)", "critical",
      "AION pattern with RAPD - must rule out giant cell arteritis urgently",
      "ESR >50 and/or CRP elevated highly suggestive. Consider empiric steroids pending biopsy if clinical suspicion high.");

    addTest("Temporal Artery Biopsy", "high",
      "Definitive test for GCA if ESR/CRP elevated or clinical suspicion high",
      "Unilateral biopsy (2-3cm length) within 2 weeks of starting steroids. Steroids don't mask pathology quickly.");
  }

  // ===== COMPREHENSIVE NEURO-OPHTHALMIC EVALUATION =====

  // If multiple concerning findings, recommend comprehensive workup
  const concernScore = (f.hasRAPD ? 2 : 0) + (f.discPallor ? 2 : 0) + (f.colorDeficit ? 1 : 0) +
    (f.vaReduced ? 1 : 0) + (f.trauma ? 2 : 0) + (f.painful ? 1 : 0) + (f.acute ? 1 : 0);

  if (concernScore >= 4) {
    addTest("Comprehensive Neuro-Ophthalmic Examination", "high",
      "Multiple findings suggest optic nerve or neurological pathology - systematic evaluation recommended",
      "VA, color vision, pupils (including RAPD), confrontation VF, motility, fundoscopy, formal VF, OCT.");
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  tests.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  return tests;
}

export function scoreDifferential(f) {
  const dx = [];
  const add = (name, score, why, nextSteps = [], category = "general") =>
    dx.push({ name, score, why, nextSteps, category });

  const largePattern = f.dominance === "light"; // anisocoria larger in light → large pupil abnormal
  const smallPattern = f.dominance === "dark";  // anisocoria larger in dark → small pupil abnormal

  // =====================================
  // PUPIL-BASED DIAGNOSES
  // =====================================

  // 1. Physiologic anisocoria
  // Reference: Loewenfeld IE. The Pupil: Anatomy, Physiology, and Clinical Applications.
  // ~20% of population has >0.4mm anisocoria; typically stable in light/dark
  // CRITICAL: Only diagnose when we have COMPLETE pupil data (both light AND dark)
  // and the anisocoria is minimal and stable across lighting conditions
  {
    let s = 0; const why = [];

    // MUST have BOTH light AND dark measurements to call physiologic anisocoria
    // Otherwise we cannot assess stability across lighting conditions
    const hasBothConditions = (f.anisL !== null) && (f.anisD !== null);

    if (hasBothConditions) {
      // Check for stable, minimal anisocoria: either both below threshold OR equal in both conditions
      const bothBelowThreshold = f.anisL < CONFIG.ANISO_THRESHOLD_MM && f.anisD < CONFIG.ANISO_THRESHOLD_MM;
      const stableAnisocoria = f.dominance === "equal" || (f.dominance === null && bothBelowThreshold);
      // Also check that the difference between light and dark anisocoria is small (<0.3mm)
      const anisocoriaChange = Math.abs(f.anisL - f.anisD);
      const stableAcrossConditions = anisocoriaChange < 0.3;

      if (stableAnisocoria || (bothBelowThreshold && stableAcrossConditions)) {
        s += 3;
        if (bothBelowThreshold) {
          why.push(`Anisocoria <${CONFIG.ANISO_THRESHOLD_MM}mm in both light and dark`);
        } else {
          why.push("Anisocoria stable/equal in light vs dark");
        }

        if (stableAcrossConditions && f.anisL > 0 && f.anisD > 0) {
          s += 2;
          why.push(`Anisocoria change of only ${anisocoriaChange.toFixed(1)}mm between conditions (stable)`);
        }

        if (!f.acute && !f.painful && !f.neuroSx && !f.diplopia && !f.ptosis) {
          s += 2;
          why.push("No red flags (acute/pain/neuro/ptosis/diplopia)");
        }
        if (!f.anyFixedPupil && !f.anySluggishPupil) {
          s += 1;
          why.push("Both pupils reactive");
        }
        if (!f.hasRAPD) {
          s += 1;
          why.push("No RAPD (rules out significant afferent defect)");
        }
        // Additional: no sympathetic or parasympathetic signs
        if (!f.dilationLag && !f.anhidrosis && !f.lnd && !f.vermiform) {
          s += 1;
          why.push("No pathologic pupil signs (dilation lag, LND, vermiform)");
        }
      }
    }

    if (s > 0) add("Physiologic anisocoria", s, why, [
      "Confirm measurements in consistent lighting conditions",
      "Review old photographs if available to confirm chronicity",
      "Anisocoria should remain relatively constant in light vs dark",
      "No further workup needed if stable and asymptomatic"
    ], "pupil");
  }

  // 2. Horner syndrome (oculosympathetic paresis)
  // Reference: Walton KA, Buono LM. Horner syndrome. Curr Opin Ophthalmol 2003;14:357-363
  // Classic triad: miosis, ptosis (1-2mm), anhidrosis
  // Dilation lag is pathognomonic (4-5 second delay in dark)
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (smallPattern) {
      s += 5;
      why.push("Anisocoria greater in dark (small pupil abnormal)");
    }
    if (f.dilationLag) {
      s += 3;
      why.push("Dilation lag (highly specific for Horner)");
    }
    if (f.ptosis) {
      s += 2;
      why.push("Ptosis (typically 1-2mm in Horner)");
    }
    if (f.anhidrosis) {
      s += 2;
      why.push("Anhidrosis (suggests preganglionic lesion)");
    }
    // Horner pupil should be reactive, no RAPD
    if (smallPattern && !f.anyFixedPupil) {
      s += 1;
      why.push("Pupils reactive (expected in Horner)");
    }
    if (smallPattern && !f.hasRAPD) {
      s += 1;
      why.push("No RAPD (efferent not afferent pathway)");
    }

    if (s > 0) {
      nextSteps.push("Pharmacologic confirmation: Apraclonidine 0.5% (reversal of anisocoria) or cocaine 4-10% (failure to dilate)");
      if (f.acute || f.painful) {
        nextSteps.push("URGENT: Acute painful Horner requires emergent CTA/MRA neck to rule out carotid dissection");
      }
      nextSteps.push("If confirmed: Hydroxyamphetamine 1% to localize (preganglionic vs postganglionic)");
      nextSteps.push("MRI/MRA from hypothalamus to T2 for preganglionic; carotid/skull base imaging for postganglionic");
    }
    if (s > 0) add("Horner syndrome", s, why, nextSteps, "pupil");
  }

  // 3. Third nerve (CN III) palsy - Compressive
  // Reference: Jacobson DM. Pupil involvement in patients with diabetes-associated oculomotor nerve palsy.
  // Arch Ophthalmol 1998;116:723-727
  // Pupil involvement suggests compressive etiology (PComm aneurysm until proven otherwise)
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (largePattern) {
      s += 5;
      why.push("Anisocoria greater in light (large pupil abnormal)");
    }
    // Fixed or poorly reactive dilated pupil
    if (f.anyFixedPupil && largePattern) {
      s += 2;
      why.push("Fixed/poorly reactive dilated pupil");
    }
    if (f.ptosis) {
      s += 2;
      why.push("Ptosis (complete CN III causes severe ptosis)");
    }
    if (f.diplopia) {
      s += 2;
      why.push("Diplopia (EOM involvement)");
    }
    if (f.adductionDeficit === true) {
      s += 2;
      why.push("Adduction deficit (medial rectus involvement)");
    }
    if (f.verticalLimitation === true) {
      s += 1;
      why.push("Vertical limitation (SR/IR/IO involvement)");
    }
    if (f.acute) {
      s += 2;
      why.push("Acute onset");
    }
    if (f.painful) {
      s += 2;
      why.push("Pain/headache (concerning for aneurysm)");
    }
    if (f.neuroSx) {
      s += 2;
      why.push("Other neurological symptoms");
    }

    if (s > 0) {
      if (f.acute || f.painful || f.neuroSx) {
        nextSteps.push("EMERGENT: CTA or MRA head to exclude posterior communicating artery aneurysm");
        nextSteps.push("Consider conventional angiography if CTA/MRA negative but suspicion high");
      }
      nextSteps.push("Complete cranial nerve exam including all EOM gazes");
      nextSteps.push("Check for aberrant regeneration (lid-gaze dyskinesis) if chronic");
      nextSteps.push("MRI brain with contrast if non-aneurysmal compressive lesion suspected");
    }
    if (s > 0) add("CN III palsy - Compressive (aneurysm concern)", s, why, nextSteps, "pupil");
  }

  // 4. Third nerve palsy - Ischemic/Microvascular
  // Reference: Jacobson DM. Pupil involvement in patients with diabetes-associated oculomotor nerve palsy.
  // Typically pupil-sparing (85-90%), resolves in 3-6 months
  {
    let s = 0; const why = [];
    const nextSteps = [];

    // Pupil-sparing pattern with EOM involvement
    if (f.ptosis && f.diplopia && !largePattern) {
      s += 4;
      why.push("Ptosis + diplopia with pupil sparing");
    }
    if (f.adductionDeficit === true && !largePattern) {
      s += 2;
      why.push("Adduction deficit without pupil involvement");
    }
    if (f.comitant === false) {
      s += 1;
      why.push("Incomitant deviation");
    }
    // Pain can occur in ischemic CN III
    if (f.painful && !f.neuroSx && !largePattern) {
      s += 1;
      why.push("Pain (can occur in ischemic CN III)");
    }

    if (s > 0) {
      nextSteps.push("Document vascular risk factors (diabetes, hypertension, hyperlipidemia)");
      nextSteps.push("If pupil completely spared and no other neuro signs: may observe with close follow-up");
      nextSteps.push("Check HbA1c, fasting glucose, lipid panel, ESR/CRP if age >50");
      nextSteps.push("If any pupil involvement or progression: imaging indicated to exclude compressive lesion");
      nextSteps.push("Expected recovery in 3-6 months; if no improvement by 3 months, reconsider diagnosis");
    }
    if (s > 0) add("CN III palsy - Ischemic/Microvascular", s, why, nextSteps, "pupil");
  }

  // 5. Adie (Tonic) pupil
  // Reference: Thompson HS. Adie's syndrome: some new observations. Trans Am Ophthalmol Soc 1977;75:587-626
  // Denervation supersensitivity to dilute pilocarpine (0.0625-0.125%)
  // Light-near dissociation, sectoral vermiform movements, accommodation paresis
  {
    let s = 0; const why = [];

    if (largePattern) {
      s += 2;
      why.push("Large pupil pattern");
    }
    if (f.lnd) {
      s += 4;
      why.push("Light-near dissociation (pupil constricts better to near than light)");
    }
    if (f.vermiform) {
      s += 3;
      why.push("Segmental/vermiform iris movements (pathognomonic)");
    }
    if (f.anySluggishPupil && !f.anyFixedPupil) {
      s += 1;
      why.push("Sluggish but present light reaction");
    }
    // Typically unilateral, no pain, no ptosis
    if (!f.painful && !f.ptosis && largePattern) {
      s += 1;
      why.push("Painless without ptosis (typical for Adie)");
    }

    if (s > 0) add("Adie (Tonic) pupil", s, why, [
      "Slit lamp exam for segmental vermiform iris movements",
      "Test accommodation: slow but tonically sustained constriction",
      "Pharmacologic confirmation: Dilute pilocarpine 0.0625-0.125% (constriction = denervation supersensitivity)",
      "Check deep tendon reflexes (Holmes-Adie syndrome if absent)",
      "Reassurance: benign condition, may progress to bilateral over years"
    ], "pupil");
  }

  // 6. Pharmacologic mydriasis
  // Reference: Lam BL, Thompson HS. A unilateral cataract produces a relative afferent pupillary defect
  // Common agents: tropicamide, cyclopentolate, atropine, scopolamine patches
  {
    let s = 0; const why = [];

    if (largePattern) {
      s += 2;
      why.push("Large pupil pattern");
    }
    if (f.anticholinergic) {
      s += 5;
      why.push("Anticholinergic/mydriatic exposure suspected");
    }
    if (f.sympathomimetic) {
      s += 3;
      why.push("Sympathomimetic exposure suspected");
    }
    // Fixed, dilated pupil typical
    if (f.anyFixedPupil && largePattern) {
      s += 2;
      why.push("Fixed dilated pupil");
    }
    // No ptosis or EOM involvement
    if (!f.ptosis && !f.diplopia && largePattern) {
      s += 1;
      why.push("No ptosis or diplopia (isolated pupil finding)");
    }

    if (s > 0) add("Pharmacologic mydriasis", s, why, [
      "Detailed medication and exposure history",
      "Ask about: eye drops, scopolamine patches, jimsonweed, nebulizers, handling medications",
      "Pilocarpine 1% test: pharmacologically blocked pupil will NOT constrict",
      "If positive history and fails pilocarpine: no further workup needed",
      "Effect typically resolves in 24-72 hours depending on agent"
    ], "pupil");
  }

  // 7. Traumatic mydriasis / Iris sphincter damage
  // Reference: Traumatic iritis and iris sphincter tears after blunt ocular trauma
  {
    let s = 0; const why = [];

    if (f.trauma) {
      s += 4;
      why.push("History of trauma/surgery");
    }
    if (largePattern && f.trauma) {
      s += 2;
      why.push("Large pupil in setting of trauma");
    }
    if (f.anyFixedPupil && f.trauma) {
      s += 2;
      why.push("Fixed pupil post-trauma");
    }

    if (s > 0) add("Traumatic mydriasis / Iris damage", s, why, [
      "Slit lamp examination for iris sphincter tears, iridodialysis",
      "Check for hyphema, lens subluxation, angle recession",
      "Gonioscopy to assess angle structures",
      "Document baseline and follow IOP (angle recession glaucoma risk)",
      "May be permanent if significant sphincter damage"
    ], "pupil");
  }

  // 8. Argyll Robertson pupils
  // Reference: Fletcher WA, Sharpe JA. Saccadic eye movement dysfunction in Alzheimer's disease.
  // Classic: bilateral small irregular pupils, light-near dissociation, poor dilation
  // Associated with neurosyphilis, diabetes, Parinaud syndrome
  {
    let s = 0; const why = [];

    if (f.lnd) {
      s += 3;
      why.push("Light-near dissociation");
    }
    // Typically bilateral small pupils
    if (f.anisL !== null && f.anisL < CONFIG.ANISO_THRESHOLD_MM) {
      if (f.odL !== null && f.osL !== null && f.odL < 3 && f.osL < 3) {
        s += 2;
        why.push("Bilateral small pupils");
      }
    }
    // Poor dilation in dark
    if (f.odD !== null && f.osD !== null && f.odD < 4 && f.osD < 4) {
      s += 1;
      why.push("Poor dilation in dark");
    }

    if (s >= 4) add("Argyll Robertson pupils", s, why, [
      "Characteristic: bilateral, small, irregular, light-near dissociation",
      "Order syphilis serology (RPR/VDRL, FTA-ABS or TP-PA)",
      "If positive: lumbar puncture for CSF VDRL",
      "Check HbA1c (diabetic autonomic neuropathy can cause similar findings)",
      "Consider MRI brain if dorsal midbrain lesion suspected"
    ], "pupil");
  }

  // =====================================
  // OPTIC NERVE / AFFERENT PATHWAY DIAGNOSES
  // =====================================

  // 9. Traumatic Optic Neuropathy (TON)
  // Reference: Steinsapir KD, Goldberg RA. Traumatic optic neuropathy. Surv Ophthalmol 1994;38:487-518
  // RAPD + disc pallor/VA loss + trauma history
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.trauma) {
      s += 3;
      why.push("History of trauma");
    }
    if (f.hasRAPD && f.trauma) {
      s += 4;
      why.push("RAPD in setting of trauma (indicates optic nerve damage)");
    }
    if (f.discPallor && f.trauma) {
      s += 3;
      why.push("Disc pallor (may be delayed 4-6 weeks post-injury)");
    }
    if (f.colorDeficit && f.trauma) {
      s += 2;
      why.push("Color vision deficit");
    }
    if (f.vaReduced && f.trauma) {
      s += 2;
      why.push("Reduced visual acuity");
    }
    if (f.unilateralPallorWithRAPD && f.trauma) {
      s += 2;
      why.push("Unilateral pallor with ipsilateral RAPD (classic TON)");
    }

    if (s > 0) {
      nextSteps.push("Immediate: Document VA, color vision (red cap/Ishihara), RAPD grade");
      nextSteps.push("CT orbits/optic canals: assess for fracture, hemorrhage, bone fragment");
      nextSteps.push("Serial exams: monitor for improvement or worsening");
      nextSteps.push("Controversial: High-dose IV methylprednisolone (CRASH trial showed harm in TBI)");
      nextSteps.push("Optic canal decompression rarely indicated; consult neurosurgery if severe");
      nextSteps.push("OCT RNFL at 4-6 weeks to document damage extent");
    }
    if (s > 0) add("Traumatic Optic Neuropathy", s, why, nextSteps, "optic");
  }

  // 10. Compressive Optic Neuropathy
  // Reference: Miller NR. The clinical spectrum of optic nerve sheath meningiomas
  // Progressive vision loss, RAPD, disc pallor/edema, optociliary shunts
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.hasRAPD && !f.trauma) {
      s += 3;
      why.push("RAPD present (afferent pathway dysfunction)");
    }
    if (f.discPallor && !f.discEdema) {
      s += 2;
      why.push("Disc pallor without edema (suggests chronic compression)");
    }
    if (f.optociliaryShunts) {
      s += 4;
      why.push("Optociliary shunt vessels (highly specific for chronic compression)");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit");
    }
    if (f.vaReduced) {
      s += 2;
      why.push("Reduced visual acuity");
    }
    // Progression without pain suggests compression over inflammation
    if (!f.painful && f.suspectedOpticNeuropathy) {
      s += 1;
      why.push("Painless progression (favors compressive over inflammatory)");
    }

    if (s >= 5) {
      nextSteps.push("MRI orbits with contrast (fat suppression): optic nerve sheath meningioma, glioma");
      nextSteps.push("MRI brain: intracranial extension, other lesions");
      nextSteps.push("Visual field testing: look for junctional scotoma if near chiasm");
      nextSteps.push("OCT RNFL to quantify damage");
      nextSteps.push("Neuro-ophthalmology referral for management planning");
    }
    if (s >= 5) add("Compressive Optic Neuropathy", s, why, nextSteps, "optic");
  }

  // 11. Optic Atrophy (various etiologies)
  // Reference: Sadun AA. Acquired mitochondrial impairment as a cause of optic nerve disease.
  {
    let s = 0; const why = [];

    if (f.discPallor) {
      s += 4;
      why.push("Disc pallor (optic atrophy)");
    }
    if (f.hasRAPD) {
      s += 3;
      why.push("RAPD present");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit (dyschromatopsia)");
    }
    if (!f.discEdema) {
      s += 1;
      why.push("No disc edema (established atrophy, not acute)");
    }
    if (!f.acute && !f.painful) {
      s += 1;
      why.push("Chronic, painless course");
    }

    if (s >= 6) add("Optic Atrophy", s, why, [
      "Determine pattern: diffuse vs temporal (bow-tie) vs sectoral",
      "Temporal pallor: MS, compressive, toxic/nutritional",
      "Bow-tie (band) atrophy: chiasmal lesion",
      "OCT RNFL to quantify and pattern nerve fiber loss",
      "Workup: MRI brain/orbits, consider B12, folate, copper if nutritional suspected",
      "Family history: consider hereditary optic neuropathies (LHON, DOA)"
    ], "optic");
  }

  // =====================================
  // EOM-BASED DIAGNOSES
  // =====================================

  // 12. CN VI (Abducens) palsy
  // Reference: Moster ML, Savino PJ, Sergott RC. Isolated sixth-nerve palsies in younger adults.
  // Most common isolated CN palsy; abduction deficit, esotropia worse at distance
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.diplopia && f.abductionDeficit === true) {
      s += 4;
      why.push("Diplopia + abduction deficit");
    }
    if (f.abductionDeficit === true && !f.adductionDeficit && !f.verticalLimitation) {
      s += 2;
      why.push("Isolated abduction deficit");
    }
    if (f.comitant === false) {
      s += 1;
      why.push("Incomitant deviation");
    }
    // Typically pupil sparing
    if (!largePattern && !smallPattern && f.abductionDeficit === true) {
      s += 1;
      why.push("Pupil sparing (expected in CN VI)");
    }

    if (s > 0) {
      nextSteps.push("Quantify deviation with prism cover testing in primary and lateral gazes");
      if (f.acute) {
        nextSteps.push("If acute: MRI brain with attention to cavernous sinus, petrous apex, skull base");
        nextSteps.push("LP if papilledema or signs of elevated ICP");
      }
      nextSteps.push("Check vascular risk factors; isolated CN VI in adults >50 with diabetes/HTN may be observed");
      nextSteps.push("If bilateral: evaluate for increased ICP, skull base pathology");
      nextSteps.push("Expected recovery 3-6 months if microvascular");
    }
    if (s > 0) add("CN VI (Abducens) palsy", s, why, nextSteps, "eom");
  }

  // 13. CN IV (Trochlear) palsy
  // Reference: Brazis PW. Isolated palsies of cranial nerves III, IV, and VI.
  // Vertical diplopia worse with downgaze, contralateral head tilt
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.diplopia && f.verticalLimitation === true) {
      s += 3;
      why.push("Diplopia + vertical limitation");
    }
    if (f.verticalLimitation === true && !f.abductionDeficit && !f.adductionDeficit) {
      s += 2;
      why.push("Isolated vertical deficit (consider CN IV)");
    }
    if (f.comitant === false) {
      s += 1;
      why.push("Incomitant deviation");
    }
    // Typically pupil sparing
    if (!largePattern && !smallPattern && f.verticalLimitation === true) {
      s += 1;
      why.push("Pupil sparing");
    }

    if (s > 0) {
      nextSteps.push("Three-step test: hypertropia worse with contralateral gaze and ipsilateral head tilt");
      nextSteps.push("Check for head tilt in old photographs (longstanding vs acquired)");
      nextSteps.push("Double Maddox rod test to assess torsion");
      if (f.trauma) {
        nextSteps.push("Trauma history: CN IV most susceptible to closed head injury");
      }
      nextSteps.push("MRI brain if no trauma history and no vascular risk factors");
    }
    if (s > 0) add("CN IV (Trochlear) palsy", s, why, nextSteps, "eom");
  }

  // 14. Myasthenia Gravis - Ocular
  // Reference: Kupersmith MJ. Ocular myasthenia gravis: treatment and prognosis.
  // Fatigable ptosis/diplopia, pupil always spared, Cogan lid twitch
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.fatigable) {
      s += 5;
      why.push("Fatigable weakness (hallmark of MG)");
    }
    if (f.ptosis && f.diplopia) {
      s += 3;
      why.push("Ptosis + diplopia combination");
    }
    else if (f.ptosis) {
      s += 2;
      why.push("Ptosis present");
    }
    else if (f.diplopia) {
      s += 2;
      why.push("Diplopia present");
    }
    // Pupil-sparing is mandatory for MG
    if ((f.ptosis || f.diplopia) && !largePattern && !smallPattern) {
      s += 2;
      why.push("Pupil-sparing pattern (required for MG diagnosis)");
    }
    // No RAPD in MG
    if (!f.hasRAPD && (f.ptosis || f.diplopia)) {
      s += 1;
      why.push("No RAPD (MG doesn't affect afferent pathway)");
    }
    // Variable/fluctuating pattern
    if (f.comitant === true && f.diplopia) {
      s += 1;
      why.push("Comitant strabismus (can mimic any pattern in MG)");
    }

    if (s > 0) {
      nextSteps.push("Sustained upgaze test: observe for ptosis worsening over 1-2 minutes");
      nextSteps.push("Ice pack test: improvement of ptosis after 2 minutes of ice");
      nextSteps.push("Cogan lid twitch: brief overshoot on return from downgaze");
      nextSteps.push("Serology: Anti-AChR antibodies (positive in ~50% ocular MG)");
      nextSteps.push("If seronegative: Anti-MuSK antibodies, repetitive nerve stimulation, single-fiber EMG");
      nextSteps.push("CT chest to evaluate for thymoma");
      nextSteps.push("Systemic MG develops in ~50% within 2 years; consider pyridostigmine trial");
    }
    if (s > 0) add("Myasthenia Gravis - Ocular", s, why, nextSteps, "eom");
  }

  // 15. Internuclear ophthalmoplegia (INO)
  // Reference: Frohman EM, et al. The medial longitudinal fasciculus in ocular motor physiology.
  // Adduction deficit with contralateral nystagmus; MS in young, stroke in elderly
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.adductionDeficit === true) {
      s += 4;
      why.push("Adduction deficit (key feature of INO)");
    }
    if (f.diplopia && f.adductionDeficit === true) {
      s += 2;
      why.push("Diplopia with adduction weakness");
    }
    // INO typically has preserved convergence (unlike CN III)
    if (f.adductionDeficit === true && !f.ptosis && !largePattern) {
      s += 2;
      why.push("No ptosis, pupil sparing (unlike CN III)");
    }
    if (f.neuroSx) {
      s += 1;
      why.push("Other neurological symptoms");
    }

    if (s >= 4) {
      nextSteps.push("Test convergence: typically preserved in INO (distinguishes from CN III)");
      nextSteps.push("Observe for abducting nystagmus in contralateral eye");
      nextSteps.push("MRI brain with attention to MLF in dorsal pons/midbrain");
      nextSteps.push("If young patient: evaluate for multiple sclerosis (LP, additional MRI)");
      nextSteps.push("If elderly: consider brainstem stroke");
      nextSteps.push("If bilateral (WEBINO): consider MS, stroke, Wernicke encephalopathy");
    }
    if (s >= 4) add("Internuclear Ophthalmoplegia (INO)", s, why, nextSteps, "eom");
  }

  // 16. Thyroid Eye Disease (Graves' ophthalmopathy)
  // Reference: Bartley GB, Gorman CA. Diagnostic criteria for Graves' ophthalmopathy.
  // Restrictive myopathy, inferior > medial > superior > lateral rectus involvement
  {
    let s = 0; const why = [];
    const nextSteps = [];

    // Vertical limitation common (IR restriction → limited upgaze)
    if (f.verticalLimitation === true) {
      s += 2;
      why.push("Vertical limitation (common in TED: IR restriction)");
    }
    if (f.diplopia) {
      s += 2;
      why.push("Diplopia (restrictive strabismus)");
    }
    if (f.painOnMovement) {
      s += 1;
      why.push("Pain on movement (active inflammation)");
    }
    // Typically comitant in gaze opposite to restriction
    // Lid retraction common but not captured in current model

    if (s >= 3) {
      nextSteps.push("Examine for lid retraction, lid lag, proptosis, chemosis");
      nextSteps.push("Check thyroid function tests (TSH, free T4, T3)");
      nextSteps.push("TSH receptor antibodies (TRAb) if clinical suspicion high");
      nextSteps.push("CT orbits (no contrast): enlarged EOMs with tendon sparing");
      nextSteps.push("Clinical Activity Score to assess inflammatory phase");
      nextSteps.push("Refer to oculoplastics/neuro-ophthalmology for management");
    }
    if (s >= 3) add("Thyroid Eye Disease", s, why, nextSteps, "eom");
  }

  // 17. Orbital inflammatory disease / Idiopathic orbital inflammation
  // Reference: Rootman J, Nugent R. The classification and management of acute orbital pseudotumors.
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.painOnMovement) {
      s += 4;
      why.push("Pain on eye movement");
    }
    if (f.diplopia && f.painOnMovement) {
      s += 2;
      why.push("Diplopia + pain combination");
    }
    if (f.painful) {
      s += 2;
      why.push("Orbital/periocular pain");
    }
    if (f.acute) {
      s += 1;
      why.push("Acute onset");
    }

    if (s > 0) {
      nextSteps.push("Examine for proptosis, chemosis, lid edema, conjunctival injection");
      nextSteps.push("CT orbits with contrast: diffuse or localized inflammation");
      nextSteps.push("MRI orbits with fat suppression for soft tissue detail");
      nextSteps.push("Labs: CBC, ESR, CRP, ANA, ANCA, ACE level");
      nextSteps.push("Consider biopsy if atypical features or poor response to steroids");
      nextSteps.push("Trial of systemic corticosteroids often diagnostic and therapeutic");
    }
    if (s > 0) add("Orbital inflammatory disease", s, why, nextSteps, "eom");
  }

  // 18. Cavernous sinus syndrome
  // Reference: Kline LB, Hoyt WF. The Tolosa-Hunt syndrome.
  // Multiple CN involvement (III, IV, V1, V2, VI), pupil may be involved
  {
    let s = 0; const why = [];
    const nextSteps = [];

    // Multiple cranial nerve involvement
    let cnCount = 0;
    if (f.abductionDeficit === true) cnCount++;
    if (f.adductionDeficit === true || f.verticalLimitation === true) cnCount++;
    if (f.ptosis) cnCount++;

    if (cnCount >= 2) {
      s += 4;
      why.push("Multiple cranial nerve involvement");
    }
    if (f.painful) {
      s += 2;
      why.push("Painful ophthalmoplegia");
    }
    if (largePattern || smallPattern) {
      s += 1;
      why.push("Pupil involvement (sympathetic or parasympathetic)");
    }
    if (f.neuroSx) {
      s += 1;
      why.push("Other neurological symptoms");
    }

    if (s >= 4) {
      nextSteps.push("MRI brain with contrast, thin cuts through cavernous sinus");
      nextSteps.push("MRA/CTA to evaluate carotid and cavernous sinus");
      nextSteps.push("Consider: tumor, infection, thrombosis, CCF, Tolosa-Hunt syndrome");
      nextSteps.push("If Tolosa-Hunt suspected: dramatic response to steroids expected");
      nextSteps.push("Check V1/V2 sensation (forehead, cheek numbness)");
    }
    if (s >= 4) add("Cavernous sinus syndrome", s, why, nextSteps, "eom");
  }

  // =====================================
  // VISUAL FIELD-BASED DIAGNOSES
  // =====================================

  // Reliability penalty
  const relPenalty = (f.vf_reliability === "poor") ? -2 : 0;
  const relNote = (f.vf_reliability === "poor") ? "Poor reliability reduces confidence" : null;

  // 19. Chiasmal compression (pituitary adenoma, craniopharyngioma, meningioma)
  // Reference: Foroozan R. Chiasmal syndromes. Curr Opin Ophthalmol 2003;14:325-331
  // Classic bitemporal hemianopia respecting vertical meridian
  {
    let s = 0; const why = [];

    if (f.vf_bitemporal) {
      s += 7;
      why.push("Bitemporal field pattern (classic chiasmal sign)");
    }
    if (f.vf_respects_vertical) {
      s += 2;
      why.push("Respects vertical meridian");
    }
    if (f.vf_laterality === "binocular") {
      s += 1;
      why.push("Binocular involvement");
    }
    if (f.vf_new_defect) {
      s += 1;
      why.push("New defect vs baseline");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) add("Chiasmal compression", s, why, [
      "MRI pituitary/sella with and without contrast (dedicated protocol)",
      "Pituitary hormone panel: prolactin, TSH, free T4, ACTH, cortisol, IGF-1, LH, FSH",
      "Formal visual field testing with reliable indices",
      "OCT RNFL to assess optic nerve damage",
      "Refer to neuro-ophthalmology and neurosurgery/endocrinology as appropriate"
    ], "vf");
  }

  // 20. Retrochiasmal lesion - Optic tract
  // Reference: Newman SA, Miller NR. Optic tract syndrome.
  // Incongruent homonymous hemianopia, contralateral RAPD, bow-tie atrophy
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.vf_homonymous) {
      s += 5;
      why.push("Homonymous pattern");
    }
    if (f.vf_congruity === "low") {
      s += 3;
      why.push("Low congruity (suggests optic tract)");
    }
    if (f.vf_respects_vertical) {
      s += 2;
      why.push("Respects vertical meridian");
    }
    // RAPD in optic tract lesion is contralateral to the side of the lesion
    if (f.hasRAPD && f.vf_homonymous) {
      s += 3;
      why.push("RAPD present (optic tract lesions produce contralateral RAPD - key distinguishing feature)");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("MRI brain with attention to optic tract");
      nextSteps.push("Look for bow-tie (band) atrophy on OCT/fundoscopy");
      if (f.acute) {
        nextSteps.push("If acute: consider stroke protocol");
      }
      nextSteps.push("Common etiologies: tumor, stroke, demyelination, trauma");
    }
    if (s > 0) add("Optic tract lesion", s, why, nextSteps, "vf");
  }

  // 21. Retrochiasmal lesion - Lateral geniculate nucleus (LGN)
  // Reference: Luco C, et al. Visual field defects from lesions of the lateral geniculate body.
  // Specific patterns: horizontal sectoranopia, wedge-shaped defects
  {
    let s = 0; const why = [];

    if (f.vf_homonymous) {
      s += 4;
      why.push("Homonymous pattern");
    }
    // LGN lesions can produce horizontal sectoranopia (wedge patterns)
    if (f.vf_respects_horizontal && f.vf_homonymous) {
      s += 3;
      why.push("Respects horizontal (suggests LGN sectoranopia)");
    }
    if (f.vf_congruity === "moderate") {
      s += 1;
      why.push("Moderate congruity");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s >= 5) add("Lateral geniculate nucleus (LGN) lesion", s, why, [
      "MRI brain with attention to thalamus/LGN",
      "Dual blood supply (anterior/posterior choroidal): can produce sector defects",
      "Consider stroke, tumor, demyelination",
      "Pattern: homonymous horizontal sectoranopia (wedge-shaped) is characteristic"
    ], "vf");
  }

  // 22. Retrochiasmal lesion - Optic radiations (temporal and parietal)
  // Reference: Zhang X, et al. Visual field defects of optic radiation lesions.
  // Temporal radiations: superior quadrantanopia ("pie in the sky")
  // Parietal radiations: inferior quadrantanopia
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.vf_homonymous) {
      s += 5;
      why.push("Homonymous pattern");
    }
    if (f.vf_respects_vertical) {
      s += 2;
      why.push("Respects vertical meridian");
    }
    if (f.vf_congruity === "moderate" || f.vf_congruity === "low") {
      s += 2;
      why.push(`${f.vf_congruity === "low" ? "Lower" : "Moderate"} congruity (anterior radiations)`);
    }
    // No RAPD in retrochiasmal lesions (beyond optic tract)
    if (!f.hasRAPD && f.vf_homonymous) {
      s += 1;
      why.push("No RAPD (lesion is retrochiasmal)");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("MRI brain with attention to temporal/parietal lobes");
      if (f.acute) {
        nextSteps.push("If acute: stroke protocol, check last known well time");
      }
      nextSteps.push("Superior quadrantanopia: temporal lobe (Meyer's loop)");
      nextSteps.push("Inferior quadrantanopia: parietal lobe");
      nextSteps.push("Common etiologies: stroke (MCA territory), tumor, demyelination");
    }
    if (s > 0) add("Optic radiation lesion", s, why, nextSteps, "vf");
  }

  // 23. Occipital cortex lesion
  // Reference: Gray LG, et al. Visual field defects after cerebral hemispherectomy.
  // High congruity, macular sparing possible (dual blood supply)
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.vf_homonymous) {
      s += 5;
      why.push("Homonymous pattern");
    }
    if (f.vf_congruity === "high") {
      s += 3;
      why.push("High congruity (characteristic of occipital cortex)");
    }
    if (f.vf_respects_vertical) {
      s += 2;
      why.push("Respects vertical meridian");
    }
    // No RAPD in occipital lesions
    if (!f.hasRAPD && f.vf_homonymous) {
      s += 1;
      why.push("No RAPD (retrochiasmal lesion)");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      if (f.acute) {
        nextSteps.push("URGENT: Stroke protocol - posterior circulation (PCA territory)");
        nextSteps.push("Check last known well time for thrombolysis/thrombectomy window");
      }
      nextSteps.push("MRI brain (DWI sequence if acute) with attention to occipital lobes");
      nextSteps.push("Macular sparing may occur (dual blood supply from MCA/PCA)");
      nextSteps.push("Complete homonymous hemianopia with macular sparing: occipital pole");
    }
    if (s > 0) add("Occipital cortex lesion", s, why, nextSteps, "vf");
  }

  // 24. Anterior Ischemic Optic Neuropathy (AION) - Arteritic (GCA)
  // Reference: Hayreh SS. Ischemic optic neuropathies. Prog Retin Eye Res 2009;28:34-62
  // Altitudinal defect, pallid disc edema, elevated ESR/CRP, jaw claudication
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.vf_altitudinal && f.vf_respects_horizontal) {
      s += 6;
      why.push("Altitudinal defect respecting horizontal meridian (classic AION)");
    } else if (f.vf_altitudinal) {
      s += 4;
      why.push("Altitudinal pattern");
    }
    if (f.vf_laterality === "mono") {
      s += 2;
      why.push("Monocular (unilateral optic nerve)");
    }
    if (f.hasRAPD) {
      s += 3;
      why.push("RAPD present (key finding in optic neuropathy)");
    }
    if (f.discEdema) {
      s += 2;
      why.push("Disc edema present");
    }
    if (f.painful) {
      s += 1;
      why.push("Headache/pain (consider GCA)");
    }
    if (f.acute) {
      s += 1;
      why.push("Acute onset");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("URGENT if age >50: ESR and CRP immediately (GCA screening)");
      nextSteps.push("Examine optic disc: pallid edema (arteritic) vs hyperemic edema (non-arteritic)");
      nextSteps.push("Ask about jaw claudication, scalp tenderness, polymyalgia symptoms");
      nextSteps.push("If GCA suspected: start high-dose IV methylprednisolone pending temporal artery biopsy");
      nextSteps.push("Temporal artery biopsy within 2 weeks (steroids don't mask pathology)");
      nextSteps.push("Assess fellow eye risk: very high in untreated GCA");
    }
    if (s > 0) add("Anterior Ischemic Optic Neuropathy (AION)", s, why, nextSteps, "vf");
  }

  // 25. Non-arteritic AION (NAION)
  // Reference: Hayreh SS. Non-arteritic anterior ischemic optic neuropathy.
  // Similar VF pattern but younger patients, disc at risk, no GCA symptoms
  {
    let s = 0; const why = [];

    if (f.vf_altitudinal) {
      s += 4;
      why.push("Altitudinal pattern");
    }
    if (f.vf_laterality === "mono") {
      s += 1;
      why.push("Monocular");
    }
    if (f.hasRAPD) {
      s += 3;
      why.push("RAPD present");
    }
    // If no pain and not elderly, more likely NAION
    if (!f.painful && f.vf_altitudinal) {
      s += 1;
      why.push("Painless (typical for NAION)");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s >= 5) add("Non-arteritic AION (NAION)", s, why, [
      "Examine disc: hyperemic edema, small cup ('disc at risk')",
      "ESR/CRP to exclude GCA (mandatory if age >50)",
      "Assess vascular risk factors: HTN, DM, hyperlipidemia, sleep apnea",
      "No proven treatment; optimize vascular risk factors",
      "Fellow eye risk ~15% over 5 years",
      "Avoid nocturnal hypotension, consider sleep study"
    ], "vf");
  }

  // 26. Optic neuritis
  // Reference: Optic Neuritis Treatment Trial (ONTT). Arch Ophthalmol 1991.
  // Central/cecocentral scotoma, pain on eye movement, RAPD, young adults
  {
    let s = 0; const why = [];
    const nextSteps = [];

    if (f.vf_central_scotoma) {
      s += 5;
      why.push("Central scotoma");
    }
    if (f.painOnMovement) {
      s += 4;
      why.push("Pain on eye movement (90% of optic neuritis)");
    }
    if (f.hasRAPD) {
      s += 3;
      why.push("RAPD present (hallmark of unilateral optic neuropathy)");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit (often disproportionate to VA)");
    }
    if (f.vf_laterality === "mono") {
      s += 1;
      why.push("Monocular (typically unilateral)");
    }
    if (f.vf_new_defect) {
      s += 1;
      why.push("New defect");
    }
    if (f.acute) {
      s += 1;
      why.push("Acute/subacute onset");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s > 0) {
      nextSteps.push("Check visual acuity, color vision (red cap desaturation, Ishihara), RAPD grade");
      nextSteps.push("MRI brain and orbits with contrast (fat suppression for orbits)");
      nextSteps.push("Disc may be normal (retrobulbar) or swollen (papillitis)");
      nextSteps.push("If MRI shows demyelinating lesions: discuss MS risk and treatment");
      nextSteps.push("ONTT: IV steroids speed recovery but don't change final outcome");
      nextSteps.push("Consider NMO-IgG (aquaporin-4), MOG antibodies if atypical features");
    }
    if (s > 0) add("Optic neuritis", s, why, nextSteps, "vf");
  }

  // 27. Macular disease (AMD, macular hole, CSR)
  // Reference: Distinguishing macular from optic nerve disease
  // Central scotoma without RAPD (unless severe), metamorphopsia
  {
    let s = 0; const why = [];

    if (f.vf_central_scotoma) {
      s += 4;
      why.push("Central scotoma");
    }
    if (f.vf_laterality === "mono") {
      s += 1;
      why.push("Monocular");
    }
    // No RAPD or minimal RAPD suggests macular rather than optic nerve
    if (f.vf_central_scotoma && !f.significantRAPD) {
      s += 3;
      why.push("No significant RAPD (strongly favors macular over optic nerve)");
    }
    // No pain
    if (!f.painOnMovement && f.vf_central_scotoma) {
      s += 1;
      why.push("Painless");
    }
    // No color deficit disproportionate to VA
    if (!f.colorDeficit && f.vf_central_scotoma) {
      s += 1;
      why.push("No color deficit (favors macular)");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s >= 5) add("Macular disease", s, why, [
      "Dilated fundus exam with attention to macula",
      "OCT macula: assess for AMD, macular hole, epiretinal membrane, CME",
      "Amsler grid: metamorphopsia suggests macular pathology",
      "Check for distortion, not just scotoma",
      "If RAPD present: consider combined or optic nerve pathology"
    ], "vf");
  }

  // 28. Glaucomatous optic neuropathy
  // Reference: Foster PJ, et al. The definition and classification of glaucoma.
  // Arcuate, nasal step, paracentral scotomas respecting horizontal
  {
    let s = 0; const why = [];

    // Arcuate defects and nasal steps respect horizontal meridian
    if (f.vf_respects_horizontal && f.vf_laterality === "mono") {
      s += 3;
      why.push("Respects horizontal meridian (nerve fiber layer pattern)");
    }
    if (f.vf_altitudinal && f.vf_laterality === "mono") {
      s += 2;
      why.push("Altitudinal/arcuate pattern");
    }
    if (f.cupping) {
      s += 3;
      why.push("Optic disc cupping noted");
    }
    // Usually no RAPD unless very asymmetric
    if (!f.acute && !f.painful) {
      s += 1;
      why.push("Chronic, painless");
    }
    if (relPenalty) { s += relPenalty; if (relNote) why.push(relNote); }

    if (s >= 4) add("Glaucomatous optic neuropathy", s, why, [
      "Check IOP, gonioscopy, optic nerve head evaluation",
      "OCT RNFL for structural correlation with VF defect",
      "Typical patterns: arcuate scotoma, nasal step, paracentral scotomas",
      "Progressive: compare to prior fields",
      "If diagnosis confirmed: IOP-lowering treatment"
    ], "vf");
  }

  // 29. Functional (non-organic) visual field loss
  // Reference: Bruce BB, Newman NJ. Functional visual loss.
  // Tubular fields, spiral pattern, inconsistent responses
  {
    let s = 0; const why = [];

    if (f.vf_reliability === "poor") {
      s += 2;
      why.push("Poor reliability");
    }
    // No anatomic pattern
    if (!f.vf_homonymous && !f.vf_bitemporal && !f.vf_altitudinal &&
        !f.vf_respects_vertical && !f.vf_respects_horizontal && f.vf_symptoms) {
      s += 2;
      why.push("No clear anatomic pattern");
    }
    if (f.vf_symptoms && !f.hasRAPD && !f.painOnMovement) {
      s += 1;
      why.push("Visual complaints without objective findings");
    }

    if (s >= 4) add("Functional visual field loss (consider)", s, why, [
      "Look for tubular fields (don't expand with distance)",
      "Spiral or star pattern on kinetic perimetry",
      "Inconsistency between VF and mobility/behavior",
      "Normal pupils, normal fundus",
      "This is a diagnosis of exclusion - rule out organic causes first",
      "Approach with empathy; may coexist with real pathology"
    ], "vf");
  }

  // =====================================
  // COMBINED/OVERLAPPING PATTERNS
  // =====================================

  // 30. Miller Fisher syndrome
  // Reference: Fisher M. An unusual variant of acute idiopathic polyneuritis.
  // Triad: ophthalmoplegia, ataxia, areflexia; anti-GQ1b antibodies
  {
    let s = 0; const why = [];

    if (f.diplopia) {
      s += 2;
      why.push("Diplopia/ophthalmoplegia");
    }
    // Multiple EOM involvement
    if ((f.abductionDeficit === true ? 1 : 0) +
        (f.adductionDeficit === true ? 1 : 0) +
        (f.verticalLimitation === true ? 1 : 0) >= 2) {
      s += 2;
      why.push("Multiple EOM involvement");
    }
    if (f.ptosis) {
      s += 1;
      why.push("Ptosis");
    }
    // Pupil involvement can occur
    if (largePattern || smallPattern) {
      s += 1;
      why.push("Pupil abnormality (can occur in MFS)");
    }
    if (f.neuroSx) {
      s += 2;
      why.push("Other neurological symptoms (ataxia?)");
    }

    if (s >= 5) add("Miller Fisher syndrome", s, why, [
      "Clinical triad: ophthalmoplegia, ataxia, areflexia",
      "Check deep tendon reflexes (typically absent)",
      "Anti-GQ1b antibodies (positive in >90%)",
      "Often preceded by respiratory/GI infection",
      "LP: albuminocytologic dissociation",
      "Usually self-limited; IVIG may speed recovery"
    ], "neuro");
  }

  // 31. Wernicke encephalopathy
  // Reference: Sechi G, Serra A. Wernicke's encephalopathy: new clinical settings and recent advances.
  // Triad: ophthalmoplegia (CN VI, gaze palsy), confusion, ataxia
  {
    let s = 0; const why = [];

    if (f.abductionDeficit === true) {
      s += 2;
      why.push("Abduction deficit (CN VI involvement common)");
    }
    if (f.diplopia) {
      s += 1;
      why.push("Diplopia");
    }
    // Nystagmus and gaze palsies common
    if (f.neuroSx) {
      s += 3;
      why.push("Neurological symptoms (confusion, ataxia)");
    }
    // Often pupil-sparing
    if (!largePattern && !smallPattern && f.abductionDeficit === true) {
      s += 1;
      why.push("Pupil-sparing");
    }

    if (s >= 5) add("Wernicke encephalopathy", s, why, [
      "Classic triad: ophthalmoplegia, confusion, ataxia (complete triad in <20%)",
      "Risk factors: alcoholism, malnutrition, bariatric surgery, hyperemesis",
      "URGENT: Thiamine 500mg IV TID before glucose administration",
      "MRI: T2/FLAIR hyperintensity in mammillary bodies, periaqueductal gray",
      "Prevent Korsakoff syndrome with prompt treatment"
    ], "neuro");
  }

  // =====================================
  // ORBITAL AND THYROID CONDITIONS
  // =====================================

  // 32. Thyroid Eye Disease (Graves' ophthalmopathy)
  // Reference: Bartalena L, et al. Consensus statement of the European Group on Graves' orbitopathy (EUGOGO).
  // Restrictive myopathy, proptosis, lid retraction, exposure keratopathy
  {
    let s = 0; const why = [];

    if (f.diplopia) {
      s += 2;
      why.push("Diplopia present");
    }
    // Restrictive pattern - typically affects IR first (limitation of upgaze)
    if (f.verticalLimitation === true) {
      s += 3;
      why.push("Vertical limitation (IR restriction causes upgaze limitation)");
    }
    // Comitant or near-comitant (restrictive, not neurogenic)
    if (f.comitant === true) {
      s += 2;
      why.push("Comitant deviation (suggests restrictive rather than neurogenic)");
    }
    if (f.painOnMovement) {
      s += 2;
      why.push("Pain on eye movement (active inflammatory phase)");
    }
    // Pupil-sparing
    if (!largePattern && !smallPattern && f.diplopia) {
      s += 1;
      why.push("Pupil-sparing");
    }
    // Ptosis is unusual (lid retraction more common, but can have pseudo-ptosis)
    if (f.ptosis) {
      s -= 1;
      why.push("Note: Ptosis unusual in TED (lid retraction typical)");
    }

    if (s >= 4) add("Thyroid Eye Disease (Graves')", s, why, [
      "Exam: proptosis (Hertel), lid retraction, lagophthalmos, conjunctival injection",
      "Check thyroid function: TSH, free T4, T3, TSH receptor antibodies",
      "CT orbits: enlarged extraocular muscles with tendon sparing",
      "Pattern: IR > MR > SR > LR (mnemonic: I'M SLow)",
      "Active vs inactive: CAS (Clinical Activity Score)",
      "Mild: lubricants, selenium; Moderate-severe: IV steroids, orbital radiation, surgery"
    ], "eom");
  }

  // 33. Orbital inflammatory disease (Idiopathic orbital inflammation / Orbital pseudotumor)
  // Reference: Yuen SJ, Rubin PA. Idiopathic orbital inflammation.
  // Painful ophthalmoplegia, proptosis, chemosis
  {
    let s = 0; const why = [];

    if (f.painOnMovement) {
      s += 4;
      why.push("Pain on eye movement (hallmark of orbital inflammation)");
    }
    if (f.painful) {
      s += 2;
      why.push("Pain/headache present");
    }
    if (f.diplopia) {
      s += 2;
      why.push("Diplopia (myositis component)");
    }
    if (f.acute) {
      s += 1;
      why.push("Acute onset");
    }
    // Can affect any EOM
    if ((f.abductionDeficit === true ? 1 : 0) +
        (f.adductionDeficit === true ? 1 : 0) +
        (f.verticalLimitation === true ? 1 : 0) >= 1) {
      s += 1;
      why.push("EOM limitation present");
    }

    if (s >= 5) add("Orbital inflammatory disease (pseudotumor)", s, why, [
      "Exam: proptosis, chemosis, injection, restricted motility, pain",
      "CT/MRI orbits with contrast: enhancing mass, may involve any orbital structure",
      "Subtypes: myositis, dacryoadenitis, diffuse, apical",
      "Dramatic response to corticosteroids (diagnostic and therapeutic)",
      "If poor steroid response: biopsy to exclude lymphoma, IgG4-related disease",
      "Rule out: thyroid eye disease, lymphoma, sarcoidosis, granulomatosis"
    ], "eom");
  }

  // 34. Cavernous sinus syndrome
  // Reference: Keane JR. Cavernous sinus syndrome.
  // Multiple cranial neuropathies (III, IV, VI, V1, V2), may have Horner
  {
    let s = 0; const why = [];

    // Multiple CN involvement
    const cnCount = (largePattern ? 1 : 0) + (f.ptosis ? 1 : 0) +
      (f.abductionDeficit === true ? 1 : 0) +
      (f.adductionDeficit === true ? 1 : 0) +
      (f.verticalLimitation === true ? 1 : 0);
    if (cnCount >= 2) {
      s += 4;
      why.push("Multiple cranial nerve involvement");
    }
    if (f.diplopia && f.ptosis) {
      s += 2;
      why.push("Diplopia + ptosis");
    }
    if (f.painful) {
      s += 2;
      why.push("Pain (V1/V2 involvement or mass effect)");
    }
    // Horner can occur (sympathetic fibers travel through cavernous sinus)
    if (smallPattern) {
      s += 2;
      why.push("Small pupil pattern (sympathetic involvement in cavernous sinus)");
    }
    if (f.acute) {
      s += 1;
      why.push("Acute onset");
    }

    if (s >= 5) add("Cavernous sinus syndrome", s, why, [
      "Structures in cavernous sinus: CN III, IV, VI, V1, V2, sympathetics, ICA",
      "MRI brain with attention to cavernous sinus, fat-saturated T1 with contrast",
      "Etiologies: tumor (meningioma, pituitary), infection, CCF, thrombosis, Tolosa-Hunt",
      "Check for proptosis, conjunctival injection (CCF), facial sensory loss (V1/V2)",
      "If infectious: emergent - can spread from sinusitis",
      "Tolosa-Hunt: painful ophthalmoplegia, responds to steroids"
    ], "neuro");
  }

  // 35. Orbital apex syndrome
  // Reference: Yeh S, Foroozan R. Orbital apex syndrome.
  // Cavernous sinus findings PLUS optic neuropathy
  {
    let s = 0; const why = [];

    // Optic nerve involvement differentiates from pure cavernous sinus
    if (f.hasRAPD) {
      s += 4;
      why.push("RAPD (optic nerve involvement - key feature)");
    }
    if (f.discPallor || f.discEdema) {
      s += 2;
      why.push("Disc changes (pallor or edema)");
    }
    if (f.colorDeficit || f.vaReduced) {
      s += 2;
      why.push("Visual function affected (color/VA)");
    }
    // Plus cavernous sinus features
    if (f.diplopia) {
      s += 2;
      why.push("Diplopia (EOM involvement)");
    }
    if (f.painful) {
      s += 2;
      why.push("Pain");
    }
    if (f.ptosis) {
      s += 1;
      why.push("Ptosis");
    }

    if (s >= 6) add("Orbital apex syndrome", s, why, [
      "Orbital apex = cavernous sinus syndrome + optic neuropathy",
      "CN II, III, IV, VI, V1 all affected",
      "MRI orbits and brain with contrast, fat suppression",
      "Etiologies: tumor, infection (mucormycosis in diabetics), inflammation",
      "If diabetic with sinusitis: consider mucormycosis (EMERGENT)",
      "Visual prognosis depends on prompt treatment"
    ], "neuro");
  }

  // =====================================
  // ADDITIONAL PUPIL CONDITIONS
  // =====================================

  // 36. Episodic unilateral mydriasis (benign)
  // Reference: Jacobson DM. Benign episodic unilateral mydriasis.
  // Intermittent dilated pupil, often with headache, no other deficits
  {
    let s = 0; const why = [];

    if (largePattern) {
      s += 2;
      why.push("Large pupil pattern");
    }
    // Typically reactive (unlike CN III or pharmacologic)
    if (!f.anyFixedPupil && largePattern) {
      s += 2;
      why.push("Pupil still reactive (distinguishes from fixed pathology)");
    }
    // No EOM involvement
    if (!f.diplopia && !f.ptosis && largePattern) {
      s += 3;
      why.push("No diplopia or ptosis (isolated pupil finding)");
    }
    // May have headache
    if (f.painful && largePattern && !f.ptosis && !f.diplopia) {
      s += 1;
      why.push("Headache present (common association)");
    }
    // No neuro symptoms
    if (!f.neuroSx && largePattern) {
      s += 1;
      why.push("No neurological symptoms");
    }

    if (s >= 6) add("Benign episodic unilateral mydriasis", s, why, [
      "Intermittent episodes of unilateral pupil dilation",
      "Pupil typically reactive during episodes",
      "Associated with migraine in many cases",
      "No ptosis, no diplopia, no other neurological signs",
      "Diagnosis of exclusion - rule out CN III pathology first",
      "Reassurance appropriate if workup negative"
    ], "pupil");
  }

  // 37. Tadpole pupil
  // Reference: Thompson HS, Zackon DH, Czarnecki JS. Tadpole-shaped pupils.
  // Segmental iris dilator spasm, association with Horner
  {
    let s = 0; const why = [];

    if (smallPattern || f.dilationLag) {
      s += 3;
      why.push("Small pupil pattern or dilation lag (associated Horner)");
    }
    // Typically intermittent
    if (!f.acute && (smallPattern || f.dilationLag)) {
      s += 1;
      why.push("Chronic/intermittent pattern");
    }

    if (s >= 3) add("Tadpole pupil (consider)", s, why, [
      "Segmental iris dilator muscle spasm causing peaked pupil",
      "Often associated with underlying Horner syndrome",
      "Transient distortion of pupil shape",
      "Check for signs of Horner: ptosis, anhidrosis, dilation lag",
      "If Horner confirmed: standard Horner workup indicated"
    ], "pupil");
  }

  // =====================================
  // ADDITIONAL EOM/MOTILITY CONDITIONS
  // =====================================

  // 38. Internuclear ophthalmoplegia (INO)
  // Reference: Keane JR. Internuclear ophthalmoplegia.
  // Adduction deficit with contralateral abducting nystagmus
  {
    let s = 0; const why = [];

    if (f.adductionDeficit === true) {
      s += 5;
      why.push("Adduction deficit (hallmark of INO)");
    }
    if (f.diplopia && f.adductionDeficit === true) {
      s += 2;
      why.push("Diplopia with adduction deficit");
    }
    // Ptosis absent
    if (!f.ptosis && f.adductionDeficit === true) {
      s += 2;
      why.push("No ptosis (distinguishes from CN III)");
    }
    // Pupil-sparing
    if (!largePattern && !smallPattern && f.adductionDeficit === true) {
      s += 2;
      why.push("Pupil-sparing (distinguishes from CN III)");
    }
    // Incomitant
    if (f.comitant === false && f.adductionDeficit === true) {
      s += 1;
      why.push("Incomitant deviation");
    }

    if (s >= 6) add("Internuclear ophthalmoplegia (INO)", s, why, [
      "Lesion in MLF (medial longitudinal fasciculus)",
      "Test convergence: typically preserved in INO (distinguishes from CN III)",
      "Look for contralateral abducting nystagmus",
      "Young patient: multiple sclerosis (bilateral INO common)",
      "Older patient: stroke (usually unilateral)",
      "MRI brain with attention to brainstem/MLF"
    ], "eom");
  }

  // 39. Duane retraction syndrome (Type I)
  // Reference: DeRespinis PA, et al. Duane's retraction syndrome.
  // Congenital, limited abduction, globe retraction on adduction
  {
    let s = 0; const why = [];

    if (f.abductionDeficit === true) {
      s += 4;
      why.push("Abduction deficit");
    }
    // Usually not acute
    if (!f.acute && f.abductionDeficit === true) {
      s += 2;
      why.push("Non-acute presentation (congenital)");
    }
    // No pain
    if (!f.painful && f.abductionDeficit === true) {
      s += 1;
      why.push("Painless");
    }
    // Pupil-sparing
    if (!largePattern && !smallPattern && f.abductionDeficit === true) {
      s += 1;
      why.push("Pupil-sparing");
    }
    // No diplopia in primary (often)
    if (!f.diplopia && f.abductionDeficit === true) {
      s += 1;
      why.push("No diplopia in primary gaze");
    }
    // Incomitant deviation typical
    if (f.comitant === false && f.abductionDeficit === true) {
      s += 1;
      why.push("Incomitant deviation");
    }

    if (s >= 6) add("Duane retraction syndrome Type I", s, why, [
      "Congenital CN VI aplasia with aberrant CN III innervation to LR",
      "Type I: limited abduction (most common)",
      "Globe retraction and palpebral fissure narrowing on adduction",
      "Usually unilateral (left > right), female predominance",
      "Face turn toward affected side to maintain binocularity",
      "No treatment needed if aligned in primary; surgery for large deviation"
    ], "eom");
  }

  // 40. Duane retraction syndrome (Type II)
  // Reference: DeRespinis PA, et al. Duane's retraction syndrome.
  // Congenital, limited adduction, globe retraction on adduction
  {
    let s = 0; const why = [];

    if (f.adductionDeficit === true) {
      s += 4;
      why.push("Adduction deficit");
    }
    // Usually not acute
    if (!f.acute && f.adductionDeficit === true) {
      s += 2;
      why.push("Non-acute presentation (congenital)");
    }
    // No pain
    if (!f.painful && f.adductionDeficit === true) {
      s += 1;
      why.push("Painless");
    }
    // Pupil-sparing
    if (!largePattern && !smallPattern && f.adductionDeficit === true) {
      s += 1;
      why.push("Pupil-sparing");
    }
    // No diplopia in primary (often)
    if (!f.diplopia && f.adductionDeficit === true) {
      s += 1;
      why.push("No diplopia in primary gaze");
    }
    // Incomitant deviation typical
    if (f.comitant === false && f.adductionDeficit === true) {
      s += 1;
      why.push("Incomitant deviation");
    }

    if (s >= 6) add("Duane retraction syndrome Type II", s, why, [
      "Congenital misinnervation of LR by CN III",
      "Type II: limited adduction (less common)",
      "Globe retraction and palpebral fissure narrowing on adduction",
      "Often esotropia in primary with paradoxical upshoot/downshoot",
      "Usually unilateral; face turn to maintain binocularity",
      "Surgery for significant primary position deviation"
    ], "eom");
  }

  // 41. Brown syndrome
  // Reference: Wright KW. Brown's syndrome: diagnosis and management.
  // Limited elevation in adduction
  {
    let s = 0; const why = [];

    if (f.verticalLimitation === true) {
      s += 3;
      why.push("Vertical limitation");
    }
    // Usually painless (unless inflammatory)
    if (!f.painful && f.verticalLimitation === true) {
      s += 1;
      why.push("Painless (congenital type)");
    }
    if (f.painOnMovement && f.verticalLimitation === true) {
      s += 2;
      why.push("Pain on movement (acquired/inflammatory type)");
    }
    // No ptosis, pupil-sparing
    if (!f.ptosis && f.verticalLimitation === true) {
      s += 1;
      why.push("No ptosis");
    }

    if (s >= 4) add("Brown syndrome (consider)", s, why, [
      "Restricted SO tendon: limited elevation in adduction",
      "Positive forced duction test",
      "Congenital: usually stable, observe if small",
      "Acquired: RA, trauma, sinus surgery, inflammation around trochlea",
      "Inflammatory: may respond to steroids or NSAIDs",
      "Surgery if significant hypotropia in primary gaze"
    ], "eom");
  }

  // 42. Ocular neuromyotonia
  // Reference: Yee RD, et al. Ocular neuromyotonia.
  // Episodic sustained EOM contraction, often after radiation
  {
    let s = 0; const why = [];

    if (f.diplopia) {
      s += 2;
      why.push("Diplopia present");
    }
    // Episodic/intermittent pattern suggested by non-constant symptoms
    if ((f.abductionDeficit === true || f.adductionDeficit === true || f.verticalLimitation === true)) {
      s += 2;
      why.push("EOM deficit present");
    }
    // No pain typically
    if (!f.painful && f.diplopia) {
      s += 1;
      why.push("Painless");
    }

    if (s >= 4) add("Ocular neuromyotonia (consider)", s, why, [
      "Episodic sustained contraction of EOM (spasm)",
      "Often history of parasellar radiation or skull base surgery",
      "Triggered by sustained gaze in direction of action of affected muscle",
      "Lasts seconds to minutes",
      "Treatment: carbamazepine or other membrane stabilizers",
      "MRI to evaluate prior treatment site"
    ], "eom");
  }

  // =====================================
  // ADDITIONAL OPTIC NERVE CONDITIONS
  // =====================================

  // 43. Papilledema (increased ICP)
  // Reference: Friedman DI, et al. Revised diagnostic criteria for pseudotumor cerebri syndrome.
  // Bilateral disc edema from elevated ICP
  {
    let s = 0; const why = [];

    if (f.discEdema) {
      s += 4;
      why.push("Disc edema present");
    }
    // Usually bilateral
    if (f.discEdemaOD && f.discEdemaOS) {
      s += 2;
      why.push("Bilateral disc edema");
    }
    // No RAPD initially (both eyes affected equally)
    if (!f.hasRAPD && f.discEdema) {
      s += 2;
      why.push("No RAPD (symmetric involvement)");
    }
    // Headache common
    if (f.painful && f.discEdema) {
      s += 2;
      why.push("Headache present");
    }
    // Transient visual obscurations (VF symptoms)
    if (f.vf_symptoms && f.discEdema) {
      s += 1;
      why.push("Visual symptoms");
    }

    if (s >= 5) add("Papilledema (elevated ICP)", s, why, [
      "Bilateral disc edema from increased intracranial pressure",
      "MRI brain + MRV to rule out mass, venous sinus thrombosis",
      "LP with opening pressure (after imaging rules out mass)",
      "IIH criteria: elevated OP >25cm H2O, normal CSF, no other cause",
      "IIH risk factors: obesity, young woman, vitamin A, tetracyclines",
      "Monitor visual fields - can cause progressive optic neuropathy",
      "Treatment: weight loss, acetazolamide, topiramate; shunt/ONSF if severe"
    ], "optic");
  }

  // 43. Anterior ischemic optic neuropathy - Non-arteritic (NAION) - already exists but enhance
  // 44. Leber hereditary optic neuropathy (LHON)
  // Reference: Yu-Wai-Man P, et al. Leber hereditary optic neuropathy.
  // Maternal inheritance, sequential bilateral painless vision loss, young males
  {
    let s = 0; const why = [];

    if (f.hasRAPD) {
      s += 2;
      why.push("RAPD present");
    }
    if (f.vf_central_scotoma) {
      s += 3;
      why.push("Central scotoma");
    }
    if (f.discEdema && !f.painful) {
      s += 2;
      why.push("Disc edema/hyperemia without pain");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit");
    }
    // Painless
    if (!f.painful && (f.hasRAPD || f.vf_central_scotoma || f.colorDeficit)) {
      s += 1;
      why.push("Painless (typical for LHON)");
    }

    if (s >= 5) add("Leber hereditary optic neuropathy (LHON)", s, why, [
      "Mitochondrial DNA mutations (most common: 11778, 3460, 14484)",
      "Typical: young male with painless sequential vision loss",
      "Exam: circumpapillary telangiectatic vessels, pseudoedema",
      "No disc leakage on FA (distinguishes from true papillitis)",
      "Maternal inheritance pattern - ask family history",
      "Genetic testing for mtDNA mutations",
      "Idebenone may help if started early; avoid smoking, alcohol"
    ], "optic");
  }

  // 45. Dominant optic atrophy (DOA / Kjer type)
  // Reference: Votruba M, et al. Clinical features of autosomal dominant optic atrophy.
  {
    let s = 0; const why = [];

    if (f.discPallor) {
      s += 3;
      why.push("Disc pallor (optic atrophy)");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit (blue-yellow axis typically)");
    }
    if (f.vf_central_scotoma) {
      s += 2;
      why.push("Central/cecocentral scotoma");
    }
    // Bilateral, symmetric
    if (f.discPallorOD && f.discPallorOS) {
      s += 2;
      why.push("Bilateral optic atrophy");
    }
    // Chronic, painless
    if (!f.acute && !f.painful && f.discPallor) {
      s += 1;
      why.push("Chronic, painless course");
    }

    if (s >= 5) add("Dominant optic atrophy (DOA)", s, why, [
      "OPA1 gene mutation (autosomal dominant)",
      "Onset typically in first decade, slowly progressive",
      "Temporal disc pallor, reduced VA (often 20/40-20/200)",
      "Blue-yellow color defects more than red-green",
      "Central or cecocentral scotomas",
      "Family history of vision loss (autosomal dominant)",
      "Genetic testing for OPA1 mutations",
      "No proven treatment; low vision rehabilitation"
    ], "optic");
  }

  // 46. Toxic/Nutritional optic neuropathy
  // Reference: Sharma P, Sharma R. Toxic optic neuropathy.
  {
    let s = 0; const why = [];

    if (f.vf_central_scotoma) {
      s += 3;
      why.push("Central/cecocentral scotoma");
    }
    if (f.colorDeficit) {
      s += 2;
      why.push("Color vision deficit");
    }
    if (f.discPallor) {
      s += 2;
      why.push("Disc pallor");
    }
    // Bilateral, symmetric
    if ((f.colorDeficitOD && f.colorDeficitOS) || (f.discPallorOD && f.discPallorOS)) {
      s += 2;
      why.push("Bilateral, symmetric involvement");
    }
    // Painless, subacute
    if (!f.painful) {
      s += 1;
      why.push("Painless");
    }

    if (s >= 5) add("Toxic/Nutritional optic neuropathy", s, why, [
      "Common toxins: ethambutol, methanol, ethylene glycol, linezolid",
      "Nutritional: B12, folate, thiamine, copper deficiency",
      "Tobacco-alcohol amblyopia (B12/folate related)",
      "Labs: B12, folate, MMA, homocysteine, CBC, copper, zinc",
      "Cecocentral scotoma typical (involves fixation and blind spot)",
      "Stop offending agent; replete deficiencies",
      "Recovery depends on duration and severity"
    ], "optic");
  }

  // 47. Optic disc drusen
  // Reference: Auw-Haedrich C, et al. Optic disk drusen.
  {
    let s = 0; const why = [];

    // VF defects without other concerning features
    if ((f.vf_altitudinal || f.vf_respects_horizontal) && !f.hasRAPD) {
      s += 3;
      why.push("Arcuate/altitudinal VF defect without RAPD");
    }
    // No RAPD despite VF loss (or minimal)
    if (!f.significantRAPD && (f.vf_altitudinal || f.vf_symptoms)) {
      s += 2;
      why.push("No significant RAPD despite VF changes");
    }
    // Chronic, stable, no pain
    if (!f.acute && !f.painful) {
      s += 1;
      why.push("Chronic, stable course");
    }
    // Disc appears elevated but not true edema
    if (!f.discEdema && !f.discPallor) {
      s += 1;
      why.push("No true disc edema or pallor");
    }

    if (s >= 4) add("Optic disc drusen", s, why, [
      "Calcified deposits in optic nerve head",
      "Can cause pseudopapilledema or be buried (not visible)",
      "VF defects: arcuate, enlarged blind spot, altitudinal",
      "B-scan ultrasound: highly reflective lesions with shadowing",
      "OCT: signal-poor core with hyperreflective margins (EDI-OCT)",
      "Autofluorescence: drusen autofluoresce",
      "Usually benign; monitor VF for rare progressive loss"
    ], "optic");
  }

  // =====================================
  // RETINAL CONDITIONS MIMICKING OPTIC NERVE
  // =====================================

  // 48. Central/Branch retinal artery occlusion
  // Reference: Hayreh SS. Acute retinal arterial occlusive disorders.
  {
    let s = 0; const why = [];

    if (f.hasRAPD) {
      s += 3;
      why.push("RAPD present");
    }
    if (f.acute) {
      s += 3;
      why.push("Acute onset");
    }
    if (f.vf_altitudinal && f.vf_laterality === "mono") {
      s += 2;
      why.push("Altitudinal or sectoral VF loss, monocular");
    }
    // Painless
    if (!f.painful && f.acute && f.hasRAPD) {
      s += 1;
      why.push("Painless (typical for CRAO)");
    }

    if (s >= 5) add("Retinal artery occlusion (CRAO/BRAO)", s, why, [
      "EMERGENT: Acute painless monocular vision loss",
      "Fundus: retinal whitening, cherry red spot (CRAO), cattle-trucking",
      "Time-sensitive: retinal tolerance ~90-120 minutes",
      "Acute CRAO: consider ocular massage, AC paracentesis, IOP lowering",
      "Workup: carotid imaging, echocardiogram, ESR (GCA if >50)",
      "GCA: must rule out if age >50 (ESR/CRP, temporal artery biopsy)",
      "Stroke workup indicated - embolic source evaluation"
    ], "vf");
  }

  // 49. Central/Branch retinal vein occlusion
  // Reference: The Central Vein Occlusion Study Group.
  {
    let s = 0; const why = [];

    if (f.hasRAPD && f.acute) {
      s += 3;
      why.push("RAPD with acute onset");
    }
    if (f.discEdema && f.vf_laterality === "mono") {
      s += 2;
      why.push("Disc edema, monocular");
    }
    if (f.vf_symptoms && f.vf_laterality === "mono") {
      s += 2;
      why.push("Visual symptoms, monocular");
    }
    // Usually painless
    if (!f.painful && f.acute) {
      s += 1;
      why.push("Painless");
    }

    if (s >= 5) add("Retinal vein occlusion (CRVO/BRVO)", s, why, [
      "Fundus: dilated tortuous veins, hemorrhages, cotton wool spots, disc edema",
      "CRVO: all quadrants; BRVO: distribution of affected vein",
      "Check for macular edema (OCT) - treat with anti-VEGF",
      "RAPD in ischemic CRVO indicates poor visual prognosis",
      "Monitor for neovascularization (NVI, NVE, NVG)",
      "Workup: HTN, DM, glaucoma, hypercoagulable states if young",
      "Refer retina for anti-VEGF and/or PRP if ischemic"
    ], "vf");
  }

  // 50. Acute zonal occult outer retinopathy (AZOOR)
  // Reference: Gass JD. Acute zonal occult outer retinopathy.
  {
    let s = 0; const why = [];

    if (f.vf_symptoms && f.vf_laterality === "mono") {
      s += 2;
      why.push("Visual symptoms, monocular");
    }
    // VF loss without proportionate fundus findings
    if ((f.vf_altitudinal || f.vf_respects_horizontal) && !f.hasRAPD) {
      s += 2;
      why.push("VF defect without significant RAPD");
    }
    // Photopsia common
    if (f.acute) {
      s += 1;
      why.push("Acute/subacute onset");
    }

    if (s >= 4) add("AZOOR (Acute zonal occult outer retinopathy)", s, why, [
      "White dot syndrome family - photoreceptor dysfunction",
      "Symptoms: photopsias, scotomas, visual field loss",
      "Fundus often normal or minimal changes initially",
      "ERG: reduced a-wave amplitude in affected zones",
      "FAF: hyper/hypo-autofluorescence in affected areas",
      "OCT: loss of ellipsoid zone (photoreceptor damage)",
      "Usually stabilizes; may have recurrences"
    ], "vf");
  }

  // =====================================
  // ADDITIONAL NEUROLOGICAL CONDITIONS
  // =====================================

  // 51. Parinaud syndrome (dorsal midbrain syndrome)
  // Reference: Keane JR. The pretectal syndrome.
  // Upgaze palsy, light-near dissociation, convergence-retraction nystagmus
  {
    let s = 0; const why = [];

    if (f.verticalLimitation === true) {
      s += 3;
      why.push("Vertical gaze limitation (upgaze palsy)");
    }
    if (f.lnd) {
      s += 4;
      why.push("Light-near dissociation");
    }
    // Pupils mid-dilated
    if (largePattern && f.lnd) {
      s += 2;
      why.push("Large pupils with LND (Parinaud pattern)");
    }
    if (f.neuroSx) {
      s += 1;
      why.push("Neurological symptoms");
    }

    if (s >= 5) add("Parinaud syndrome (dorsal midbrain)", s, why, [
      "Dorsal midbrain lesion at level of superior colliculus",
      "Classic findings: upgaze palsy, LND, lid retraction (Collier sign)",
      "Convergence-retraction nystagmus on attempted upgaze",
      "Etiologies: pineal tumor, stroke, MS, hydrocephalus",
      "MRI brain with attention to posterior commissure, pineal region",
      "If hydrocephalus: may need shunting"
    ], "neuro");
  }

  // 52. Progressive supranuclear palsy (PSP)
  // Reference: Litvan I, et al. Clinical research criteria for PSP.
  // Vertical gaze palsy, postural instability, parkinsonism
  {
    let s = 0; const why = [];

    if (f.verticalLimitation === true) {
      s += 3;
      why.push("Vertical gaze limitation (especially downgaze)");
    }
    // No pupil involvement
    if (!largePattern && !smallPattern && f.verticalLimitation === true) {
      s += 1;
      why.push("Pupil-sparing");
    }
    if (f.neuroSx) {
      s += 2;
      why.push("Neurological symptoms (postural instability, falls)");
    }
    // Chronic, progressive
    if (!f.acute && f.verticalLimitation === true) {
      s += 1;
      why.push("Chronic progressive course");
    }

    if (s >= 5) add("Progressive supranuclear palsy (PSP)", s, why, [
      "Neurodegenerative: tau protein accumulation",
      "Vertical gaze palsy (downgaze > upgaze initially)",
      "Square wave jerks, slowed saccades",
      "Postural instability with backward falls",
      "Pseudobulbar affect, dysarthria, dysphagia",
      "MRI: hummingbird sign (midbrain atrophy), Mickey Mouse sign",
      "Neurology referral; supportive care, fall prevention"
    ], "neuro");
  }

  // 53. Skew deviation
  // Reference: Brandt T, Dieterich M. Skew deviation.
  // Vertical misalignment from brainstem/cerebellar lesion
  {
    let s = 0; const why = [];

    if (f.verticalLimitation === true && f.diplopia) {
      s += 3;
      why.push("Vertical diplopia with vertical deviation");
    }
    // Comitant or near-comitant (unlike CN IV)
    if (f.comitant === true && f.diplopia) {
      s += 2;
      why.push("Comitant vertical deviation (unlike CN IV palsy)");
    }
    if (f.neuroSx) {
      s += 2;
      why.push("Neurological symptoms (brainstem/cerebellar)");
    }
    if (f.acute) {
      s += 2;
      why.push("Acute onset");
    }

    if (s >= 5) add("Skew deviation", s, why, [
      "Vertical misalignment from brainstem/cerebellar/vestibular lesion",
      "Comitant (same in all gazes) - unlike CN IV palsy",
      "Often part of ocular tilt reaction (head tilt, skew, torsion)",
      "Differentiating from CN IV: head tilt test opposite (skew opposite to CN IV)",
      "Associated with stroke, MS, or posterior fossa lesions",
      "MRI brain with attention to brainstem and cerebellum"
    ], "neuro");
  }

  // 54. Ocular myasthenia (expanded scoring)
  // This enhances the existing MG entry with more specific features
  // Already covered in #14, but ensure comprehensive coverage

  // 55. Chronic progressive external ophthalmoplegia (CPEO)
  // Reference: DiMauro S, et al. Mitochondrial myopathies.
  {
    let s = 0; const why = [];

    if (f.ptosis) {
      s += 3;
      why.push("Ptosis present");
    }
    if (f.diplopia || (f.abductionDeficit === true || f.adductionDeficit === true || f.verticalLimitation === true)) {
      s += 2;
      why.push("EOM limitation");
    }
    // Bilateral, symmetric
    if (f.ptosis && !f.fatigable) {
      s += 2;
      why.push("Non-fatigable (distinguishes from MG)");
    }
    // Chronic
    if (!f.acute && f.ptosis) {
      s += 2;
      why.push("Chronic progressive course");
    }
    // No pupil involvement
    if (!largePattern && !smallPattern && f.ptosis) {
      s += 1;
      why.push("Pupil-sparing");
    }

    if (s >= 6) add("Chronic progressive external ophthalmoplegia (CPEO)", s, why, [
      "Mitochondrial myopathy affecting EOM and levator",
      "Bilateral, symmetric ptosis and ophthalmoplegia",
      "Slowly progressive over years; often no diplopia (symmetric)",
      "May have orbicularis weakness, pigmentary retinopathy",
      "Kearns-Sayre: CPEO + pigmentary retinopathy + heart block + onset <20",
      "Genetic testing for mtDNA deletions",
      "Cardiac evaluation important (heart block in KSS)"
    ], "eom");
  }

  // Sort by score descending, return top matches
  dx.sort((a, b) => b.score - a.score);
  return dx.filter(d => d.score > 0).slice(0, 12);
}

export function compute(session) {
  const features = deriveFeatures(session);

  // Determine if we have enough data to show differentials
  const pupilReady = hasFullPupilDataset(session);
  const eomReady = hasEOMData(session);
  const vfReady = hasVFData(session);
  const opticNerveReady = hasOpticNerveData(session);

  // Compute differential if any module has meaningful data
  const differential = (pupilReady || eomReady || vfReady || opticNerveReady) ? scoreDifferential(features) : [];

  // Generate testing recommendations based on features and differential
  const testingRecommendations = generateTestingRecommendations(features, differential);

  // Unified global urgency banner
  let urgency = {
    level: "none",
    text: "Enter findings to build a live differential."
  };

  if (!pupilReady && !eomReady && !vfReady && !opticNerveReady) {
    urgency = {
      level: "none",
      text: "Enter clinical findings in any module to generate differential diagnoses."
    };
  }

  // Urgency hierarchy: critical > danger > warn > info > none

  // CRITICAL: Immediate life/vision threatening conditions
  // 1. Compressive CN III (PComm aneurysm)
  if (features.dominance === "light" && features.ptosis &&
    (features.acute || features.painful) && (features.diplopia || features.neuroSx)) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Pattern strongly suggests compressive CN III palsy. EMERGENT CTA/MRA head required to exclude posterior communicating artery aneurysm."
    };
  }
  // 2. Acute painful Horner (carotid dissection)
  else if (features.dominance === "dark" && (features.acute && features.painful) &&
    (features.dilationLag || features.ptosis || features.anhidrosis)) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Acute painful Horner syndrome. EMERGENT carotid imaging (CTA/MRA neck) required to exclude carotid artery dissection."
    };
  }
  // 3. Giant cell arteritis (AION pattern + elderly + symptoms)
  else if (features.vf_altitudinal && features.hasRAPD && features.painful && features.acute) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Acute painful AION with RAPD. If age >50, start empiric high-dose steroids and obtain STAT ESR/CRP. GCA can cause bilateral blindness within days."
    };
  }
  // 4. Traumatic optic neuropathy
  else if (features.trauma && features.hasRAPD && (features.discPallor || features.colorDeficit || features.vaReduced)) {
    urgency = {
      level: "critical",
      text: "CRITICAL: Traumatic optic neuropathy suspected. Document baseline VA, color vision, RAPD. Consider CT orbits/optic canals. Serial monitoring essential."
    };
  }

  // DANGER: High concern, urgent workup needed
  else if (features.dominance === "light" && (features.ptosis || features.diplopia) &&
    (features.acute || features.painful || features.neuroSx)) {
    urgency = {
      level: "danger",
      text: "High concern: Large pupil pattern with acute/painful presentation + ptosis/diplopia. Consider compressive CN III - imaging indicated."
    };
  }
  else if (features.vf_homonymous && features.acute) {
    urgency = {
      level: "danger",
      text: "URGENT: Acute homonymous visual field defect suggests stroke. Activate stroke protocol, establish last known well time."
    };
  }
  else if (features.hasRAPD && features.discPallor && !features.trauma) {
    urgency = {
      level: "danger",
      text: "RAPD with disc pallor indicates optic nerve damage. MRI brain/orbits recommended to evaluate for compressive or inflammatory etiology."
    };
  }

  // WARN: Elevated concern
  else if (features.dominance === "dark" && (features.dilationLag || features.ptosis || features.anhidrosis) &&
    (features.acute || features.painful || features.neuroSx)) {
    urgency = {
      level: "warn",
      text: "Elevated concern: Small pupil pattern with sympathetic signs in acute/painful setting. Consider Horner syndrome workup including vascular imaging."
    };
  }
  else if (features.fatigable && (features.ptosis || features.diplopia)) {
    urgency = {
      level: "warn",
      text: "Fatigable weakness pattern raises concern for myasthenia gravis. Recommend serology and consider pyridostigmine trial."
    };
  }
  else if (features.hasRAPD && !features.discPallor && !features.discEdema) {
    urgency = {
      level: "warn",
      text: "RAPD detected without visible disc changes. Consider retrobulbar optic neuropathy, optic tract lesion, or asymmetric retinal disease. Color vision and VF testing recommended."
    };
  }

  // INFO: Notable findings
  else if (features.vf_bitemporal && features.vf_reliability !== "poor") {
    urgency = {
      level: "info",
      text: "Bitemporal visual field pattern suggests chiasmal pathology. MRI pituitary/sella with contrast recommended."
    };
  }
  else if (features.vf_central_scotoma && features.painOnMovement) {
    urgency = {
      level: "info",
      text: "Central scotoma with pain on eye movement suggests optic neuritis. MRI brain/orbits with contrast recommended."
    };
  }
  else if (features.colorDeficit && features.hasRAPD) {
    urgency = {
      level: "info",
      text: "Color deficit with RAPD suggests optic neuropathy. Recommend formal VF testing and OCT RNFL."
    };
  }
  else if (features.acute || features.painful || features.neuroSx) {
    urgency = {
      level: "info",
      text: "Acute/painful/neurological context noted. Continue entering findings to refine localization."
    };
  }

  return { features, differential, urgency, testingRecommendations };
}
