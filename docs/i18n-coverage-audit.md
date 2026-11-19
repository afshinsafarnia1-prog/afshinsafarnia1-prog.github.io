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
| /initial-guidance.html | No page-body translation markers observed | Translate complete guide and metadata |
| /rules.html | Only limited translation markers; Persian-only notice | Translate complete legal text and metadata; legal review of equivalent meaning in all locales |
| /standards.html | No page-body translation markers observed | Translate complete standards and metadata |
| /workshops.html | Partial page markers | Audit descriptions, registration, errors, dates and dynamic content |
| /articles/ | Article index has partial translations | Audit all article cards, tags, excerpts and pagination/empty states |
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
