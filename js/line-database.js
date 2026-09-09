(function(global) {
  "use strict";
  if (global.ReelCalcLineDatabase) return;
  function initialize(root, data) {
    if (root.dataset.reelcalcDatabaseRendered === "true") return;
    root.dataset.reelcalcDatabaseRendered = "true";
    var lines = data.map(function (line, index) {
      return Object.assign({ databaseIndex: index }, line);
    });

    var state = {
      search: "",
      brand: "",
      type: "",
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
      type: "Type",
      lb: "Pound test",
      dia_in: "Diameter (in)",
      dia_mm: "Diameter (mm)"
    };

    var lineSelect = root.querySelector("#lineSelect");
    var findMatchesButton = root.querySelector("#findMatchesButton");
    var matchResults = root.querySelector("#matchResults");
    var matchSummary = root.querySelector("#matchSummary");
    var compareTableBody = root.querySelector("#compareTable tbody");
    var searchInput = root.querySelector("#lineSearch");
    var brandFilter = root.querySelector("#brandFilter");
    var typeFilter = root.querySelector("#typeFilter");
    var sortBy = root.querySelector("#sortBy");
    var directionButton = root.querySelector("#directionButton");
    var resetButton = root.querySelector("#resetButton");
    var sortStatus = root.querySelector("#sortStatus");
    var lineCount = root.querySelector("#lineCount");
    var tableBody = root.querySelector("#lineTable tbody");

    function compareValues(a, b, key) {
      var left = a[key];
      var right = b[key];

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left || "").localeCompare(String(right || ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    }

    function compareByState(a, b) {
      var result = compareValues(a, b, state.sortBy);
      if (result === 0 && state.sortBy !== "brand") result = compareValues(a, b, "brand");
      if (result === 0 && state.sortBy !== "model") result = compareValues(a, b, "model");
      if (result === 0 && state.sortBy !== "lb") result = compareValues(a, b, "lb");
      return state.direction === "asc" ? result : -result;
    }

    function filteredLines() {
      var term = state.search.trim().toLowerCase();

      return lines.filter(function (line) {
        var searchText = [line.brand, line.model, line.type, line.lb, line.dia_in, line.dia_mm]
          .join(" ")
          .toLowerCase();

        return (!term || searchText.includes(term)) &&
          (!state.brand || line.brand === state.brand) &&
          (!state.type || line.type === state.type);
      });
    }

    function formatDiameter(value, decimals) {
      return Number(value).toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
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

      var typeCell = document.createElement("td");
      var typeLabel = document.createElement("span");
      typeLabel.className = "rcdb-type";
      typeLabel.textContent = line.type;
      typeCell.appendChild(typeLabel);
      row.appendChild(typeCell);

      appendCell(row, line.lb, "rcdb-number");
      appendCell(row, formatDiameter(line.dia_in, 4), "rcdb-number");
      appendCell(row, formatDiameter(line.dia_mm, 3), "rcdb-number");
      targetBody.appendChild(row);
    }

    function appendGroupRow(name, count) {
      var row = document.createElement("tr");
      row.className = "rcdb-group-row";
      var cell = document.createElement("td");
      cell.colSpan = 6;
      cell.appendChild(document.createTextNode(name || "Not specified"));

      var countLabel = document.createElement("span");
      countLabel.textContent = count.toLocaleString() + (count === 1 ? " line" : " lines");
      cell.appendChild(countLabel);
      row.appendChild(cell);
      tableBody.appendChild(row);
    }

    function updateMainIndicators() {
      root.querySelectorAll("#reelcalc-line-database [data-sort]").forEach(function (button) {
        var isActive = button.dataset.sort === state.sortBy;
        var indicator = button.querySelector(".rcdb-sort-indicator");
        indicator.textContent = isActive
          ? (state.direction === "asc" ? "\u2191" : "\u2193")
          : "\u2195";
        button.classList.toggle("is-sorted", isActive);
        button.title = isActive
          ? "Reverse " + labels[button.dataset.sort] + " order"
          : "Sort by " + labels[button.dataset.sort];
        button.closest("th").setAttribute(
          "aria-sort",
          isActive ? (state.direction === "asc" ? "ascending" : "descending") : "none"
        );
      });
    }

    function updateStatus(count) {
      var directionLabel = state.direction === "asc" ? "low to high" : "high to low";
      if (["brand", "model", "type"].includes(state.sortBy)) {
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
        emptyCell.colSpan = 6;
        emptyCell.className = "rcdb-empty";
        emptyCell.textContent = "No lines match those filters.";
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
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }

    function populateLineSelect() {
      lines.slice().sort(function (a, b) {
        var result = compareValues(a, b, "brand");
        if (result === 0) result = compareValues(a, b, "model");
        if (result === 0) result = compareValues(a, b, "lb");
        return result;
      }).forEach(function (line) {
        var option = document.createElement("option");
        option.value = String(line.databaseIndex);
        option.textContent = line.brand + " " + line.model + " - " + line.lb +
          " lb (" + formatDiameter(line.dia_in, 4) + " in)";
        lineSelect.appendChild(option);
      });
    }

    function compareMatchLines(a, b) {
      if (!compareState.sortBy) {
        var selected = lines[Number(lineSelect.value)];
        var differenceA = Math.abs(Number(a.dia_in) - Number(selected.dia_in));
        var differenceB = Math.abs(Number(b.dia_in) - Number(selected.dia_in));
        if (differenceA !== differenceB) return differenceA - differenceB;
        var typeResult = compareValues(a, b, "type");
        if (typeResult !== 0) return typeResult;
        var brandResult = compareValues(a, b, "brand");
        if (brandResult !== 0) return brandResult;
        return compareValues(a, b, "lb");
      }

      var result = compareValues(a, b, compareState.sortBy);
      if (result === 0) result = compareValues(a, b, "brand");
      if (result === 0) result = compareValues(a, b, "model");
      if (result === 0) result = compareValues(a, b, "lb");
      return compareState.direction === "asc" ? result : -result;
    }

    function updateCompareIndicators() {
      root.querySelectorAll("#reelcalc-line-database [data-compare-sort]").forEach(function (button) {
        var isActive = button.dataset.compareSort === compareState.sortBy;
        var indicator = button.querySelector(".rcdb-sort-indicator");
        indicator.textContent = isActive
          ? (compareState.direction === "asc" ? "\u2191" : "\u2193")
          : "\u2195";
        button.classList.toggle("is-sorted", isActive);
        button.title = isActive
          ? "Reverse " + labels[button.dataset.compareSort] + " order"
          : "Sort by " + labels[button.dataset.compareSort];
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

      var tolerance = 0.0015;
      compareState.sortBy = null;
      compareState.direction = "asc";
      compareState.matches = lines.filter(function (line) {
        return Math.abs(Number(line.dia_in) - Number(selectedLine.dia_in)) <= tolerance;
      });

      matchSummary.innerHTML = "<strong>" + compareState.matches.length.toLocaleString() +
        " similar lines</strong><span>Selected diameter: " +
        formatDiameter(selectedLine.dia_in, 4) + " in / " +
        formatDiameter(selectedLine.dia_mm, 3) + " mm</span>";
      renderCompareTable();
      matchResults.hidden = false;
    }

    function resetDatabase() {
      state = {
        search: "",
        brand: "",
        type: "",
        sortBy: "brand",
        direction: "asc"
      };
      searchInput.value = "";
      brandFilter.value = "";
      typeFilter.value = "";
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

    typeFilter.addEventListener("change", function () {
      state.type = typeFilter.value;
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

    root.querySelectorAll("#reelcalc-line-database [data-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        var column = button.dataset.sort;
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

    root.querySelectorAll("#reelcalc-line-database [data-compare-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        var column = button.dataset.compareSort;
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

    fillFilter(typeFilter, Array.from(new Set(lines.map(function (line) {
      return line.type;
    }))).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }));

    populateLineSelect();
    renderMainTable();

  }
  global.ReelCalcLineDatabase = { initialize: initialize };
})(window);
