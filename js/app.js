/* js/app.js — Expense & Budget Visualizer */

// =============================================================================
// Constants & Default Categories
// =============================================================================

const DEFAULT_CATEGORIES = [
  { name: 'Food',      color: '#FF6384', isDefault: true },
  { name: 'Transport', color: '#36A2EB', isDefault: true },
  { name: 'Fun',       color: '#FFCE56', isDefault: true },
];

const STORAGE_KEY       = 'expense_visualizer_transactions';
const CATEGORIES_KEY    = 'expense_visualizer_categories';
const THEME_KEY         = 'expense_visualizer_theme';

// =============================================================================
// State — single in-memory source of truth
// =============================================================================

const State = {
  transactions: [],
  categories: [],   // [{ name, color, isDefault }]
  theme: 'light',
};

// =============================================================================
// Storage Service
// =============================================================================

const StorageService = {
  loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item =>
        typeof item.id === 'string' &&
        typeof item.itemName === 'string' && item.itemName.trim().length > 0 &&
        typeof item.amount === 'number' && isFinite(item.amount) && item.amount > 0 &&
        typeof item.category === 'string' &&
        typeof item.createdAt === 'number'
      );
    } catch { return null; }
  },

  saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch { return false; }
  },

  loadCategories() {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY);
      if (raw === null) return [...DEFAULT_CATEGORIES];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...DEFAULT_CATEGORIES];
      return parsed.filter(c =>
        typeof c.name === 'string' && c.name.trim().length > 0 &&
        typeof c.color === 'string'
      );
    } catch { return [...DEFAULT_CATEGORIES]; }
  },

  saveCategories(categories) {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
      return true;
    } catch { return false; }
  },

  loadTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  },

  saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* ignore */ }
  },
};

// =============================================================================
// Validator
// =============================================================================

const Validator = {
  validateForm(data, categoryNames) {
    const errors = {};
    const trimmedName = (data.itemName || '').trim();
    if (trimmedName.length === 0) {
      errors.itemName = 'Item name is required.';
    } else if (trimmedName.length > 100) {
      errors.itemName = 'Item name must be 100 characters or fewer.';
    }

    const parsedAmount = parseFloat(data.amount);
    if (data.amount === '' || data.amount === undefined || data.amount === null) {
      errors.amount = 'Amount is required.';
    } else if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (parsedAmount < 0.01 || parsedAmount > 999999999.99) {
      errors.amount = 'Amount must be between 0.01 and 999,999,999.99.';
    }

    if (!data.category || data.category === '') {
      errors.category = 'Please select a category.';
    } else if (!categoryNames.includes(data.category)) {
      errors.category = 'Please select a valid category.';
    }

    return errors;
  },

  validateNewCategory(name, existingNames) {
    const trimmed = (name || '').trim();
    if (trimmed.length === 0) return 'Category name is required.';
    if (trimmed.length > 30)  return 'Category name must be 30 characters or fewer.';
    if (existingNames.map(n => n.toLowerCase()).includes(trimmed.toLowerCase()))
      return 'Category already exists.';
    return null;
  },
};

// =============================================================================
// Chart instances
// =============================================================================

let pieChartInstance = null;
let barChartInstance = null;

// =============================================================================
// Renderer
// =============================================================================

const Renderer = {
  // ---- Category helpers ----

  getCategoryColor(name) {
    const cat = State.categories.find(c => c.name === name);
    return cat ? cat.color : '#9e9e9e';
  },

  // ---- Category tags (Manage Categories section) ----

  renderCategoryTags() {
    const container = document.getElementById('category-list');
    if (!container) return;

    container.innerHTML = State.categories.map(cat => `
      <span class="category-tag${cat.isDefault ? ' default-cat' : ''}">
        <span class="tag-dot" style="background:${_escapeHtml(cat.color)}"></span>
        ${_escapeHtml(cat.name)}
        <button class="tag-delete" data-cat="${_escapeHtml(cat.name)}"
          aria-label="Remove category ${_escapeHtml(cat.name)}" type="button">×</button>
      </span>
    `).join('');
  },

  // ---- Category <select> options ----

  renderCategorySelect() {
    const select = document.getElementById('category');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- Select Category --</option>' +
      State.categories.map(c =>
        `<option value="${_escapeHtml(c.name)}"${c.name === current ? ' selected' : ''}>${_escapeHtml(c.name)}</option>`
      ).join('');
  },

  // ---- Transaction list ----

  renderList(transactions) {
    const ul = document.getElementById('transaction-list');
    if (!ul) return;
    if (!transactions || transactions.length === 0) {
      ul.innerHTML = '<li class="no-transactions">No transactions added yet.</li>';
      return;
    }
    ul.innerHTML = transactions.map(t => {
      const displayName     = t.itemName.slice(0, 100);
      const formattedAmount = '$' + t.amount.toFixed(2);
      const color           = Renderer.getCategoryColor(t.category);
      return `<li class="transaction-item">
        <span class="tag-dot" style="background:${color};width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
        <span class="transaction-name">${_escapeHtml(displayName)}</span>
        <span class="transaction-amount">${formattedAmount}</span>
        <span class="transaction-category">${_escapeHtml(t.category)}</span>
        <button class="delete-btn" data-id="${_escapeHtml(t.id)}"
          aria-label="Delete ${_escapeHtml(displayName)}" type="button">Delete</button>
      </li>`;
    }).join('');
  },

  // ---- Balance ----

  renderBalance(transactions) {
    const el = document.getElementById('balance-display');
    if (!el) return;
    const sum = (transactions || []).reduce((acc, t) => acc + t.amount, 0);
    el.textContent = '$' + sum.toFixed(2);
    sum < 0 ? el.classList.add('negative') : el.classList.remove('negative');
  },

  // ---- Form errors ----

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
      if (span) span.textContent = msg || '';
      if (input) {
        if (msg) { input.setAttribute('aria-invalid', 'true'); if (!firstInvalid) firstInvalid = input; }
        else input.removeAttribute('aria-invalid');
      }
    });
    if (firstInvalid) firstInvalid.focus();
  },

  clearErrors() {
    [
      { inputId: 'item-name', errorId: 'item-name-error' },
      { inputId: 'amount',    errorId: 'amount-error'    },
      { inputId: 'category',  errorId: 'category-error'  },
    ].forEach(({ inputId, errorId }) => {
      const input = document.getElementById(inputId);
      const span  = document.getElementById(errorId);
      if (span)  span.textContent = '';
      if (input) input.removeAttribute('aria-invalid');
    });
  },

  clearForm() {
    const itemName = document.getElementById('item-name');
    const amount   = document.getElementById('amount');
    const category = document.getElementById('category');
    if (itemName) itemName.value = '';
    if (amount)   amount.value   = '';
    if (category) category.selectedIndex = 0;
  },

  showStorageError(message) {
    const el = document.getElementById('storage-error');
    if (!el) return;
    el.textContent = message;
    setTimeout(() => { el.textContent = ''; }, 5000);
  },

  // ---- Pie chart ----

  renderPieChart(transactions) {
    const canvas    = document.getElementById('pie-chart');
    const container = document.getElementById('chart-container');
    if (!canvas || !container) return;

    const existing = container.querySelector('.no-data-message');
    if (existing) existing.remove();

    if (!transactions || transactions.length === 0) {
      if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
      canvas.style.display = 'none';
      const msg = document.createElement('p');
      msg.className = 'no-data-message';
      msg.textContent = 'No data to display yet.';
      container.appendChild(msg);
      return;
    }

    canvas.style.display = '';
    const totals = {};
    transactions.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    const labels = Object.keys(totals);
    const data   = labels.map(l => totals[l]);
    const colors = labels.map(l => Renderer.getCategoryColor(l));

    if (pieChartInstance) {
      pieChartInstance.data.labels = labels;
      pieChartInstance.data.datasets[0].data   = data;
      pieChartInstance.data.datasets[0].backgroundColor = colors;
      pieChartInstance.update();
    } else {
      pieChartInstance = new Chart(canvas, {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2 }] },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const val   = ctx.parsed;
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: $${val.toFixed(2)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    }
  },

  // ---- Monthly summary table ----

  renderMonthlySummary() {
    const yearSelect = document.getElementById('summary-year');
    const content    = document.getElementById('monthly-summary-content');
    if (!yearSelect || !content) return;

    // Populate year selector
    const years = [...new Set(
      State.transactions.map(t => new Date(t.createdAt).getFullYear())
    )].sort((a, b) => b - a);

    if (years.length === 0) {
      // default to current year
      const currentYear = new Date().getFullYear();
      years.push(currentYear);
    }

    const selectedYear = parseInt(yearSelect.value) || years[0];

    // Rebuild year options if needed
    const existingYears = [...yearSelect.options].map(o => parseInt(o.value));
    const needsRebuild = years.some(y => !existingYears.includes(y)) ||
                         existingYears.some(y => !years.includes(y));
    if (needsRebuild) {
      yearSelect.innerHTML = years.map(y =>
        `<option value="${y}"${y === selectedYear ? ' selected' : ''}>${y}</option>`
      ).join('');
    }

    const filtered = State.transactions.filter(t =>
      new Date(t.createdAt).getFullYear() === selectedYear
    );

    if (filtered.length === 0) {
      content.innerHTML = `<p class="summary-empty">No transactions for ${selectedYear}.</p>`;
      Renderer.renderBarChart([], selectedYear);
      return;
    }

    // Group by month
    const months = {};
    filtered.forEach(t => {
      const month = new Date(t.createdAt).getMonth(); // 0-11
      if (!months[month]) months[month] = { total: 0, byCategory: {} };
      months[month].total += t.amount;
      months[month].byCategory[t.category] = (months[month].byCategory[t.category] || 0) + t.amount;
    });

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const rows = Object.keys(months).sort((a, b) => a - b).map(m => {
      const data = months[m];
      const topCat = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])[0];
      return `<tr>
        <td>${monthNames[m]}</td>
        <td>$${data.total.toFixed(2)}</td>
        <td>${topCat ? _escapeHtml(topCat[0]) : '-'}</td>
        <td>${Object.keys(data.byCategory).length}</td>
      </tr>`;
    }).join('');

    const grandTotal = filtered.reduce((acc, t) => acc + t.amount, 0);

    content.innerHTML = `
      <table class="summary-table" aria-label="Monthly summary for ${selectedYear}">
        <thead>
          <tr>
            <th>Month</th>
            <th>Total Spent</th>
            <th>Top Category</th>
            <th>Categories Used</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td>Total ${selectedYear}</td>
            <td>$${grandTotal.toFixed(2)}</td>
            <td colspan="2">${filtered.length} transaction(s)</td>
          </tr>
        </tfoot>
      </table>
    `;

    Renderer.renderBarChart(months, selectedYear);
  },

  // ---- Bar chart (monthly) ----

  renderBarChart(months, year) {
    const canvas    = document.getElementById('bar-chart');
    const container = document.getElementById('bar-chart-container');
    if (!canvas || !container) return;

    const existing = container.querySelector('.no-data-message');
    if (existing) existing.remove();

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = monthNames;
    const data   = monthNames.map((_, i) => months[i] ? months[i].total : 0);
    const hasData = data.some(v => v > 0);

    if (!hasData) {
      if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
      canvas.style.display = 'none';
      const msg = document.createElement('p');
      msg.className = 'no-data-message';
      msg.textContent = `No spending data for ${year}.`;
      container.appendChild(msg);
      return;
    }

    canvas.style.display = '';

    if (barChartInstance) {
      barChartInstance.data.datasets[0].data = data;
      barChartInstance.update();
    } else {
      barChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total Spent ($)',
            data,
            backgroundColor: 'rgba(74, 144, 226, 0.7)',
            borderColor:     '#4a90e2',
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` $${ctx.parsed.y.toFixed(2)}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => '$' + v },
            },
          },
        },
      });
    }
  },

  // ---- Theme ----

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  },
};

// =============================================================================
// Internal helpers
// =============================================================================

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAll() {
  Renderer.renderList(State.transactions);
  Renderer.renderBalance(State.transactions);
  Renderer.renderPieChart(State.transactions);
  Renderer.renderCategoryTags();
  Renderer.renderCategorySelect();
}

// =============================================================================
// Init
// =============================================================================

(function init() {
  // Load theme
  State.theme = StorageService.loadTheme();
  Renderer.applyTheme(State.theme);

  // Load categories
  State.categories = StorageService.loadCategories();

  // Load transactions
  const loaded = StorageService.loadTransactions();
  if (loaded === null) {
    State.transactions = [];
    Renderer.showStorageError('Unable to load saved data. localStorage may be unavailable.');
  } else {
    State.transactions = loaded;
  }

  renderAll();
  Renderer.renderMonthlySummary();

  // ---- Theme toggle ----
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn && themeBtn.addEventListener('click', () => {
    State.theme = State.theme === 'light' ? 'dark' : 'light';
    Renderer.applyTheme(State.theme);
    StorageService.saveTheme(State.theme);
  });

  // ---- Tab switching ----
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', !panel.id.endsWith(target));
      });

      if (target === 'summary') {
        Renderer.renderMonthlySummary();
      }
    });
  });

  // ---- Add transaction ----
  const form = document.getElementById('transaction-form');
  form && form.addEventListener('submit', e => {
    e.preventDefault();
    Renderer.clearErrors();

    const data = {
      itemName: document.getElementById('item-name').value,
      amount:   document.getElementById('amount').value,
      category: document.getElementById('category').value,
    };

    const categoryNames = State.categories.map(c => c.name);
    const errors = Validator.validateForm(data, categoryNames);
    if (Object.keys(errors).length > 0) { Renderer.renderErrors(errors); return; }

    const transaction = {
      id:        crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      itemName:  data.itemName.trim(),
      amount:    parseFloat(data.amount),
      category:  data.category,
      createdAt: Date.now(),
    };

    State.transactions.push(transaction);
    const saved = StorageService.saveTransactions(State.transactions);
    if (!saved) Renderer.showStorageError('Transaction added but could not be saved.');

    renderAll();
    Renderer.clearForm();
  });

  // ---- Delete transaction ----
  const list = document.getElementById('transaction-list');
  list && list.addEventListener('click', e => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    State.transactions = State.transactions.filter(t => t.id !== id);
    const saved = StorageService.saveTransactions(State.transactions);
    if (!saved) Renderer.showStorageError('Transaction deleted but changes could not be saved.');
    renderAll();
  });

  // ---- Add custom category ----
  const addCatForm = document.getElementById('add-category-form');
  addCatForm && addCatForm.addEventListener('submit', e => {
    e.preventDefault();
    const nameInput  = document.getElementById('new-category');
    const colorInput = document.getElementById('new-category-color');
    const errorSpan  = document.getElementById('new-category-error');

    const name  = nameInput ? nameInput.value : '';
    const color = colorInput ? colorInput.value : '#4a90e2';
    const existingNames = State.categories.map(c => c.name);

    const error = Validator.validateNewCategory(name, existingNames);
    if (error) {
      if (errorSpan) errorSpan.textContent = error;
      if (nameInput) { nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); }
      return;
    }

    if (errorSpan) errorSpan.textContent = '';
    if (nameInput) nameInput.removeAttribute('aria-invalid');

    State.categories.push({ name: name.trim(), color, isDefault: false });
    StorageService.saveCategories(State.categories);

    if (nameInput)  nameInput.value = '';
    if (colorInput) colorInput.value = '#4a90e2';

    Renderer.renderCategoryTags();
    Renderer.renderCategorySelect();
  });

  // ---- Delete custom category ----
  const catList = document.getElementById('category-list');
  catList && catList.addEventListener('click', e => {
    const btn = e.target.closest('.tag-delete');
    if (!btn) return;
    const catName = btn.dataset.cat;
    const cat = State.categories.find(c => c.name === catName);
    if (!cat || cat.isDefault) return; // can't delete defaults

    State.categories = State.categories.filter(c => c.name !== catName);
    StorageService.saveCategories(State.categories);
    Renderer.renderCategoryTags();
    Renderer.renderCategorySelect();
  });

  // ---- Year selector for monthly summary ----
  const yearSelect = document.getElementById('summary-year');
  yearSelect && yearSelect.addEventListener('change', () => {
    Renderer.renderMonthlySummary();
  });

})();
