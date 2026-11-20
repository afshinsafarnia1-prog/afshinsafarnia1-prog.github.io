# RADYAD multilingual coverage audit

Target locales: `fa`, `ku` (Sorani Kurdish), `en`, `tr`, `ar`, `es`, `de`, `fr`.

This is a working implementation checklist. A locale is not considered complete merely because the language selector changes the document language or shared navigation labels.

## Route inventory

| Route | Current coverage observed on main | Required work |
|---|---|---|
| / | Shared shell and homepage dictionary | Verify all visible copy, metadata, filters, empty states and dynamic directory results |
| /contact.html | No language script or translation markers observed | Add selector, all page copy, contact labels and metadata |
| /relationships.html | Service-guide translation script and partial markers | Verify all content, headings, lists, metadata |
| /psychology.html | Service-guide translation script and partial markers | Verify all content, headings, lists, metadata |
| /psychotherapy.html | Service-guide translation script and partial markers | Verify all content, headings, lists, metadata |
| /psychiatry.html | Service-guide translation script and partial markers | Verify all content, headings, lists, metadata |
| /client.html | Shared dictionary and page markers | Audit every label, validation, status, notification, consent and async state |
| /admin.html | Shared dictionary and page markers | Audit every control, status, error, confirmation and async state |
| /therapist.html | Shared dictionary and page markers | Audit all profile, article, schedule and workflow states |
| /therapist-profile.html | Shared shell and very few page markers | Translate complete page and metadata |
| /therapists/foruzan-shahla.html | Shared shell; no page-body markers observed | Translate profile content and metadata |
| /assistant.html | Shared dictionary and page markers | Audit prompts, replies, fallback and emergency text |
| /assessment.html | Shared dictionary and page markers | Audit questions, options, results, validation and recommendations |
| /initial-guidance.html | Complete page-specific translations for all seven non-Persian locales, including guide text, form labels/options, generated result, crisis notice, footer and metadata | Browser verification in all eight locales; independent linguistic review recommended before release |
| /rules.html | Only limited translation markers; Persian-only notice | Translate complete legal text and metadata; legal review of equivalent meaning in all locales |
| /standards.html | Full visible body, section headings, commitments, safety caveats and metadata translated in all seven non-Persian locales; Persian remains the source | Browser verification in all eight locales; independent linguistic review recommended before release |
| /workshops.html | Partial page markers | Audit descriptions, registration, errors, dates and dynamic content |
| /articles/ | Static article cards, section labels, descriptions and metadata translated in all eight locales; contributor-submitted article bodies remain in their original language with an explicit notice | Browser verification in all eight locales; audit dynamic loading and accessibility states |
| /articles/ai-robots-human-meaning.html | Very few page markers; long Persian body | Translate full article or clearly mark it unavailable in that locale |
| /articles/choosing-a-therapist.html | Very few page markers; long Persian body | Translate full article or clearly mark it unavailable in that locale |
| /articles/psychoanalytic-traditions.html | No page-body translation markers observed | Translate full article or clearly mark it unavailable in that locale |
| /articles/psychotherapy-first-session.html | Partial markers | Verify full article body and metadata |
| /articles/therapeutic-relationship.html | No page-body translation markers observed | Translate full article or clearly mark it unavailable in that locale |
| /articles/why-assessment-matters.html | No page-body translation markers observed | Translate full article or clearly mark it unavailable in that locale |

## Cross-cutting requirements

- The language choice persists across navigation and refresh on every route.
- `html lang` and `dir` are correct for each locale. Persian, Sorani Kurdish and Arabic use RTL; English, Turkish, Spanish, German and French use LTR.
- No page is presented as fully translated when its substantive content remains Persian.
- All user-facing dynamic strings are localized: form validation, errors, confirmations, empty states, payment and appointment states, notifications, assistant responses, and accessibility labels.
- User-generated content and proper names are not machine-translated.
- Legal, clinical, privacy, consent and crisis-safety language must preserve meaning; do not silently omit or simplify safeguards.
- Page title, meta description, Open Graph fields and structured metadata are localized where appropriate.
- Language switching does not break forms, authentication, route navigation, PWA behavior or cached assets.

## Release gate

Do not merge until every route has been tested in all eight locales, untranslated Persian content is either translated or explicitly identified as not yet available, and browser smoke tests cover both static and dynamic UI states. The production branch and live site remain unchanged until the release gate passes.


## Work completed on `feature/full-site-i18n` (2026-11-20)

- `/standards.html`: added complete editorial translations for Sorani Kurdish, English, Turkish, Arabic, Spanish, German and French, including every section, all commitment bullets, online-session caveats, footer, navigation, title and meta description. Persian remains the source language.
- Added `editorial-pages-i18n.js` as the page-specific translation pack and browser smoke assertions for all eight locales. The new assertions are pending a CI run against the latest branch head.
- `/initial-guidance.html`, legal rules, articles, dynamic portal messages and user-generated content are still release blockers; the language selector alone must not be interpreted as full translation.


- `/initial-guidance.html`: added `initial-guidance-i18n.js` with full page translations for Sorani Kurdish, English, Turkish, Arabic, Spanish, German and French. The form's generated result now follows the selected interface language, while preserving the original filter values in the URL. Removed the obsolete Persian-only coverage notice for this route.
- Added browser smoke assertions for all eight language variants, RTL/LTR direction, localized lead copy, and the English dynamic form result. These assertions require a CI run against the latest branch head.

- `/articles/` and `/articles/index.html`: completed translations for the previously untranslated theoretical and assessment cards and the contributor-article section. Added an explicit eight-language notice that contributor-submitted articles remain in the author's original language rather than being silently presented as translated. Added eight-locale browser assertions and removed the misleading generic Persian-only notice for the article index.

- Follow-up QA found a language-switch regression on `/standards.html`: after switching from another locale back to Persian, the page could retain translated text because the Persian source pack was implicit. Updated `editorial-pages-i18n.js` to preserve and restore the original Persian text and metadata. The previous CI run exposed this issue; the fix is committed, but a fresh run against the newest branch head is still required.
