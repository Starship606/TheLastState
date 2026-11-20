const POLICY_DATA = {
  industrial: {
    none: { label: "None", food: 0, medicine: 0, electricity: 0 },
    small: { label: "Small", food: 3000000, medicine: 4000, electricity: 350000 },
    moderate: { label: "Moderate", food: 5500000, medicine: 8500, electricity: 600000 },
    large: { label: "Large", food: 10000000, medicine: 15000, electricity: 1000000 },
  },
  electrical: {
    none: { label: "None", fuel: 0, electricity: 0 },
    small: { label: "Small", fuel: 5000, electricity: 250000 },
    moderate: { label: "Moderate", fuel: 30000, electricity: 700000 },
    large: { label: "Large", fuel: 80000, electricity: 1500000 },
  },
  expedition: {
    none: { label: "None", medicine: 0, fuel: 0, fuelProduction: 0 },
    small: { label: "Small", medicine: 7000, fuel: 5000, fuelProduction: 15000 },
    moderate: { label: "Moderate", medicine: 9000, fuel: 20000, fuelProduction: 45000 },
    large: { label: "Large", medicine: 20000, fuel: 70000, fuelProduction: 120000 },
  },
};

const RESOURCE_NAMES = {
  food: "Food",
  fuel: "Fuel",
  medicine: "Medicine",
  electricity: "Electricity",
  population: "Population",
};

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const state = {
  day: 1,
  population: 6000000,
  initialPopulation: 6000000,
  resources: { food: 24000000, fuel: 400000, medicine: 80000, electricity: 4000000 },
  policies: { industrial: "small", expedition: "small", electrical: "small" },
  snapshot: null,
  gameOver: false,
  events: ["The nation enters Day 1."],
};

state.snapshot = getSnapshot();

function policy(group) {
  return POLICY_DATA[group][state.policies[group]];
}

function getSnapshot() {
  return { ...state.resources, population: state.population };
}

function estimateDays(stock, dailyConsumption, dailyProduction) {
  const netDailyLoss = dailyConsumption - dailyProduction;
  if (netDailyLoss <= 0) return Infinity;
  return Math.max(0, stock) / netDailyLoss;
}

function estimateOrdinaryDays(stock, largeProduction, smallConsumption) {
  if (smallConsumption <= 0) return Infinity;
  return Math.floor(Math.max(0, stock + largeProduction) / smallConsumption);
}

function formatDays(days) {
  if (!Number.isFinite(days)) return "∞ days";
  const formattedDays = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(days);
  return `${formattedDays} ${Number(days) === 1 ? "day" : "days"}`;
}

function scenarioEstimates() {
  const industrialNone = POLICY_DATA.industrial.none;
  const industrialSmall = POLICY_DATA.industrial.small;
  const industrialLarge = POLICY_DATA.industrial.large;
  const electricalNone = POLICY_DATA.electrical.none;
  const electricalSmall = POLICY_DATA.electrical.small;
  const electricalLarge = POLICY_DATA.electrical.large;
  const expeditionSmall = POLICY_DATA.expedition.small;
  const expeditionLarge = POLICY_DATA.expedition.large;
  const foodNeed = state.population;

  return {
    food: {
      worst: estimateDays(state.resources.food, foodNeed, industrialNone.food),
      ordinary: estimateOrdinaryDays(state.resources.food, industrialLarge.food, foodNeed),
      best: estimateDays(state.resources.food, foodNeed, industrialLarge.food),
    },
    fuel: {
      worst: estimateDays(state.resources.fuel, expeditionLarge.fuel + electricalLarge.fuel, 0),
      ordinary: estimateOrdinaryDays(
        state.resources.fuel,
        expeditionLarge.fuelProduction,
        expeditionSmall.fuel + electricalSmall.fuel,
      ),
      best: estimateDays(
        state.resources.fuel,
        expeditionLarge.fuel + electricalNone.fuel,
        expeditionLarge.fuelProduction,
      ),
    },
    medicine: {
      worst: estimateDays(state.resources.medicine, expeditionLarge.medicine, industrialNone.medicine),
      ordinary: estimateOrdinaryDays(
        state.resources.medicine,
        industrialLarge.medicine,
        expeditionSmall.medicine,
      ),
      best: estimateDays(
        state.resources.medicine,
        expeditionSmall.medicine,
        industrialLarge.medicine,
      ),
    },
    electricity: {
      worst: estimateDays(
        state.resources.electricity,
        industrialLarge.electricity,
        electricalNone.electricity,
      ),
      ordinary: estimateOrdinaryDays(
        state.resources.electricity,
        electricalLarge.electricity,
        industrialSmall.electricity,
      ),
      best: estimateDays(
        state.resources.electricity,
        industrialSmall.electricity,
        electricalLarge.electricity,
      ),
    },
  };
}

function renderResources() {
  const estimates = scenarioEstimates();
  const target = document.querySelector("#resource-list");
  target.replaceChildren();

  for (const [resource, cases] of Object.entries(estimates)) {
    const row = document.createElement("article");
    row.className = "resource-row";
    row.innerHTML = `
      <div class="resource-name">${RESOURCE_NAMES[resource]}</div>
      <div class="scenario worst"><span>Worst case</span><strong>${formatDays(cases.worst)}</strong></div>
      <div class="scenario ordinary"><span>Ordinary case</span><strong>${formatDays(cases.ordinary)}</strong></div>
      <div class="scenario best"><span>Best case</span><strong>${formatDays(cases.best)}</strong></div>
    `;
    target.append(row);
  }
}

function renderPolicies() {
  const controlIds = {
    industrial: "#industrial-policy",
    expedition: "#expedition-policy",
    electrical: "#electrical-policy",
  };
  for (const [group, selector] of Object.entries(controlIds)) {
    const control = document.querySelector(selector);
    control.replaceChildren();
    for (const [level, details] of Object.entries(POLICY_DATA[group])) {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = details.label;
      option.selected = state.policies[group] === level;
      control.append(option);
    }
    control.disabled = state.gameOver;
  }
}

function renderSummary() {
  const current = getSnapshot();
  const target = document.querySelector("#daily-summary");
  target.replaceChildren();
  for (const key of ["food", "fuel", "medicine", "electricity", "population"]) {
    const difference = current[key] - state.snapshot[key];
    const label = difference > 0 ? "Increased" : difference < 0 ? "Decreased" : "Nothing changed";
    const row = document.createElement("div");
    row.className = "summary-row";
    row.innerHTML = `<span>${RESOURCE_NAMES[key]}</span><span class="summary-state ${difference > 0 ? "up" : difference < 0 ? "down" : ""}">${label}</span>`;
    target.append(row);
  }
}

function renderEvents() {
  const target = document.querySelector("#event-log");
  target.replaceChildren();
  for (const event of state.events) {
    const item = document.createElement("li");
    item.textContent = event;
    target.append(item);
  }
}

function render() {
  document.querySelector("#day-number").textContent = `Day ${state.day}`;
  document.querySelector("#population-number").textContent = numberFormat.format(state.population);
  document.querySelector("#initial-population").textContent = numberFormat.format(state.initialPopulation);
  document.querySelector("#advance-button").disabled = state.gameOver;
  renderResources();
  renderPolicies();
  renderSummary();
  renderEvents();
}

function suspendPolicy(group, reason) {
  const previousPolicy = policy(group);
  if (state.policies[group] === "none") return;
  state.policies[group] = "none";
  const groupNames = { industrial: "Industrial", expedition: "Expedition", electrical: "Electrical" };
  state.events.unshift(`${reason}: the current ${groupNames[group]} policy (${previousPolicy.label}) cannot be sustained and has been suspended.`);
}

function checkPolicyResources() {
  const electrical = policy("electrical");
  if (state.policies.electrical !== "none" && state.resources.fuel < electrical.fuel) {
    suspendPolicy("electrical", "Fuel shortage");
  }

  let industrial = policy("industrial");
  let availableElectricity = state.resources.electricity;
  if (state.policies.electrical !== "none") availableElectricity += policy("electrical").electricity;
  if (state.policies.industrial !== "none" && availableElectricity < industrial.electricity) {
    suspendPolicy("industrial", "Electricity shortage");
  }

  industrial = policy("industrial");
  const expedition = policy("expedition");
  let availableMedicine = state.resources.medicine;
  if (state.policies.industrial !== "none") availableMedicine += industrial.medicine;
  if (state.policies.expedition !== "none" && availableMedicine < expedition.medicine) {
    suspendPolicy("expedition", "Medicine shortage");
  }

  const electricalFuelNeed = state.policies.electrical === "none" ? 0 : policy("electrical").fuel;
  const expeditionFuelNeed = state.policies.expedition === "none" ? 0 : policy("expedition").fuel;
  if (electricalFuelNeed + expeditionFuelNeed > state.resources.fuel) {
    const affected = [];
    if (state.policies.electrical !== "none") {
      affected.push(`Electrical policy (${policy("electrical").label})`);
      state.policies.electrical = "none";
    }
    if (state.policies.expedition !== "none") {
      affected.push(`Expedition policy (${policy("expedition").label})`);
      state.policies.expedition = "none";
    }
    state.events.unshift(`Fuel shortage: the current ${affected.join(" and ")} cannot both be sustained. Both policies have been suspended.`);

    industrial = policy("industrial");
    if (state.policies.industrial !== "none" && state.resources.electricity < industrial.electricity) {
      suspendPolicy("industrial", "Electricity shortage");
    }
  }
}

function advanceDay() {
  if (state.gameOver) return;

  checkPolicyResources();
  state.snapshot = getSnapshot();

  const industrial = policy("industrial");
  const expedition = policy("expedition");
  const electrical = policy("electrical");

  // Apply all daily production before daily consumption.
  state.resources.food += industrial.food;
  state.resources.medicine += industrial.medicine;
  state.resources.electricity += electrical.electricity;
  state.resources.fuel += expedition.fuelProduction;

  const foodNeed = state.population;
  let foodShortageDeaths = 0;
  if (state.resources.food >= foodNeed) {
    state.resources.food -= foodNeed;
  } else {
    state.resources.food = 0;
    foodShortageDeaths = Math.min(
      state.population,
      Math.max(1, Math.floor(state.initialPopulation * 0.2)),
    );
    state.population -= foodShortageDeaths;
  }

  state.resources.medicine -= expedition.medicine;
  state.resources.electricity -= industrial.electricity;
  state.resources.fuel -= expedition.fuel + electrical.fuel;
  state.day += 1;

  if (foodShortageDeaths > 0) {
    state.events.unshift(`Food shortage: ${numberFormat.format(foodShortageDeaths)} people died. Food reserves are depleted.`);
  }

  if (state.population < state.initialPopulation * 0.2) {
    state.gameOver = true;
    state.events.unshift("Defeat: the surviving population has fallen below 20% of its original size.");
  } else {
    state.events.unshift(`Day advanced to Day ${state.day}.`);
  }

  state.events = state.events.slice(0, 12);
  render();
}

for (const [group, selector] of Object.entries({
  industrial: "#industrial-policy",
  expedition: "#expedition-policy",
  electrical: "#electrical-policy",
})) {
  document.querySelector(selector).addEventListener("change", (event) => {
    state.policies[group] = event.target.value;
    render();
  });
}

document.querySelector("#advance-button").addEventListener("click", advanceDay);
render();
