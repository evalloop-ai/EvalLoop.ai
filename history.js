(() => {
  "use strict";

  const SUPABASE_URL = "https://vonknmobshxkhbewdoie.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_J_eboKnioENyrRqnp8uTkg_5I9rrE8t";
  const $ = (id) => document.getElementById(id);
  const state = { client: null, runs: [], filter: "all", search: "", chart: null };

  $("year").textContent = new Date().getFullYear();

  function initSupabase() {
    if (!window.supabase?.createClient) throw new Error("Supabase client failed to load. Refresh the page and try again.");
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function getRunArray(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["runs", "evaluations", "history", "items", "data", "results"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    if (Array.isArray(payload?.data?.runs)) return payload.data.runs;
    if (Array.isArray(payload?.data?.evaluations)) return payload.data.evaluations;
    return [];
  }

  async function fetchHistory(session) {
    const response = await fetch("/api/history", {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw new Error("Your session expired. Please log in again.");
    if (!response.ok) throw new Error(payload.error || payload.message || `History request failed (${response.status}).`);
    const runs = getRunArray(payload);
    if (!runs.length && payload && !Array.isArray(payload) &&
        !["runs","evaluations","history","items","data","results"].some(k => Array.isArray(payload[k]))) {
      if (payload.error) throw new Error(payload.error);
      throw new Error("The history API returned an unexpected response. Check that GET /api/history returns the user's saved runs.");
    }
    return runs.map(normalizeRun);
  }

  function normalizeRun(raw) {
    const row = raw?.evaluation || raw?.run || raw;
    let result = row?.result ?? row?.result_json ?? row?.evaluation_result ?? {};
    if (typeof result === "string") {
      try { result = JSON.parse(result); } catch { result = { raw_result: result }; }
    }
    return {
      ...row,
      id: row?.id || row?.evaluation_id || raw?.id || "",
      evaluation_type: normalizeType(row?.evaluation_type || row?.type || row?.kind),
      prompt: row?.prompt || row?.input_prompt || "",
      response: row?.response || "",
      response_a: row?.response_a || "",
      response_b: row?.response_b || "",
      reference_context: row?.reference_context || row?.reference || "",
      result: result && typeof result === "object" ? result : {},
      model_used: row?.model_used || row?.model || "—",
      created_at: row?.created_at || row?.createdAt || row?.timestamp || null
    };
  }

  function normalizeType(value) {
    const type = String(value || "").toLowerCase();
    if (type.includes("compar") || type === "pairwise") return "compare";
    if (type.includes("safety")) return "safety";
    return "general";
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const n = numberOrNull(value);
      if (n !== null) return n;
    }
    return null;
  }

  function overallScore(run) {
    const r = run.result || {};
    return firstNumber(r.overall_score, r.overallScore, r.overall_quality_score, r.quality_score, r.score, r.scores?.overall);
  }

  function safetyScore(run) {
    const r = run.result || {};
    return firstNumber(r.safety_score, r.safetyScore, r.scores?.safety, r.dimensions?.safety?.score,
      run.evaluation_type === "safety" ? r.overall_score : null,
      run.evaluation_type === "safety" ? r.score : null);
  }

  function dimensionScore(run, key) {
    const r = run.result || {};
    return firstNumber(r.scores?.[key], r.dimensions?.[key]?.score, r.dimension_scores?.[key],
      r[key], r.scores?.[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]);
  }

  function average(values) {
    const valid = values.filter(v => v !== null && Number.isFinite(v));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  }

  function formatScore(value) { return value === null ? "—" : `${Math.round(value)} / 100`; }
  function formatDate(value, includeTime = true) {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, includeTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric" }).format(date);
  }
  function safeText(value, fallback = "—") {
    if (value === null || value === undefined || String(value).trim() === "") return fallback;
    return String(value);
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }
  function titleCaseType(type) {
    return type === "compare" ? "Compare" : type === "safety" ? "Safety" : "General";
  }

  function resultLabel(run) {
    const r = run.result || {};
    if (run.evaluation_type === "compare") {
      const winner = r.winner || r.overall_winner || r.winning_response || r.result?.winner;
      if (winner) return String(winner);
      const score = overallScore(run);
      return score === null ? "Comparison complete" : formatScore(score);
    }
    if (run.evaluation_type === "safety") {
      const verdict = r.verdict || r.safety_verdict || r.classification || r.decision || r.label;
      if (verdict) return String(verdict);
      const score = safetyScore(run);
      return score === null ? "Safety check complete" : `Safety ${Math.round(score)}/100`;
    }
    const score = overallScore(run);
    return score === null ? "Evaluation complete" : formatScore(score);
  }

  function renderKPIs() {
    const runs = state.runs;
    const general = runs.filter(r => r.evaluation_type === "general");
    const compares = runs.filter(r => r.evaluation_type === "compare");
    const safety = runs.filter(r => r.evaluation_type === "safety");
    $("kpiTotal").textContent = runs.length;
    $("kpiGeneral").textContent = general.length;
    $("kpiCompare").textContent = compares.length;
    $("kpiSafety").textContent = safety.length;
    $("kpiQuality").textContent = formatScore(average(runs.map(overallScore)));
    $("kpiSafetyScore").textContent = formatScore(average(runs.map(safetyScore)));
  }

  function renderTrend() {
    const points = state.runs
      .map(run => ({ date: run.created_at, score: overallScore(run) }))
      .filter(point => point.date && point.score !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const showEmpty = points.length < 2;
    $("trendEmpty").hidden = !showEmpty;
    $("trendChartWrap").hidden = showEmpty;
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    if (showEmpty || !window.Chart) return;

    const ctx = $("qualityTrend").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(62,207,142,0.22)");
    gradient.addColorStop(1, "rgba(62,207,142,0.00)");
    state.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map(point => formatDate(point.date, false)),
        datasets: [{
          label: "Overall score",
          data: points.map(point => point.score),
          borderColor: "#3ecf8e",
          backgroundColor: gradient,
          fill: true,
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#85e7ba"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: context => ` ${Math.round(context.parsed.y)} / 100` } }
        },
        scales: {
          x: { grid: { color: "rgba(241,241,239,0.06)" }, ticks: { color: "#a4aaa6", maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
          y: { min: 0, max: 100, grid: { color: "rgba(241,241,239,0.08)" }, ticks: { color: "#a4aaa6", stepSize: 20 } }
        }
      }
    });
  }

  const DIMENSIONS = [
    ["factuality", "Factuality"],
    ["relevance", "Relevance"],
    ["instruction_following", "Instruction Following"],
    ["completeness", "Completeness"],
    ["safety", "Safety"],
    ["fluency", "Fluency"]
  ];

  function renderDimensions() {
    const general = state.runs.filter(run => run.evaluation_type === "general");
    const root = $("dimensionsList");
    root.replaceChildren();
    const dimensionValues = DIMENSIONS.map(([key, label]) => ({
      key, label, value: average(general.map(run => dimensionScore(run, key)))
    }));
    const hasAny = dimensionValues.some(item => item.value !== null);
    $("dimensionsEmpty").hidden = hasAny;
    root.hidden = !hasAny;
    if (!hasAny) return;
    dimensionValues.forEach(({ label, value }) => {
      const row = document.createElement("div");
      row.className = "dimension-row";
      const top = document.createElement("div");
      top.className = "dimension-top";
      const name = document.createElement("span");
      name.textContent = label;
      const number = document.createElement("span");
      number.className = "dimension-value";
      number.textContent = value === null ? "—" : `${Math.round(value)} / 100`;
      top.append(name, number);
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${value === null ? 0 : value}%`;
      track.append(fill);
      row.append(top, track);
      root.append(row);
    });
  }

  function getFilteredRuns() {
    return state.runs.filter(run => {
      const filterMatches = state.filter === "all" || run.evaluation_type === state.filter;
      const searchMatches = !state.search || `${run.prompt} ${run.response} ${run.response_a} ${run.response_b}`
        .toLowerCase().includes(state.search);
      return filterMatches && searchMatches;
    });
  }

  function renderHistory() {
    const runs = getFilteredRuns();
    const tbody = $("historyRows");
    tbody.replaceChildren();
    $("historyCount").textContent = `${runs.length} ${runs.length === 1 ? "evaluation" : "evaluations"}`;
    $("historyEmpty").hidden = runs.length !== 0;
    runs.forEach(run => {
      const tr = document.createElement("tr");
      const date = document.createElement("td");
      date.className = "date-cell";
      date.textContent = formatDate(run.created_at);
      const type = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `type-pill ${run.evaluation_type}`;
      pill.textContent = titleCaseType(run.evaluation_type);
      type.append(pill);
      const prompt = document.createElement("td");
      prompt.className = "prompt-cell";
      prompt.title = run.prompt || "";
      prompt.textContent = run.prompt ? run.prompt.replace(/\s+/g, " ").slice(0, 180) : "(No prompt saved)";
      const result = document.createElement("td");
      result.className = "result-cell";
      result.textContent = resultLabel(run);
      if (result.textContent === "Evaluation complete" || result.textContent === "Comparison complete" || result.textContent === "Safety check complete") result.classList.add("result-muted");
      const action = document.createElement("td");
      const open = document.createElement("button");
      open.className = "open-button";
      open.type = "button";
      open.textContent = "View result ↗";
      open.addEventListener("click", () => openDetails(run));
      action.append(open);
      tr.append(date, type, prompt, result, action);
      tbody.append(tr);
    });
  }

  function addDetailBlock(title, content, isHTML = false) {
    const section = document.createElement("section");
    section.className = "detail-block";
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.append(heading);
    if (isHTML) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = content;
      section.append(wrapper);
    } else {
      const p = document.createElement("p");
      p.textContent = content;
      section.append(p);
    }
    $("detailBody").append(section);
  }

  function resultSummaryHTML(run) {
    const r = run.result || {};
    const scorePairs = [
      ["Overall", overallScore(run)],
      ["Factuality", dimensionScore(run, "factuality")],
      ["Relevance", dimensionScore(run, "relevance")],
      ["Instruction Following", dimensionScore(run, "instruction_following")],
      ["Completeness", dimensionScore(run, "completeness")],
      ["Safety", safetyScore(run)],
      ["Fluency", dimensionScore(run, "fluency")]
    ].filter(([, score]) => score !== null);
    let html = "";
    if (scorePairs.length) {
      html += '<div class="score-grid">';
      for (const [label, score] of scorePairs) html += `<div class="score-chip"><span>${escapeHTML(label)}</span><strong>${Math.round(score)}/100</strong></div>`;
      html += "</div>";
    }
    return html;
  }

  function renderResultObject(value) {
    const root = document.createElement("pre");
    root.className = "json-view";
    try { root.textContent = JSON.stringify(value, null, 2); }
    catch { root.textContent = String(value); }
    return root;
  }

  function openDetails(run) {
    $("detailTitle").textContent = `${titleCaseType(run.evaluation_type)} evaluation`;
    $("detailMeta").replaceChildren();
    [
      formatDate(run.created_at),
      `Model: ${safeText(run.model_used)}`,
      `Result: ${resultLabel(run)}`
    ].forEach(value => {
      const tag = document.createElement("span");
      tag.textContent = value;
      $("detailMeta").append(tag);
    });
    $("detailBody").replaceChildren();
    if (run.prompt) addDetailBlock("Prompt", run.prompt);
    if (run.evaluation_type === "compare") {
      if (run.response_a) addDetailBlock("Response A", run.response_a);
      if (run.response_b) addDetailBlock("Response B", run.response_b);
    } else if (run.response) {
      addDetailBlock("Response", run.response);
    }
    if (run.reference_context) addDetailBlock("Reference / context", run.reference_context);

    const scoreHTML = resultSummaryHTML(run);
    if (scoreHTML) addDetailBlock("Scores", scoreHTML, true);

    const r = run.result || {};
    if (r.summary) addDetailBlock("Summary", String(r.summary));
    if (r.verdict || r.safety_verdict || r.classification) addDetailBlock("Safety verdict", String(r.verdict || r.safety_verdict || r.classification));
    if (r.winner || r.overall_winner || r.winning_response) addDetailBlock("Comparison winner", String(r.winner || r.overall_winner || r.winning_response));
    if (r.recommendation) addDetailBlock("Recommendation", String(r.recommendation));
    if (Array.isArray(r.issues) && r.issues.length) addDetailBlock("Issues", r.issues.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n"));
    addDetailBlock("Full saved result", "");
    const last = $("detailBody").lastElementChild;
    last.querySelector("p")?.remove();
    last.append(renderResultObject(r));

    const dialog = $("detailDialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderAll() {
    renderKPIs();
    renderTrend();
    renderDimensions();
    renderHistory();
  }

  function showError(message) {
    $("errorNotice").textContent = message;
    $("errorNotice").hidden = false;
  }
  function clearError() {
    $("errorNotice").textContent = "";
    $("errorNotice").hidden = true;
  }

  async function loadPage() {
    clearError();
    $("loadingNotice").hidden = false;
    $("insightsContent").hidden = true;
    try {
      const { data: { session }, error } = await state.client.auth.getSession();
      if (error) throw error;
      setHeaderAuth(session);
      if (!session) {
        $("authStatus").textContent = "Signed out";
        $("loginGate").hidden = false;
        $("historyApp").hidden = true;
        $("loadingNotice").hidden = true;
        return;
      }
      $("authStatus").textContent = "Signed in";
      $("loginGate").hidden = true;
      $("historyApp").hidden = false;
      state.runs = await fetchHistory(session);
      renderAll();
      $("insightsContent").hidden = false;
    } catch (error) {
      $("loginGate").hidden = true;
      $("historyApp").hidden = false;
      $("insightsContent").hidden = true;
      showError(error?.message || "Unable to load your saved evaluations.");
    } finally {
      $("loadingNotice").hidden = true;
    }
  }

  function setHeaderAuth(session) {
    const user = session?.user;
    const loggedIn = Boolean(user);
    ["authLoggedOut", "mobileAuthLoggedOut"].forEach(id => { if ($(id)) $(id).hidden = loggedIn; });
    ["authLoggedIn", "mobileAuthLoggedIn"].forEach(id => { if ($(id)) $(id).hidden = !loggedIn; });
    if (!loggedIn) return;
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || meta.display_name || (user.email || "Account").split("@")[0];
    const initials = name.split(/\\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "U";
    ["profileAvatar", "profileMenuAvatar", "mobileProfileAvatar"].forEach(id => { if ($(id)) $(id).textContent = initials; });
    ["profileName", "profileMenuName", "mobileProfileName"].forEach(id => { if ($(id)) $(id).textContent = name; });
    ["profileMenuEmail", "mobileProfileEmail"].forEach(id => { if ($(id)) $(id).textContent = user.email || ""; });
  }

  function wireEvents() {
    $("refreshButton").addEventListener("click", loadPage);
    $("filterGroup").addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      renderHistory();
    });
    $("historySearch").addEventListener("input", event => {
      state.search = event.target.value.trim().toLowerCase();
      renderHistory();
    });
    const mobileMenuButton = $("mobileMenuButton");
    const mobileNav = $("mobileNav");
    if (mobileMenuButton && mobileNav) {
      mobileMenuButton.addEventListener("click", () => {
        const open = mobileMenuButton.classList.toggle("active");
        mobileNav.classList.toggle("active", open);
        mobileMenuButton.setAttribute("aria-expanded", String(open));
        document.body.classList.toggle("menu-open", open);
      });
      mobileNav.querySelectorAll(".mobile-nav-dropdown-trigger").forEach(trigger => {
        trigger.addEventListener("click", () => {
          const open = trigger.getAttribute("aria-expanded") === "true";
          trigger.setAttribute("aria-expanded", String(!open));
          trigger.nextElementSibling?.classList.toggle("is-open", !open);
        });
      });
      mobileNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
        mobileMenuButton.classList.remove("active");
        mobileNav.classList.remove("active");
        mobileMenuButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");
      }));
    }
    const profileTrigger = $("profileTrigger");
    const profileMenu = $("profileMenu");
    if (profileTrigger && profileMenu) {
      profileTrigger.addEventListener("click", event => {
        event.stopPropagation();
        const open = profileMenu.getAttribute("aria-hidden") === "false";
        profileMenu.setAttribute("aria-hidden", String(open));
        profileTrigger.setAttribute("aria-expanded", String(!open));
      });
      document.addEventListener("click", event => {
        if (!profileMenu.contains(event.target) && !profileTrigger.contains(event.target)) {
          profileMenu.setAttribute("aria-hidden", "true");
          profileTrigger.setAttribute("aria-expanded", "false");
        }
      });
    }
    async function logout() {
      const buttons = [$("profileLogout"), $("mobileProfileLogout")].filter(Boolean);
      buttons.forEach(button => { button.disabled = true; button.textContent = "Signing out..."; });
      const { error } = await state.client.auth.signOut();
      if (error) {
        buttons.forEach(button => { button.disabled = false; button.textContent = "Sign out"; });
        showError(error.message || "Could not sign out.");
        return;
      }
      window.location.href = "/login/";
    }
    [$("profileLogout"), $("mobileProfileLogout")].filter(Boolean).forEach(button => button.addEventListener("click", logout));

    $("closeDialog").addEventListener("click", () => $("detailDialog").close());
    $("detailDialog").addEventListener("click", event => {
      if (event.target === $("detailDialog")) $("detailDialog").close();
    });
    state.client.auth.onAuthStateChange((event, session) => {
      setHeaderAuth(session);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (!session) {
          $("loginGate").hidden = false;
          $("historyApp").hidden = true;
          $("authStatus").textContent = "Signed out";
        } else {
          loadPage();
        }
      }
    });
  }

  try {
    initSupabase();
    wireEvents();
    loadPage();
  } catch (error) {
    // Keep the page from becoming visually empty when initialization fails.
    const loginGate = $("loginGate");
    const historyApp = $("historyApp");
    const loadingNotice = $("loadingNotice");
    if (loginGate) loginGate.hidden = true;
    if (historyApp) historyApp.hidden = false;
    if (loadingNotice) loadingNotice.hidden = true;
    const insightsContent = $("insightsContent");
    if (insightsContent) insightsContent.hidden = true;
    showError(error.message || "Could not initialize the History page.");
  }
})();
