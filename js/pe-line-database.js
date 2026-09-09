(function(global) {
  "use strict";
  if (global.ReelCalcPELineDatabase) return;
  function initialize(root, data) {
    if (root.dataset.reelcalcDatabaseRendered === "true") return;
    root.dataset.reelcalcDatabaseRendered = "true";
    var lines = data.map(function (line, index) {
      return Object.assign({ databaseIndex: index }, line);
    });

    var state = {
      search: "",
      brand: "",
      strands: "",
      sortBy: "brand",
      direction: "asc"
    };

    var compareState = {
      sortBy: null,
      direction: "asc",
      matches: []
    };

    var labels = {
      brand: "Brand",
      model: "Model",
      pe: "PE size",
      lb: "Pound strength",
      kg: "Kilogram strength",
      strands: "Strand count",
      dia_mm: "Diameter (mm)",
      dia_in: "Diameter (in)",
      notes: "Notes"
    };

    var lineSelect = root.querySelector("#peLineSelect");
    var findMatchesButton = root.querySelector("#peFindMatchesButton");
    var matchResults = root.querySelector("#peMatchResults");
    var matchSummary = root.querySelector("#peMatchSummary");
    var compareTableBody = root.querySelector("#peCompareTable tbody");
    var searchInput = root.querySelector("#peLineSearch");
    var brandFilter = root.querySelector("#peBrandFilter");
    var strandFilter = root.querySelector("#peStrandFilter");
    var sortBy = root.querySelector("#peSortBy");
    var directionButton = root.querySelector("#peDirectionButton");
    var resetButton = root.querySelector("#peResetButton");
    var sortStatus = root.querySelector("#peSortStatus");
    var lineCount = root.querySelector("#peLineCount");
    var tableBody = root.querySelector("#peLineTable tbody");

    function isBlank(value) {
      return value === "" || value === null || typeof value === "undefined";
    }

    function compareValues(a, b, key) {
      var left = a[key];
      var right = b[key];
      var leftBlank = isBlank(left);
      var rightBlank = isBlank(right);

      if (leftBlank && rightBlank) return 0;
      if (leftBlank) return 1;
      if (rightBlank) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    }

    function compareByState(a, b) {
      var result = compareValues(a, b, state.sortBy);
      if (result === 0 && state.sortBy !== "brand") result = compareValues(a, b, "brand");
      if (result === 0 && state.sortBy !== "model") result = compareValues(a, b, "model");
      if (result === 0 && state.sortBy !== "pe") result = compareValues(a, b, "pe");
      if (result === 0 && state.sortBy !== "lb") result = compareValues(a, b, "lb");
      return state.direction === "asc" ? result : -result;
    }

    function filteredLines() {
      var term = state.search.trim().toLowerCase();

      return lines.filter(function (line) {
        var searchText = [
          line.brand,
          line.model,
          line.pe,
          line.lb,
          line.kg,
          line.strands,
          line.dia_mm,
          line.dia_in,
          line.notes
        ].join(" ").toLowerCase();

        return (!term || searchText.includes(term)) &&
          (!state.brand || line.brand === state.brand) &&
          (!state.strands || String(line.strands) === state.strands);
      });
    }

    function formatNumber(value, decimals) {
      if (isBlank(value)) return "\u2014";
      return Number(value).toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
    }

    function displayValue(value) {
      return isBlank(value) ? "\u2014" : String(value);
    }

    function appendCell(row, value, className) {
      var cell = document.createElement("td");
      if (className) cell.className = className;
      cell.textContent = value;
      row.appendChild(cell);
    }

    function appendLineRow(line, targetBody) {
      var row = document.createElement("tr");
      row.className = "rcdb-data-row";

      appendCell(row, line.brand);
      appendCell(row, line.model);
      appendCell(row, displayValue(line.pe), "rcdb-number");
      appendCell(row, displayValue(line.lb), "rcdb-number");
      appendCell(row, displayValue(line.kg), "rcdb-number");

      var strandCell = document.createElement("td");
      var strandLabel = document.createElement("span");
      strandLabel.className = "rcdb-type";
      strandLabel.textContent = displayValue(line.strands);
      strandCell.appendChild(strandLabel);
      row.appendChild(strandCell);

      appendCell(row, formatNumber(line.dia_mm, 3), "rcdb-number");
      appendCell(row, formatNumber(line.dia_in, 4), "rcdb-number");
      appendCell(row, displayValue(line.notes));
      targetBody.appendChild(row);
    }

    function updateMainIndicators() {
      root.querySelectorAll("#reelcalc-pe-line-database [data-pe-sort]").forEach(function (button) {
        var isActive = button.dataset.peSort === state.sortBy;
        var indicator = button.querySelector(".rcdb-sort-indicator");
        indicator.textContent = isActive
          ? (state.direction === "asc" ? "\u2191" : "\u2193")
          : "\u2195";
        button.classList.toggle("is-sorted", isActive);
        button.title = isActive
          ? "Reverse " + labels[button.dataset.peSort] + " order"
          : "Sort by " + labels[button.dataset.peSort];
        button.closest("th").setAttribute(
          "aria-sort",
          isActive ? (state.direction === "asc" ? "ascending" : "descending") : "none"
        );
      });
    }

    function updateStatus(count) {
      var directionLabel = state.direction === "asc" ? "low to high" : "high to low";
      if (["brand", "model", "notes"].includes(state.sortBy)) {
        directionLabel = state.direction === "asc" ? "A to Z" : "Z to A";
      }

      sortStatus.innerHTML = "<strong>" + labels[state.sortBy] + "</strong> &middot; " + directionLabel;
      lineCount.textContent = count.toLocaleString() + (count === 1 ? " line" : " lines");
      directionButton.textContent = state.direction === "asc" ? "\u2191" : "\u2193";
      directionButton.title = "Sort " + directionLabel;
      directionButton.setAttribute("aria-label", "Sort " + directionLabel);
      updateMainIndicators();
    }

    function renderMainTable() {
      var filtered = filteredLines();
      tableBody.innerHTML = "";

      if (!filtered.length) {
        var emptyRow = document.createElement("tr");
        var emptyCell = document.createElement("td");
        emptyCell.colSpan = 9;
        emptyCell.className = "rcdb-empty";
        emptyCell.textContent = "No PE lines match those filters.";
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
        updateStatus(0);
        return;
      }

      filtered.sort(compareByState).forEach(function (line) {
        appendLineRow(line, tableBody);
      });

      updateStatus(filtered.length);
    }

    function fillFilter(select, values) {
      values.forEach(function (value) {
        var option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      });
    }

    function populateLineSelect() {
      lines.slice().sort(function (a, b) {
        var result = compareValues(a, b, "brand");
        if (result === 0) result = compareValues(a, b, "model");
        if (result === 0) result = compareValues(a, b, "pe");
        if (result === 0) result = compareValues(a, b, "lb");
        return result;
      }).forEach(function (line) {
        var option = document.createElement("option");
        var strength = isBlank(line.lb) ? "" : " / " + line.lb + " lb";
        option.value = String(line.databaseIndex);
        option.textContent = line.brand + " " + line.model + " - PE " + line.pe +
          strength + " / " + formatNumber(line.dia_mm, 3) + " mm";
        lineSelect.appendChild(option);
      });
    }

    function compareMatchLines(a, b) {
      if (!compareState.sortBy) {
        var selected = lines[Number(lineSelect.value)];
        var differenceA = Math.abs(Number(a.dia_in) - Number(selected.dia_in));
        var differenceB = Math.abs(Number(b.dia_in) - Number(selected.dia_in));
        if (differenceA !== differenceB) return differenceA - differenceB;
        var brandResult = compareValues(a, b, "brand");
        if (brandResult !== 0) return brandResult;
        var modelResult = compareValues(a, b, "model");
        if (modelResult !== 0) return modelResult;
        return compareValues(a, b, "pe");
      }

      var result = compareValues(a, b, compareState.sortBy);
      if (result === 0) result = compareValues(a, b, "brand");
      if (result === 0) result = compareValues(a, b, "model");
      if (result === 0) result = compareValues(a, b, "pe");
      return compareState.direction === "asc" ? result : -result;
    }

    function updateCompareIndicators() {
      root.querySelectorAll("#reelcalc-pe-line-database [data-pe-compare-sort]").forEach(function (button) {
        var isActive = button.dataset.peCompareSort === compareState.sortBy;
        var indicator = button.querySelector(".rcdb-sort-indicator");
        indicator.textContent = isActive
          ? (compareState.direction === "asc" ? "\u2191" : "\u2193")
          : "\u2195";
        button.classList.toggle("is-sorted", isActive);
        button.title = isActive
          ? "Reverse " + labels[button.dataset.peCompareSort] + " order"
          : "Sort by " + labels[button.dataset.peCompareSort];
      });
    }

    function renderCompareTable() {
      compareTableBody.innerHTML = "";
      compareState.matches.slice().sort(compareMatchLines).forEach(function (line) {
        appendLineRow(line, compareTableBody);
      });
      updateCompareIndicators();
    }

    function findMatches() {
      if (lineSelect.value === "") {
        matchResults.hidden = true;
        return;
      }

      var selectedLine = lines[Number(lineSelect.value)];
      if (!selectedLine) {
        matchResults.hidden = true;
        return;
      }

      var toleranceMM = 0.015;
      compareState.sortBy = null;
      compareState.direction = "asc";
      compareState.matches = lines.filter(function (line) {
        return Math.abs(Number(line.dia_mm) - Number(selectedLine.dia_mm)) <= toleranceMM;
      });

      matchSummary.innerHTML = "<strong>" + compareState.matches.length.toLocaleString() +
        " similar lines</strong><span>Selected diameter: " +
        formatNumber(selectedLine.dia_mm, 3) + " mm / " +
        formatNumber(selectedLine.dia_in, 4) + " in</span>";
      renderCompareTable();
      matchResults.hidden = false;
    }

    function resetDatabase() {
      state = {
        search: "",
        brand: "",
        strands: "",
        sortBy: "brand",
        direction: "asc"
      };
      searchInput.value = "";
      brandFilter.value = "";
      strandFilter.value = "";
      sortBy.value = "brand";
      renderMainTable();
    }

    searchInput.addEventListener("input", function () {
      state.search = searchInput.value;
      renderMainTable();
    });

    brandFilter.addEventListener("change", function () {
      state.brand = brandFilter.value;
      renderMainTable();
    });

    strandFilter.addEventListener("change", function () {
      state.strands = strandFilter.value;
      renderMainTable();
    });

    sortBy.addEventListener("change", function () {
      state.sortBy = sortBy.value;
      state.direction = "asc";
      renderMainTable();
    });

    directionButton.addEventListener("click", function () {
      state.direction = state.direction === "asc" ? "desc" : "asc";
      renderMainTable();
    });

    resetButton.addEventListener("click", resetDatabase);
    findMatchesButton.addEventListener("click", findMatches);

    root.querySelectorAll("#reelcalc-pe-line-database [data-pe-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        var column = button.dataset.peSort;
        if (state.sortBy === column) {
          state.direction = state.direction === "asc" ? "desc" : "asc";
        } else {
          state.sortBy = column;
          state.direction = "asc";
          sortBy.value = column;
        }
        renderMainTable();
      });
    });

    root.querySelectorAll("#reelcalc-pe-line-database [data-pe-compare-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        var column = button.dataset.peCompareSort;
        if (compareState.sortBy === column) {
          compareState.direction = compareState.direction === "asc" ? "desc" : "asc";
        } else {
          compareState.sortBy = column;
          compareState.direction = "asc";
        }
        renderCompareTable();
      });
    });

    fillFilter(brandFilter, Array.from(new Set(lines.map(function (line) {
      return line.brand;
    }))).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }));

    fillFilter(strandFilter, Array.from(new Set(lines.map(function (line) {
      return line.strands;
    }))).sort(function (a, b) {
      var left = Number(a);
      var right = Number(b);
      if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
      return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    }));

    populateLineSelect();
    renderMainTable();

  }
  global.ReelCalcPELineDatabase = { initialize: initialize };
})(window);
