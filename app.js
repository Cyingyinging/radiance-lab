const PLANCK_H = 6.62607015e-34;
const LIGHT_C = 2.99792458e8;
const BOLTZMANN_K = 1.380649e-23;
const WIEN_B = 2.897771955e-3;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const MICRON = 1e-6;

const elements = {
  form: document.querySelector("#radiationForm"),
  temperatureInput: document.querySelector("#temperatureInput"),
  emissivityInput: document.querySelector("#emissivityInput"),
  lambdaMinInput: document.querySelector("#lambdaMinInput"),
  lambdaMaxInput: document.querySelector("#lambdaMaxInput"),
  sampleCountInput: document.querySelector("#sampleCountInput"),
  spectralVariableInput: document.querySelector("#spectralVariableInput"),
  radianceUnitInput: document.querySelector("#radianceUnitInput"),
  scaleModeInput: document.querySelector("#scaleModeInput"),
  presetButton: document.querySelector("#presetButton"),
  copyButton: document.querySelector("#copyButton"),
  statusText: document.querySelector("#statusText"),
  statsGrid: document.querySelector("#statsGrid"),
  bandMetrics: document.querySelector("#bandMetrics"),
  chartSvg: document.querySelector("#chartSvg"),
  chartTooltip: document.querySelector("#chartTooltip"),
  chartNote: document.querySelector("#chartNote"),
  theoryCards: document.querySelectorAll(".theory-card"),
  theoryDetail: document.querySelector("#theoryDetail"),
};

const state = {
  lastResult: null,
  lastInput: null,
};

const theoryContent = {
  planck: {
    title: "Planck 定律",
    formula: "L_lambda(T) = (2hc^2 / lambda^5) / (exp(hc / (lambda kT)) - 1)",
    paragraphs: [
      "Planck 定律描述理想黑体在热平衡状态下的谱辐射分布，是红外辐射计算的基础。随着温度升高，整条谱辐亮度曲线会整体上升，同时峰值向短波方向移动。",
      "在工程应用中，实际目标通常不是理想黑体，因此常用灰体近似，即在黑体谱辐亮度基础上乘以发射率 epsilon。"
    ],
  },
  wien: {
    title: "Wien 位移定律",
    formula: "lambda_max * T = b,  b ≈ 2.897771955 x 10^-3 m·K",
    paragraphs: [
      "Wien 位移定律给出了温度与峰值波长之间的反比关系。温度越高，谱峰越向短波移动，因此高温目标往往在更短波段释放更强辐射。",
      "它常用于估算目标的主要辐射波段，例如常温物体的峰值通常位于中远红外附近。"
    ],
  },
  stefan: {
    title: "Stefan-Boltzmann 定律",
    formula: "M = epsilon * sigma * T^4",
    paragraphs: [
      "Stefan-Boltzmann 定律给出单位面积上所有波段积分后的总辐射出射度。总辐射随温度四次方增长，因此温度变化会显著影响辐射强度。",
      "当目标发射率低于 1 时，总辐射出射度按比例下降，这也是材料表面特性影响红外特征的重要原因。"
    ],
  },
  infrared: {
    title: "红外波段划分",
    formula: "近红外: 0.75-3 um | 中红外: 3-8 um | 远红外: 8-1000 um",
    paragraphs: [
      "红外范围通常按应用习惯划分为近红外、中红外和远红外。不同波段对应不同的辐射特征、窗口条件和探测器技术路线。",
      "在热成像与目标探测中，3-5 um 和 8-14 um 是常见的大气窗口，因此页面提供的示例也优先围绕这些典型波段。"
    ],
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const abs = Math.abs(value);
  if ((abs >= 1e4 || (abs > 0 && abs < 1e-2))) {
    return value.toExponential(digits);
  }

  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
  });
}

function spectralRadiancePerMicron(lambdaMicron, temperature, emissivity) {
  const lambdaMeter = lambdaMicron * MICRON;
  const numerator = 2 * PLANCK_H * LIGHT_C ** 2;
  const exponent = (PLANCK_H * LIGHT_C) / (lambdaMeter * BOLTZMANN_K * temperature);
  const denominator = lambdaMeter ** 5 * (Math.exp(exponent) - 1);
  const radiancePerMeter = numerator / denominator;
  return emissivity * radiancePerMeter * MICRON;
}

function wavelengthToWavenumber(lambdaMicron) {
  return 10000 / lambdaMicron;
}

function radiancePerMicronToPerWavenumber(valuePerMicron, lambdaMicron) {
  return valuePerMicron * (lambdaMicron ** 2) / 10000;
}

function convertRadianceUnit(baseValue, lambdaMicron, unitKey) {
  const perWavenumberValue = radiancePerMicronToPerWavenumber(baseValue, lambdaMicron);

  switch (unitKey) {
    case "w_cm2_sr_um":
      return baseValue / 10000;
    case "w_m2_sr_cm-1":
      return perWavenumberValue;
    case "w_cm2_sr_cm-1":
      return perWavenumberValue / 10000;
    case "w_m2_sr_um":
    default:
      return baseValue;
  }
}

function getUnitLabel(unitKey) {
  const map = {
    "w_m2_sr_um": "W/(m2·sr·um)",
    "w_cm2_sr_um": "W/(cm2·sr·um)",
    "w_m2_sr_cm-1": "W/(m2·sr·cm-1)",
    "w_cm2_sr_cm-1": "W/(cm2·sr·cm-1)",
  };

  return map[unitKey] || map.w_m2_sr_um;
}

function getDomainLabel(spectralVariable) {
  return spectralVariable === "wavenumber" ? "波数 / cm-1" : "波长 / um";
}

function trapezoidalIntegral(points) {
  let sum = 0;

  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    const delta = right.lambda - left.lambda;
    sum += ((left.value + right.value) * delta) / 2;
  }

  return sum;
}

function buildDisplaySamples(samples, input) {
  return samples.map((sample) => ({
    lambda: sample.lambda,
    domainX: input.spectralVariable === "wavenumber" ? wavelengthToWavenumber(sample.lambda) : sample.lambda,
    value: convertRadianceUnit(sample.baseValue, sample.lambda, input.radianceUnit),
  }));
}

function buildSpectrum({ temperature, emissivity, lambdaMin, lambdaMax, sampleCount }) {
  const count = Math.max(2, sampleCount);
  const step = (lambdaMax - lambdaMin) / (count - 1);
  const samples = [];

  for (let index = 0; index < count; index += 1) {
    const lambda = lambdaMin + step * index;
    const baseValue = spectralRadiancePerMicron(lambda, temperature, emissivity);
    samples.push({ lambda, baseValue });
  }

  return samples;
}

function createStats(result) {
  return [
    {
      label: "峰值波长",
      value: `${formatNumber(result.peakWavelength, 3)} um`,
      note: "按 Wien 位移定律计算的谱峰位置",
    },
    {
      label: "峰值谱辐亮度",
      value: `${formatNumber(result.peakRadiance, 4)}`,
      note: `单位 ${result.unitLabel}`,
    },
    {
      label: "波段积分辐亮度",
      value: `${formatNumber(result.bandRadiance, 4)}`,
      note: `在输入波段内积分得到，单位 ${result.integralUnit}`,
    },
    {
      label: "总辐射出射度",
      value: `${formatNumber(result.totalExitance, 4)}`,
      note: "按 εσT4 计算，单位 W/m2",
    },
  ];
}

function renderStats(result) {
  elements.statsGrid.innerHTML = createStats(result)
    .map(
      (item) => `
        <article>
          <p>${item.label}</p>
          <strong>${item.value}</strong>
          <small>${item.note}</small>
        </article>
      `
    )
    .join("");
}

function renderBandMetrics(result) {
  const rows = [
    ["温度", `${formatNumber(result.temperature, 2)} K`],
    ["发射率", `${formatNumber(result.emissivity, 3)}`],
    ["积分波段", `${formatNumber(result.lambdaMin, 3)} ~ ${formatNumber(result.lambdaMax, 3)} um`],
    ["波数范围", `${formatNumber(result.nuMin, 3)} ~ ${formatNumber(result.nuMax, 3)} cm-1`],
    ["采样点数", `${result.sampleCount}`],
    ["谱变量", result.spectralVariable === "wavenumber" ? "按波数显示" : "按波长显示"],
    ["辐亮度单位", result.unitLabel],
    ["波段平均谱辐亮度", `${formatNumber(result.averageBandRadiance, 4)} ${result.unitLabel}`],
    ["波段积分单位", result.integralUnit],
    ["波段占总辐射比例", `${formatNumber(result.bandFraction * 100, 3)} %`],
    ["波段内最大谱辐亮度", `${formatNumber(result.maxBandRadiance, 4)} ${result.unitLabel}`],
    ["波段内最小谱辐亮度", `${formatNumber(result.minBandRadiance, 4)} ${result.unitLabel}`],
  ];

  elements.bandMetrics.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="metric-item">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function createChart(samples, options) {
  const width = 960;
  const height = 460;
  const padding = { top: 24, right: 30, bottom: 48, left: 84 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const domainSamples = buildDisplaySamples(samples, options);
  const sortedDomainSamples = [...domainSamples].sort((left, right) => left.domainX - right.domainX);
  const minX = sortedDomainSamples[0].domainX;
  const maxX = sortedDomainSamples[sortedDomainSamples.length - 1].domainX;
  const maxY = Math.max(...sortedDomainSamples.map((sample) => sample.value));
  const minY = options.scaleMode === "log"
    ? Math.max(Math.min(...sortedDomainSamples.map((sample) => sample.value).filter((value) => value > 0)), 1e-12)
    : 0;

  const mapX = (value) =>
    padding.left + ((value - minX) / Math.max(maxX - minX, Number.EPSILON)) * innerWidth;

  const mapY = (value) => {
    if (options.scaleMode === "log") {
      const safeValue = Math.max(value, minY);
      const logMin = Math.log10(minY);
      const logMax = Math.log10(maxY);
      const ratio = (Math.log10(safeValue) - logMin) / Math.max(logMax - logMin, Number.EPSILON);
      return padding.top + innerHeight - ratio * innerHeight;
    }

    return padding.top + innerHeight - (value / Math.max(maxY, Number.EPSILON)) * innerHeight;
  };

  const linePath = sortedDomainSamples
    .map((sample) => `${mapX(sample.domainX)},${mapY(sample.value)}`)
    .join(" ");
  const domainBandStart = options.spectralVariable === "wavenumber" ? wavelengthToWavenumber(options.lambdaMax) : options.lambdaMin;
  const domainBandEnd = options.spectralVariable === "wavenumber" ? wavelengthToWavenumber(options.lambdaMin) : options.lambdaMax;
  const bandLeft = mapX(Math.min(domainBandStart, domainBandEnd));
  const bandRight = mapX(Math.max(domainBandStart, domainBandEnd));
  const gridLines = [];
  const xTicks = 6;
  const yTicks = 5;

  for (let index = 0; index <= xTicks; index += 1) {
    const tickValue = minX + ((maxX - minX) / xTicks) * index;
    const x = mapX(tickValue);
    gridLines.push(`
      <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.08)" />
      <text x="${x}" y="${height - 18}" fill="rgba(229,231,235,0.82)" font-size="12" text-anchor="middle">${formatNumber(tickValue, 2)}</text>
    `);
  }

  for (let index = 0; index <= yTicks; index += 1) {
    const ratio = index / yTicks;
    const y = padding.top + innerHeight - ratio * innerHeight;
    let tickValue;

    if (options.scaleMode === "log") {
      const logMin = Math.log10(minY);
      const logMax = Math.log10(maxY);
      tickValue = 10 ** (logMin + (logMax - logMin) * ratio);
    } else {
      tickValue = maxY * ratio;
    }

    gridLines.push(`
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.08)" />
      <text x="${padding.left - 12}" y="${y + 4}" fill="rgba(229,231,235,0.82)" font-size="12" text-anchor="end">${formatNumber(tickValue, 2)}</text>
    `);
  }

  return `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
    <rect x="${bandLeft}" y="${padding.top}" width="${Math.max(bandRight - bandLeft, 2)}" height="${innerHeight}" fill="rgba(234,88,12,0.14)" />
    ${gridLines.join("")}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.28)" />
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.28)" />
    <polyline
      fill="none"
      stroke="url(#curveGradient)"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
      points="${linePath}"
    />
    <defs>
      <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="50%" stop-color="#fb7185" />
        <stop offset="100%" stop-color="#22d3ee" />
      </linearGradient>
    </defs>
    <text x="${width / 2}" y="${height - 10}" fill="rgba(229,231,235,0.92)" font-size="14" text-anchor="middle">${getDomainLabel(options.spectralVariable)}</text>
    <text x="24" y="${height / 2}" fill="rgba(229,231,235,0.92)" font-size="14" text-anchor="middle" transform="rotate(-90 24 ${height / 2})">谱辐亮度 / ${getUnitLabel(options.radianceUnit)}</text>
  `;
}

function renderChart(samples, options) {
  elements.chartSvg.innerHTML = createChart(samples, options);
  bindChartTooltip(samples, options);
  elements.chartNote.textContent =
    options.scaleMode === "log"
      ? "当前使用对数纵轴，更适合宽动态范围观察。"
      : "当前使用线性纵轴，适合直接观察峰值与面积变化。";
}

function getClosestSample(clientX) {
  const rect = elements.chartSvg.getBoundingClientRect();
  if (!state.lastResult || rect.width <= 0) {
    return null;
  }

  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  const samples = state.lastResult.samples;
  const domainSamples = samples
    .map((sample) => ({
      source: sample,
      domainX: state.lastInput.spectralVariable === "wavenumber"
        ? wavelengthToWavenumber(sample.lambda)
        : sample.lambda,
    }))
    .sort((left, right) => left.domainX - right.domainX);
  const minX = domainSamples[0].domainX;
  const maxX = domainSamples[domainSamples.length - 1].domainX;
  const targetX = minX + ratio * (maxX - minX);

  let closest = domainSamples[0];
  for (const sample of domainSamples) {
    if (Math.abs(sample.domainX - targetX) < Math.abs(closest.domainX - targetX)) {
      closest = sample;
    }
  }

  return closest;
}

function bindChartTooltip(samples, options) {
  const tooltip = elements.chartTooltip;

  const onMove = (event) => {
    const closest = getClosestSample(event.clientX);
    if (!closest) {
      return;
    }

    const rect = elements.chartSvg.getBoundingClientRect();
    const left = clamp(event.clientX - rect.left, 16, rect.width - 16);
    const top = clamp(event.clientY - rect.top, 16, rect.height - 16);
    const lambda = closest.source.lambda;
    const wavenumber = wavelengthToWavenumber(lambda);
    const value = convertRadianceUnit(closest.source.baseValue, lambda, options.radianceUnit);
    const primaryX = options.spectralVariable === "wavenumber"
      ? `${formatNumber(wavenumber, 3)} cm-1`
      : `${formatNumber(lambda, 3)} um`;

    tooltip.hidden = false;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.innerHTML = `
      <strong>${primaryX}</strong>
      <span>谱辐亮度: ${formatNumber(value, 4)} ${getUnitLabel(options.radianceUnit)}</span>
      <span>对应波长: ${formatNumber(lambda, 3)} um</span>
      <span>对应波数: ${formatNumber(wavenumber, 3)} cm-1</span>
    `;
  };

  const onLeave = () => {
    tooltip.hidden = true;
  };

  elements.chartSvg.onmousemove = onMove;
  elements.chartSvg.onmouseleave = onLeave;
  elements.chartSvg.ontouchstart = (event) => {
    if (event.touches[0]) {
      onMove(event.touches[0]);
    }
  };
  elements.chartSvg.ontouchmove = (event) => {
    if (event.touches[0]) {
      onMove(event.touches[0]);
    }
  };
  elements.chartSvg.ontouchend = onLeave;
}

function calculateResult(input) {
  const samples = buildSpectrum(input);
  const displaySamples = buildDisplaySamples(samples, input).sort((left, right) => left.domainX - right.domainX);
  const baseBandRadiance = trapezoidalIntegral(
    samples.map((sample) => ({
      lambda: sample.lambda,
      value: sample.baseValue,
    }))
  );
  const bandRadiance = trapezoidalIntegral(
    displaySamples.map((sample) => ({
      lambda: sample.domainX,
      value: sample.value,
    }))
  );
  const peakWavelength = (WIEN_B / input.temperature) / MICRON;
  const totalExitance = input.emissivity * STEFAN_BOLTZMANN * input.temperature ** 4;
  const peakRadiance = Math.max(...displaySamples.map((item) => item.value));
  const maxBandRadiance = peakRadiance;
  const minBandRadiance = Math.min(...displaySamples.map((item) => item.value));
  const domainSpan = Math.max(
    Math.abs(displaySamples[displaySamples.length - 1].domainX - displaySamples[0].domainX),
    Number.EPSILON
  );
  const averageBandRadiance = bandRadiance / domainSpan;

  return {
    ...input,
    samples,
    displaySamples,
    bandRadiance,
    baseBandRadiance,
    peakWavelength,
    peakRadiance,
    totalExitance,
    averageBandRadiance,
    maxBandRadiance,
    minBandRadiance,
    nuMin: wavelengthToWavenumber(input.lambdaMax),
    nuMax: wavelengthToWavenumber(input.lambdaMin),
    unitLabel: getUnitLabel(input.radianceUnit),
    integralUnit:
      input.radianceUnit === "w_cm2_sr_um" || input.radianceUnit === "w_cm2_sr_cm-1"
        ? "W/(cm2·sr)"
        : "W/(m2·sr)",
    bandFraction: Math.min((Math.PI * baseBandRadiance) / Math.max(totalExitance, Number.EPSILON), 1),
  };
}

function readInput() {
  const temperature = Number(elements.temperatureInput.value);
  const emissivity = Number(elements.emissivityInput.value);
  const lambdaMin = Number(elements.lambdaMinInput.value);
  const lambdaMax = Number(elements.lambdaMaxInput.value);
  const sampleCount = Number(elements.sampleCountInput.value);
  const spectralVariable = elements.spectralVariableInput.value;
  const radianceUnit = elements.radianceUnitInput.value;
  const scaleMode = elements.scaleModeInput.value;

  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new Error("温度必须大于 0 K。");
  }

  if (!Number.isFinite(emissivity) || emissivity <= 0 || emissivity > 1) {
    throw new Error("发射率需要位于 0 到 1 之间。");
  }

  if (!Number.isFinite(lambdaMin) || !Number.isFinite(lambdaMax) || lambdaMin <= 0 || lambdaMax <= lambdaMin) {
    throw new Error("结束波长必须大于起始波长，且波长要大于 0。");
  }

  return {
    temperature,
    emissivity,
    lambdaMin,
    lambdaMax,
    sampleCount: clamp(Math.round(sampleCount), 120, 3000),
    spectralVariable,
    radianceUnit,
    scaleMode,
  };
}

function buildSummaryText(result) {
  return [
    "Radiance Lab 结果摘要",
    `温度: ${formatNumber(result.temperature, 2)} K`,
    `发射率: ${formatNumber(result.emissivity, 3)}`,
    `波段: ${formatNumber(result.lambdaMin, 3)} ~ ${formatNumber(result.lambdaMax, 3)} um`,
    `波数范围: ${formatNumber(result.nuMin, 3)} ~ ${formatNumber(result.nuMax, 3)} cm-1`,
    `显示模式: ${result.spectralVariable === "wavenumber" ? "波数" : "波长"}`,
    `辐亮度单位: ${result.unitLabel}`,
    `峰值波长: ${formatNumber(result.peakWavelength, 3)} um`,
    `峰值谱辐亮度: ${formatNumber(result.peakRadiance, 4)} ${result.unitLabel}`,
    `波段积分辐亮度: ${formatNumber(result.bandRadiance, 4)} ${result.integralUnit}`,
    `总辐射出射度: ${formatNumber(result.totalExitance, 4)} W/m2`,
    `波段占总辐射比例: ${formatNumber(result.bandFraction * 100, 3)} %`,
  ].join("\n");
}

async function copySummary() {
  try {
    const result = calculateResult(readInput());
    await navigator.clipboard.writeText(buildSummaryText(result));
    elements.statusText.textContent = "结果摘要已复制到剪贴板。";
  } catch (error) {
    elements.statusText.textContent = error.message || "复制失败，请检查浏览器权限。";
  }
}

function updateView() {
  try {
    const input = readInput();
    const result = calculateResult(input);
    state.lastInput = input;
    state.lastResult = result;

    renderStats(result);
    renderBandMetrics(result);
    renderChart(result.samples, input);

    elements.statusText.textContent =
      `已完成 ${result.sampleCount} 个采样点的计算，当前按${input.spectralVariable === "wavenumber" ? "波数" : "波长"}显示，波段积分辐亮度为 ${formatNumber(result.bandRadiance, 4)} ${result.integralUnit}。`;
  } catch (error) {
    elements.statusText.textContent = error.message || "输入有误，请检查参数。";
  }
}

function loadInfraredPreset() {
  elements.temperatureInput.value = "800";
  elements.emissivityInput.value = "0.92";
  elements.lambdaMinInput.value = "3";
  elements.lambdaMaxInput.value = "14";
  elements.sampleCountInput.value = "800";
  elements.spectralVariableInput.value = "wavelength";
  elements.radianceUnitInput.value = "w_m2_sr_um";
  elements.scaleModeInput.value = "linear";
  updateView();
}

function renderTheory(key) {
  const content = theoryContent[key];
  if (!content) {
    return;
  }

  elements.theoryDetail.innerHTML = `
    <h3>${content.title}</h3>
    <div class="formula">${content.formula}</div>
    ${content.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
  `;

  elements.theoryCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.theory === key);
  });
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateView();
  });

  [
    elements.temperatureInput,
    elements.emissivityInput,
    elements.lambdaMinInput,
    elements.lambdaMaxInput,
    elements.sampleCountInput,
    elements.spectralVariableInput,
    elements.radianceUnitInput,
    elements.scaleModeInput,
  ].forEach((element) => {
    element.addEventListener("input", updateView);
    element.addEventListener("change", updateView);
  });

  elements.presetButton.addEventListener("click", loadInfraredPreset);
  elements.copyButton.addEventListener("click", copySummary);
  elements.theoryCards.forEach((card) => {
    card.addEventListener("click", () => renderTheory(card.dataset.theory));
  });
}

bindEvents();
renderTheory("planck");
updateView();
