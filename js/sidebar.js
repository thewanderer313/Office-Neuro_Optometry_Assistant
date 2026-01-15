// js/sidebar.js
import { sessionStore } from "./common.js";
import { compute, CONFIG } from "./engine.js";

const $ = (id) => document.getElementById(id);

function fmtMm(x) {
  if (x === null || x === undefined) return "—";
  return `${Number(x).toFixed(1)} mm`;
}

function getScoreTier(score) {
  if (score >= 8) return { label: "Strong match", tier: "strong" };
  if (score >= 5) return { label: "Consider", tier: "moderate" };
  return { label: "Less likely", tier: "low" };
}

function setCallout(level, text) {
  const el = $("sbUrgency");
  el.dataset.level = level;
  el.textContent = text;
}

function getCategoryBadge(category) {
  const badges = {
    pupil: '<span class="dx-category dx-category--pupil">Pupil</span>',
    eom: '<span class="dx-category dx-category--eom">EOM</span>',
    vf: '<span class="dx-category dx-category--vf">VF</span>',
    neuro: '<span class="dx-category dx-category--neuro">Neuro</span>',
    optic: '<span class="dx-category dx-category--optic">Optic</span>'
  };
  return badges[category] || '';
}

function renderDx(differential) {
  const wrap = $("sbDx");
  wrap.innerHTML = "";

  if (!differential.length) {
    wrap.innerHTML = `<div class="small">No scored differentials yet. Enter findings in any module.</div>`;
    return;
  }

  differential.slice(0, 5).forEach((d, idx) => {
    const tier = getScoreTier(d.score);
    const categoryBadge = getCategoryBadge(d.category);

    // Format "why" reasons with point values if available
    const why = (d.why && d.why.length)
      ? `<div class="dxWhy"><ul>${d.why.map(x => `<li>${x}</li>`).join("")}</ul></div>`
      : `<div class="dxWhy">No matched features listed.</div>`;

    // Format next steps if available
    const nextSteps = (d.nextSteps && d.nextSteps.length)
      ? `<div class="dxNextSteps"><div class="dxNextStepsLabel">Next steps:</div><ul>${d.nextSteps.map(x => `<li>${x}</li>`).join("")}</ul></div>`
      : "";

    const el = document.createElement("div");
    el.className = `dxItem dxItem--${tier.tier}`;
    el.innerHTML = `
      <div class="dxTop">
        <div class="dxName">${idx + 1}. ${d.name}${categoryBadge}</div>
        <div class="dxScore" data-tier="${tier.tier}">${tier.label}</div>
      </div>
      ${why}
      ${nextSteps}
    `;
    wrap.appendChild(el);
  });
}

function getPriorityIcon(priority) {
  switch (priority) {
    case "critical": return "🔴";
    case "high": return "🟠";
    case "moderate": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
  }
}

function getPriorityLabel(priority) {
  switch (priority) {
    case "critical": return "Critical";
    case "high": return "High Priority";
    case "moderate": return "Moderate";
    case "low": return "If Time Permits";
    default: return "";
  }
}

function renderTestingRecommendations(tests) {
  const wrap = $("sbTests");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!tests || !tests.length) {
    wrap.innerHTML = `<div class="small">Enter clinical findings to generate testing recommendations.</div>`;
    return;
  }

  // Group tests by priority
  const priorityOrder = ["critical", "high", "moderate", "low"];
  const grouped = {};
  priorityOrder.forEach(p => grouped[p] = []);

  tests.forEach(t => {
    if (grouped[t.priority]) {
      grouped[t.priority].push(t);
    }
  });

  priorityOrder.forEach(priority => {
    const group = grouped[priority];
    if (!group.length) return;

    const groupEl = document.createElement("div");
    groupEl.className = `test-group test-group--${priority}`;

    const headerEl = document.createElement("div");
    headerEl.className = "test-group-header";
    headerEl.innerHTML = `${getPriorityIcon(priority)} ${getPriorityLabel(priority)}`;
    groupEl.appendChild(headerEl);

    group.forEach(test => {
      const testEl = document.createElement("div");
      testEl.className = "test-item";

      const nameEl = document.createElement("div");
      nameEl.className = "test-name";
      nameEl.textContent = test.name;
      testEl.appendChild(nameEl);

      const rationaleEl = document.createElement("div");
      rationaleEl.className = "test-rationale";
      rationaleEl.textContent = test.rationale;
      testEl.appendChild(rationaleEl);

      if (test.technique) {
        const techEl = document.createElement("div");
        techEl.className = "test-technique";
        techEl.innerHTML = `<strong>Technique:</strong> ${test.technique}`;
        testEl.appendChild(techEl);
      }

      groupEl.appendChild(testEl);
    });

    wrap.appendChild(groupEl);
  });
}

function renderMeta(session, features) {
  $("sbPatient").textContent = session.meta.activePatientLabel || "Untitled";
  $("sbUpdated").textContent = `Updated: ${new Date(session.meta.updatedAt).toLocaleString()}`;

  $("sbAnisL").textContent = fmtMm(features.anisL);
  $("sbAnisD").textContent = fmtMm(features.anisD);

  const dom =
    features.dominance === "light" ? `Light-dominant (≥${CONFIG.ANISO_THRESHOLD_MM} mm)` :
      features.dominance === "dark" ? `Dark-dominant (≥${CONFIG.ANISO_THRESHOLD_MM} mm)` :
        features.dominance === "equal" ? `Equal in light/dark (≥${CONFIG.ANISO_THRESHOLD_MM} mm)` :
          `Not called (<${CONFIG.ANISO_THRESHOLD_MM} mm or missing)`;

  $("sbPattern").textContent = dom;
}

export function initSidebar(activePageHref) {
  // Mark active nav link
  document.querySelectorAll(".tabbarInner a").forEach(a => {
    if (a.getAttribute("href") === activePageHref) a.classList.add("active");
  });


  // Reset button
  $("sbReset").addEventListener("click", () => sessionStore.reset());

  // Initial render
  const session = sessionStore.getSession();
  const { features, differential, urgency, testingRecommendations } = compute(session);
  renderMeta(session, features);
  setCallout(urgency.level, urgency.text);
  renderDx(differential);
  renderTestingRecommendations(testingRecommendations);

  // Subscribe to updates from any module
  sessionStore.subscribe((s) => {
    const out = compute(s);
    renderMeta(s, out.features);
    setCallout(out.urgency.level, out.urgency.text);
    renderDx(out.differential);
    renderTestingRecommendations(out.testingRecommendations);
  });
}
