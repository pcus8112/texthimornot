(() => {
  "use strict";

  const config = window.TEXT_HIM_CONFIG || {};
  const payhipUrl = config.payhipUrl || "https://payhip.com/PierreCUSinger";
  const contactEmail = config.contactEmail || "contact@texthimornot.com";

  document.querySelectorAll("[data-payhip-link]").forEach((link) => {
    link.href = payhipUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  document.querySelectorAll("[data-contact-link]").forEach((link) => {
    link.href = `mailto:${contactEmail}`;
  });

  const form = document.querySelector("#quick-check-form");
  const result = document.querySelector("#quick-result");
  const error = document.querySelector("#quick-check-error");
  const title = document.querySelector("#quick-result-title");
  const copy = document.querySelector("#quick-result-copy");
  const reset = document.querySelector("#quick-check-reset");

  if (!form || !result || !title || !copy) return;

  const signals = {
    stop: {
      title: "Do not text him.",
      copy: "A clear no-contact request or ending is already an answer. Respecting it protects both his boundary and your dignity. The full tool can help you turn that answer into a practical letting-go plan."
    },
    space: {
      title: "Wait and respect the space.",
      copy: "A request for space matters more than the urge to resolve uncertainty today. The full tool helps you distinguish respectful waiting from staying emotionally stuck."
    },
    wait: {
      title: "Wait before you text.",
      copy: "An unanswered message or an urgent need for reassurance usually needs time—not another notification. The full check will calculate your next respectful step from the complete context."
    },
    letgo: {
      title: "Pause. You may need to let go.",
      copy: "Trying to change someone’s mind can turn contact into pressure. The full tool looks at patterns, boundaries, and your readiness before giving you one clear answer."
    },
    possible: {
      title: "You may be ready to text.",
      copy: "A calm, specific reason and no crossed boundary are good signs—but timing and the wider pattern still matter. The full tool checks those details and gives you wording that stays clear and pressure-free."
    }
  };

  function getSignal(boundary, unanswered, motive) {
    if (boundary === "stop") return { key: "stop", ...signals.stop };
    if (boundary === "space") return { key: "space", ...signals.space };
    if (motive === "change") return { key: "letgo", ...signals.letgo };
    if (unanswered !== "no" || motive === "anxiety") return { key: "wait", ...signals.wait };
    return { key: "possible", ...signals.possible };
  }

  function displaySignal(boundary, unanswered, motive) {
    const signal = getSignal(boundary, unanswered, motive);
    title.textContent = signal.title;
    copy.textContent = signal.copy;
    form.hidden = true;
    result.hidden = false;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: "smooth", block: "center" });
    return { signal: signal.key, title: signal.title };
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const boundary = data.get("boundary");
    const unanswered = data.get("unanswered");
    const motive = data.get("motive");

    if (!boundary || !unanswered || !motive) {
      if (error) error.hidden = false;
      return;
    }

    if (error) error.hidden = true;

    displaySignal(boundary, unanswered, motive);
  });

  reset?.addEventListener("click", () => {
    form.reset();
    result.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    try {
      void Promise.resolve(modelContext.registerTool({
        name: "run_free_clarity_check",
        title: "Run free clarity check",
        description: "Answer the three visible free-check questions and show the same first signal displayed by the page.",
        inputSchema: {
          type: "object",
          properties: {
            boundary: { type: "string", enum: ["no", "space", "stop"] },
            unanswered: { type: "string", enum: ["no", "recent", "long"] },
            motive: { type: "string", enum: ["clear", "anxiety", "change"] }
          },
          required: ["boundary", "unanswered", "motive"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const allowed = {
            boundary: ["no", "space", "stop"],
            unanswered: ["no", "recent", "long"],
            motive: ["clear", "anxiety", "change"]
          };
          if (!input || !allowed.boundary.includes(input.boundary) || !allowed.unanswered.includes(input.unanswered) || !allowed.motive.includes(input.motive)) {
            throw new Error("Invalid free-check answers.");
          }
          Object.entries(input).forEach(([name, value]) => {
            const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) radio.checked = true;
          });
          if (error) error.hidden = true;
          return displaySignal(input.boundary, input.unanswered, input.motive);
        }
      })).catch(() => {});
    } catch {
      // WebMCP is optional; the visible form remains fully functional.
    }
  }
})();
