const POLICY_DATA = {
  industrial: {
    none: { label: "停产", food: 0, medicine: 0, electricity: 0 },
    small: { label: "小规模生产", food: 3000000, medicine: 4000, electricity: 350000 },
    moderate: { label: "中规模生产", food: 5500000, medicine: 8500, electricity: 600000 },
    large: { label: "大规模生产", food: 10000000, medicine: 15000, electricity: 1000000 },
  },
  electrical: {
    none: { label: "停产", fuel: 0, electricity: 0 },
    small: { label: "小规模生产", fuel: 5000, electricity: 250000 },
    moderate: { label: "中规模生产", fuel: 30000, electricity: 700000 },
    large: { label: "大规模生产", fuel: 80000, electricity: 1500000 },
  },
  expedition: {
    none: { label: "停止远征", medicine: 0, fuel: 0, fuelProduction: 0 },
    small: { label: "小规模远征", medicine: 7000, fuel: 5000, fuelProduction: 15000 },
    moderate: { label: "中规模远征", medicine: 9000, fuel: 20000, fuelProduction: 45000 },
    large: { label: "大规模远征", medicine: 20000, fuel: 70000, fuelProduction: 120000 },
  },
};

const RESOURCE_NAMES = {
  food: "食物",
  fuel: "燃料",
  medicine: "药品",
  electricity: "电力",
  population: "人口",
};

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const state = {
  day: 1,
  population: 6000000,
  initialPopulation: 6000000,
  resources: { food: 24000000, fuel: 400000, medicine: 80000, electricity: 4000000 },
  policies: { industrial: "small", expedition: "small", electrical: "small" },
  snapshot: null,
  gameOver: false,
  events: ["国家进入第1天。"],
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
  if (!Number.isFinite(days)) return "无限天";
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(days)}天`;
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
      <div class="scenario worst"><span>最坏情况</span><strong>${formatDays(cases.worst)}</strong></div>
      <div class="scenario ordinary"><span>一般情况</span><strong>${formatDays(cases.ordinary)}</strong></div>
      <div class="scenario best"><span>最好情况</span><strong>${formatDays(cases.best)}</strong></div>
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
    const label = difference > 0 ? "增加" : difference < 0 ? "减少" : "没有变化";
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
  document.querySelector("#day-number").textContent = `第${state.day}天`;
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
  const groupNames = { industrial: "工业", expedition: "远征", electrical: "电力" };
  state.events.unshift(`${reason}：当前${groupNames[group]}政策“${previousPolicy.label}”无法维持，已自动停用。`);
}

function checkPolicyResources() {
  const electrical = policy("electrical");
  if (state.policies.electrical !== "none" && state.resources.fuel < electrical.fuel) {
    suspendPolicy("electrical", "燃料不足");
  }

  let industrial = policy("industrial");
  let availableElectricity = state.resources.electricity;
  if (state.policies.electrical !== "none") availableElectricity += policy("electrical").electricity;
  if (state.policies.industrial !== "none" && availableElectricity < industrial.electricity) {
    suspendPolicy("industrial", "电力不足");
  }

  industrial = policy("industrial");
  const expedition = policy("expedition");
  let availableMedicine = state.resources.medicine;
  if (state.policies.industrial !== "none") availableMedicine += industrial.medicine;
  if (state.policies.expedition !== "none" && availableMedicine < expedition.medicine) {
    suspendPolicy("expedition", "药品不足");
  }

  const electricalFuelNeed = state.policies.electrical === "none" ? 0 : policy("electrical").fuel;
  const expeditionFuelNeed = state.policies.expedition === "none" ? 0 : policy("expedition").fuel;
  if (electricalFuelNeed + expeditionFuelNeed > state.resources.fuel) {
    const affected = [];
    if (state.policies.electrical !== "none") {
      affected.push(`电力政策“${policy("electrical").label}”`);
      state.policies.electrical = "none";
    }
    if (state.policies.expedition !== "none") {
      affected.push(`远征政策“${policy("expedition").label}”`);
      state.policies.expedition = "none";
    }
    state.events.unshift(`燃料不足：无法同时维持${affected.join("和")}，相关政策已自动停用。`);

    industrial = policy("industrial");
    if (state.policies.industrial !== "none" && state.resources.electricity < industrial.electricity) {
      suspendPolicy("industrial", "电力不足");
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
    state.events.unshift(`食物短缺：${numberFormat.format(foodShortageDeaths)}人死亡，现有食物已耗尽。`);
  }

  if (state.population < state.initialPopulation * 0.2) {
    state.gameOver = true;
    state.events.unshift("国家覆灭：存活人口已低于初始人口的20%。");
  } else {
    state.events.unshift(`日期已推进至第${state.day}天。`);
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
