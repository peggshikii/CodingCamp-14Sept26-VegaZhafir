# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that enables users to track personal expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The application requires no backend server, stores all data in the browser's Local Storage, and is built with HTML, CSS, and Vanilla JavaScript. It can be used as a standalone web page or packaged as a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, an amount, and a category.
- **Transaction_List**: The scrollable on-screen list displaying all stored transactions.
- **Input_Form**: The HTML form through which users submit new transactions.
- **Balance_Display**: The UI element at the top of the page showing the computed total balance.
- **Pie_Chart**: The visual chart rendered by Chart.js that shows spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Validator**: The client-side validation logic that checks Input_Form fields before submission.
- **Category**: One of three predefined expense categories — Food, Transport, or Fun.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE App SHALL render the Input_Form containing three fields: Item Name (text, maximum 100 characters), Amount (number, accepting values from 0.01 to 999999999.99), and Category (select with options Food, Transport, and Fun).
2. THE App SHALL render a submit button on the Input_Form labeled "Add Transaction".
3. WHEN the user submits the Input_Form with all fields filled and Amount greater than zero, THE App SHALL add a new Transaction to the Transaction_List and persist it to Storage within 2 seconds.
4. WHEN the user submits the Input_Form, THE Validator SHALL verify that the Item Name field is not empty, the Amount field contains a numeric value between 0.01 and 999999999.99 inclusive, and the Category field has a selected value.
5. IF the Validator detects that any required field is empty or the Amount is not a numeric value between 0.01 and 999999999.99 inclusive, THEN THE App SHALL display an inline error message adjacent to each invalid field identifying the validation failure and SHALL NOT add the Transaction.
6. WHEN a Transaction is successfully added, THE App SHALL clear all Input_Form fields and reset the Category selector to its default unselected state.
7. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL display an error message indicating the Transaction could not be saved and SHALL NOT add the Transaction to the Transaction_List.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE App SHALL render the Transaction_List as a scrollable container below the Input_Form.
2. WHEN the Transaction_List contains one or more Transactions, THE App SHALL display each Transaction as a list item showing the item name truncated to a maximum of 100 characters, the amount formatted to two decimal places with a currency symbol, and the Category label.
3. WHEN the Transaction_List is empty, THE App SHALL display a placeholder message indicating that no transactions have been added.
4. THE App SHALL render a delete button on each Transaction list item.
5. WHEN the user activates the delete button on a Transaction list item, THE App SHALL remove that Transaction from the Transaction_List and from Storage.
6. IF Storage is unavailable when the user activates the delete button, THEN THE App SHALL display an error message indicating the deletion failed and retain the Transaction in the Transaction_List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page so that I can quickly understand how much I have spent overall.

#### Acceptance Criteria

1. THE App SHALL render the Balance_Display as the topmost visible element showing the sum of all Transaction amounts formatted to two decimal places with a currency symbol prefix.
2. WHEN a Transaction is added to the Transaction_List, THE Balance_Display SHALL update to reflect the new total within 500 milliseconds without requiring a page reload.
3. WHEN a Transaction is deleted from the Transaction_List, THE Balance_Display SHALL update to reflect the revised total within 500 milliseconds without requiring a page reload.
4. WHEN the Transaction_List is empty, THE Balance_Display SHALL show "$0.00".
5. WHEN the computed total is negative, THE Balance_Display SHALL render the amount in a visually distinct color (e.g. red) to differentiate it from a positive balance.

---

### Requirement 4: Category Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL render the Pie_Chart using Chart.js, displaying one slice per Category that contains at least one Transaction.
2. WHEN Transactions exist in the Transaction_List, THE Pie_Chart SHALL display each Category slice sized proportionally to that Category's share of total spending, where each slice angle equals (category sum / total sum) × 360 degrees.
3. WHEN a Transaction is added to the Transaction_List, THE Pie_Chart SHALL update to reflect the new category distribution without requiring a page reload.
4. WHEN a Transaction is deleted from the Transaction_List and that deletion removes the last Transaction for a Category, THE Pie_Chart SHALL remove that Category's slice and update proportions accordingly without requiring a page reload.
5. WHEN the Transaction_List is empty, THE Pie_Chart SHALL display a text message in place of the chart indicating that no spending data is available.
6. THE Pie_Chart SHALL assign a unique, non-repeating color to each Category (Food, Transport, Fun) such that no two Category slices share the same color, and SHALL render a legend identifying each Category by name and color.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my spending history when I close and reopen the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL serialize the complete Transaction_List to Local Storage under a fixed key dedicated to Transaction data.
2. WHEN a Transaction is deleted, THE App SHALL serialize the updated Transaction_List to Local Storage under the same fixed key.
3. WHEN the App initializes on page load, THE App SHALL read and deserialize Transaction data from Local Storage and replace the Transaction_List, Balance_Display, and Pie_Chart with the persisted data; IF the stored data cannot be read or deserialized, THEN THE App SHALL discard the stored data and initialize with an empty Transaction_List, a zero Balance_Display, and the Pie_Chart no-data state.
4. IF no Transaction data exists in Local Storage on page load, THEN THE App SHALL initialize with an empty Transaction_List, a Balance_Display showing "$0.00", and the Pie_Chart in its no-data state, defined as no category segments rendered and a visible label indicating no data is available.
5. THE App SHALL store Transaction data exclusively in the browser's Local Storage with no data transmitted to any external server.
6. IF a Local Storage write operation fails, THEN THE App SHALL display an error message indicating that the Transaction could not be saved and leave the Transaction_List in its current in-memory state without partial modification.

---

### Requirement 6: File and Code Structure

**User Story:** As a developer, I want the project to follow a clean, single-file-per-type structure so that the codebase remains easy to read and maintain.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located at `css/style.css`.
2. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
3. THE App SHALL load Chart.js via a `<script>` tag pointing to a CDN URL in the HTML file, and the project SHALL contain no `package.json`, `node_modules` directory, or build configuration files.
4. THE App SHALL function as a standalone web page openable via the `file://` protocol in Chrome v100+, Firefox v100+, Edge v100+, and Safari v15+, with no backend server required and no network requests made other than to load the Chart.js CDN script.

---

### Requirement 7: Responsive and Accessible UI

**User Story:** As a user, I want a clean, readable interface that works across modern browsers so that I have a consistent and accessible experience.

#### Acceptance Criteria

1. THE App SHALL apply a consistent visual style where all body text is at minimum 14px, heading levels are visually distinct in size or weight, and interactive elements (buttons, inputs) have uniform padding and margin, using only the single CSS file.
2. THE App SHALL render without broken layouts, overlapping elements, missing content, or non-operable interactive features in the latest stable versions of Chrome, Firefox, Edge, and Safari.
3. WHEN the viewport width is 320px or wider, THE App SHALL render without horizontal scrolling, without clipped or truncated UI text, and without overlapping interactive elements.
4. THE App SHALL assign a `<label>` element to each Input_Form field, all interactive elements SHALL be operable via Tab and Enter or Space keys, and each focusable element SHALL display a visible focus indicator.
