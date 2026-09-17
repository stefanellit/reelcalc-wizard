import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

// Exercise the real UI listeners with the same lightweight DOM approach as the math tests.
function calculator() {
  const elements = new Map();
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const attributes = new Map();
    const item = {
      value: "", textContent: "", innerHTML: "", dataset: {}, checked: false,
      listeners: {}, buttons: [],
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle(name, on = !classes.has(name)) {
          if (on) classes.add(name); else classes.delete(name);
        }
      },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name),
      addEventListener(name, callback) { this.listeners[name] = callback; },
      querySelectorAll(selector) { return selector === ".seg-btn" ? this.buttons : []; }
    };
    elements.set(id, item);
    return item;
  }
  const segments = {
    setupSegment: ["setup", ["simple", "detailed"]],
    simpleRatingSegment: ["simpleRating", ["mono", "braid"]],
    unitSegment: ["unit", ["standard", "metric"]],
    modeSegment: ["mode", ["backing", "capacity"]],
    workingTypeSegment: ["lineType", ["mono", "braid"]],
    backingTypeSegment: ["lineType", ["mono", "braid"]]
  };
  for (const [id, [key, values]] of Object.entries(segments)) {
    element(id).buttons = values.map((value) => {
      const button = element(`${id}-${value}`);
      button.dataset[key] = value;
      return button;
    });
  }
  for (const type of ["mono", "braid"]) {
    element(`${type}StrengthUnit`).value = "lb";
    element(`${type}CapacityUnit`).value = "yards";
    element(`${type}DiameterUnit`).value = "mm";
  }
  const context = vm.createContext({
    console, window: {},
    document: {
      readyState: "loading", addEventListener() {}, getElementById: element,
      querySelectorAll: () => [], querySelector: () => null
    }
  });
  vm.runInContext(read("js/calculator-core.js"), context);
  vm.runInContext(read("js/homepage-calculator-v2.js"), context);
  context.window.ReelCalcHomepageCalculator.initialize();
  return {
    element,
    state: context.window.ReelCalcHomepageTest.getState,
    calculate: () => context.window.ReelCalcHomepageTest.calculate(true),
    click(id, value) {
      const [key] = segments[id];
      const button = element(id).buttons.find((item) => item.dataset[key] === value);
      element(id).listeners.click({ target: { closest: () => button } });
    }
  };
}

function fill(calc, values) {
  for (const [id, value] of Object.entries(values)) calc.element(id).value = String(value);
}

function selected(calc, type) {
  assert.equal(calc.state().simpleRatingType, type);
  assert.equal(calc.element(`${type}RatingColumn`).classList.contains("hidden"), false);
  assert.equal(calc.element(`simpleRatingSegment-${type}`).getAttribute("aria-pressed"), "true");
  const other = type === "mono" ? "braid" : "mono";
  assert.equal(calc.element(`${other}RatingColumn`).classList.contains("hidden"), true);
  assert.equal(calc.element(`simpleRatingSegment-${other}`).getAttribute("aria-pressed"), "false");
}

let cases = 0;
for (const first of ["mono", "braid"]) {
  for (const mode of ["backing", "capacity"]) {
    for (const metric of [false, true]) {
      const calc = calculator();
      const second = first === "mono" ? "braid" : "mono";
      calc.click("simpleRatingSegment", first);
      calc.click("modeSegment", mode);
      calc.click("workingTypeSegment", "braid");
      fill(calc, {
        [`${first}Strength`]: first === "mono" ? 10 : 20,
        [`${first}Capacity`]: first === "mono" ? 200 : 240,
        mainDiameter: 0.009, mainAmount: 100, backingDiameter: 0.012
      });
      if (metric) calc.click("unitSegment", "metric");
      assert.ok(calc.calculate());
      assert.notEqual(calc.element("output").innerHTML, "");
      const savedMain = calc.element("mainDiameter").value;
      const savedAmount = calc.element("mainAmount").value;
      const savedBacking = calc.element("backingDiameter").value;

      calc.click("simpleRatingSegment", second);
      selected(calc, second);
      assert.equal(calc.element("output").innerHTML, "");
      assert.equal(calc.element("resultTools").classList.contains("hidden"), true);
      assert.equal(calc.element(`${second}Strength`).value, "");
      assert.equal(calc.element(`${second}Capacity`).value, "");
      assert.equal(calc.element("mainDiameter").value, savedMain);
      assert.equal(calc.element("mainAmount").value, savedAmount);
      assert.equal(calc.element("backingDiameter").value, savedBacking);
      assert.equal(calc.state().workingLineType, "braid");
      assert.equal(calc.calculate(), null, "An empty selected rating must not reuse the hidden rating");

      fill(calc, {
        [`${second}Strength`]: second === "mono" ? 10 : 20,
        [`${second}Capacity`]: second === "mono" ? 200 : 240
      });
      const result = calc.calculate();
      assert.equal(result.mainResolution.anchorType, second);
      const mainInches = Number(savedMain) / (metric ? 25.4 : 1);
      const expectedCapacity = second === "mono"
        ? 200 * (0.012 / mainInches) ** 2
        : 240 * (0.009 / mainInches) ** 2;
      assert.ok(Math.abs(result.estimate.fullWorkingCapacityYards - expectedCapacity) < 1e-8);
      calc.click("simpleRatingSegment", first);
      selected(calc, first);
      assert.equal(calc.calculate().mainResolution.anchorType, first);
      calc.click("simpleRatingSegment", second);
      selected(calc, second);
      assert.equal(calc.calculate().mainResolution.anchorType, second);
      cases += 1;
    }
  }
}

for (const populated of ["mono", "braid"]) {
  const calc = calculator();
  calc.click("setupSegment", "detailed");
  fill(calc, { [`${populated}Strength`]: 20, [`${populated}Capacity`]: 240 });
  calc.click("setupSegment", "simple");
  selected(calc, populated);
  const other = populated === "mono" ? "braid" : "mono";
  calc.click("simpleRatingSegment", other);
  selected(calc, other);
}

const partial = calculator();
fill(partial, { monoStrength: 10 });
partial.click("simpleRatingSegment", "braid");
selected(partial, "braid");
partial.element("braidUseDiameter").checked = true;
fill(partial, { braidCapacity: 240, braidDiameter: 0.23 });
partial.element("braidDiameterUnit").value = "mm";
partial.click("simpleRatingSegment", "mono");
selected(partial, "mono");
partial.click("simpleRatingSegment", "braid");
selected(partial, "braid");
assert.equal(partial.element("braidDiameter").value, "0.23");
assert.equal(partial.element("braidUseDiameter").checked, true);
assert.equal(partial.element("braidDiameterUnit").value, "mm");

console.log(`Homepage rating-switch tests passed: ${cases} calculation round trips, both Detailed-to-Simple transitions, and partial/printed-diameter entry preservation.`);
