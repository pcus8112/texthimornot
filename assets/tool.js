(() => {
  "use strict";

  const config = window.TEXT_HIM_CONFIG || {};
  const apiBase = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const payhipUrl = config.payhipUrl || "https://payhip.com/b/6qEcj";
  const contactEmail = config.contactEmail || "pcusinger@gmail.com";
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
  elements.print?.addEventListener("click", downloadResultPdf);
  elements.restart?.addEventListener("click", restartTool);

  const existingToken = localStorage.getItem(storageKeys.token);
  if (existingToken && apiBase) {
    setGateStatus("Restoring your access on this device…");
    loadProtectedContent(existingToken).catch(() => {
      localStorage.removeItem(storageKeys.token);
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

      localStorage.setItem(storageKeys.token, data.token);
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

  function downloadResultPdf() {
    const PdfDocument = window.jspdf?.jsPDF;
    if (!PdfDocument) {
      window.alert("The PDF generator could not be loaded. Please check your connection and try again.");
      return;
    }

    const button = elements.print;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Creating your PDF…";

    try {
      const documentPdf = new PdfDocument({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        putOnlyUsedFonts: true,
        compress: true
      });
      const pageWidth = documentPdf.internal.pageSize.getWidth();
      const pageHeight = documentPdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - (margin * 2);
      const bottomLimit = pageHeight - 18;
      let cursorY = 18;

      const ensureRoom = (height) => {
        if (cursorY + height <= bottomLimit) return;
        documentPdf.addPage();
        cursorY = 18;
      };

      const writeText = (value, options = {}) => {
        const size = options.size || 11;
        const lineHeight = size * 0.48;
        const indent = options.indent || 0;
        const width = contentWidth - indent;
        const lines = documentPdf.splitTextToSize(pdfSafeText(value), width);
        documentPdf.setFont("helvetica", options.bold ? "bold" : "normal");
        documentPdf.setFontSize(size);
        documentPdf.setTextColor(...(options.color || [40, 55, 59]));

        lines.forEach((line) => {
          ensureRoom(lineHeight);
          documentPdf.text(line, margin + indent, cursorY);
          cursorY += lineHeight;
        });
        cursorY += options.after ?? 3;
      };

      const estimateTextHeight = (value, size = 11, width = contentWidth, after = 3) => {
        const lines = documentPdf.splitTextToSize(pdfSafeText(value), width);
        return (lines.length * size * 0.48) + after;
      };

      const writeSectionHeading = (heading) => {
        ensureRoom(15);
        cursorY += 3;
        writeText(heading, { size: 13, bold: true, color: [18, 92, 88], after: 3 });
      };

      const writeList = (items, ordered = false) => {
        items.forEach((item, index) => {
          const size = 10.5;
          const lineHeight = size * 0.48;
          const prefix = ordered ? `${index + 1}.` : "-";
          const lines = documentPdf.splitTextToSize(pdfSafeText(item), contentWidth - 9);
          ensureRoom(lineHeight);
          documentPdf.setFont("helvetica", "normal");
          documentPdf.setFontSize(size);
          documentPdf.setTextColor(52, 70, 74);
          documentPdf.text(prefix, margin, cursorY);
          lines.forEach((line) => {
            ensureRoom(lineHeight);
            documentPdf.text(line, margin + 8, cursorY);
            cursorY += lineHeight;
          });
          cursorY += 2;
        });
      };

      documentPdf.setProperties({
        title: "Your Clarity Check - Text Him or Not?",
        subject: "Private clarity check result",
        author: "Pierre Christian Ulrich Singer, Entrepreneur individuel (EI)",
        creator: "Text Him or Not?"
      });

      writeText("TEXT HIM OR NOT?", { size: 10, bold: true, color: [18, 92, 88], after: 5 });
      writeText("YOUR CLEAR ANSWER", { size: 9, bold: true, color: [145, 112, 43], after: 3 });
      writeText(elements.resultTitle.textContent, { size: 22, bold: true, color: [20, 33, 38], after: 5 });
      writeText(elements.resultSummary.textContent, { size: 12, color: [52, 70, 74], after: 5 });

      writeSectionHeading("Why this is your result");
      writeList(Array.from(elements.resultReasons.children, (item) => item.textContent));

      writeSectionHeading("Your timing guidance");
      writeText(elements.timing.textContent);

      writeSectionHeading("Your next steps");
      writeList(Array.from(elements.plan.children, (item) => item.textContent), true);

      writeSectionHeading(elements.templateHeading.textContent || "A respectful message");
      writeText(elements.template.textContent, { bold: true, color: [20, 75, 72] });
      writeText(elements.templateNote.textContent, { size: 9.5, color: [75, 91, 95] });

      const reflectionTerms = Array.from(elements.reflectionList.querySelectorAll("dt"));
      const reflectionValues = Array.from(elements.reflectionList.querySelectorAll("dd"));
      if (reflectionTerms.length) {
        writeSectionHeading("What you clarified");
        reflectionTerms.forEach((term, index) => {
          const answer = reflectionValues[index]?.textContent || "";
          const pairHeight = estimateTextHeight(term.textContent, 10.5, contentWidth, 1)
            + estimateTextHeight(answer, 10.5, contentWidth, 3);
          ensureRoom(pairHeight);
          writeText(term.textContent, { size: 10.5, bold: true, after: 1 });
          writeText(answer, { size: 10.5, color: [52, 70, 74] });
        });
      }

      const boundaryTitle = elements.boundary.querySelector("strong")?.textContent || "Important boundary";
      const boundaryText = Array.from(elements.boundary.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(" ");
      writeSectionHeading(boundaryTitle);
      writeText(boundaryText, { bold: true, color: [145, 41, 68] });

      writeSectionHeading("Keep this result in perspective");
      writeText("This tool supports reflection and decision-making. It cannot know another person's thoughts and cannot guarantee a reply, reconciliation, or relationship outcome.", { size: 9.5, color: [75, 91, 95] });

      const pageCount = documentPdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        documentPdf.setPage(page);
        documentPdf.setFont("helvetica", "normal");
        documentPdf.setFontSize(8);
        documentPdf.setTextColor(100, 112, 115);
        documentPdf.text("Text Him or Not? | texthimornot.com", margin, pageHeight - 8);
        documentPdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      documentPdf.save("Your-Clarity-Check-Text-Him-or-Not.pdf");
    } catch (error) {
      console.error("PDF creation failed", error);
      window.alert("The PDF could not be created. Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function pdfSafeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d\u201e]/g, "\"")
      .replace(/\s*[\u2013\u2014]\s*/g, " - ")
      .replace(/\u2026/g, "...")
      .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g, "?");
  }

  function restartTool() {
    const confirmed = window.confirm("Start over and clear the answers saved in this browser?");
    if (!confirmed) return;
    answers = {};
    reflections = {};
    currentIndex = 0;
    activeOutcome = null;
    localStorage.removeItem(storageKeys.progress);
    showTool();
  }

  function saveAndExit() {
    persistProgress();
    window.location.href = "../";
  }

  function persistProgress() {
    localStorage.setItem(storageKeys.progress, JSON.stringify({
      currentIndex,
      answers,
      reflections,
      activeOutcome
    }));
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.progress) || "null");
      if (!saved || typeof saved !== "object") return;
      currentIndex = Number.isFinite(saved.currentIndex) ? saved.currentIndex : 0;
      answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
      reflections = saved.reflections && typeof saved.reflections === "object" ? saved.reflections : {};
      activeOutcome = typeof saved.activeOutcome === "string" ? saved.activeOutcome : null;
    } catch {
      localStorage.removeItem(storageKeys.progress);
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
