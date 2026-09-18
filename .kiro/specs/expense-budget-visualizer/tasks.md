# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side, single-page expense tracker using HTML5, CSS3, and vanilla JavaScript ES2020 with Chart.js 4.x loaded from CDN. The application follows an MVC pattern within a single `js/app.js` file and persists data to `localStorage`. No build toolchain is required — the deliverable is a folder of static files openable via the `file://` protocol.

## Tasks

- [~] 1. Scaffold project structure and HTML skeleton
  - Create the root `index.html` file with full semantic markup: `<header>` containing `#balance-display` with `role="status" aria-live="polite"`, `<main>` with three `<section>` elements (form, transaction list, chart), and all required IDs and ARIA attributes from the design
  - Add the Chart.js 4.x CDN `<script>` tag and a `<script src="js/app.js">` tag (deferred) — no `package.json` or build config
  - Create empty placeholder files `css/style.css` and `js/app.js`
  - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 7.4_

- [x] 2. Implement CSS layout and visual styles
  - [x] 2.1 Write CSS custom properties, reset/base styles, and layout
    - Define color palette, spacing scale, and font-size custom properties in `:root`
    - Apply `box-sizing: border-box`, `font-family`, `min-width: 320px` on body
    - Style `<header>`, `<main>` (single-column), and `<section>` spacing
    - _Requirements: 6.1, 7.1, 7.3_

  - [x] 2.2 Style the balance display, form, validation errors, and transaction list
    - Style `#balance-display` as large prominent text; add `.negative` class rule with color `#d32f2f`
    - Style `.field-group` as a Flexbox column (label → input/select → error span stacked)
    - Style `.field-error` as small red text, hidden when empty; style the submit button with uniform padding
    - Style `#transaction-list` with `overflow-y: auto; max-height: 40vh;`; each list item as a Flexbox row with spread content; style delete buttons with accessible hit area
    - _Requirements: 1.5, 2.1, 2.2, 3.5, 7.1_

  - [x] 2.3 Style chart container, focus indicators, and responsive breakpoint
    - Style `#chart-container` with a max-width constraint, centered
    - Add `:focus-visible` outline rules for all interactive elements
    - Add `@media (max-width: 480px)` block: full-width form elements, reduced padding, no horizontal overflow
    - _Requirements: 4.1, 6.1, 7.2, 7.3, 7.4_

- [x] 3. Implement data constants and `StorageService`
  - [x] 3.1 Define `CATEGORIES`, `CATEGORY_COLORS`, and `STORAGE_KEY` constants
    - `const CATEGORIES = ['Food', 'Transport', 'Fun']`
    - `const CATEGORY_COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' }`
    - `const STORAGE_KEY = 'expense_visualizer_transactions'`
    - _Requirements: 1.1, 4.6, 5.1_

  - [x] 3.2 Implement `StorageService.load()` with deserialization guard
    - Wrap `localStorage.getItem` + `JSON.parse` in `try/catch`; return `null` on failure
    - After parse, verify top-level value is an array; if not, return `[]`
    - For each item, check presence of `id` (string), `itemName` (non-empty string), `amount` (finite positive number), `category` (member of `CATEGORIES`), `createdAt` (number) — silently drop invalid items
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 3.3 Implement `StorageService.save(transactions)`
    - Wrap `localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))` in `try/catch`
    - Return `true` on success, `false` on failure
    - _Requirements: 5.1, 5.2, 5.6_

  - [ ]* 3.4 Write property test for `StorageService` round-trip (Property 11)
    - **Property 11: Initialization Deserializes Stored Transactions**
    - **Validates: Requirements 5.3, 5.4**
    - Generate valid transaction arrays → serialize via `StorageService.save` → call `StorageService.load` → assert deep equality
    - Generate corrupt payloads (invalid JSON, non-array values) → assert `load` returns `null` or `[]`

- [x] 4. Implement `State` and `Validator`
  - [x] 4.1 Define `State` object and implement `Validator.validateForm(data)`
    - `const State = { transactions: [] }` — single in-memory source of truth
    - Implement validation rules: `itemName` non-empty after trim, ≤ 100 chars; `amount` parses as float, finite, within [0.01, 999999999.99]; `category` non-empty and member of `CATEGORIES`
    - Return a `ValidationErrors` object (empty means valid)
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ]* 4.2 Write property test for `Validator` (Property 2)
    - **Property 2: Invalid Input Rejected With Per-Field Errors**
    - **Validates: Requirements 1.4, 1.5**
    - Generate random invalid field combinations (empty names, out-of-range amounts, bad categories) → call `Validator.validateForm` → assert errors object is non-empty with a key for each invalid field
    - Generate random valid combinations → assert errors object is empty `{}`

- [x] 5. Implement `Renderer`
  - [x] 5.1 Implement `Renderer.renderList(transactions)` and `Renderer.renderBalance(transactions)`
    - `renderList`: rebuild `<ul id="transaction-list">` innerHTML; for non-empty lists, render each transaction as `<li>` with item name (max 100 chars), amount formatted as `"$X.XX"`, category label, and a delete `<button>` with `data-id` attribute and accessible `aria-label`; for empty list, inject placeholder `<li>` with no-transactions message
    - `renderBalance`: compute sum of all amounts, format as `"$" + sum.toFixed(2)`, set as `textContent` of `#balance-display`; toggle `.negative` class when sum < 0
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.4, 3.5_

  - [ ]* 5.2 Write property test for `renderBalance` (Property 6)
    - **Property 6: Balance Equals Sum Invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Generate random transaction lists (including empty) → call `renderBalance` → assert `#balance-display` text equals `"$" + sum.toFixed(2)`

  - [ ]* 5.3 Write property test for `renderBalance` negative styling (Property 7)
    - **Property 7: Negative Balance Gets Distinct Styling**
    - **Validates: Requirements 3.5**
    - Generate lists with negative sum → assert `.negative` class present on `#balance-display`
    - Generate lists with non-negative sum → assert `.negative` class absent

  - [ ]* 5.4 Write property test for `renderList` item structure (Property 5)
    - **Property 5: List Item Rendering Invariant**
    - **Validates: Requirements 2.2, 2.4**
    - Generate random non-empty transaction lists → call `renderList` → assert each `<li>` contains truncated name, `"$X.XX"` formatted amount, category label, and exactly one delete button

  - [x] 5.5 Implement `Renderer.renderErrors`, `Renderer.clearErrors`, `Renderer.clearForm`, and `Renderer.showStorageError`
    - `renderErrors(errors)`: for each field, set `textContent` on `#*-error` span; set `aria-invalid="true"` on inputs with errors; move focus to first invalid field
    - `clearErrors()`: clear all `#*-error` spans, remove `aria-invalid` attributes
    - `clearForm()`: reset all form inputs and category select to default/empty
    - `showStorageError(message)`: set `textContent` on `#storage-error` div with `role="alert"`; auto-dismiss after 5 s via `setTimeout`
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 2.6, 7.4_

- [ ] 6. Checkpoint — Verify storage, state, and rendering logic
  - Ensure all tests written so far pass, form renders correctly in browser via `file://`, balance and list render properly from a hard-coded `State.transactions` array. Ask the user if questions arise.

- [ ] 7. Implement `ChartService`
  - [ ] 7.1 Implement `ChartService.init()` with Chart.js unavailability guard
    - Guard: if `typeof Chart === 'undefined'`, set `#chart-container` text to fallback message and return
    - Create a `Chart` instance on `#pie-chart` canvas with `type: 'pie'`, responsive options, legend at bottom, and tooltip callback formatting labels as `"$X.XX (Y%)"`
    - Use fixed `CATEGORY_COLORS` for `backgroundColor`; set `hoverOffset: 4`
    - Store instance as `ChartService.chart`
    - _Requirements: 4.1, 4.6_

  - [ ] 7.2 Implement `ChartService.update(transactions)`
    - Compute per-category sums from `transactions`; filter to only categories with sum > 0
    - If `ChartService.chart` is `null`, return early
    - If no categories have data, show no-data message in `#chart-container` and call `chart.destroy()` (reset `ChartService.chart` to null); re-init on next update with data
    - Otherwise update `chart.data.labels`, `chart.data.datasets[0].data`, and `chart.data.datasets[0].backgroundColor` with per-category values; call `chart.update('none')`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 7.3 Write property test for chart data computation (Properties 8, 9, 10)
    - **Property 8: Chart Labels Equal Categories With Data**
    - **Property 9: Chart Data Proportional to Category Sums**
    - **Property 10: Chart Category Colors Are Unique**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**
    - Extract the pure chart-data computation logic into a testable helper function
    - Generate random transaction lists → compute chart data → assert labels = categories with sum > 0, dataset values match per-category sums, `backgroundColor` values are pairwise distinct

- [ ] 8. Implement `Controller` and wire the application
  - [ ] 8.1 Implement `Controller.handleSubmit(event)`
    - Prevent default form submission; call `Renderer.clearErrors()` and clear storage error
    - Collect `itemName`, `amount`, `category` from form fields; call `Validator.validateForm`
    - If errors: call `Renderer.renderErrors(errors)` and return
    - Build `Transaction` object with `id` (`crypto.randomUUID()` with `Date.now().toString()` fallback), `itemName` (trimmed), `amount` (parsed float), `category`, `createdAt` (`Date.now()`)
    - Push to `State.transactions`; call `StorageService.save` — on failure: splice the pushed item, call `Renderer.showStorageError`, return
    - Call `Renderer.renderList`, `Renderer.renderBalance`, `ChartService.update`, `Renderer.clearForm`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 3.2, 4.3, 5.1_

  - [ ]* 8.2 Write property test for add round-trip (Property 1)
    - **Property 1: Transaction Add Round-Trip**
    - **Validates: Requirements 1.3, 5.1**
    - Generate random valid transaction tuples → simulate form submit via `handleSubmit` → assert `State.transactions.length` increased by 1 and `localStorage` contains the new item

  - [ ]* 8.3 Write property test for form cleared after add (Property 3)
    - **Property 3: Form Cleared After Successful Add**
    - **Validates: Requirements 1.6**
    - Generate random valid transactions → simulate submit → assert all form fields are empty/default after success

  - [ ] 8.4 Implement `Controller.handleDelete(event)` and `Controller.init()`
    - `handleDelete`: read `data-id` from clicked delete button; find transaction index in `State.transactions`; splice it out; call `StorageService.save` — on failure: re-insert at original index, call `Renderer.showStorageError`, return; call `Renderer.renderList`, `Renderer.renderBalance`, `ChartService.update`
    - `Controller.init()`: attach `submit` listener on `#transaction-form` and delegated `click` listener on `#transaction-list` (checking `event.target.dataset.id`)
    - _Requirements: 2.5, 2.6, 3.3, 4.4, 5.2_

  - [ ]* 8.5 Write property test for delete round-trip (Property 4)
    - **Property 4: Delete Removes Transaction From List and Storage**
    - **Validates: Requirements 2.5, 5.2**
    - Generate random non-empty transaction lists + random index → simulate delete → assert list length decreased by 1, id absent from `State.transactions`, and `localStorage` reflects removal

- [ ] 9. Implement application entry point (`DOMContentLoaded` bootstrap)
  - Add `document.addEventListener('DOMContentLoaded', ...)` at the bottom of `js/app.js`
  - Call `StorageService.load()` → populate `State.transactions` (use `[]` if `null` returned)
  - Call `Renderer.renderList`, `Renderer.renderBalance`, `ChartService.init`, `ChartService.update` in order
  - Call `Controller.init()`
  - _Requirements: 5.3, 5.4_

- [ ] 10. Final checkpoint — End-to-end validation
  - Ensure all automated tests pass with `npx vitest --run` from the `tests/` directory
  - Verify the app opens via `file://` in a browser: add transactions across all three categories, delete one, reload the page, confirm data persists and the pie chart, balance, and list are all restored correctly. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `tests/` directory lives alongside the project source; no `package.json` is committed inside the project folder itself — `npx vitest --run` is invoked from within `tests/`
- Property tests use **fast-check** with a minimum of 100 iterations each
- Each property test file must include the comment tag `// Feature: expense-budget-visualizer, Property N: <property text>` for traceability
- Unit tests and property tests are complementary — both are needed for full coverage
- Checkpoints ensure incremental validation before proceeding to dependent tasks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "3.3", "4.1"] },
    { "id": 2, "tasks": ["2.3", "3.4", "4.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4", "5.5", "7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1"] },
    { "id": 5, "tasks": ["7.3", "8.2", "8.3", "8.4"] },
    { "id": 6, "tasks": ["8.5"] }
  ]
}
```
