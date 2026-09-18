(() => {
  "use strict";

  const config = window.TEXT_HIM_CONFIG || {};
  const apiBase = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const payhipUrl = config.payhipUrl || "https://payhip.com/PierreCUSinger";
  const contactEmail = config.contactEmail || "contact@texthimornot.com";
  const storageKeys = {
    token: "textHimAccessToken",
    progress: "textHimToolProgress"
  };

  const elements = {
    gate: document.querySelector("#access-gate"),
    form: document.querySelector("#license-form"),
    licenseInput: document.querySelector("#license-key"),
    gateStatus: document.querySelector("#gate-status"),
    tool: document.querySelector("#guided-tool"),
    stageLabel: document.querySelector("#stage-label"),
    questionCard: document.querySelector("#question-card"),
    progressLabel: document.querySelector("#progress-label"),
    progressPercent: document.querySelector("#progress-percent"),
    progress: document.querySelector(".tool-progress"),
    progressBar: document.querySelector("#progress-bar"),
    back: document.querySelector("#back-button"),
    next: document.querySelector("#next-button"),
    saveExit: document.querySelector("#save-exit"),
    result: document.querySelector("#result-view"),
    resultTitle: document.querySelector("#result-title"),
    resultSummary: document.querySelector("#result-summary"),
    resultReasons: document.querySelector("#result-reasons"),
    timing: document.querySelector("#timing-copy"),
    plan: document.querySelector("#result-plan"),
    templateSection: document.querySelector("#template-section"),
    templateHeading: document.querySelector("#template-heading"),
    template: document.querySelector("#message-template"),
    templateNote: document.querySelector("#template-note"),
    copyTemplate: document.querySelector("#copy-template"),
    reflectionSummary: document.querySelector("#reflection-summary"),
    reflectionList: document.querySelector("#reflection-list"),
    boundary: document.querySelector("#result-boundary"),
    print: document.querySelector("#print-result"),
    restart: document.querySelector("#restart-tool")
  };

  let content = null;
  let currentIndex = 0;
  let answers = {};
  let reflections = {};
  let activeOutcome = null;

  document.querySelectorAll("[data-payhip-link]").forEach((link) => {
    link.href = payhipUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  document.querySelectorAll("[data-contact-link]").forEach((link) => {
    link.href = `mailto:${contactEmail}`;
  });

  restoreProgress();

  elements.form?.addEventListener("submit", handleLicenseSubmit);
  elements.back?.addEventListener("click", goBack);
  elements.next?.addEventListener("click", goNext);
  elements.saveExit?.addEventListener("click", saveAndExit);
  elements.copyTemplate?.addEventListener("click", copyCurrentTemplate);
  elements.print?.addEventListener("click", () => window.print());
  elements.restart?.addEventListener("click", restartTool);

  const existingToken = sessionStorage.getItem(storageKeys.token);
  if (existingToken && apiBase) {
    setGateStatus("Restoring your private session…");
    loadProtectedContent(existingToken).catch(() => {
      sessionStorage.removeItem(storageKeys.token);
      setGateStatus("Your previous session has expired. Enter your key again.", "error");
    });
  }

  async function handleLicenseSubmit(event) {
    event.preventDefault();
    const licenseKey = normalizeLicense(elements.licenseInput?.value);

    if (!apiBase) {
      setGateStatus("Access verification is being connected for launch. Your key has not been sent.", "error");
      return;
    }

    if (licenseKey.length < 12) {
      setGateStatus("Enter the complete Payhip access key.", "error");
      elements.licenseInput?.focus();
      return;
    }

    const submitButton = elements.form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Checking your key…";
    setGateStatus("Securely checking your access…");

    try {
      const response = await fetch(`${apiBase}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey })
      });
      const data = await safeJson(response);

      if (!response.ok || !data?.valid || !data?.token) {
        throw new Error(data?.error || "That key could not be verified.");
      }

      sessionStorage.setItem(storageKeys.token, data.token);
      setGateStatus("Access confirmed. Loading your clarity check…", "success");
      await loadProtectedContent(data.token);
    } catch (error) {
      setGateStatus(error.message || "The access service is temporarily unavailable.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Unlock my clarity check";
    }
  }

  async function loadProtectedContent(token) {
    const response = await fetch(`${apiBase}/content`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await safeJson(response);

    if (!response.ok || !data?.content) {
      throw new Error(data?.error || "Your access session could not be restored.");
    }

    content = data.content;
    showTool();
  }

  function showTool() {
    elements.gate.hidden = true;
    elements.result.hidden = true;
    elements.tool.hidden = false;
    currentIndex = clamp(currentIndex, 0, content.questions.length);
    renderCurrentStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrentStep() {
    const isReflection = currentIndex === content.questions.length;
    const totalSteps = content.questions.length + 1;
    const stepNumber = currentIndex + 1;
    const percent = Math.round((stepNumber / totalSteps) * 100);

    elements.progressLabel.textContent = isReflection ? "Final reflection" : `Question ${stepNumber} of ${content.questions.length}`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progress.setAttribute("aria-valuenow", String(percent));
    elements.progressBar.style.width = `${percent}%`;
    elements.back.disabled = currentIndex === 0;
    elements.next.textContent = isReflection ? "Show my clear answer" : "Continue";

    if (isReflection) renderReflections();
    else renderQuestion(content.questions[currentIndex]);

    persistProgress();
  }

  function renderQuestion(question) {
    elements.stageLabel.textContent = content.stages[question.stage] || "Clarity check";
    elements.questionCard.replaceChildren();

    const number = createElement("p", "question-number", `QUESTION ${String(currentIndex + 1).padStart(2, "0")}`);
    const title = createElement("h2", "question-title", question.prompt);
    const help = createElement("p", "question-help", question.help);
    const fieldset = document.createElement("fieldset");
    fieldset.className = "choice-list";
    fieldset.setAttribute("aria-label", question.prompt);

    question.options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "choice-card";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.id;
      input.value = option.value;
      input.checked = answers[question.id] === option.value;
      input.addEventListener("change", () => {
        answers[question.id] = option.value;
        elements.next.disabled = false;
        persistProgress();
      });

      const text = document.createElement("span");
      text.append(createElement("strong", "", option.label));
      if (option.detail) text.append(createElement("small", "", option.detail));

      label.append(input, text);
      fieldset.append(label);
    });

    elements.questionCard.append(number, title, help, fieldset);
    elements.next.disabled = !answers[question.id];
    requestAnimationFrame(() => title.focus?.());
  }

  function renderReflections() {
    elements.stageLabel.textContent = content.stages.clarity || "Your clarity";
    elements.questionCard.replaceChildren();

    const number = createElement("p", "question-number", "FINAL STEP");
    const title = createElement("h2", "question-title", "Separate what you know from what you need.");
    const help = createElement("p", "question-help", "These prompts are optional, but answering them makes your saved result more useful. Nothing you write here leaves this browser.");
    const grid = document.createElement("div");
    grid.className = "reflection-grid";

    content.reflections.forEach((reflection) => {
      const field = document.createElement("div");
      field.className = "reflection-field";
      const label = document.createElement("label");
      label.htmlFor = `reflection-${reflection.id}`;
      label.textContent = reflection.label;
      const note = createElement("p", "", reflection.help);
      const textarea = document.createElement("textarea");
      textarea.id = `reflection-${reflection.id}`;
      textarea.placeholder = reflection.placeholder || "";
      textarea.maxLength = 900;
      textarea.value = reflections[reflection.id] || "";
      textarea.addEventListener("input", () => {
        reflections[reflection.id] = textarea.value;
        persistProgress();
      });
      field.append(label, note, textarea);
      grid.append(field);
    });

    elements.questionCard.append(number, title, help, grid);
    elements.next.disabled = false;
  }

  function goNext() {
    if (!content) return;

    if (currentIndex < content.questions.length) {
      const question = content.questions[currentIndex];
      if (!answers[question.id]) {
        elements.next.disabled = true;
        elements.questionCard.querySelector("input")?.focus();
        return;
      }
    }

    if (currentIndex < content.questions.length) {
      currentIndex += 1;
      renderCurrentStep();
      elements.tool.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    showResult();
  }

  function goBack() {
    if (currentIndex <= 0) return;
    currentIndex -= 1;
    renderCurrentStep();
    elements.tool.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showResult() {
    const calculation = calculateOutcome();
    activeOutcome = calculation.outcome;
    const outcome = content.outcomes[activeOutcome];
    const templateKey = activeOutcome === "text" ? (answers.intent || "default") : "default";
    const template = outcome.templates[templateKey] || outcome.templates.default || "";

    elements.tool.hidden = true;
    elements.result.hidden = false;
    elements.result.dataset.outcome = activeOutcome;
    elements.resultTitle.textContent = outcome.title;
    elements.resultSummary.textContent = outcome.summary;
    elements.resultReasons.replaceChildren(...calculation.reasons.map((reason) => createElement("li", "", reason)));
    elements.timing.textContent = findTiming(activeOutcome) || outcome.timingDefault;
    elements.plan.replaceChildren(...outcome.plan.map((step) => createElement("li", "", step)));
    elements.templateHeading.textContent = outcome.templateHeading;
    elements.template.textContent = template;
    elements.templateNote.textContent = outcome.templateNote;
    elements.copyTemplate.textContent = activeOutcome === "text" ? "Copy message" : "Copy note";

    elements.boundary.replaceChildren(
      createElement("strong", "", outcome.boundaryTitle),
      document.createTextNode(outcome.boundary)
    );

    renderReflectionSummary();
    persistProgress();
    elements.result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function calculateOutcome() {
    const scores = { text: 0, wait: 0, letgo: 0 };
    const forces = new Set();
    const selectedOptions = [];

    content.questions.forEach((question) => {
      const option = question.options.find((candidate) => candidate.value === answers[question.id]);
      if (!option) return;
      selectedOptions.push(option);
      Object.keys(scores).forEach((key) => { scores[key] += Number(option.scores?.[key] || 0); });
      if (option.force) forces.add(option.force);
    });

    let outcome;
    if (forces.has("letgo")) outcome = "letgo";
    else if (scores.letgo >= 14 && scores.letgo >= scores.wait && scores.letgo >= scores.text) outcome = "letgo";
    else if (forces.has("wait")) outcome = "wait";
    else if (scores.letgo >= 9 && scores.letgo >= scores.wait && scores.letgo >= scores.text) outcome = "letgo";
    else if (scores.wait >= scores.text) outcome = "wait";
    else outcome = "text";

    const reasons = selectedOptions
      .map((option) => option.insight?.[outcome])
      .filter(Boolean)
      .slice(0, 4);

    const fallbacks = {
      text: "Your answers support one clear, bounded message rather than silence or pursuit.",
      wait: "More time is likely to improve the quality of the decision and protect both people’s space.",
      letgo: "The clearest information is coming from boundaries and repeated behavior, not from the hope that another message will change them."
    };

    if (!reasons.length) reasons.push(fallbacks[outcome]);
    return { outcome, reasons, scores };
  }

  function findTiming(outcome) {
    return content.timingRules
      .filter((rule) => rule.outcome === outcome && rule.values.includes(answers[rule.question]))
      .sort((a, b) => b.priority - a.priority)[0]?.text;
  }

  function renderReflectionSummary() {
    const entries = content.reflections
      .map((reflection) => ({ reflection, value: String(reflections[reflection.id] || "").trim() }))
      .filter((entry) => entry.value);

    if (!entries.length) {
      elements.reflectionSummary.hidden = true;
      elements.reflectionList.replaceChildren();
      return;
    }

    elements.reflectionSummary.hidden = false;
    const nodes = [];
    entries.forEach(({ reflection, value }) => {
      nodes.push(createElement("dt", "", reflection.label));
      nodes.push(createElement("dd", "", value));
    });
    elements.reflectionList.replaceChildren(...nodes);
  }

  async function copyCurrentTemplate() {
    const text = elements.template.textContent.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const original = elements.copyTemplate.textContent;
      elements.copyTemplate.textContent = "Copied";
      setTimeout(() => { elements.copyTemplate.textContent = original; }, 1800);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(elements.template);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      elements.copyTemplate.textContent = "Selected—copy now";
    }
  }

  function restartTool() {
    const confirmed = window.confirm("Start over and clear the answers saved in this browser session?");
    if (!confirmed) return;
    answers = {};
    reflections = {};
    currentIndex = 0;
    activeOutcome = null;
    sessionStorage.removeItem(storageKeys.progress);
    showTool();
  }

  function saveAndExit() {
    persistProgress();
    window.location.href = "../";
  }

  function persistProgress() {
    sessionStorage.setItem(storageKeys.progress, JSON.stringify({
      currentIndex,
      answers,
      reflections,
      activeOutcome
    }));
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKeys.progress) || "null");
      if (!saved || typeof saved !== "object") return;
      currentIndex = Number.isFinite(saved.currentIndex) ? saved.currentIndex : 0;
      answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
      reflections = saved.reflections && typeof saved.reflections === "object" ? saved.reflections : {};
      activeOutcome = typeof saved.activeOutcome === "string" ? saved.activeOutcome : null;
    } catch {
      sessionStorage.removeItem(storageKeys.progress);
    }
  }

  function setGateStatus(message, state = "") {
    if (!elements.gateStatus) return;
    elements.gateStatus.textContent = message;
    elements.gateStatus.classList.toggle("is-error", state === "error");
    elements.gateStatus.classList.toggle("is-success", state === "success");
  }

  function normalizeLicense(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
})();
