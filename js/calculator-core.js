(function(global) {
  "use strict";

  var YARDS_PER_METER = 1.0936132983;
  var MM_PER_INCH = 25.4;
  var LB_PER_KG = 2.2046226218;

  function yardsToMeters(yards) {
    return Number(yards) / YARDS_PER_METER;
  }

  function metersToYards(meters) {
    return Number(meters) * YARDS_PER_METER;
  }

  function lbToKg(lb) {
    return Number(lb) / LB_PER_KG;
  }

  function kgToLb(kg) {
    return Number(kg) * LB_PER_KG;
  }

  function inchesToMm(inches) {
    return Number(inches) * MM_PER_INCH;
  }

  function mmToInches(mm) {
    return Number(mm) / MM_PER_INCH;
  }

  function monoDiameter(lb) {
    if (lb <= 2) return 0.006;
    if (lb <= 4) return 0.008;
    if (lb <= 6) return 0.0095;
    if (lb <= 8) return 0.011;
    if (lb <= 10) return 0.012;
    if (lb <= 12) return 0.014;
    if (lb <= 15) return 0.015;
    if (lb <= 20) return 0.018;
    if (lb <= 25) return 0.019;
    if (lb <= 30) return 0.022;
    return 0.025;
  }

  function estimateMonoLbFromDiameter(diameterIn) {
    var monoTable = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40];
    return monoTable.reduce(function(best, current) {
      return Math.abs(monoDiameter(current) - diameterIn) < Math.abs(monoDiameter(best) - diameterIn) ? current : best;
    }, monoTable[0]);
  }

  function calculateLineCapacityFromDiameter(capacityYards, ratedLineDiameterIn, selectedLineDiameterIn) {
    if (!(capacityYards > 0) || !(ratedLineDiameterIn > 0) || !(selectedLineDiameterIn > 0)) return null;
    var totalSpoolSpace = capacityYards * ratedLineDiameterIn * ratedLineDiameterIn;
    return totalSpoolSpace / (selectedLineDiameterIn * selectedLineDiameterIn);
  }

  function isReelReady(reel) {
    return !!reel && Number(reel.capacity_yards) > 0 && Number(reel.rated_line_diameter_in) > 0;
  }

  function isLineReady(line) {
    return !!line && Number(line.dia_in) > 0;
  }

  function calculateMainLineCapacity(reel, line) {
    if (!isReelReady(reel) || !isLineReady(line)) return null;
    return calculateLineCapacityFromDiameter(Number(reel.capacity_yards), Number(reel.rated_line_diameter_in), Number(line.dia_in));
  }

  function calculateFullSpoolCapacity(reel, line) {
    return calculateMainLineCapacity(reel, line);
  }

  function getReelSpoolSpace(reel) {
    if (!isReelReady(reel)) return null;
    return Number(reel.capacity_yards) * Number(reel.rated_line_diameter_in) * Number(reel.rated_line_diameter_in);
  }

  function calculateBackingNeeded(reel, mainLine, desiredMainLineYards, backingLine) {
    var totalSpoolSpace = getReelSpoolSpace(reel);
    var mainLineSpace = Number(desiredMainLineYards) * Number(mainLine.dia_in) * Number(mainLine.dia_in);
    var backingSpace = totalSpoolSpace - mainLineSpace;
    var backingYards = backingSpace / (Number(backingLine.dia_in) * Number(backingLine.dia_in));
    var mainPercent = totalSpoolSpace > 0 ? mainLineSpace / totalSpoolSpace * 100 : 0;
    var backingPercent = totalSpoolSpace > 0 ? Math.max(0, backingSpace) / totalSpoolSpace * 100 : 0;
    return {
      totalSpoolSpace: totalSpoolSpace,
      mainLineSpace: mainLineSpace,
      backingSpace: backingSpace,
      backingYards: Math.max(0, backingYards),
      overCapacity: backingSpace < 0,
      mainPercent: Math.min(100, mainPercent),
      backingPercent: backingPercent
    };
  }

  global.ReelCalcCore = {
    YARDS_PER_METER: YARDS_PER_METER,
    MM_PER_INCH: MM_PER_INCH,
    LB_PER_KG: LB_PER_KG,
    yardsToMeters: yardsToMeters,
    metersToYards: metersToYards,
    lbToKg: lbToKg,
    kgToLb: kgToLb,
    inchesToMm: inchesToMm,
    mmToInches: mmToInches,
    monoDiameter: monoDiameter,
    estimateMonoLbFromDiameter: estimateMonoLbFromDiameter,
    calculateLineCapacityFromDiameter: calculateLineCapacityFromDiameter,
    calculateFullSpoolCapacity: calculateFullSpoolCapacity,
    calculateMainLineCapacity: calculateMainLineCapacity,
    getReelSpoolSpace: getReelSpoolSpace,
    calculateBackingNeeded: calculateBackingNeeded,
    isReelReady: isReelReady,
    isLineReady: isLineReady
  };
})(window);
