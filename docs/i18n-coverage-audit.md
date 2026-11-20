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
| /articles/psychotherapy-first-session.html | Full eight-language page translation, body copy, lists, safety note, direction and social metadata | Eight-locale browser smoke assertions added; CI verification pending |
| /articles/therapeutic-relationship.html | No page-body translation markers observed | Translate full article or clearly mark it unavailable in that locale |
| /articles/why-assessment-matters.html | Full eight-language translation of headings, body paragraphs, CTA, direction and social metadata | Eight-locale browser assertions added; CI verification pending |

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

- `/articles/psychotherapy-first-session.html`: completed a full page-specific translation pack for all eight languages, covering breadcrumbs, headings, body paragraphs, lists, safety note, page direction, title, description, Open Graph and Twitter metadata. Removed the obsolete Persian-only notice. Browser smoke tests now assert localized title/body and RTL/LTR behavior in all eight locales. This does not mean the other five article bodies are translated; they remain outstanding.

- `/articles/why-assessment-matters.html`: completed full translations in all eight languages, including the article's clinical distinctions, collaborative-assessment framing, limits of standardized testing, therapist-fit discussion, and the description of RADYAD's non-diagnostic initial guide. Added page metadata and browser assertions for localized title/body and direction.
## Automatic translation pipeline (2026-11-20)

- Added a source-hash-based Google Cloud Translation build generator for the four remaining long-form article bodies and the legal rules document.
- The generator translates Persian HTML fragments into English, Sorani Kurdish (ckb), Turkish, Arabic, Spanish, German and French while preserving the HTML structure. It also generates page title, description, Open Graph and Twitter metadata.
- Added a browser runtime that loads generated translation files, restores the Persian source when the user switches back to Persian, sets the correct language and direction, and labels machine-translated legal/clinical content as not yet professionally reviewed.
- Added a GitHub Actions workflow that checks for the provider credential, translates changed source blocks, caches outputs by source hash and commits refreshed files to the feature branch. Unchanged blocks are not retranslated. The generator also enforces a 400,000-character per-run safety ceiling.
- Added CI validation for the translation manifest, source markers and runtime script references.
- **Activation is pending:** the workflow requires a Google Cloud Translation API key stored as the repository Actions secret GOOGLE_TRANSLATE_API_KEY. No key is stored in source code. Until that one-time credential is configured, no generated translations are published and the Persian-only notices remain visible.
- Google Cloud documents support for Sorani Kurdish with language code ckb; machine translations still require qualified human review before legal or clinical use.
- Extended the pipeline to scan developer-authored HTML text, metadata, labels and Persian string literals in site JavaScript. A source-string cache translates only new/changed strings; the runtime applies cached translations to static text and later-generated UI messages through a MutationObserver without replacing DOM nodes or event handlers. The scanner does not collect live database content; therapist names/bios, workshop submissions, contributor-authored text, private messages and editable fields are excluded from runtime translation.


## Monthly translation quota (2026-11-20)

- Both machine-translation pipelines share `auto-translations/monthly-budget.json` and a hard internal cap of 450,000 source characters per UTC calendar month. This is below Google Cloud Translation's published 500,000-character monthly free allowance for NMT text translation (Basic and Advanced combined).
- The content generator saves each completed locale incrementally; the dynamic UI generator saves each completed batch. When the shared cap is reached, remaining work stays queued for the next monthly run.
- GitHub Actions runs the queue on the first day of each month and also on relevant source-code changes. A shared concurrency group prevents simultaneous workflow runs from spending the same monthly budget twice.
- The current estimate is approximately 1.27 million source characters across seven target locales. At 450,000 characters per month, this is expected to fit in three monthly allowances, provided other Cloud Translation usage on the same account remains below the 50,000-character monthly buffer.
- The budget is an application-side guardrail, not visibility into the Google Cloud account's total usage. If another project or service uses the same monthly free credit, the remaining free allowance may be lower. No provider calls occur until the Actions secret `GOOGLE_TRANSLATE_API_KEY` is configured.
- The monthly schedule starts only when this workflow exists on the repository's default branch. While the PR remains unmerged, feature-branch pushes can run the same capped queue once the secret is configured, but the production schedule is not active yet.
