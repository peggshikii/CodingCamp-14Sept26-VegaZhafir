/* js/app.js — Expense & Budget Visualizer */

const CATEGORIES = ['Food', 'Transport', 'Fun'];

const CATEGORY_COLORS = {
  Food: '#FF6384',
  Transport: '#36A2EB',
  Fun: '#FFCE56',
};

const STORAGE_KEY = 'expense_visualizer_transactions';

const StorageService = {
  /**
   * Reads and deserializes transactions from localStorage.
   * Returns null if localStorage is unavailable or JSON.parse fails.
   * Returns [] if the parsed value is not an array.
   * Silently drops any items that fail schema validation.
   * @returns {Array|null}
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item =>
        typeof item.id === 'string' &&
        typeof item.itemName === 'string' && item.itemName.trim().length > 0 &&
        typeof item.amount === 'number' && isFinite(item.amount) && item.amount > 0 &&
        CATEGORIES.includes(item.category) &&
        typeof item.createdAt === 'number'
      );
    } catch {
      return null;
    }
  },

  /**
   * Serializes and saves transactions to localStorage.
   * @param {Array} transactions
   * @returns {boolean} true on success, false on failure
   */
  save(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// State — single in-memory source of truth
// ---------------------------------------------------------------------------

const State = {
  transactions: [],
};

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const Validator = {
  /**
   * Validates the add-transaction form data.
   *
   * @param {{ itemName: string, amount: string, category: string }} data
   * @returns {{ itemName?: string, amount?: string, category?: string }}
   *   An empty object means all fields are valid.
   */
  validateForm(data) {
    const errors = {};

    // itemName: non-empty after trim, max 100 characters
    const trimmedName = (data.itemName || '').trim();
    if (trimmedName.length === 0) {
      errors.itemName = 'Item name is required.';
    } else if (trimmedName.length > 100) {
      errors.itemName = 'Item name must be 100 characters or fewer.';
    }

    // amount: numeric, finite, within [0.01, 999999999.99]
    const parsedAmount = parseFloat(data.amount);
    if (data.amount === '' || data.amount === undefined || data.amount === null) {
      errors.amount = 'Amount is required.';
    } else if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (parsedAmount < 0.01 || parsedAmount > 999999999.99) {
      errors.amount = 'Amount must be between 0.01 and 999,999,999.99.';
    }

    // category: non-empty and one of the known categories
    if (!data.category || data.category === '') {
      errors.category = 'Please select a category.';
    } else if (!CATEGORIES.includes(data.category)) {
      errors.category = 'Category must be Food, Transport, or Fun.';
    }

    return errors;
  },
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const Renderer = {
  /**
   * Rebuilds the #transaction-list <ul> from the given transactions array.
   * Shows a placeholder <li> when the list is empty.
   * @param {Array} transactions
   */
  renderList(transactions) {
    const ul = document.getElementById('transaction-list');
    if (!ul) return;

    if (!transactions || transactions.length === 0) {
      ul.innerHTML = '<li class="no-transactions">No transactions added yet.</li>';
      return;
    }

    ul.innerHTML = transactions.map(t => {
      // itemName is already capped at 100 chars by validation, but truncate defensively
      const displayName = t.itemName.slice(0, 100);
      const formattedAmount = '$' + t.amount.toFixed(2);
      return `<li class="transaction-item">
        <span class="transaction-name">${_escapeHtml(displayName)}</span>
        <span class="transaction-amount">${formattedAmount}</span>
        <span class="transaction-category">${_escapeHtml(t.category)}</span>
        <button
          class="delete-btn"
          data-id="${_escapeHtml(t.id)}"
          aria-label="Delete ${_escapeHtml(displayName)}"
          type="button"
        >Delete</button>
      </li>`;
    }).join('');
  },

  /**
   * Computes the sum of all transaction amounts and updates #balance-display.
   * Toggles the .negative CSS class when the sum is less than zero.
   * @param {Array} transactions
   */
  renderBalance(transactions) {
    const el = document.getElementById('balance-display');
    if (!el) return;

    const sum = (transactions || []).reduce((acc, t) => acc + t.amount, 0);
    el.textContent = '$' + sum.toFixed(2);

    if (sum < 0) {
      el.classList.add('negative');
    } else {
      el.classList.remove('negative');
    }
  },

  /**
   * Displays per-field validation errors and moves focus to the first invalid field.
   * @param {{ itemName?: string, amount?: string, category?: string }} errors
   */
  renderErrors(errors) {
    const fields = [
      { key: 'itemName', inputId: 'item-name',  errorId: 'item-name-error' },
      { key: 'amount',   inputId: 'amount',      errorId: 'amount-error'    },
      { key: 'category', inputId: 'category',    errorId: 'category-error'  },
    ];

    let firstInvalid = null;

    fields.forEach(({ key, inputId, errorId }) => {
      const input = document.getElementById(inputId);
      const span  = document.getElementById(errorId);
      const msg   = errors[key];

      if (span) {
        span.textContent = msg || '';
      }

      if (input) {
        if (msg) {
          input.setAttribute('aria-invalid', 'true');
          if (!firstInvalid) firstInvalid = input;
        } else {
          input.removeAttribute('aria-invalid');
        }
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
    }
  },

  /**
   * Clears all field-level error spans and removes aria-invalid attributes.
   */
  clearErrors() {
    const fields = [
      { inputId: 'item-name', errorId: 'item-name-error' },
      { inputId: 'amount',    errorId: 'amount-error'    },
      { inputId: 'category',  errorId: 'category-error'  },
    ];

    fields.forEach(({ inputId, errorId }) => {
      const input = document.getElementById(inputId);
      const span  = document.getElementById(errorId);

      if (span)  span.textContent = '';
      if (input) input.removeAttribute('aria-invalid');
    });
  },

  /**
   * Resets all Input_Form fields to their default empty/unselected state.
   */
  clearForm() {
    const itemName = document.getElementById('item-name');
    const amount   = document.getElementById('amount');
    const category = document.getElementById('category');

    if (itemName) itemName.value = '';
    if (amount)   amount.value   = '';
    if (category) category.selectedIndex = 0;
  },

  /**
   * Displays a storage error message in #storage-error and auto-dismisses after 5 s.
   * @param {string} message
   */
  showStorageError(message) {
    const el = document.getElementById('storage-error');
    if (!el) return;

    el.textContent = message;

    setTimeout(() => {
      el.textContent = '';
    }, 5000);
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS when injecting user content.
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
