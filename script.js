"use strict";

let scholarships = [];
let filteredScholarships = [];

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRT0WRStJqjLpBwSf_BIDjXbSKG4A-Utd41mNhFaTDjKn9JC3hcStCWDPXcRJYKKngnKp5jlDFhBfXx/pub?output=csv";

async function loadCSV() {
  const resultCount =
    document.getElementById("resultCount");

  try {
    const response = await fetch(
      `${SHEET_URL}&v=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load data. HTTP status: ${response.status}`
      );
    }

    const text = await response.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: header => header.trim()
    });

    if (parsed.errors.length > 0) {
      console.warn(
        "CSV parsing warnings:",
        parsed.errors
      );
    }

    scholarships = parsed.data
      .map(cleanRecord)
      .filter(item => item["Scholarship Name"]);

    filteredScholarships = [...scholarships];

    applyFilters();
  } catch (error) {
    console.error(error);

    resultCount.textContent =
      "The scholarships could not be loaded.";

    const emptyState =
      document.getElementById("emptyState");

    emptyState.hidden = false;

    emptyState.querySelector("h2").textContent =
      "Unable to load scholarships";

    emptyState.querySelector("p").textContent =
      "Please refresh the page or try again later.";
  }
}

function cleanRecord(record) {
  const cleaned = {};

  Object.entries(record).forEach(([key, value]) => {
    cleaned[key.trim()] =
      typeof value === "string"
        ? value.trim()
        : value;
  });

  return cleaned;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_.\/-]+/g, "");
}

function getCheckedValues(className) {
  return [
    ...document.querySelectorAll(
      `.${className}:checked`
    )
  ].map(checkbox =>
    normalizeText(checkbox.value)
  );
}

function parseDeadline(rawDeadline) {
  if (!rawDeadline) {
    return null;
  }

  const text = String(rawDeadline).trim();

  const nonDateTerms = [
    "open",
    "rolling",
    "varies",
    "quarterly",
    "ongoing",
    "tbd",
    "opens",
    "priority",
    "winter"
  ];

  const normalized =
    text.toLowerCase();

  if (
    nonDateTerms.some(term =>
      normalized.includes(term)
    )
  ) {
    return null;
  }

  const cleaned = text
    .replace(/\bSept\b/gi, "Sep")
    .replace(/\bSeot\b/gi, "Sep")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .trim();

  const directDate = new Date(cleaned);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const currentYear =
    new Date().getFullYear();

  const dateWithYear =
    new Date(`${cleaned} ${currentYear}`);

  if (!Number.isNaN(dateWithYear.getTime())) {
    return dateWithYear;
  }

  const firstDateMatch = cleaned.match(
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i
  );

  if (firstDateMatch) {
    const firstDate =
      new Date(`${firstDateMatch[0]} ${currentYear}`);

    if (!Number.isNaN(firstDate.getTime())) {
      return firstDate;
    }
  }

  return null;
}

function createLocalDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] =
    dateValue.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function applyFilters() {
  const search = normalizeText(
    document.getElementById("searchInput").value
  );

  const selectedDemographics =
    getCheckedValues("demographic-checkbox");

  const selectedCriteria =
    getCheckedValues("criteria-checkbox");

  const activeQuickDemographics = [
    ...document.querySelectorAll(
      '.quick-filter.active[data-type="demographic"]'
    )
  ].map(button =>
    normalizeText(button.dataset.filter)
  );

  const activeQuickCriteria = [
    ...document.querySelectorAll(
      '.quick-filter.active[data-type="criteria"]'
    )
  ].map(button =>
    normalizeText(button.dataset.filter)
  );

  const demographicFilters = [
    ...new Set([
      ...selectedDemographics,
      ...activeQuickDemographics
    ])
  ];

  const criteriaFilters = [
    ...new Set([
      ...selectedCriteria,
      ...activeQuickCriteria
    ])
  ];

  const fromDate = createLocalDate(
    document.getElementById("fromDate").value
  );

  const toDate = createLocalDate(
    document.getElementById("toDate").value
  );

  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  filteredScholarships =
    scholarships.filter(item => {
      const name =
        item["Scholarship Name"] || "";

      const criteria =
        item.Criteria || "";

      const demographic =
        item.Demographic || "";

      const amount =
        item.Amount || "";

      const deadlineText =
        item.Deadline || "";

      const searchableText =
        normalizeText(`
          ${name}
          ${criteria}
          ${demographic}
          ${amount}
          ${deadlineText}
        `);

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      const normalizedDemographic =
        normalizeText(demographic);

      const matchesDemographic =
        demographicFilters.length === 0 ||
        demographicFilters.some(filter =>
          normalizedDemographic.includes(filter)
        );

      const normalizedCriteria =
        normalizeText(criteria);

      const matchesCriteria =
        criteriaFilters.length === 0 ||
        criteriaFilters.some(filter =>
          normalizedCriteria.includes(filter)
        );

      let matchesDate = true;

      if (fromDate || toDate) {
        const deadline =
          parseDeadline(deadlineText);

        if (!deadline) {
          matchesDate = false;
        } else {
          if (
            fromDate &&
            deadline < fromDate
          ) {
            matchesDate = false;
          }

          if (
            toDate &&
            deadline > toDate
          ) {
            matchesDate = false;
          }
        }
      }

      return (
        matchesSearch &&
        matchesDemographic &&
        matchesCriteria &&
        matchesDate
      );
    });

  sortScholarships();
  updateFilterButtonLabels();
  syncQuickFilterButtons();
  renderScholarships();
}

function sortScholarships() {
  const sortValue =
    document.getElementById(
      "sortSelect"
    ).value;

  filteredScholarships.sort((a, b) => {
    if (sortValue === "deadline") {
      const dateA =
        parseDeadline(a.Deadline);

      const dateB =
        parseDeadline(b.Deadline);

      if (!dateA && !dateB) {
        return 0;
      }

      if (!dateA) {
        return 1;
      }

      if (!dateB) {
        return -1;
      }

      return dateA - dateB;
    }

    if (sortValue === "amount") {
      return (
        getNumericAmount(b.Amount) -
        getNumericAmount(a.Amount)
      );
    }

    return String(
      a["Scholarship Name"] || ""
    ).localeCompare(
      String(
        b["Scholarship Name"] || ""
      )
    );
  });
}

function getNumericAmount(value) {
  const numbers =
    String(value || "")
      .replace(/,/g, "")
      .match(/\d+(\.\d+)?/g);

  if (!numbers) {
    return 0;
  }

  return Math.max(
    ...numbers.map(Number)
  );
}

function renderScholarships() {
  const list =
    document.getElementById(
      "scholarshipList"
    );

  const resultCount =
    document.getElementById(
      "resultCount"
    );

  const emptyState =
    document.getElementById(
      "emptyState"
    );

  list.innerHTML = "";

  const count =
    filteredScholarships.length;

  resultCount.textContent =
    `${count} scholarship${count === 1 ? "" : "s"} found`;

  emptyState.hidden = count !== 0;

  filteredScholarships.forEach(item => {
    const card =
      document.createElement("article");

    card.className = "card";

    const name =
      item["Scholarship Name"] ||
      "Untitled Scholarship";

    const link =
      item["Scholarship Link"] || "";

    const amount =
      item.Amount || "Varies";

    const deadline =
      item.Deadline ||
      "Rolling or not listed";

    const demographic =
      item.Demographic || "";

    const criteria =
      item.Criteria || "";

    const validLink =
      isValidURL(link);

    card.innerHTML = `
      <h2>${escapeHTML(name)}</h2>

      <div class="info-grid">
        <div class="info-box">
          <span class="info-label">
            Award
          </span>

          <span class="info-value">
            ${escapeHTML(amount)}
          </span>
        </div>

        <div class="info-box">
          <span class="info-label">
            Deadline
          </span>

          <span class="info-value">
            ${escapeHTML(deadline)}
          </span>
        </div>
      </div>

      <p class="section-label">
        Intended For
      </p>

      <div class="tag-row">
        ${createTags(demographic)}
      </div>

      <p class="section-label">
        Eligibility Criteria
      </p>

      <p class="criteria-text">
        ${
          criteria
            ? escapeHTML(criteria)
            : "See the official website for eligibility details."
        }
      </p>

      <div class="card-actions">
        ${
          validLink
            ? `
              <a
                class="view-btn"
                href="${escapeAttribute(link)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit Scholarship →
              </a>
            `
            : `
              <span class="view-btn disabled">
                Link Unavailable
              </span>
            `
        }
      </div>
    `;

    list.appendChild(card);
  });
}

function createTags(value) {
  if (!value) {
    return `
      <span class="tag">
        See eligibility details
      </span>
    `;
  }

  return String(value)
    .split(/[,;]/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `
      <span class="tag">
        ${escapeHTML(item)}
      </span>
    `)
    .join("");
}

function isValidURL(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function setupDropdown(buttonId, menuId) {
  const button =
    document.getElementById(buttonId);

  const menu =
    document.getElementById(menuId);

  button.addEventListener("click", event => {
    event.stopPropagation();

    const isOpen =
      menu.classList.contains("show");

    closeAllDropdowns();

    if (!isOpen) {
      menu.classList.add("show");

      button.setAttribute(
        "aria-expanded",
        "true"
      );
    }
  });

  menu.addEventListener("click", event => {
    event.stopPropagation();
  });
}

function closeAllDropdowns() {
  document
    .querySelectorAll(".dropdown-menu")
    .forEach(menu => {
      menu.classList.remove("show");
    });

  document
    .querySelectorAll(".dropdown-btn")
    .forEach(button => {
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    });
}

function updateFilterButtonLabels() {
  updateButtonLabel(
    "demographic-checkbox",
    "demographicBtn",
    "demographicBtnText",
    "All Demographics",
    "Demographics"
  );

  updateButtonLabel(
    "criteria-checkbox",
    "criteriaBtn",
    "criteriaBtnText",
    "All Criteria",
    "Criteria"
  );
}

function updateButtonLabel(
  checkboxClass,
  buttonId,
  textId,
  defaultLabel,
  selectedLabel
) {
  const checkedCount =
    document.querySelectorAll(
      `.${checkboxClass}:checked`
    ).length;

  const button =
    document.getElementById(buttonId);

  const text =
    document.getElementById(textId);

  if (checkedCount === 0) {
    text.textContent = defaultLabel;
    button.classList.remove("active");
  } else {
    text.textContent =
      `${selectedLabel} (${checkedCount})`;

    button.classList.add("active");
  }
}

function toggleQuickFilter(button) {
  const filterValue =
    normalizeText(button.dataset.filter);

  const type =
    button.dataset.type;

  const checkboxClass =
    type === "criteria"
      ? "criteria-checkbox"
      : "demographic-checkbox";

  const checkbox = [
    ...document.querySelectorAll(
      `.${checkboxClass}`
    )
  ].find(item =>
    normalizeText(item.value) ===
    filterValue
  );

  if (checkbox) {
    checkbox.checked =
      !checkbox.checked;

    button.classList.toggle(
      "active",
      checkbox.checked
    );
  } else {
    button.classList.toggle("active");
  }

  applyFilters();
}

function syncQuickFilterButtons() {
  document
    .querySelectorAll(".quick-filter")
    .forEach(button => {
      const type =
        button.dataset.type;

      const checkboxClass =
        type === "criteria"
          ? "criteria-checkbox"
          : "demographic-checkbox";

      const matchingCheckbox = [
        ...document.querySelectorAll(
          `.${checkboxClass}`
        )
      ].find(checkbox =>
        normalizeText(checkbox.value) ===
        normalizeText(button.dataset.filter)
      );

      if (matchingCheckbox) {
        button.classList.toggle(
          "active",
          matchingCheckbox.checked
        );
      }
    });
}

function clearFilters() {
  document.getElementById(
    "searchInput"
  ).value = "";

  document.getElementById(
    "fromDate"
  ).value = "";

  document.getElementById(
    "toDate"
  ).value = "";

  document.getElementById(
    "sortSelect"
  ).value = "name";

  document
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(checkbox => {
      checkbox.checked = false;
    });

  document
    .querySelectorAll(
      ".quick-filter"
    )
    .forEach(button => {
      button.classList.remove("active");
    });

  closeAllDropdowns();
  applyFilters();
}

function downloadResults() {
  const headers = [
    "Scholarship Name",
    "Scholarship Link",
    "Criteria",
    "Amount",
    "Deadline",
    "Demographic"
  ];

  const rows = [
    headers
      .map(csvEscape)
      .join(",")
  ];

  filteredScholarships.forEach(item => {
    const row = headers.map(header =>
      csvEscape(item[header] || "")
    );

    rows.push(row.join(","));
  });

  const csvContent =
    "\uFEFF" + rows.join("\n");

  const blob = new Blob(
    [csvContent],
    {
      type:
        "text/csv;charset=utf-8;"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download =
    "filtered-mair-scholarships.csv";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value)
    .replaceAll('"', '""')}"`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

setupDropdown(
  "demographicBtn",
  "demographicMenu"
);

setupDropdown(
  "criteriaBtn",
  "criteriaMenu"
);

document.addEventListener(
  "click",
  closeAllDropdowns
);

document.getElementById(
  "searchInput"
).addEventListener(
  "input",
  applyFilters
);

document.getElementById(
  "fromDate"
).addEventListener(
  "change",
  applyFilters
);

document.getElementById(
  "toDate"
).addEventListener(
  "change",
  applyFilters
);

document.getElementById(
  "sortSelect"
).addEventListener(
  "change",
  applyFilters
);

document
  .querySelectorAll(
    ".demographic-checkbox, .criteria-checkbox"
  )
  .forEach(checkbox => {
    checkbox.addEventListener(
      "change",
      applyFilters
    );
  });

document
  .querySelectorAll(
    ".quick-filter"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => toggleQuickFilter(button)
    );
  });

document.getElementById(
  "clearBtn"
).addEventListener(
  "click",
  clearFilters
);

document.getElementById(
  "downloadBtn"
).addEventListener(
  "click",
  downloadResults
);

loadCSV();
