# Design Document — Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side, single-page web application. It lets users record personal expense transactions, review them in a scrollable list, track a running total balance, and understand their spending breakdown through an interactive pie chart. All data is stored in `localStorage`; there is no backend server and no build toolchain. The deliverable is a folder of static files openable directly via the `file://` protocol.

**Technology choices:**
- **HTML5** — semantic markup, native form elements
- **CSS3** (single file `css/style.css`) — Flexbox/Grid layout, responsive breakpoints, custom properties for theming
- **Vanilla JavaScript ES2020** (single file `js/app.js`) — no frameworks, no bundler
- **Chart.js 4.x** loaded from CDN — pie chart rendering

**Key quality attributes:**
- Works offline (only external request is the Chart.js CDN script load)
- Survives `localStorage` unavailability gracefully
- Accessible at WCAG 2.1 AA level: keyboard-operable, labelled inputs, visible focus indicators
- Responsive from 320 px viewport upward

---

## Architecture

The application follows a simple **Model → View → Controller** separation within a single JS file (`js/app.js`). There are no modules or imports; all code executes in the browser's global scope via a single `<script>` tag.

```mermaid
flowchart TD
    subgraph HTML [index.html]
        FORM[Input Form]
        LIST[Transaction List]
        BAL[Balance Display]
        CHART_CONTAINER[Chart Container]
    end

    subgraph JS [js/app.js]
        STATE[State\n transactions\: Transaction[]]
        VALIDATOR[Validator\nvalidateForm\(\)]
        STORAGE[StorageService\nload / save / delete]
        RENDERER[Renderer\nrenderList / renderBalance / renderChart]
        CONTROLLER[Controller\nhandleSubmit / handleDelete]
        CHART_SVC[ChartService\ninitChart / updateChart]
    end

    subgraph BROWSER [Browser APIs]
        LS[localStorage]
        CHARTJS[Chart.js CDN]
    end

    FORM -->|submit event| CONTROLLER
    LIST -->|click delete| CONTROLLER
    CONTROLLER --> VALIDATOR
    CONTROLLER --> STATE
    CONTROLLER --> STORAGE
    CONTROLLER --> RENDERER
    RENDERER --> BAL
    RENDERER --> LIST
    RENDERER --> CHART_SVC
    CHART_SVC --> CHART_CONTAINER
    CHART_SVC --> CHARTJS
    STORAGE --> LS
    STATE -.->|in-memory array| CONTROLLER
```

**Data flow for adding a transaction:**
1. User fills form → clicks "Add Transaction"
2. `handleSubmit` calls `validateForm` → collects errors
3. If errors: inline error messages rendered, return
4. Build `Transaction` object, push to in-memory `state.transactions`
5. `StorageService.save(state.transactions)` — on failure: display storage error, rollback push, return
6. `Renderer.renderList`, `Renderer.renderBalance`, `ChartService.updateChart` called synchronously (all updates within one event-loop tick, well under 500 ms)

**Data flow for deleting a transaction:**
1. Click on delete button (carries `data-id` attribute)
2. `handleDelete` finds transaction by id, splices from `state.transactions`
3. `StorageService.save(state.transactions)` — on failure: re-insert transaction, display error, return
4. Same render cascade as above

---

## Components and Interfaces

### 1. HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display" role="status" aria-live="polite">$0.00</div>
  </header>

  <main>
    <section aria-labelledby="form-heading">
      <h2 id="form-heading">Add Transaction</h2>
      <form id="transaction-form" novalidate>
        <div class="field-group">
          <label for="item-name">Item Name</label>
          <input id="item-name" name="itemName" type="text" maxlength="100" />
          <span class="field-error" id="item-name-error" role="alert"></span>
        </div>
        <div class="field-group">
          <label for="amount">Amount</label>
          <input id="amount" name="amount" type="number" min="0.01"
                 max="999999999.99" step="0.01" />
          <span class="field-error" id="amount-error" role="alert"></span>
        </div>
        <div class="field-group">
          <label for="category">Category</label>
          <select id="category" name="category">
            <option value="">-- Select Category --</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
          <span class="field-error" id="category-error" role="alert"></span>
        </div>
        <button type="submit">Add Transaction</button>
      </form>
    </section>

    <section aria-labelledby="list-heading">
      <h2 id="list-heading">Transactions</h2>
      <ul id="transaction-list" aria-label="Transaction list"></ul>
      <!-- Empty state injected by JS when list is empty -->
    </section>

    <section aria-labelledby="chart-heading">
      <h2 id="chart-heading">Spending by Category</h2>
      <div id="chart-container">
        <canvas id="pie-chart" aria-label="Spending pie chart" role="img"></canvas>
        <!-- No-data message injected by JS when list is empty -->
      </div>
    </section>
  </main>
</body>
```

### 2. JavaScript Modules (within `js/app.js`)

All functions are organized into logical namespaces using plain object literals.

#### `StorageService`

```js
const StorageService = {
  STORAGE_KEY: 'expense_visualizer_transactions',

  // Returns Transaction[] or null on failure
  load(): Transaction[] | null,

  // Returns true on success, false on failure
  save(transactions: Transaction[]): boolean,
};
```

#### `Validator`

```js
const Validator = {
  // Returns { itemName?: string, amount?: string, category?: string }
  // Empty object means valid
  validateForm(data: { itemName: string, amount: string, category: string }): ValidationErrors,
};
```

Validation rules:
- `itemName`: non-empty after trim; ≤ 100 characters
- `amount`: parses as float; within [0.01, 999999999.99] inclusive; must be numeric (reject NaN, Infinity)
- `category`: non-empty; one of `['Food', 'Transport', 'Fun']`

#### `State`

```js
const State = {
  transactions: Transaction[],   // single source of truth; mutated in place
};
```

#### `Renderer`

```js
const Renderer = {
  renderList(transactions: Transaction[]): void,
  renderBalance(transactions: Transaction[]): void,
  renderErrors(errors: ValidationErrors): void,
  clearErrors(): void,
  clearForm(): void,
  showStorageError(message: string): void,
};
```

- `renderList` rebuilds the `<ul>` innerHTML; shows placeholder `<li>` when empty
- `renderBalance` computes sum, formats to 2 dp with `$` prefix, toggles `.negative` CSS class when sum < 0
- `renderErrors` sets `textContent` on each `#*-error` span; adds `aria-invalid="true"` to the corresponding input

#### `ChartService`

```js
const ChartService = {
  chart: Chart | null,   // Chart.js instance

  init(): void,           // called once on DOMContentLoaded
  update(transactions: Transaction[]): void,
};
```

- `init` creates the `Chart` instance on `#pie-chart` canvas
- `update` computes per-category sums, calls `chart.data.datasets[0].data = [...]` and `chart.update('none')` for smooth update without animation on data change

#### `Controller`

```js
const Controller = {
  handleSubmit(event: SubmitEvent): void,
  handleDelete(event: MouseEvent): void,
  init(): void,   // attaches event listeners
};
```

### 3. CSS Architecture (`css/style.css`)

Organised into sections:
1. **CSS Custom Properties** — color palette, spacing scale, font sizes
2. **Reset / Base** — box-sizing, font-family, min body width 320 px
3. **Layout** — `<header>`, `<main>` (single column), `<section>` spacing
4. **Balance Display** — large prominent number; `.negative` class overrides color to red (`#d32f2f`)
5. **Form** — `.field-group` Flexbox column; label, input/select, error span stacked vertically
6. **Validation errors** — `.field-error` red small text; hidden when empty via `min-height: 0`
7. **Transaction List** — `overflow-y: auto; max-height: 40vh;` scrollable; each item row with Flexbox spread
8. **Delete Button** — accessible button with `aria-label`
9. **Chart Container** — max-width constraint; centered
10. **Responsive** — `@media (max-width: 480px)` adjustments: full-width elements, reduced padding
11. **Focus Styles** — `:focus-visible` outlines for all interactive elements

---

## Data Models

### `Transaction`

```js
/**
 * @typedef {Object} Transaction
 * @property {string}   id        - Unique identifier (crypto.randomUUID() or Date.now() fallback)
 * @property {string}   itemName  - Expense description, 1–100 characters
 * @property {number}   amount    - Positive number, 0.01–999999999.99
 * @property {Category} category  - One of 'Food' | 'Transport' | 'Fun'
 * @property {number}   createdAt - Unix timestamp (ms) for ordering
 */
```

### `Category` (enum-like constant)

```js
const CATEGORIES = /** @type {const} */ (['Food', 'Transport', 'Fun']);
// type Category = 'Food' | 'Transport' | 'Fun'
```

### `ValidationErrors`

```js
/**
 * @typedef {Object} ValidationErrors
 * @property {string} [itemName]  - Error message for item name field, if invalid
 * @property {string} [amount]    - Error message for amount field, if invalid
 * @property {string} [category]  - Error message for category field, if invalid
 */
```

### Local Storage Schema

```
Key:   "expense_visualizer_transactions"
Value: JSON array of Transaction objects

Example:
[
  {
    "id": "a1b2c3d4-...",
    "itemName": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1700000000000
  }
]
```

**Deserialization guard:** after `JSON.parse`, each item is checked for the presence of `id`, `itemName` (string), `amount` (finite positive number), `category` (member of `CATEGORIES`), and `createdAt` (number). Any record failing validation is silently dropped. If the top-level parsed value is not an array, the entire stored payload is discarded and an empty list is used (requirement 5.3).

### Chart.js Data Shape

```js
{
  type: 'pie',
  data: {
    labels: ['Food', 'Transport', 'Fun'],      // only categories with amount > 0
    datasets: [{
      data: [120.00, 45.50, 80.00],            // sums per category in same order
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
      hoverOffset: 4,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: /* "$X.XX (Y%)" format */ } }
    }
  }
}
```

Category colors are fixed constants — each category always maps to the same color regardless of which categories have data, ensuring visual consistency across sessions.

```js
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction Add Round-Trip

*For any* valid transaction (non-empty item name ≤ 100 chars, amount in [0.01, 999999999.99], category in {Food, Transport, Fun}), submitting the add form should increase the in-memory transaction list length by exactly 1 and the new transaction should be recoverable by parsing the value stored in `localStorage` under the app's fixed key.

**Validates: Requirements 1.3, 5.1**

---

### Property 2: Invalid Input Rejected With Per-Field Errors

*For any* form submission where at least one field is invalid (empty or whitespace-only item name, amount outside [0.01, 999999999.99] or non-numeric, category not selected), the validator should return a non-empty errors object with a message for each invalid field, the transaction list length should remain unchanged, and the error span adjacent to each invalid field should be non-empty.

**Validates: Requirements 1.4, 1.5**

---

### Property 3: Form Cleared After Successful Add

*For any* valid transaction submission, after the transaction is successfully added the item name input value, amount input value, and category select value should all be empty or reset to their default unselected state.

**Validates: Requirements 1.6**

---

### Property 4: Delete Removes Transaction From List and Storage

*For any* non-empty list of transactions and any transaction at index *i*, clicking that transaction's delete button should reduce the in-memory list length by exactly 1, the deleted transaction's id should no longer appear in the in-memory list, and `JSON.parse(localStorage.getItem(STORAGE_KEY))` should reflect the same removal.

**Validates: Requirements 2.5, 5.2**

---

### Property 5: List Item Rendering Invariant

*For any* non-empty list of transactions, every rendered `<li>` element should contain: the item name truncated to a maximum of 100 characters, the amount formatted as a string matching `"$X.XX"` (two decimal places, currency prefix), the category label, and exactly one delete button element.

**Validates: Requirements 2.2, 2.4**

---

### Property 6: Balance Equals Sum Invariant

*For any* list of transactions (including the empty list), the text content of the Balance_Display element should equal `"$" + sum.toFixed(2)` where `sum` is the arithmetic sum of all transaction amounts. This invariant must hold after initialization, after any add, and after any delete.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 7: Negative Balance Gets Distinct Styling

*For any* transaction list whose sum is strictly less than zero, the Balance_Display element should carry the `.negative` CSS class; for any transaction list whose sum is greater than or equal to zero, the `.negative` class should be absent.

**Validates: Requirements 3.5**

---

### Property 8: Chart Labels Equal Categories With Data

*For any* list of transactions, the labels array passed to Chart.js should equal exactly the set of categories for which the sum of amounts is greater than zero — no more, no less.

**Validates: Requirements 4.1, 4.3, 4.4**

---

### Property 9: Chart Data Proportional to Category Sums

*For any* non-empty list of transactions, the dataset values array passed to Chart.js should equal the per-category sums corresponding to the chart labels, and each value divided by the total sum should equal that category's proportional share to within floating-point tolerance.

**Validates: Requirements 4.2**

---

### Property 10: Chart Category Colors Are Unique

*For any* non-empty list of transactions, the `backgroundColor` values in the Chart.js dataset for all active (non-zero) categories should be pairwise distinct — no two active category slices share the same color.

**Validates: Requirements 4.6**

---

### Property 11: Initialization Deserializes Stored Transactions

*For any* valid JSON array of transactions serialized into `localStorage` under the fixed key, calling the app's initialization function should result in `state.transactions` being deeply equal to the parsed array. For any corrupt or non-array payload (invalid JSON, wrong type), `state.transactions` should be an empty array after initialization.

**Validates: Requirements 5.3, 5.4**

---

## Error Handling

### Storage Unavailability

`localStorage` can be unavailable in private/incognito mode (in some browsers) or when storage quota is exceeded. The `StorageService` wraps all `localStorage` calls in `try/catch` blocks.

| Scenario | Detection | Behavior |
|---|---|---|
| `localStorage.setItem` throws on **add** | `try/catch` in `StorageService.save` | Roll back the push from `state.transactions`; call `Renderer.showStorageError("Could not save transaction. Storage unavailable.")` |
| `localStorage.setItem` throws on **delete** | `try/catch` in `StorageService.save` | Re-insert the transaction at its original index; call `Renderer.showStorageError("Could not delete transaction. Storage unavailable.")` |
| `localStorage.getItem` / `JSON.parse` throws on **init** | `try/catch` in `StorageService.load` | Return `null`; Controller initializes with empty state |
| Stored data fails schema validation on init | Item-level guard loop | Silently drop malformed items; continue with valid ones |

The storage error message is rendered in a `<div id="storage-error" role="alert">` at the top of `<main>`. It auto-dismisses after 5 seconds via `setTimeout` and is also cleared at the start of the next add or delete attempt.

### Validation Errors

Validation errors are per-field. The `Renderer.renderErrors` function:
1. Sets `textContent` on each `#*-error` span (empty string if no error for that field)
2. Sets `aria-invalid="true"` on fields with errors; removes the attribute on fields that pass
3. Moves focus to the first invalid field so screen reader users hear the error immediately

Errors are cleared by `Renderer.clearErrors` before each validation run and on form reset.

### Chart.js Unavailability

If the Chart.js CDN script fails to load (network offline), `window.Chart` will be undefined. `ChartService.init` guards with:
```js
if (typeof Chart === 'undefined') {
  document.getElementById('chart-container').textContent =
    'Chart library could not be loaded. Please check your internet connection.';
  return;
}
```
All subsequent `ChartService.update` calls check `this.chart !== null` before proceeding.

---

## Testing Strategy

### Overview

Because this application consists entirely of DOM manipulation, event handling, and `localStorage` interaction (no pure algorithmic core beyond the formatter and validator), most behavior is tested through DOM-level unit tests. Property-based tests are written for the pure logic functions (`Validator`, balance computation, chart data computation, list item rendering).

The project has no build toolchain (requirement 6.3), so tests run in a **jsdom** environment via **Vitest** (or Jest with jsdom preset) invoked directly with `npx vitest --run` — no `package.json` is committed to the project source folder; the test setup lives in a sibling `tests/` directory.

> **Note:** Full WCAG compliance requires manual testing with assistive technologies. The automated tests below cover structural accessibility (label associations, `aria-*` attributes) but not screen reader interaction quality.

### Unit Tests (Example-Based)

| Test | Requirement(s) |
|---|---|
| Form renders with correct input attributes (type, min, max, maxlength) | 1.1 |
| Submit button has label "Add Transaction" | 1.2 |
| Empty transaction list shows placeholder message | 2.3 |
| Empty transaction list shows "$0.00" balance | 3.4 |
| Empty transaction list shows no-data chart message | 4.5 |
| Storage error on add: transaction not added, error shown | 1.7 |
| Storage error on delete: transaction retained, error shown | 2.6 |
| Corrupt localStorage on init: state is empty | 5.3 |
| Each input has an associated `<label>` element | 7.4 |
| All interactive elements are focusable (tabIndex ≥ 0) | 7.4 |

### Property-Based Tests

Library: **fast-check** (JavaScript)
Minimum iterations per test: **100**

Each property test references its design property via a comment tag:
`// Feature: expense-budget-visualizer, Property N: <property text>`

| Property | Test Description |
|---|---|
| Property 1 | Generate random valid transaction tuples → add → assert list length +1 and localStorage contains new item |
| Property 2 | Generate random invalid field combinations → validate → assert errors non-empty and list unchanged |
| Property 3 | Generate random valid transactions → add → assert all form fields empty/default |
| Property 4 | Generate random non-empty transaction lists + random index → delete → assert list length -1, id gone, localStorage updated |
| Property 5 | Generate random transaction lists → render list → assert each `<li>` contains truncated name, formatted amount, category, delete button |
| Property 6 | Generate random transaction lists (including empty) → render balance → assert text equals `"$" + sum.toFixed(2)` |
| Property 7 | Generate lists with negative sum → assert `.negative` class present; generate lists with non-negative sum → assert class absent |
| Property 8 | Generate random transaction lists → compute chart data → assert labels = categories with sum > 0 |
| Property 9 | Generate random non-empty lists → compute chart data → assert dataset values = per-category sums, proportions correct |
| Property 10 | Generate random non-empty lists → compute chart data → assert backgroundColor values are pairwise distinct |
| Property 11 | Generate valid transaction arrays → serialize to localStorage → init → assert state equals stored array; generate corrupt payloads → init → assert state is empty |

### Integration / Smoke Tests

| Test | Requirement(s) |
|---|---|
| App opens via `file://` in Chrome without console errors (manual) | 6.4 |
| No fetch/XHR calls observed in Network tab other than Chart.js CDN (manual) | 5.5 |
| Viewport 320 px: no horizontal scroll, no overlapping elements (manual) | 7.3 |
| All form controls operable via Tab + Enter/Space (manual) | 7.4 |
| Visible focus indicator on all interactive elements (manual) | 7.4 |
