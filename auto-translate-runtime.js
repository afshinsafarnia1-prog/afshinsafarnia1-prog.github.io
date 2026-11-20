(() => {
  "use strict";
  const script = document.currentScript;
  const base = new URL(".", script?.src || location.href);
  const blocks = [...document.querySelectorAll("[data-auto-translate-block]")];
  if (!blocks.length) return;

  const originals = new Map(blocks.map(node => [node, node.innerHTML]));
  const originalMeta = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.content || "",
    ogDescription: document.querySelector('meta[property="og:description"]')?.content || "",
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || "",
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || ""
  };
  const cache = new Map();
  let generation = 0;
  const rtl = new Set(["fa", "ku", "ar"]);
  const notes = {
    en: "Machine translation. Clinical and legal wording has not been professionally reviewed.",
    ku: "وەرگێڕانی ئامێرییە؛ دەقی کلینیکی و یاسایی هێشتا لەلایەن پسپۆڕەوە پێداچوونەوەی بۆ نەکراوە.",
    tr: "Makine çevirisidir. Klinik ve hukuki metinler uzman tarafından henüz incelenmemiştir.",
    ar: "ترجمة آلية؛ لم تُراجع الصياغة السريرية والقانونية بعد من مختص.",
    es: "Traducción automática. El contenido clínico y jurídico aún no ha sido revisado por especialistas.",
    de: "Maschinelle Übersetzung. Klinische und rechtliche Formulierungen wurden noch nicht fachlich geprüft.",
    fr: "Traduction automatique. Les formulations cliniques et juridiques n'ont pas encore été vérifiées par des spécialistes."
  };

  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    const url = new URL(`auto-translations/${encodeURIComponent(id)}.json`, base);
    const promise = fetch(url).then(response => response.ok ? response.json() : null).catch(() => null);
    cache.set(id, promise);
    return promise;
  }

  function updateMeta(value) {
    document.title = value.title || originalMeta.title;
    const set = (selector, content) => {
      const node = document.querySelector(selector);
      if (node && content) node.content = content;
    };
    set('meta[name="description"]', value.description);
    set('meta[property="og:title"]', value.ogTitle);
    set('meta[property="og:description"]', value.ogDescription);
    set('meta[name="twitter:title"]', value.twitterTitle);
    set('meta[name="twitter:description"]', value.twitterDescription);
  }

  async function apply(language) {
    const current = ++generation;
    if (language === "fa") {
      for (const node of blocks) {
        node.innerHTML = originals.get(node);
        node.lang = "fa";
        node.dir = "rtl";
      }
      document.title = originalMeta.title;
      const d = document.querySelector('meta[name="description"]'); if (d) d.content = originalMeta.description;
      const ogt = document.querySelector('meta[property="og:title"]'); if (ogt) ogt.content = originalMeta.ogTitle;
      const ogd = document.querySelector('meta[property="og:description"]'); if (ogd) ogd.content = originalMeta.ogDescription;
      const tt = document.querySelector('meta[name="twitter:title"]'); if (tt) tt.content = originalMeta.twitterTitle;
      const td = document.querySelector('meta[name="twitter:description"]'); if (td) td.content = originalMeta.twitterDescription;
      document.querySelectorAll("[data-i18n-show-non-fa], [data-i18n-coverage-notice]").forEach(node => { node.hidden = true; });
      return;
    }

    for (const node of blocks) {
      const id = node.getAttribute("data-auto-translate-block");
      const file = await load(id);
      if (current !== generation) return;
      const translated = file?.translations?.[language];
      if (translated?.html) {
        node.innerHTML = translated.html;
        node.lang = language;
        node.dir = rtl.has(language) ? "rtl" : "ltr";
        updateMeta(translated);
        const notice = document.querySelector("[data-i18n-show-non-fa]") || document.querySelector("[data-i18n-coverage-notice]");
        if (notice) {
          notice.textContent = notes[language] || notes.en;
          notice.hidden = false;
        }
        document.querySelectorAll("[data-i18n-coverage-notice]").forEach(node => { if (node !== notice) node.hidden = true; });
      } else {
        node.innerHTML = originals.get(node);
        node.lang = "fa";
        node.dir = "rtl";
        const notice = document.querySelector("[data-i18n-show-non-fa]");
        if (notice) notice.hidden = false;
      }
    }
  }

  document.addEventListener("yad:languagechange", event => apply(event.detail?.language || document.documentElement.lang));
  apply(document.documentElement.lang || "fa");
})();
