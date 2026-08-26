(function() {
    "use strict";

    const PREMIUM_LINE_COST_LOW = 0.10;
    const PREMIUM_LINE_COST_HIGH = 0.16;
    const BACKING_COST_LOW = 0.01;
    const BACKING_COST_HIGH = 0.03;

    const YARDS_TO_METERS = 0.9144;
    const METERS_TO_YARDS = 1 / YARDS_TO_METERS;
    const INCH_TO_MM = 25.4;
    const MM_TO_INCH = 1 / INCH_TO_MM;
    const INCH_TO_CM = 2.54;
    const CM_TO_INCH = 1 / INCH_TO_CM;
    const LB_PER_KG = 2.2046226218;
    const MAX_REASONABLE_LENGTH_YARDS = 100000;
    const MAX_REASONABLE_RATING_LB = 1000;
    const NO_BACKING_FRACTION = 0.995;
    const MONO_RATING_DIAMETERS_IN = {
        2: 0.006, 4: 0.008, 6: 0.0095, 8: 0.011, 10: 0.012,
        12: 0.014, 15: 0.015, 20: 0.018, 25: 0.019, 30: 0.022,
        40: 0.025, 50: 0.028, 60: 0.031, 80: 0.035, 100: 0.04,
        120: 0.044
    };
    const BRAID_RATING_DIAMETERS_IN = {
        2: 0.003, 3: 0.0035, 4: 0.004, 6: 0.005, 8: 0.005,
        10: 0.006, 12: 0.007, 15: 0.008, 20: 0.009, 25: 0.01,
        30: 0.011, 40: 0.013, 50: 0.014, 60: 0.0155, 65: 0.016,
        80: 0.017, 100: 0.02, 120: 0.022
    };

    let isMetric = false;
    let isCapacityOnly = false;
    let currentDisplayIsMetric = false;
    let workingLineType = "mono";
    let backingLineType = "mono";
    let hasCalculated = false;
    let lastCalculationContext = null;
    let feedbackSubmitted = false;
    let copyStatusTimer = null;
    const acceptedDiameterWarnings = new Map();

    function trackCalculatorEvent(name, parameters) {
        const details = Object.assign({
            page_type: "homepage_calculator",
            calculator_version: "v2"
        }, lastCalculationContext || {}, parameters || {});

        if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.track === "function") {
            window.ReelCalcAnalytics.track(name, details);
            return;
        }
        if (typeof window.gtag === "function") {
            try {
                window.gtag("event", name, details);
                return;
            } catch (error) {
                // Analytics must never interrupt the calculator.
            }
        }

        window.ReelCalcAnalyticsQueue = Array.isArray(window.ReelCalcAnalyticsQueue)
            ? window.ReelCalcAnalyticsQueue
            : [];
        window.ReelCalcAnalyticsQueue.push({ name: name, parameters: details });
    }

    function calculationContext(mainResolution, backingResolution) {
        return {
            calculator_mode: isCapacityOnly ? "capacity" : "backing",
            unit_system: isMetric ? "metric" : "standard",
            main_line_type: workingLineType,
            backing_line_type: isCapacityOnly ? "not_applicable" : backingLineType,
            main_rating_source: mainResolution.anchorType,
            backing_rating_source: backingResolution ? backingResolution.anchorType : "not_applicable",
            rating_fallback_used: Boolean(
                mainResolution.fallback || (backingResolution && backingResolution.fallback)
            ),
            printed_rating_diameter_used: Boolean(
                !mainResolution.rating.diameterAssumed ||
                (backingResolution && !backingResolution.rating.diameterAssumed)
            ),
            handle_turns_available: getIptInches() > 0
        };
    }

    function resetResultTools() {
        const tools = document.getElementById("resultTools");
        const status = document.getElementById("resultActionStatus");
        const copyButton = document.getElementById("copyResultsButton");
        if (copyStatusTimer) {
            window.clearTimeout(copyStatusTimer);
            copyStatusTimer = null;
        }
        if (tools) tools.classList.add("hidden");
        if (status) status.textContent = "";
        if (copyButton) copyButton.textContent = "Copy Results";
        document.querySelectorAll("#resultTools .feedback-btn").forEach(function(button) {
            button.disabled = false;
            button.classList.remove("selected");
            button.setAttribute("aria-pressed", "false");
        });
        lastCalculationContext = null;
        feedbackSubmitted = false;
    }

    function showResultTools(mainResolution, backingResolution) {
        lastCalculationContext = calculationContext(mainResolution, backingResolution);
        feedbackSubmitted = false;
        document.getElementById("resultActionStatus").textContent = "";
        document.querySelectorAll("#resultTools .feedback-btn").forEach(function(button) {
            button.disabled = false;
            button.classList.remove("selected");
            button.setAttribute("aria-pressed", "false");
        });
        document.getElementById("resultTools").classList.remove("hidden");
    }

    function fallbackCopy(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command was unavailable.");
    }

    async function copyResults() {
        const outputText = document.getElementById("output").innerText.trim();
        if (!outputText) return;
        const copyText = "ReelCalc Result\n\n" + outputText;
        const copyButton = document.getElementById("copyResultsButton");
        const status = document.getElementById("resultActionStatus");

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                try {
                    await navigator.clipboard.writeText(copyText);
                } catch (clipboardError) {
                    fallbackCopy(copyText);
                }
            } else {
                fallbackCopy(copyText);
            }
            copyButton.textContent = "Copied";
            status.textContent = "Results copied.";
            trackCalculatorEvent("homepage_calculator_results_copied");
            copyStatusTimer = window.setTimeout(function() {
                copyButton.textContent = "Copy Results";
                if (status.textContent === "Results copied.") status.textContent = "";
                copyStatusTimer = null;
            }, 1800);
        } catch (error) {
            status.textContent = "Copy was blocked. Select the result text and copy it manually.";
        }
    }

    function submitFeedback(button) {
        if (feedbackSubmitted || !lastCalculationContext) return;
        feedbackSubmitted = true;
        const feedback = button.dataset.feedback;
        document.querySelectorAll("#resultTools .feedback-btn").forEach(function(feedbackButton) {
            const selected = feedbackButton === button;
            feedbackButton.disabled = true;
            feedbackButton.classList.toggle("selected", selected);
            feedbackButton.setAttribute("aria-pressed", String(selected));
        });
        document.getElementById("resultActionStatus").textContent = "Thanks for the feedback.";
        const feedbackEvent = feedback === "thumbs_down"
            ? "homepage_calculator_feedback_down"
            : "homepage_calculator_feedback_up";
        trackCalculatorEvent(feedbackEvent, {
            feedback_rating: feedback
        });
    }

    function safeNumber(element) {
        const value = (element.value || "").toString().trim();
        return value === "" ? NaN : Number(value);
    }

    function hasValue(element) {
        return (element.value || "").toString().trim() !== "";
    }

    function lineTypeName(type) {
        return type === "braid" ? "braid" : "mono / fluoro";
    }

    function ratingTypeName(type) {
        return type === "braid" ? "Braid" : "Mono";
    }

    function assumedRatingDiameter(type, strengthLb) {
        const table = type === "braid" ? BRAID_RATING_DIAMETERS_IN : MONO_RATING_DIAMETERS_IN;
        const strengths = Object.keys(table).map(Number).sort(function(a, b) { return a - b; });
        const lb = Number(strengthLb);
        if (!(lb > 0)) return null;
        if (table[lb]) return table[lb];

        if (lb < strengths[0]) {
            return table[strengths[0]] * Math.sqrt(lb / strengths[0]);
        }
        const maximum = strengths[strengths.length - 1];
        if (lb > maximum) {
            return table[maximum] * Math.sqrt(lb / maximum);
        }

        for (let index = 1; index < strengths.length; index += 1) {
            const high = strengths[index];
            if (lb > high) continue;
            const low = strengths[index - 1];
            const fraction = (lb - low) / (high - low);
            return table[low] + (table[high] - table[low]) * fraction;
        }
        return null;
    }

    function strengthToLb(value) {
        return Number(value) * (isMetric ? LB_PER_KG : 1);
    }

    function displayedStrength(valueLb) {
        const value = isMetric ? Number(valueLb) / LB_PER_KG : Number(valueLb);
        return Number(value.toFixed(isMetric ? 1 : 0)) + (isMetric ? " kg" : " lb");
    }

    function displayedDiameter(valueIn) {
        const value = isMetric ? Number(valueIn) * INCH_TO_MM : Number(valueIn);
        return formatSuggestedDiameter(value, isMetric) + (isMetric ? " mm" : " in");
    }

    function setSegmentActive(containerId, selectorKey, selectorValue) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.querySelectorAll(".seg-btn").forEach(function(button) {
            const matches = button.dataset[selectorKey] === selectorValue;
            button.classList.toggle("active", matches);
            button.setAttribute("aria-pressed", String(matches));
        });
    }

    function setMessage(id, message, kind) {
        const element = document.getElementById(id);
        if (!element) return;
        element.className = element.classList.contains("pair-message")
            ? "pair-message"
            : element.classList.contains("form-message")
                ? "form-message"
                : "field-message";
        if (kind) element.classList.add(kind);
        element.textContent = message || "";
    }

    function setDiameterMessage(inputId, message, kind, actions) {
        const messageElement = document.getElementById(inputId + "Message");
        const input = document.getElementById(inputId);
        if (!messageElement || !input) return;

        messageElement.className = "field-message" + (kind ? " " + kind : "");
        input.classList.toggle("input-error", kind === "error");
        input.classList.toggle("input-warning", kind === "warning");
        messageElement.textContent = message || "";

        if (actions && actions.length) {
            const actionWrap = document.createElement("div");
            actionWrap.className = "inline-actions";
            actions.forEach(function(action) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "inline-action";
                button.dataset.diameterAction = action.action;
                button.dataset.inputId = inputId;
                if (action.value != null) button.dataset.value = String(action.value);
                button.textContent = action.label;
                actionWrap.appendChild(button);
            });
            messageElement.appendChild(actionWrap);
        }
    }

    function formatSuggestedDiameter(value, metric) {
        const decimals = metric
            ? (value < 0.1 ? 3 : 2)
            : (value < 0.01 ? 4 : 3);
        return Number(value).toFixed(decimals);
    }

    function likelyDiameterSuggestion(value, metric) {
        if (!(value > 0)) return null;
        if (metric) {
            if (value >= 10 && value < 100) return value / 100;
            if (value >= 100 && value < 1000) return value / 1000;
            return null;
        }
        if (value >= 1 && value < 1000) return value / 1000;
        if (value >= 0.25 && value < 1) return value / 10;
        return null;
    }

    function assessDiameter(value, metric, warningAccepted) {
        if (!Number.isFinite(value)) {
            return { valid: false, kind: "missing", message: "Enter a numeric diameter." };
        }
        if (!(value > 0)) {
            return { valid: false, kind: "error", message: "Diameter must be greater than zero." };
        }

        const diameterMm = metric ? value : value * INCH_TO_MM;
        const suggestion = likelyDiameterSuggestion(value, metric);
        if (suggestion && suggestion > 0 && suggestion * (metric ? 1 : INCH_TO_MM) <= 3) {
            const unit = metric ? "mm" : "in";
            const formatted = formatSuggestedDiameter(suggestion, metric);
            if (!warningAccepted) {
                return {
                    valid: false,
                    kind: "warning",
                    suggestion: suggestion,
                    message: "That diameter looks unusually high. Did you mean " + formatted + " " + unit + "?"
                };
            }
        }

        if (diameterMm > 20) {
            return {
                valid: false,
                kind: "error",
                message: "That diameter is too large to be a realistic fishing-line diameter."
            };
        }

        if ((diameterMm > 3 || diameterMm < 0.01) && !warningAccepted) {
            return {
                valid: false,
                kind: "warning",
                message: "That diameter is unusual for fishing line. Check the decimal and unit before continuing."
            };
        }

        return {
            valid: true,
            kind: (diameterMm > 3 || diameterMm < 0.01) ? "warning" : "",
            message: (diameterMm > 3 || diameterMm < 0.01) ? "Using the unusual diameter you confirmed." : "",
            diameterIn: diameterMm * MM_TO_INCH
        };
    }

    function diameterWarningAccepted(inputId, value) {
        return acceptedDiameterWarnings.get(inputId) === [isMetric ? "metric" : "standard", value].join("|");
    }

    function validateDiameterField(inputId, required) {
        const input = document.getElementById(inputId);
        const present = hasValue(input);
        if (!present && !required) {
            setDiameterMessage(inputId, "", "");
            return { valid: false, blank: true };
        }

        const value = safeNumber(input);
        const accepted = diameterWarningAccepted(inputId, value);
        const assessment = assessDiameter(value, isMetric, accepted);

        if (assessment.valid) {
            setDiameterMessage(inputId, assessment.message, assessment.kind);
            return assessment;
        }

        if (assessment.kind === "missing") {
            setDiameterMessage(inputId, required ? assessment.message : "", required ? "error" : "");
            return assessment;
        }

        const enteredDiameterMm = isMetric ? value : value * INCH_TO_MM;
        const actions = assessment.kind === "warning"
            ? [
                ...(assessment.suggestion != null ? [{
                    action: "suggestion",
                    value: formatSuggestedDiameter(assessment.suggestion, isMetric),
                    label: "Use " + formatSuggestedDiameter(assessment.suggestion, isMetric)
                }] : []),
                ...(enteredDiameterMm <= 20 ? [{ action: "accept", label: "Keep entered value" }] : [])
            ]
            : [];
        setDiameterMessage(inputId, assessment.message, assessment.kind, actions);
        return assessment;
    }

    function ratingPairState(capacityPresent, diameterPresent, capacityValue, diameterValid) {
        if (!capacityPresent && !diameterPresent) return "blank";
        if (!capacityPresent || !diameterPresent) return "partial";
        if (!(capacityValue > 0) || !diameterValid) return "invalid";
        return "complete";
    }

    function readRating(type, showRequired) {
        const capacityInput = document.getElementById(type + "Capacity");
        const strengthInput = document.getElementById(type + "Strength");
        const diameterInput = document.getElementById(type + "Diameter");
        const capacityPresent = hasValue(capacityInput);
        const strengthPresent = hasValue(strengthInput);
        const diameterPresent = hasValue(diameterInput);
        const capacityDisplay = safeNumber(capacityInput);
        const strengthDisplay = safeNumber(strengthInput);
        const strengthLb = strengthToLb(strengthDisplay);
        const strengthValid = strengthPresent && strengthLb > 0;
        const diameterResult = validateDiameterField(type + "Diameter", diameterPresent);
        const referencePresent = strengthPresent || diameterPresent;
        const referenceValid = diameterPresent ? diameterResult.valid : strengthValid;
        const pairState = ratingPairState(
            capacityPresent,
            referencePresent,
            capacityDisplay,
            referenceValid
        );

        if (pairState === "blank") {
            setMessage(type + "RatingMessage", "", "");
            return { state: pairState, rating: null };
        }
        if (pairState === "partial") {
            const message = !capacityPresent
                ? "Enter how much line the reel holds for this rating."
                : "Enter the line strength shown with this capacity, or use the printed diameter option.";
            setMessage(
                type + "RatingMessage",
                message,
                "warning"
            );
            return { state: pairState, rating: null };
        }
        if (pairState === "invalid") {
            const message = !(capacityDisplay > 0)
                ? "Capacity must be a number greater than zero."
                : diameterPresent
                    ? "Correct or confirm the diameter before this rating can be used."
                    : "Rated line strength must be greater than zero.";
            setMessage(type + "RatingMessage", message, "error");
            return { state: pairState, rating: null };
        }

        const capacityYards = capacityDisplay * (isMetric ? METERS_TO_YARDS : 1);
        if (capacityYards > MAX_REASONABLE_LENGTH_YARDS) {
            setMessage(type + "RatingMessage", "That capacity amount looks unreasonably high. Check the number and unit.", "error");
            return { state: "invalid", rating: null };
        }
        if (!diameterPresent && strengthLb > MAX_REASONABLE_RATING_LB) {
            setMessage(type + "RatingMessage", "That rated line strength looks unreasonably high. Check the number and unit.", "error");
            return { state: "invalid", rating: null };
        }

        const referenceDiameterIn = diameterPresent
            ? diameterResult.diameterIn
            : assumedRatingDiameter(type, strengthLb);
        if (!(referenceDiameterIn > 0)) {
            setMessage(type + "RatingMessage", "ReelCalc could not estimate a diameter from that line strength.", "error");
            return { state: "invalid", rating: null };
        }

        const ratingMessage = diameterPresent
            ? ratingTypeName(type) + " rating ready using the printed " + displayedDiameter(referenceDiameterIn) + " diameter."
            : ratingTypeName(type) + " rating ready.";
        setMessage(type + "RatingMessage", ratingMessage, "ready");
        return {
            state: "complete",
            rating: {
                capacityYards: capacityYards,
                referenceDiameterIn: referenceDiameterIn,
                strengthLb: strengthValid ? strengthLb : null,
                diameterAssumed: !diameterPresent,
                type: type
            }
        };
    }

    function collectRatings(showRequired) {
        const mono = readRating("mono", showRequired);
        const braid = readRating("braid", showRequired);
        return {
            mono: mono.rating,
            braid: braid.rating,
            states: { mono: mono.state, braid: braid.state }
        };
    }

    function resolveRating(requestedType, ratings) {
        if (ratings[requestedType]) {
            return {
                rating: ratings[requestedType],
                requestedType: requestedType,
                anchorType: requestedType,
                fallback: false
            };
        }
        const alternateType = requestedType === "braid" ? "mono" : "braid";
        if (ratings[alternateType]) {
            return {
                rating: ratings[alternateType],
                requestedType: requestedType,
                anchorType: alternateType,
                fallback: true
            };
        }
        return null;
    }

    function capacityFromRating(rating, lineDiameterIn) {
        return rating.capacityYards * Math.pow(rating.referenceDiameterIn / lineDiameterIn, 2);
    }

    function estimateSetup(options) {
        const fullWorkingCapacityYards = capacityFromRating(
            options.workingRating,
            options.workingDiameterIn
        );

        if (options.capacityOnly) {
            return {
                fullWorkingCapacityYards: fullWorkingCapacityYards,
                backingYards: null,
                workingFraction: null
            };
        }

        const workingFraction = options.workingYards / fullWorkingCapacityYards;
        if (workingFraction > 1 + 1e-10) {
            return { error: "working_exceeds_capacity", fullWorkingCapacityYards: fullWorkingCapacityYards };
        }

        const fullBackingCapacityYards = capacityFromRating(
            options.backingRating,
            options.backingDiameterIn
        );
        return {
            fullWorkingCapacityYards: fullWorkingCapacityYards,
            fullBackingCapacityYards: fullBackingCapacityYards,
            workingFraction: workingFraction,
            backingYards: fullBackingCapacityYards * Math.max(0, 1 - workingFraction)
        };
    }

    function getIptInches() {
        const iptDisplay = safeNumber(document.getElementById("reelIPT"));
        if (!(iptDisplay > 0)) return null;
        return iptDisplay * (isMetric ? CM_TO_INCH : 1);
    }

    function validateIptField() {
        const input = document.getElementById("reelIPT");
        if (!hasValue(input)) {
            setMessage("reelIPTMessage", "", "");
            input.classList.remove("input-error");
            return { valid: true, inches: null };
        }

        const inches = safeNumber(input) * (isMetric ? CM_TO_INCH : 1);
        if (!(inches > 0)) {
            setMessage("reelIPTMessage", "Retrieve rate must be greater than zero, or leave this optional field blank.", "error");
            input.classList.add("input-error");
            return { valid: false, inches: null };
        }
        if (inches > 200) {
            setMessage("reelIPTMessage", "That retrieve rate looks unreasonably high. Check the number and unit.", "error");
            input.classList.add("input-error");
            return { valid: false, inches: null };
        }

        setMessage("reelIPTMessage", "", "");
        input.classList.remove("input-error");
        return { valid: true, inches: inches };
    }

    function appendCapacityTurns(totalYards) {
        const iptInches = getIptInches();
        if (!(iptInches > 0)) return;
        const totalTurns = (totalYards * 36 / iptInches).toFixed(1);
        document.getElementById("output").innerHTML +=
            "<hr><strong>Estimated Handle Turns (if reel IPT known)</strong><br>" +
            "Total line: " + totalTurns + " turns<br><br>" +
            "<em>Handle turns are estimated. Actual turns may vary slightly as spool diameter changes while filling.</em>";
    }

    function appendBackingTurns(backingYards, workingYards) {
        const iptInches = getIptInches();
        if (!(iptInches > 0)) return;
        const backingTurns = (backingYards * 36 / iptInches).toFixed(1);
        const workingTurns = (workingYards * 36 / iptInches).toFixed(1);
        document.getElementById("output").innerHTML +=
            "<hr><strong>Estimated Handle Turns (if reel IPT known)</strong><br>" +
            "Backing: " + backingTurns + " turns<br>" +
            "Main line: " + workingTurns + " turns<br><br>" +
            "<em>Handle turns are estimated. Actual turns may vary slightly as spool diameter changes while filling.</em>";
    }

    function appendRatingAssumption(note, mainResolution, backingResolution) {
        const resolutions = [mainResolution, backingResolution].filter(Boolean);
        const assumed = [];
        resolutions.forEach(function(resolution) {
            const rating = resolution.rating;
            if (!rating || !rating.diameterAssumed || !(rating.strengthLb > 0)) return;
            const key = rating.type + ":" + rating.strengthLb;
            if (assumed.some(function(item) { return item.key === key; })) return;
            assumed.push({
                key: key,
                label: displayedStrength(rating.strengthLb) + " " + ratingTypeName(rating.type)
            });
        });
        if (!assumed.length) return note;
        const labels = assumed.map(function(item) { return item.label; }).join(" and ");
        const ratingWord = assumed.length === 1 ? "capacity rating" : "capacity ratings";
        return note + " No printed diameter was entered, so this result is estimated from the reel's listed " + labels + " " + ratingWord + ".";
    }

    function resolutionNote(mainResolution, backingResolution) {
        let note;
        if (isCapacityOnly) {
            note = mainResolution.fallback
                ? "A complete " + ratingTypeName(mainResolution.anchorType) + " reel rating was used because the matching " + ratingTypeName(mainResolution.requestedType) + " rating was not available."
                : "This estimate uses the reel's " + ratingTypeName(mainResolution.anchorType) + " capacity rating and the entered main-line diameter.";
        } else if (!mainResolution.fallback && !backingResolution.fallback) {
            if (mainResolution.anchorType !== backingResolution.anchorType) {
                note = "The reel's " + ratingTypeName(mainResolution.anchorType) + " rating is used for the main line and its " + ratingTypeName(backingResolution.anchorType) + " rating is used for the backing.";
            } else {
                note = "The reel's " + ratingTypeName(mainResolution.anchorType) + " rating and both entered line diameters are used for this setup.";
            }
        } else if (mainResolution.anchorType === backingResolution.anchorType) {
            note = "Only the reel's " + ratingTypeName(mainResolution.anchorType) + " rating was available, so that complete rating and both entered line diameters are used for this estimate.";
        } else {
            const fallbackPortion = mainResolution.fallback ? "main line" : "backing";
            const fallbackResolution = mainResolution.fallback ? mainResolution : backingResolution;
            note = "The available " + ratingTypeName(fallbackResolution.anchorType) + " reel rating is used as the diameter-based fallback for the " + fallbackPortion + ".";
        }
        return appendRatingAssumption(note, mainResolution, backingResolution);
    }

    function validateMainAmount(required) {
        const input = document.getElementById("mainAmount");
        if (!required) {
            setMessage("mainAmountMessage", "", "");
            input.classList.remove("input-error");
            return { valid: true, value: 0 };
        }

        const value = safeNumber(input);
        if (!(value > 0)) {
            const message = hasValue(input)
                ? "Main Line Amount must be greater than zero."
                : "Enter the amount of main line you plan to use.";
            setMessage("mainAmountMessage", message, "error");
            input.classList.add("input-error");
            return { valid: false };
        }

        const yards = value * (isMetric ? METERS_TO_YARDS : 1);
        if (yards > MAX_REASONABLE_LENGTH_YARDS) {
            setMessage("mainAmountMessage", "That amount looks unreasonably high. Check the number and unit.", "error");
            input.classList.add("input-error");
            return { valid: false };
        }

        setMessage("mainAmountMessage", "", "");
        input.classList.remove("input-error");
        return { valid: true, value: yards };
    }

    function calculate(showRequired) {
        hasCalculated = Boolean(showRequired);
        setMessage("formMessage", "", "");
        resetResultTools();

        const ratings = collectRatings(showRequired);
        const usableRatings = { mono: ratings.mono, braid: ratings.braid };
        if (!usableRatings.mono && !usableRatings.braid) {
            if (showRequired) {
                setMessage("formMessage", "Enter at least one complete Mono or Braid reel capacity rating.", "error");
            }
            document.getElementById("output").innerHTML = "";
            return null;
        }

        const mainDiameter = validateDiameterField("mainDiameter", showRequired);
        const backingDiameter = isCapacityOnly
            ? { valid: true, diameterIn: null }
            : validateDiameterField("backingDiameter", showRequired);
        const mainAmount = validateMainAmount(!isCapacityOnly && showRequired);
        const ipt = validateIptField();
        if (!mainDiameter.valid || !backingDiameter.valid || !mainAmount.valid || !ipt.valid) {
            document.getElementById("output").innerHTML = "";
            return null;
        }

        const mainResolution = resolveRating(workingLineType, usableRatings);
        const backingResolution = isCapacityOnly ? null : resolveRating(backingLineType, usableRatings);
        if (!mainResolution || (!isCapacityOnly && !backingResolution)) {
            setMessage("formMessage", "ReelCalc could not establish a usable reel capacity rating.", "error");
            document.getElementById("output").innerHTML = "";
            return null;
        }

        const estimate = estimateSetup({
            workingRating: mainResolution.rating,
            backingRating: backingResolution ? backingResolution.rating : null,
            workingYards: mainAmount.value,
            workingDiameterIn: mainDiameter.diameterIn,
            backingDiameterIn: backingDiameter.diameterIn,
            capacityOnly: isCapacityOnly
        });

        const fullWorkingCapacityYards = estimate.fullWorkingCapacityYards;
        const output = document.getElementById("output");
        const outputMultiplier = isMetric ? YARDS_TO_METERS : 1;
        const unitLabel = isMetric ? "meters" : "yards";

        if (isCapacityOnly) {
            const capacityOut = fullWorkingCapacityYards * outputMultiplier;
            output.innerHTML =
                "<strong>Capacity Only Result</strong><br><br>" +
                "Estimated maximum that will fill the reel:<br>" +
                "&bull; <strong>Main line:</strong> " + capacityOut.toFixed(1) + " " + unitLabel +
                "<div style='margin-top:6px;font-size:13px;opacity:0.8;'>" + resolutionNote(mainResolution, null) + "</div>";
            appendCapacityTurns(fullWorkingCapacityYards);
            showResultTools(mainResolution, null);
            return { estimate: estimate, mainResolution: mainResolution, backingResolution: null };
        }

        if (estimate.error === "working_exceeds_capacity") {
            const capacityDisplay = fullWorkingCapacityYards * outputMultiplier;
            setMessage(
                "mainAmountMessage",
                "That amount exceeds the estimated reel capacity of " + capacityDisplay.toFixed(1) + " " + unitLabel + ". Reduce the amount or use thinner line.",
                "error"
            );
            document.getElementById("mainAmount").classList.add("input-error");
            output.innerHTML = "";
            return { estimate: estimate, mainResolution: mainResolution, backingResolution: backingResolution };
        }

        const noBackingRequired = estimate.workingFraction >= NO_BACKING_FRACTION;
        const backingYards = noBackingRequired ? 0 : estimate.backingYards;
        const workingYards = mainAmount.value;

        const premiumYardsAvoided = Math.max(0, fullWorkingCapacityYards - workingYards);
        const savingsLow = noBackingRequired ? 0 : Math.max(
            0,
            premiumYardsAvoided * PREMIUM_LINE_COST_LOW - backingYards * BACKING_COST_HIGH
        );
        const savingsHigh = noBackingRequired ? 0 : Math.max(
            savingsLow,
            premiumYardsAvoided * PREMIUM_LINE_COST_HIGH - backingYards * BACKING_COST_LOW
        );
        const savingsLowRounded = Math.floor(savingsLow);
        const savingsHighRounded = Math.ceil(savingsHigh);
        const savingsLabel = savingsHighRounded < 1
            ? "About $0"
            : savingsLowRounded < 1
                ? "Up to about $" + savingsHighRounded
                : savingsLowRounded === savingsHighRounded
                    ? "About $" + savingsLowRounded
                    : "About $" + savingsLowRounded + "-$" + savingsHighRounded;

        const backingOut = backingYards * outputMultiplier;
        const workingOut = workingYards * outputMultiplier;
        const totalOut = (backingYards + workingYards) * outputMultiplier;
        const fillMessage = noBackingRequired
            ? "<div style='margin-top:8px;font-size:13px;'><strong>No backing is required.</strong> The requested main-line amount effectively fills the reel.</div>"
            : "";

        output.innerHTML =
            "You need:<br>" +
            "&bull; <strong>Backing:</strong> " + backingOut.toFixed(1) + " " + unitLabel + "<br>" +
            "&bull; <strong>Main line:</strong> " + workingOut.toFixed(1) + " " + unitLabel + "<br>" +
            "&bull; <strong>Total on spool:</strong> " + totalOut.toFixed(1) + " " + unitLabel +
            fillMessage +
            "<div style='margin-top:6px;font-size:13px;opacity:0.8;'>" + resolutionNote(mainResolution, backingResolution) + "</div>" +
            "<div class='savings-box'>" +
            "<strong>Estimated Line-Cost Savings</strong><br><br>" +
            "<strong>" + savingsLabel + "</strong><br>" +
            "Savings come from using lower-cost backing instead of filling the entire spool with premium line.<br>" +
            "<em>Typical retail estimate using $0.10-$0.16 per yard for premium line and " +
            "$0.01-$0.03 per yard for backing. Actual prices vary by line, strength, and spool size.</em>" +
            "</div>";

        appendBackingTurns(backingYards, workingYards);
        showResultTools(mainResolution, backingResolution);
        return { estimate: estimate, mainResolution: mainResolution, backingResolution: backingResolution };
    }

    function updatePlaceholders() {
        const placeholders = isMetric
            ? {
                monoCapacity: "130",
                monoStrength: "4.5",
                monoDiameter: "0.30",
                braidCapacity: "170",
                braidStrength: "6.8",
                braidDiameter: "0.20",
                mainDiameter: "0.16",
                mainAmount: "150",
                backingDiameter: "0.30",
                reelIPT: "86"
            }
            : {
                monoCapacity: "150",
                monoStrength: "10",
                monoDiameter: "0.012",
                braidCapacity: "200",
                braidStrength: "15",
                braidDiameter: "0.008",
                mainDiameter: "0.006",
                mainAmount: "165",
                backingDiameter: "0.012",
                reelIPT: "34"
            };
        Object.keys(placeholders).forEach(function(id) {
            document.getElementById(id).placeholder = placeholders[id];
        });
    }

    function convertInputValue(id, multiplier, decimals) {
        const input = document.getElementById(id);
        const value = safeNumber(input);
        if (!Number.isNaN(value)) input.value = (value * multiplier).toFixed(decimals);
    }

    function convertDisplayedValues(toMetric) {
        if (toMetric === currentDisplayIsMetric) return;
        const lengthIds = ["monoCapacity", "braidCapacity", "mainAmount"];
        const strengthIds = ["monoStrength", "braidStrength"];
        const diameterIds = ["monoDiameter", "braidDiameter", "mainDiameter", "backingDiameter"];

        if (toMetric) {
            lengthIds.forEach(function(id) { convertInputValue(id, YARDS_TO_METERS, 1); });
            strengthIds.forEach(function(id) { convertInputValue(id, 1 / LB_PER_KG, 1); });
            diameterIds.forEach(function(id) { convertInputValue(id, INCH_TO_MM, 3); });
            convertInputValue("reelIPT", INCH_TO_CM, 1);
        } else {
            lengthIds.forEach(function(id) { convertInputValue(id, METERS_TO_YARDS, 1); });
            strengthIds.forEach(function(id) { convertInputValue(id, LB_PER_KG, 1); });
            diameterIds.forEach(function(id) { convertInputValue(id, MM_TO_INCH, 4); });
            convertInputValue("reelIPT", CM_TO_INCH, 1);
        }
        currentDisplayIsMetric = toMetric;
    }

    function updateUnitUI() {
        document.querySelectorAll(".lengthUnit").forEach(function(element) {
            element.textContent = isMetric ? "meters" : "yards";
        });
        document.querySelectorAll(".diaUnit").forEach(function(element) {
            element.textContent = isMetric ? "mm" : "in";
        });
        document.querySelectorAll(".strengthUnit").forEach(function(element) {
            element.textContent = isMetric ? "kg" : "lb";
        });
        document.getElementById("iptUnitLabel").textContent = isMetric ? "cm" : "inches";
        updatePlaceholders();
        updateHelpText();
        updateStep3Intro();
    }

    function updateHelpText() {
        document.getElementById("step1RatingExample").textContent = isMetric
            ? "Most reels list line strength and capacity, such as 4.5 kg / 137 meters. Enter that information normally."
            : "Most reels list pound test and capacity, such as 10 lb / 150 yards. Enter that information normally.";
        document.getElementById("step2DiameterHelp").textContent = isMetric
            ? "Enter the line's published diameter from its package or manufacturer specifications. Example: 0.16 mm."
            : "Enter the line's published diameter from its package or manufacturer specifications. Example: 0.006 in.";
        document.getElementById("step2ModeHelp").textContent = isCapacityOnly
            ? "You are in Capacity Only mode. Enter the main-line diameter and ReelCalc will estimate how much line is needed to fill the spool."
            : isMetric
                ? "Enter how much main line you want over the backing. Example: 150 meters of 0.16 mm braid."
                : "Enter how much main line you want over the backing. Example: 165 yards of 0.006 in braid.";
        document.getElementById("step3DiameterExample").textContent = isMetric
            ? "Example: 0.30 mm mono backing."
            : "Example: 0.012 in mono backing.";
    }

    function updateStep3Intro() {
        const intro = document.getElementById("step3Intro");
        const amount = safeNumber(document.getElementById("mainAmount"));
        if (!(amount > 0)) {
            intro.textContent = "Select your backing line type and enter its diameter. ReelCalc will calculate how much backing you need underneath your chosen main-line amount.";
            return;
        }

        const roundedAmount = Number(amount.toFixed(2));
        const unit = isMetric
            ? (roundedAmount === 1 ? "meter" : "meters")
            : (roundedAmount === 1 ? "yard" : "yards");
        intro.innerHTML = "Select your backing line type and enter its diameter. ReelCalc will calculate how much backing you need underneath your chosen <strong>" + roundedAmount + " " + unit + "</strong> of main line.";
    }

    function updateModeUI() {
        const backingGroup = document.getElementById("backingGroup");
        const mainAmountWrap = document.getElementById("mainAmountWrap");
        const modeSubtext = document.getElementById("modeSubtext");
        const step1Intro = document.getElementById("step1Intro");
        const step2Intro = document.getElementById("step2Intro");

        setSegmentActive("modeSegment", "mode", isCapacityOnly ? "capacity" : "backing");
        backingGroup.classList.toggle("hidden", isCapacityOnly);
        mainAmountWrap.classList.toggle("hidden", isCapacityOnly);

        if (isCapacityOnly) {
            modeSubtext.innerHTML =
                '<span id="modeBadge" class="mode-badge badge-capacity">CAPACITY MODE</span>' +
                " Calculate how much of the selected main line the reel can hold.";
            step1Intro.textContent =
                "Enter both Mono and Braid ratings when available for the most accurate result. One complete rating is enough to calculate.";
            step2Intro.textContent =
                "Select your line type and enter its diameter to calculate how much the reel can hold.";
            const step3Help = document.getElementById("step3Help");
            step3Help.classList.add("hidden");
            const step3Button = document.querySelector('[data-help-toggle="step3Help"]');
            if (step3Button) step3Button.setAttribute("aria-expanded", "false");
        } else {
            modeSubtext.innerHTML =
                '<span id="modeBadge" class="mode-badge badge-backing">BACKING MODE</span>' +
                " Calculate backing for your chosen main-line amount.";
            step1Intro.textContent =
                "Enter both Mono and Braid ratings when available for the most accurate result. One complete rating is enough to calculate.";
            step2Intro.textContent =
                "Enter the line you plan to put on the reel and how much of it you want to use.";
        }
        updateHelpText();
        updateStep3Intro();
    }

    function clearResult() {
        setMessage("formMessage", "", "");
        document.getElementById("output").innerHTML = "";
        resetResultTools();
        hasCalculated = false;
    }

    function refreshInlineValidation() {
        collectRatings(false);
        if (hasValue(document.getElementById("mainDiameter"))) validateDiameterField("mainDiameter", false);
        if (!isCapacityOnly && hasValue(document.getElementById("backingDiameter"))) {
            validateDiameterField("backingDiameter", false);
        }
        if (hasValue(document.getElementById("reelIPT"))) validateIptField();
    }

    function updateRatingDiameterVisibility(type, clearHiddenValue) {
        const toggle = document.getElementById(type + "UseDiameter");
        const wrap = document.getElementById(type + "DiameterWrap");
        const input = document.getElementById(type + "Diameter");
        const visible = Boolean(toggle && toggle.checked);
        wrap.classList.toggle("hidden", !visible);
        toggle.setAttribute("aria-expanded", String(visible));
        if (!visible && clearHiddenValue) {
            input.value = "";
            acceptedDiameterWarnings.delete(type + "Diameter");
            setDiameterMessage(type + "Diameter", "", "");
        }
    }

    function initialize() {
        const calculatorRoot = document.getElementById("reelcalc-homepage-calculator");
        if (!calculatorRoot || calculatorRoot.dataset.reelcalcInitialized === "true") return;
        calculatorRoot.dataset.reelcalcInitialized = "true";

        document.getElementById("unitSegment").addEventListener("click", function(event) {
            const button = event.target.closest(".seg-btn");
            if (!button || !button.dataset.unit) return;
            const goingMetric = button.dataset.unit === "metric";
            if (goingMetric === isMetric) return;

            convertDisplayedValues(goingMetric);
            isMetric = goingMetric;
            acceptedDiameterWarnings.clear();
            setSegmentActive("unitSegment", "unit", button.dataset.unit);
            updateUnitUI();
            clearResult();
            refreshInlineValidation();
        });

        document.getElementById("modeSegment").addEventListener("click", function(event) {
            const button = event.target.closest(".seg-btn");
            if (!button || !button.dataset.mode) return;
            isCapacityOnly = button.dataset.mode === "capacity";
            updateModeUI();
            clearResult();
            refreshInlineValidation();
        });

        document.getElementById("workingTypeSegment").addEventListener("click", function(event) {
            const button = event.target.closest(".seg-btn");
            if (!button || !button.dataset.lineType) return;
            workingLineType = button.dataset.lineType;
            setSegmentActive("workingTypeSegment", "lineType", workingLineType);
            clearResult();
        });

        document.getElementById("backingTypeSegment").addEventListener("click", function(event) {
            const button = event.target.closest(".seg-btn");
            if (!button || !button.dataset.lineType) return;
            backingLineType = button.dataset.lineType;
            setSegmentActive("backingTypeSegment", "lineType", backingLineType);
            clearResult();
        });

        calculatorRoot.querySelectorAll("[data-rating-diameter-toggle]").forEach(function(toggle) {
            toggle.addEventListener("change", function() {
                updateRatingDiameterVisibility(toggle.dataset.ratingDiameterToggle, true);
                clearResult();
                refreshInlineValidation();
            });
        });

        calculatorRoot.querySelectorAll("[data-help-toggle]").forEach(function(button) {
            button.addEventListener("click", function() {
                const panel = document.getElementById(button.dataset.helpToggle);
                const willOpen = panel.classList.contains("hidden");
                panel.classList.toggle("hidden", !willOpen);
                button.setAttribute("aria-expanded", String(willOpen));
            });
        });

        calculatorRoot.addEventListener("click", function(event) {
            const button = event.target.closest("[data-diameter-action]");
            if (!button) return;
            const inputId = button.dataset.inputId;
            const input = document.getElementById(inputId);
            if (button.dataset.diameterAction === "suggestion") {
                input.value = button.dataset.value;
                acceptedDiameterWarnings.delete(inputId);
            } else if (button.dataset.diameterAction === "accept") {
                const value = safeNumber(input);
                acceptedDiameterWarnings.set(inputId, [isMetric ? "metric" : "standard", value].join("|"));
            }
            clearResult();
            refreshInlineValidation();
            input.focus();
        });

        [
            "monoCapacity", "monoStrength", "monoDiameter",
            "braidCapacity", "braidStrength", "braidDiameter",
            "mainDiameter", "mainAmount", "backingDiameter", "reelIPT"
        ].forEach(function(id) {
            document.getElementById(id).addEventListener("input", function() {
                acceptedDiameterWarnings.delete(id);
                clearResult();
                refreshInlineValidation();
                if (id === "mainAmount") updateStep3Intro();
            });
        });

        document.getElementById("calculateButton").addEventListener("click", function() {
            calculate(true);
        });

        document.getElementById("copyResultsButton").addEventListener("click", copyResults);
        document.getElementById("resultTools").addEventListener("click", function(event) {
            const button = event.target.closest("[data-feedback]");
            if (button) submitFeedback(button);
        });

        setSegmentActive("unitSegment", "unit", "standard");
        setSegmentActive("modeSegment", "mode", "backing");
        setSegmentActive("workingTypeSegment", "lineType", workingLineType);
        setSegmentActive("backingTypeSegment", "lineType", backingLineType);
        updateRatingDiameterVisibility("mono", false);
        updateRatingDiameterVisibility("braid", false);
        updateUnitUI();
        updateModeUI();
    }

    window.ReelCalcHomepageCalculator = {
        initialize: initialize
    };

    if (typeof document.getElementById === "function") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initialize, { once: true });
        } else {
            initialize();
        }
    }

    window.calc = function() { return calculate(true); };
    window.ReelCalcHomepageTest = {
        calculate: calculate,
        estimateSetup: estimateSetup,
        capacityFromRating: capacityFromRating,
        resolveRating: resolveRating,
        assumedRatingDiameter: assumedRatingDiameter,
        assessDiameter: assessDiameter,
        likelyDiameterSuggestion: likelyDiameterSuggestion,
        ratingPairState: ratingPairState,
        getState: function() {
            return {
                isMetric: isMetric,
                isCapacityOnly: isCapacityOnly,
                workingLineType: workingLineType,
                backingLineType: backingLineType
            };
        }
    };
})();
