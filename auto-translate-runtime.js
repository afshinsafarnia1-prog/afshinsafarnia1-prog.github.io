(() => {
  "use strict";
  if (window.__RADYAD_AUTO_TRANSLATE_RUNTIME__) return;
  window.__RADYAD_AUTO_TRANSLATE_RUNTIME__ = true;
  const script = document.currentScript;
  const base = new URL(".", script?.src || location.href);
  const blocks = [...document.querySelectorAll("[data-auto-translate-block]")];

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

  let dynamicTranslations = null;
  const originalText = new WeakMap();
  const renderedText = new WeakMap();
  const manualTextOverrides = new WeakSet();
  const originalAttributes = new WeakMap();
  const renderedAttributes = new WeakMap();
  const manualAttributeOverrides = new WeakMap();
  const attributeNames = ["placeholder", "aria-label", "title", "alt", "content", "data-q"];
  const excluded = "script,style,textarea,input,select,option,[contenteditable='true'],[data-user-content],[data-user-generated],.user-content,.profile-bio,.therapist-bio,.contributor-content,.user-msg,.message-body";

  function isExcluded(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return !element || Boolean(element.closest(excluded));
  }

  function mapString(value, language) {
    if (!dynamicTranslations || language === "fa") return value;
    const pairs = (dynamicTranslations.translations?.[language] || []).slice().sort((a, b) => b[0].length - a[0].length);
    let output = value;
    for (const [source, translated] of pairs) {
      if (source && output.includes(source)) output = output.split(source).join(translated);
    }
    return output;
  }

  function processText(node, language) {
    if (!node || node.nodeType !== 3 || isExcluded(node)) return;
    const previous = renderedText.get(node);
    const isPersian = /[\u0600-\u06FF]/.test(node.data);
    if (manualTextOverrides.has(node)) {
      if (language === "fa" && isPersian) {
        manualTextOverrides.delete(node);
        originalText.set(node, node.data);
      } else {
        renderedText.set(node, node.data);
        return;
      }
    }
    if (!originalText.has(node)) originalText.set(node, node.data);
    else if (previous !== undefined && node.data !== previous) {
      if (isPersian) originalText.set(node, node.data);
      else {
        manualTextOverrides.add(node);
        renderedText.set(node, node.data);
        return;
      }
    }
    const source = originalText.get(node);
    const next = language === "fa" ? source : mapString(source, language);
    if (node.data !== next) {
      node.data = next;
    }
    renderedText.set(node, next);
  }

  function processAttributes(element, language) {
    if (!element || element.nodeType !== 1 || isExcluded(element)) return;
    let originals = originalAttributes.get(element);
    if (!originals) { originals = new Map(); originalAttributes.set(element, originals); }
    let rendered = renderedAttributes.get(element);
    if (!rendered) { rendered = new Map(); renderedAttributes.set(element, rendered); }
    for (const name of attributeNames) {
      if (name === "content" && element.tagName !== "META") continue;
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      const previous = rendered.get(name);
      let suppressed = manualAttributeOverrides.get(element);
      if (!suppressed) { suppressed = new Set(); manualAttributeOverrides.set(element, suppressed); }
      const isPersian = /[\u0600-\u06FF]/.test(current);
      if (suppressed.has(name)) {
        if (language === "fa" && isPersian) {
          suppressed.delete(name);
          originals.set(name, current);
        } else {
          rendered.set(name, current);
          continue;
        }
      }
      if (!originals.has(name)) originals.set(name, current);
      else if (previous !== undefined && current !== previous) {
        if (isPersian) originals.set(name, current);
        else {
          suppressed.add(name);
          rendered.set(name, current);
          continue;
        }
      }
      const source = originals.get(name);
      const next = language === "fa" ? source : mapString(source, language);
      if (current !== next) element.setAttribute(name, next);
      rendered.set(name, next);
    }
  }

  function applyDynamic(language) {
    if (!dynamicTranslations) return;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) processText(node, language);
    document.querySelectorAll("*").forEach(element => processAttributes(element, language));
  }

  const dynamicUrl = new URL("auto-translations/dynamic-ui.json", base);
  fetch(dynamicUrl).then(response => response.ok ? response.json() : null).then(data => {
    if (!data?.translations) return;
    dynamicTranslations = data;
    applyDynamic(document.documentElement.lang || "fa");
    const observer = new MutationObserver(records => {
      const language = document.documentElement.lang || "fa";
      for (const record of records) {
        if (record.type === "characterData") processText(record.target, language);
        for (const added of record.addedNodes || []) {
          if (added.nodeType === 3) processText(added, language);
          else if (added.nodeType === 1) {
            const walker = document.createTreeWalker(added, NodeFilter.SHOW_TEXT);
            let child;
            while ((child = walker.nextNode())) processText(child, language);
            processAttributes(added, language);
            added.querySelectorAll?.("*").forEach(element => processAttributes(element, language));
          }
        }
        if (record.type === "attributes") processAttributes(record.target, language);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributeNames });
    document.addEventListener("yad:languagechange", event => applyDynamic(event.detail?.language || document.documentElement.lang));
  }).catch(() => {});

  document.addEventListener("yad:languagechange", event => apply(event.detail?.language || document.documentElement.lang));
  apply(document.documentElement.lang || "fa");
})();
