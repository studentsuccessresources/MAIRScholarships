let scholarships = [];
let filteredScholarships = [];

async function loadCSV() {
  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmA5JubC95ImYidRFWAwVTfb7YYW1EDR3jj5eJKpiep_zGN5UNlMq9eAFdHEHYA-OsVKOd9eXRK0eE/pub?output=csv";

  const response = await fetch(SHEET_URL + "&v=" + Date.now());
  const text = await response.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });

  scholarships = parsed.data;
  filteredScholarships = scholarships;
  renderScholarships();
}

function parseDeadline(rawDeadline) {
  if (!rawDeadline) return null;

  const text = rawDeadline.trim();

  if (
    text.toLowerCase().includes("open") ||
    text.toLowerCase().includes("rolling") ||
    text.toLowerCase().includes("varies") ||
    text.toLowerCase().includes("quarterly")
  ) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  let cleaned = text
    .replace(/Sept/i, "Sep")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .trim();

  const date = new Date(cleaned);
  if (!isNaN(date)) return date;

  const withYear = `${cleaned} ${currentYear}`;
  const dateWithYear = new Date(withYear);

  if (!isNaN(dateWithYear)) return dateWithYear;

  return null;
}

function getCheckedValues(className) {
  return [...document.querySelectorAll(`.${className}:checked`)]
    .map(checkbox => checkbox.value.toLowerCase());
}

function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const selectedDemographics = getCheckedValues("demographic-checkbox");
  const selectedCriteria = getCheckedValues("criteria-checkbox");
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  filteredScholarships = scholarships.filter(item => {
    const name = item["Scholarship Name"] || "";
    const criteriaText = item.Criteria || "";
    const demographicText = item.Demographic || "";
    const amount = item.Amount || "";

    const searchableText = `
      ${name}
      ${criteriaText}
      ${demographicText}
      ${amount}
    `.toLowerCase();

    const matchesSearch = !search || searchableText.includes(search);

    const matchesDemographic =
      selectedDemographics.length === 0 ||
      selectedDemographics.some(demo =>
        demographicText.toLowerCase().includes(demo)
      );

    const matchesCriteria =
      selectedCriteria.length === 0 ||
      selectedCriteria.some(criteria =>
        criteriaText.toLowerCase().includes(criteria)
      );

    let matchesDate = true;

    if (fromDate || toDate) {
      const deadline = parseDeadline(item.Deadline);

      if (!deadline) return false;

      if (fromDate && deadline < new Date(fromDate)) {
        matchesDate = false;
      }

      if (toDate && deadline > new Date(toDate)) {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDemographic && matchesCriteria && matchesDate;
  });

  renderScholarships();
}

function renderScholarships() {
  const list = document.getElementById("scholarshipList");
  const count = document.getElementById("resultCount");

  count.textContent = `${filteredScholarships.length} scholarship(s) found`;
  list.innerHTML = "";

  filteredScholarships.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";

    const title = item["Scholarship Name"] || "Untitled Scholarship";
    const link = item["Scholarship Link"] || "#";

    card.innerHTML = `
      <h2>${title}</h2>
      <p class="meta"><strong>Amount:</strong> ${item.Amount || "N/A"}</p>
      <p class="meta"><strong>Deadline:</strong> ${item.Deadline || "N/A"}</p>
      <p class="meta"><strong>Criteria:</strong> ${item.Criteria || "N/A"}</p>
      <p class="tags"><strong>Demographic:</strong> ${item.Demographic || "N/A"}</p>
      <a class="apply-btn" href="${link}" target="_blank">View Scholarship</a>
    `;

    list.appendChild(card);
  });
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

  const csvRows = [headers.join(",")];

  filteredScholarships.forEach(item => {
    const row = headers.map(header => {
      const value = item[header] || "";
      return `"${value.replace(/"/g, '""')}"`;
    });

    csvRows.push(row.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "filtered-scholarships.csv";
  a.click();

  URL.revokeObjectURL(url);
}

document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("fromDate").addEventListener("change", applyFilters);
document.getElementById("toDate").addEventListener("change", applyFilters);

document.querySelectorAll(".demographic-checkbox").forEach(checkbox => {
  checkbox.addEventListener("change", applyFilters);
});

document.querySelectorAll(".criteria-checkbox").forEach(checkbox => {
  checkbox.addEventListener("change", applyFilters);
});

document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("fromDate").value = "";
  document.getElementById("toDate").value = "";

  document.querySelectorAll(".demographic-checkbox").forEach(checkbox => {
    checkbox.checked = false;
  });

  document.querySelectorAll(".criteria-checkbox").forEach(checkbox => {
    checkbox.checked = false;
  });

  filteredScholarships = scholarships;
  renderScholarships();
});

document.getElementById("downloadBtn").addEventListener("click", downloadResults);
function setupDropdown(buttonId, menuId) {
  const button = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);

  button.addEventListener("click", () => {
    menu.classList.toggle("show");
  });
}

setupDropdown("demographicBtn", "demographicMenu");
setupDropdown("criteriaBtn", "criteriaMenu");

document.addEventListener("click", function(event) {
  if (!event.target.closest(".multi-select")) {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
      menu.classList.remove("show");
    });
  }
});
loadCSV();
