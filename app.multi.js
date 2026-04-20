const PLANCK_H = 6.62607015e-34;
const LIGHT_C = 2.99792458e8;
const BOLTZMANN_K = 1.380649e-23;
const WIEN_B = 2.897771955e-3;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const MICRON = 1e-6;
const CURVE_COLORS = ["#4cc9f0", "#ff9f43", "#35d07f", "#ff6b6b", "#c084fc", "#ffd166"];

const elements = {
  curveList: document.querySelector("#curveList"),
  legendList: document.querySelector("#legendList"),
  addCurveButton: document.querySelector("#addCurveButton"),
  presetGroupButton: document.querySelector("#presetGroupButton"),
  fitAllButton: document.querySelector("#fitAllButton"),
  editorTitle: document.querySelector("#editorTitle"),
  activeCurveBadge: document.querySelector("#activeCurveBadge"),
  nameInput: document.querySelector("#nameInput"),
  colorInput: document.querySelector("#colorInput"),
  temperatureInput: document.querySelector("#temperatureInput"),
  emissivityInput: document.querySelector("#emissivityInput"),
  lambdaMinInput: document.querySelector("#lambdaMinInput"),
  lambdaMaxInput: document.querySelector("#lambdaMaxInput"),
  sampleCountInput: document.querySelector("#sampleCountInput"),
  visibleInput: document.querySelector("#visibleInput"),
  spectralVariableInput: document.querySelector("#spectralVariableInput"),
  radianceUnitInput: document.querySelector("#radianceUnitInput"),
  scaleModeInput: document.querySelector("#scaleModeInput"),
  copyButton: document.querySelector("#copyButton"),
  statusText: document.querySelector("#statusText"),
  summaryGrid: document.querySelector("#summaryGrid"),
  bandMetrics: document.querySelector("#bandMetrics"),
  chartSvg: document.querySelector("#chartSvg"),
  navigatorSvg: document.querySelector("#navigatorSvg"),
  navigatorTrack: document.querySelector("#navigatorTrack"),
  navigatorWindow: document.querySelector("#navigatorWindow"),
  navigatorHandleLeft: document.querySelector("#navigatorHandleLeft"),
  navigatorHandleRight: document.querySelector("#navigatorHandleRight"),
  zoomStartInput: document.querySelector("#zoomStartInput"),
  zoomEndInput: document.querySelector("#zoomEndInput"),
  chartTooltip: document.querySelector("#chartTooltip"),
  chartNote: document.querySelector("#chartNote"),
  theoryCards: document.querySelectorAll(".theory-card"),
  theoryDetail: document.querySelector("#theoryDetail"),
};

const state = {
  curves: [],
  activeCurveId: null,
  display: {
    spectralVariable: "wavelength",
    radianceUnit: "w_m2_sr_um",
    scaleMode: "linear",
  },
  zoom: {
    start: null,
    end: null,
  },
  drag: {
    mode: null,
    pointerX: 0,
    startRatio: 0,
    endRatio: 1,
  },
  renderData: {
    activeResult: null,
    visibleResults: [],
    allResults: [],
    domain: null,
  },
};

const theoryContent = {
  planck: {
    title: "Planck 定律",
    formula: "L_lambda(T) = (2hc^2 / lambda^5) / (exp(hc / (lambda kT)) - 1)",
    paragraphs: [
      "Planck 定律描述理想黑体在热平衡状态下的谱辐射分布，是红外辐射计算的基础。温度越高，谱辐亮度整体抬升，峰值也会向短波方向移动。",
      "工程上常把实际目标视为灰体，即在黑体谱辐亮度基础上乘以发射率 epsilon，用于表征材料的辐射能力。"
    ],
  },
  wien: {
    title: "Wien 位移定律",
    formula: "lambda_max * T = b,  b ≈ 2.897771955 x 10^-3 m·K",
    paragraphs: [
      "Wien 位移定律给出温度与峰值波长之间的反比关系。温度越高，主要辐射能量越向短波区域集中。",
      "它常用于估算目标主要辐射落在哪个波段，从而辅助选择观测窗口与探测器。"
    ],
  },
  stefan: {
    title: "Stefan-Boltzmann 定律",
    formula: "M = epsilon * sigma * T^4",
    paragraphs: [
      "Stefan-Boltzmann 定律给出单位面积在所有波段上的总辐射出射度。由于与温度四次方相关，温度变化会显著影响总辐射水平。",
      "在相同温度下，发射率越低，目标总辐射越弱，因此材料表面处理会直接影响红外特征。"
    ],
  },
  infrared: {
    title: "红外波段划分",
    formula: "近红外: 0.75-3 um | 中红外: 3-8 um | 远红外: 8-1000 um",
    paragraphs: [
      "红外区域通常按应用习惯划分为近红外、中红外和远红外。不同波段对应不同的大气透过条件与探测器路线。",
      "工程上常关注 3-5 um 与 8-14 um 两个窗口，因为它们在目标探测、热成像和系统设计中非常常见。"
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
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) {
    return value.toExponential(digits);
  }

  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function createCurve(seed = {}) {
  const index = state.curves.length;
  return {
    id: crypto.randomUUID(),
    name: seed.name || `曲线 ${index + 1}`,
    color: seed.color || CURVE_COLORS[index % CURVE_COLORS.length],
    temperature: seed.temperature ?? 600,
    emissivity: seed.emissivity ?? 0.95,
    lambdaMin: seed.lambdaMin ?? 3,
    lambdaMax: seed.lambdaMax ?? 14,
    sampleCount: seed.sampleCount ?? 700,
    visible: seed.visible ?? true,
  };
}

function getActiveCurve() {
  return state.curves.find((curve) => curve.id === state.activeCurveId) || state.curves[0] || null;
}

function setActiveCurve(curveId) {
  state.activeCurveId = curveId;
  syncEditor();
  updateView();
}

function spectralRadiancePerMicron(lambdaMicron, temperature, emissivity) {
  const lambdaMeter = lambdaMicron * MICRON;
  const numerator = 2 * PLANCK_H * LIGHT_C ** 2;
  const exponent = (PLANCK_H * LIGHT_C) / (lambdaMeter * BOLTZMANN_K * temperature);
  const denominator = lambdaMeter ** 5 * (Math.exp(exponent) - 1);
  return emissivity * (numerator / denominator) * MICRON;
}

function wavelengthToWavenumber(lambdaMicron) {
  return 10000 / lambdaMicron;
}

function radiancePerMicronToPerWavenumber(valuePerMicron, lambdaMicron) {
  return valuePerMicron * (lambdaMicron ** 2) / 10000;
}

function convertRadianceUnit(baseValue, lambdaMicron, unitKey) {
  const perWavenumber = radiancePerMicronToPerWavenumber(baseValue, lambdaMicron);

  switch (unitKey) {
    case "w_cm2_sr_um":
      return baseValue / 10000;
    case "w_m2_sr_cm-1":
      return perWavenumber;
    case "w_cm2_sr_cm-1":
      return perWavenumber / 10000;
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

function getIntegralUnit(unitKey) {
  return unitKey === "w_cm2_sr_um" || unitKey === "w_cm2_sr_cm-1" ? "W/(cm2·sr)" : "W/(m2·sr)";
}

function getDomainLabel(spectralVariable) {
  return spectralVariable === "wavenumber" ? "波数 / cm-1" : "波长 / um";
}

function trapezoidalIntegral(points, key = "x") {
  let sum = 0;
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    sum += ((left.value + right.value) * (right[key] - left[key])) / 2;
  }
  return sum;
}

function buildSpectrum(curve) {
  const sampleCount = clamp(Math.round(curve.sampleCount), 120, 3000);
  const step = (curve.lambdaMax - curve.lambdaMin) / (sampleCount - 1);
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const lambda = curve.lambdaMin + step * index;
    samples.push({
      lambda,
      baseValue: spectralRadiancePerMicron(lambda, curve.temperature, curve.emissivity),
    });
  }

  return samples;
}

function buildDisplaySamples(samples) {
  return samples
    .map((sample) => ({
      lambda: sample.lambda,
      domainX:
        state.display.spectralVariable === "wavenumber"
          ? wavelengthToWavenumber(sample.lambda)
          : sample.lambda,
      value: convertRadianceUnit(sample.baseValue, sample.lambda, state.display.radianceUnit),
    }))
    .sort((left, right) => left.domainX - right.domainX);
}

function calculateCurve(curve) {
  const samples = buildSpectrum(curve);
  const displaySamples = buildDisplaySamples(samples);
  const baseIntegral = trapezoidalIntegral(
    samples.map((sample) => ({ x: sample.lambda, value: sample.baseValue })),
    "x"
  );
  const displayIntegral = trapezoidalIntegral(
    displaySamples.map((sample) => ({ x: sample.domainX, value: sample.value })),
    "x"
  );
  const peakRadiance = Math.max(...displaySamples.map((sample) => sample.value));
  const minRadiance = Math.min(...displaySamples.map((sample) => sample.value));
  const domainSpan = Math.max(
    Math.abs(displaySamples[displaySamples.length - 1].domainX - displaySamples[0].domainX),
    Number.EPSILON
  );

  return {
    ...curve,
    samples,
    displaySamples,
    peakWavelength: (WIEN_B / curve.temperature) / MICRON,
    peakRadiance,
    minRadiance,
    bandRadiance: displayIntegral,
    averageBandRadiance: displayIntegral / domainSpan,
    totalExitance: curve.emissivity * STEFAN_BOLTZMANN * curve.temperature ** 4,
    bandFraction: Math.min(
      (Math.PI * baseIntegral) /
        Math.max(curve.emissivity * STEFAN_BOLTZMANN * curve.temperature ** 4, Number.EPSILON),
      1
    ),
    unitLabel: getUnitLabel(state.display.radianceUnit),
    integralUnit: getIntegralUnit(state.display.radianceUnit),
    nuMin: wavelengthToWavenumber(curve.lambdaMax),
    nuMax: wavelengthToWavenumber(curve.lambdaMin),
  };
}

function renderCurveList() {
  elements.curveList.innerHTML = state.curves
    .map(
      (curve) => `
        <article class="curve-card ${curve.id === state.activeCurveId ? "is-active" : ""}" data-curve-id="${curve.id}">
          <div class="curve-card__head">
            <div class="curve-card__title">
              <span class="swatch" style="background:${curve.color}"></span>
              <strong>${curve.name}</strong>
            </div>
            <div class="curve-card__actions">
              <button class="icon-btn" type="button" data-action="toggle">${curve.visible ? "隐藏" : "显示"}</button>
              <button class="icon-btn icon-btn--danger" type="button" data-action="delete">删除</button>
            </div>
          </div>
          <div class="curve-card__meta">
            <small>T ${formatNumber(curve.temperature, 0)} K</small>
            <small>ε ${formatNumber(curve.emissivity, 2)}</small>
            <small>${formatNumber(curve.lambdaMin, 2)}-${formatNumber(curve.lambdaMax, 2)} um</small>
          </div>
        </article>
      `
    )
    .join("");

  elements.curveList.querySelectorAll("[data-curve-id]").forEach((item) => {
    item.addEventListener("click", (event) => {
      const { curveId } = item.dataset;
      const action = event.target.dataset.action;
      if (!curveId) {
        return;
      }

      if (action === "toggle") {
        event.stopPropagation();
        const curve = state.curves.find((entry) => entry.id === curveId);
        if (curve) {
          curve.visible = !curve.visible;
          updateView();
        }
        return;
      }

      if (action === "delete") {
        event.stopPropagation();
        removeCurve(curveId);
        return;
      }

      setActiveCurve(curveId);
    });
  });
}

function renderLegend(results) {
  elements.legendList.innerHTML = results
    .map(
      (result) => `
        <button class="legend-item ${result.id === state.activeCurveId ? "is-active" : ""}" type="button" data-legend-id="${result.id}">
          <div>
            <div class="curve-card__title">
              <span class="swatch" style="background:${result.color}"></span>
              <strong>${result.name}</strong>
            </div>
            <span>T ${formatNumber(result.temperature, 0)} K · ${result.unitLabel}</span>
          </div>
          <div class="legend-item__actions">
            <span>${result.visible ? "显示中" : "已隐藏"}</span>
          </div>
        </button>
      `
    )
    .join("");

  elements.legendList.querySelectorAll("[data-legend-id]").forEach((item) => {
    item.addEventListener("click", () => setActiveCurve(item.dataset.legendId));
  });
}

function renderSummary(results) {
  const visible = results.filter((result) => result.visible);
  const hottest = [...results].sort((left, right) => right.temperature - left.temperature)[0];
  const maxPeak = visible.length
    ? visible.reduce((current, item) => (item.peakRadiance > current.peakRadiance ? item : current), visible[0])
    : results[0];

  const cards = [
    {
      label: "可见曲线",
      value: `${visible.length}`,
      note: `总计 ${results.length} 条曲线已加入分析`,
    },
    {
      label: "当前变量",
      value: state.display.spectralVariable === "wavenumber" ? "波数" : "波长",
      note: state.display.scaleMode === "log" ? "对数纵轴" : "线性纵轴",
    },
    {
      label: "最热目标",
      value: hottest ? `${formatNumber(hottest.temperature, 0)} K` : "--",
      note: hottest ? hottest.name : "暂无数据",
    },
    {
      label: "最大峰值",
      value: maxPeak ? formatNumber(maxPeak.peakRadiance, 4) : "--",
      note: maxPeak ? `${maxPeak.name} · ${maxPeak.unitLabel}` : "暂无数据",
    },
  ];

  elements.summaryGrid.innerHTML = cards
    .map(
      (item) => `
        <article>
          <p>${item.label}</p>
          <strong>${item.value}</strong>
          <p>${item.note}</p>
        </article>
      `
    )
    .join("");
}

function renderBandMetrics(result) {
  if (!result) {
    elements.bandMetrics.innerHTML = '<div class="metric-item"><span>状态</span><strong>没有可用曲线</strong></div>';
    return;
  }

  const rows = [
    ["名称", result.name],
    ["温度", `${formatNumber(result.temperature, 2)} K`],
    ["发射率", formatNumber(result.emissivity, 3)],
    ["波段", `${formatNumber(result.lambdaMin, 3)} ~ ${formatNumber(result.lambdaMax, 3)} um`],
    ["波数范围", `${formatNumber(result.nuMin, 3)} ~ ${formatNumber(result.nuMax, 3)} cm-1`],
    ["峰值波长", `${formatNumber(result.peakWavelength, 3)} um`],
    ["峰值谱辐亮度", `${formatNumber(result.peakRadiance, 4)} ${result.unitLabel}`],
    ["波段积分辐亮度", `${formatNumber(result.bandRadiance, 4)} ${result.integralUnit}`],
    ["平均谱辐亮度", `${formatNumber(result.averageBandRadiance, 4)} ${result.unitLabel}`],
    ["波段占总辐射比例", `${formatNumber(result.bandFraction * 100, 3)} %`],
    ["总辐射出射度", `${formatNumber(result.totalExitance, 4)} W/m2`],
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

function getDomainBounds(results) {
  const visible = results.filter((result) => result.visible);
  if (!visible.length) {
    return null;
  }

  const allSamples = visible.flatMap((result) => result.displaySamples);
  return {
    minX: Math.min(...allSamples.map((sample) => sample.domainX)),
    maxX: Math.max(...allSamples.map((sample) => sample.domainX)),
  };
}

function ensureZoomBounds(domain) {
  if (!domain) {
    state.zoom.start = null;
    state.zoom.end = null;
    return;
  }

  if (state.zoom.start === null || state.zoom.end === null) {
    state.zoom.start = domain.minX;
    state.zoom.end = domain.maxX;
  }

  state.zoom.start = clamp(state.zoom.start, domain.minX, domain.maxX);
  state.zoom.end = clamp(state.zoom.end, domain.minX, domain.maxX);

  if (state.zoom.end - state.zoom.start < (domain.maxX - domain.minX) * 0.02) {
    state.zoom.end = Math.min(domain.maxX, state.zoom.start + (domain.maxX - domain.minX) * 0.02);
  }
}

function getZoomedVisibleResults(results, domain) {
  if (!domain) {
    return [];
  }

  ensureZoomBounds(domain);
  return results
    .filter((result) => result.visible)
    .map((result) => ({
      ...result,
      zoomSamples: result.displaySamples.filter(
        (sample) => sample.domainX >= state.zoom.start && sample.domainX <= state.zoom.end
      ),
    }));
}

function createChart(results) {
  const visible = results.filter((result) => result.visible);
  const width = 1120;
  const height = 560;
  const padding = { top: 24, right: 24, bottom: 56, left: 92 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (!visible.length) {
    return `
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
      <text x="${width / 2}" y="${height / 2}" fill="rgba(229,238,252,0.72)" font-size="24" text-anchor="middle">
        当前没有显示中的曲线
      </text>
    `;
  }

  const domain = getDomainBounds(results);
  const zoomed = getZoomedVisibleResults(results, domain).filter((result) => result.zoomSamples.length);
  const allSamples = zoomed.flatMap((result) => result.zoomSamples);
  const minX = state.zoom.start;
  const maxX = state.zoom.end;
  const maxY = Math.max(...allSamples.map((sample) => sample.value));
  const positiveValues = allSamples.map((sample) => sample.value).filter((value) => value > 0);
  const minY = state.display.scaleMode === "log" ? Math.max(Math.min(...positiveValues), 1e-12) : 0;

  const mapX = (value) =>
    padding.left + ((value - minX) / Math.max(maxX - minX, Number.EPSILON)) * innerWidth;

  const mapY = (value) => {
    if (state.display.scaleMode === "log") {
      const safeValue = Math.max(value, minY);
      const logMin = Math.log10(minY);
      const logMax = Math.log10(maxY);
      const ratio = (Math.log10(safeValue) - logMin) / Math.max(logMax - logMin, Number.EPSILON);
      return padding.top + innerHeight - ratio * innerHeight;
    }

    return padding.top + innerHeight - (value / Math.max(maxY, Number.EPSILON)) * innerHeight;
  };

  const xTicks = 8;
  const yTicks = 6;
  const gridLines = [];

  for (let index = 0; index <= xTicks; index += 1) {
    const tickValue = minX + ((maxX - minX) / xTicks) * index;
    const x = mapX(tickValue);
    gridLines.push(`
      <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="rgba(125,145,175,0.24)" />
      <text x="${x}" y="${height - 20}" fill="rgba(70,86,110,0.92)" font-size="12" text-anchor="middle">${formatNumber(tickValue, 2)}</text>
    `);
  }

  for (let index = 0; index <= yTicks; index += 1) {
    const ratio = index / yTicks;
    const y = padding.top + innerHeight - ratio * innerHeight;
    const tickValue =
      state.display.scaleMode === "log"
        ? 10 ** (Math.log10(minY) + (Math.log10(maxY) - Math.log10(minY)) * ratio)
        : maxY * ratio;

    gridLines.push(`
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(125,145,175,0.24)" />
      <text x="${padding.left - 12}" y="${y + 4}" fill="rgba(70,86,110,0.92)" font-size="12" text-anchor="end">${formatNumber(tickValue, 2)}</text>
    `);
  }

  const curveLines = zoomed
    .map((result) => {
      const points = result.zoomSamples.map((sample) => `${mapX(sample.domainX)},${mapY(sample.value)}`).join(" ");
      return `
        <polyline
          fill="none"
          stroke="${result.color}"
          stroke-width="${result.id === state.activeCurveId ? 3.6 : 2.4}"
          stroke-linecap="round"
          stroke-linejoin="round"
          points="${points}"
          opacity="${result.id === state.activeCurveId ? "1" : "0.84"}"
        />
      `;
    })
    .join("");

  return `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
    ${gridLines.join("")}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(85,102,126,0.78)" stroke-width="1.2" />
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgba(85,102,126,0.78)" stroke-width="1.2" />
    ${curveLines}
    <text x="${width / 2}" y="${height - 12}" fill="rgba(48,64,87,0.96)" font-size="14" font-weight="600" text-anchor="middle">${getDomainLabel(state.display.spectralVariable)}</text>
    <text x="28" y="${height / 2}" fill="rgba(48,64,87,0.96)" font-size="14" font-weight="600" text-anchor="middle" transform="rotate(-90 28 ${height / 2})">谱辐亮度 / ${getUnitLabel(state.display.radianceUnit)}</text>
  `;
}

function getClosestBundle(clientX) {
  const rect = elements.chartSvg.getBoundingClientRect();
  const visible = state.renderData.visibleResults;
  if (!visible.length || rect.width <= 0) {
    return null;
  }

  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  const domain = state.renderData.domain;
  const targetX = state.zoom.start + ratio * (state.zoom.end - state.zoom.start);

  return visible.map((result) => {
    const sourceSamples = result.zoomSamples?.length ? result.zoomSamples : result.displaySamples;
    let closest = sourceSamples[0];
    for (const sample of sourceSamples) {
      if (Math.abs(sample.domainX - targetX) < Math.abs(closest.domainX - targetX)) {
        closest = sample;
      }
    }
    return { result, sample: closest };
  });
}

function bindChartTooltip() {
  const tooltip = elements.chartTooltip;

  const onMove = (point) => {
    const bundle = getClosestBundle(point.clientX);
    if (!bundle || !bundle.length) {
      return;
    }

    const rect = elements.chartSvg.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.style.left = `${clamp(point.clientX - rect.left, 18, rect.width - 18)}px`;
    tooltip.style.top = `${clamp(point.clientY - rect.top, 18, rect.height - 18)}px`;

    const first = bundle[0].sample;
    const primaryX =
      state.display.spectralVariable === "wavenumber"
        ? `${formatNumber(first.domainX, 3)} cm-1`
        : `${formatNumber(first.domainX, 3)} um`;

    tooltip.innerHTML = `
      <strong>${primaryX}</strong>
      ${bundle
        .map(
          ({ result, sample }) => `
            <span><span class="swatch" style="background:${result.color};display:inline-block;margin-right:6px"></span>${result.name}: ${formatNumber(sample.value, 4)} ${result.unitLabel}</span>
          `
        )
        .join("")}
      <span>对应波长: ${formatNumber(first.lambda, 3)} um</span>
      <span>对应波数: ${formatNumber(wavelengthToWavenumber(first.lambda), 3)} cm-1</span>
    `;
  };

  const onLeave = () => {
    tooltip.hidden = true;
  };

  elements.chartSvg.onmousemove = onMove;
  elements.chartSvg.onmouseleave = onLeave;
  elements.chartSvg.ontouchstart = (event) => event.touches[0] && onMove(event.touches[0]);
  elements.chartSvg.ontouchmove = (event) => event.touches[0] && onMove(event.touches[0]);
  elements.chartSvg.ontouchend = onLeave;
}

function createNavigator(results) {
  const visible = results.filter((result) => result.visible);
  const width = 1120;
  const height = 110;
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };

  if (!visible.length) {
    return `<rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />`;
  }

  const domain = getDomainBounds(results);
  const allSamples = visible.flatMap((result) => result.displaySamples);
  const maxY = Math.max(...allSamples.map((sample) => sample.value));
  const mapX = (value) =>
    padding.left + ((value - domain.minX) / Math.max(domain.maxX - domain.minX, Number.EPSILON)) * (width - padding.left - padding.right);
  const mapY = (value) =>
    height - padding.bottom - (value / Math.max(maxY, Number.EPSILON)) * (height - padding.top - padding.bottom);

  const fills = visible
    .map((result) => {
      const points = result.displaySamples.map((sample) => `${mapX(sample.domainX)},${mapY(sample.value)}`).join(" ");
      return `<polyline fill="none" stroke="${result.color}" stroke-width="1.5" opacity="0.75" points="${points}" />`;
    })
    .join("");

  return `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
    ${fills}
  `;
}

function updateNavigatorWindow() {
  const domain = state.renderData.domain;
  if (!domain) {
    return;
  }

  const range = Math.max(domain.maxX - domain.minX, Number.EPSILON);
  const startRatio = (state.zoom.start - domain.minX) / range;
  const endRatio = (state.zoom.end - domain.minX) / range;
  const left = startRatio * 100;
  const width = Math.max((endRatio - startRatio) * 100, 4);

  elements.navigatorWindow.style.left = `${left}%`;
  elements.navigatorWindow.style.width = `${width}%`;
  elements.zoomStartInput.value = formatNumber(state.zoom.start, 3);
  elements.zoomEndInput.value = formatNumber(state.zoom.end, 3);
}

function renderChart(results) {
  elements.chartSvg.innerHTML = createChart(results);
  elements.navigatorSvg.innerHTML = createNavigator(results);
  updateNavigatorWindow();
  bindChartTooltip();
  elements.chartNote.textContent =
    state.display.scaleMode === "log"
      ? "对数纵轴已启用，适合比较不同温度下的宽动态范围。"
      : "线性纵轴已启用，适合观察峰值位置与谱面积差异。";
}

function syncEditor() {
  const active = getActiveCurve();
  if (!active) {
    return;
  }

  elements.editorTitle.textContent = `${active.name} 参数编辑`;
  elements.activeCurveBadge.textContent = active.visible ? "显示中" : "已隐藏";
  elements.nameInput.value = active.name;
  elements.colorInput.value = active.color;
  elements.temperatureInput.value = String(active.temperature);
  elements.emissivityInput.value = String(active.emissivity);
  elements.lambdaMinInput.value = String(active.lambdaMin);
  elements.lambdaMaxInput.value = String(active.lambdaMax);
  elements.sampleCountInput.value = String(active.sampleCount);
  elements.visibleInput.checked = active.visible;
  elements.spectralVariableInput.value = state.display.spectralVariable;
  elements.radianceUnitInput.value = state.display.radianceUnit;
  elements.scaleModeInput.value = state.display.scaleMode;
}

function removeCurve(curveId) {
  if (state.curves.length === 1) {
    elements.statusText.textContent = "至少保留一条曲线用于分析。";
    return;
  }

  state.curves = state.curves.filter((curve) => curve.id !== curveId);
  if (state.activeCurveId === curveId) {
    state.activeCurveId = state.curves[0].id;
  }
  syncEditor();
  updateView();
}

function updateActiveCurveFromEditor() {
  const active = getActiveCurve();
  if (!active) {
    return;
  }

  const next = {
    ...active,
    name: elements.nameInput.value.trim() || active.name,
    color: elements.colorInput.value,
    temperature: Number(elements.temperatureInput.value),
    emissivity: Number(elements.emissivityInput.value),
    lambdaMin: Number(elements.lambdaMinInput.value),
    lambdaMax: Number(elements.lambdaMaxInput.value),
    sampleCount: Number(elements.sampleCountInput.value),
    visible: elements.visibleInput.checked,
  };

  if (!Number.isFinite(next.temperature) || next.temperature <= 0) {
    throw new Error("温度必须大于 0 K。");
  }
  if (!Number.isFinite(next.emissivity) || next.emissivity <= 0 || next.emissivity > 1) {
    throw new Error("发射率需要位于 0 到 1 之间。");
  }
  if (!Number.isFinite(next.lambdaMin) || !Number.isFinite(next.lambdaMax) || next.lambdaMin <= 0 || next.lambdaMax <= next.lambdaMin) {
    throw new Error("结束波长必须大于起始波长。");
  }

  Object.assign(active, next);
}

function updateDisplayFromEditor() {
  state.display.spectralVariable = elements.spectralVariableInput.value;
  state.display.radianceUnit = elements.radianceUnitInput.value;
  state.display.scaleMode = elements.scaleModeInput.value;
}

function buildSummaryText(result) {
  return [
    `当前曲线: ${result.name}`,
    `温度: ${formatNumber(result.temperature, 2)} K`,
    `发射率: ${formatNumber(result.emissivity, 3)}`,
    `波段: ${formatNumber(result.lambdaMin, 3)} ~ ${formatNumber(result.lambdaMax, 3)} um`,
    `峰值波长: ${formatNumber(result.peakWavelength, 3)} um`,
    `峰值谱辐亮度: ${formatNumber(result.peakRadiance, 4)} ${result.unitLabel}`,
    `波段积分辐亮度: ${formatNumber(result.bandRadiance, 4)} ${result.integralUnit}`,
    `总辐射出射度: ${formatNumber(result.totalExitance, 4)} W/m2`,
  ].join("\n");
}

async function copySummary() {
  const active = state.renderData.activeResult;
  if (!active) {
    return;
  }

  try {
    await navigator.clipboard.writeText(buildSummaryText(active));
    elements.statusText.textContent = `已复制 ${active.name} 的摘要。`;
  } catch (error) {
    elements.statusText.textContent = "复制失败，请检查浏览器剪贴板权限。";
  }
}

function updateView() {
  try {
    updateDisplayFromEditor();
    updateActiveCurveFromEditor();

    const results = state.curves.map(calculateCurve);
    const domain = getDomainBounds(results);
    const visibleResults = getZoomedVisibleResults(results, domain);
    const activeResult = results.find((result) => result.id === state.activeCurveId) || results[0] || null;

    state.renderData.activeResult = activeResult;
    state.renderData.visibleResults = visibleResults;
    state.renderData.allResults = results;
    state.renderData.domain = domain;

    renderCurveList();
    renderLegend(results);
    renderSummary(results);
    renderBandMetrics(activeResult);
    renderChart(results);

    elements.statusText.textContent = `当前已加载 ${results.length} 条曲线，其中 ${visibleResults.length} 条正在图中显示。`;
  } catch (error) {
    elements.statusText.textContent = error.message || "参数存在错误，请检查输入。";
  }
}

function addCurve(seed) {
  const curve = createCurve(seed);
  state.curves.push(curve);
  state.activeCurveId = curve.id;
  syncEditor();
  updateView();
}

function loadPresetGroup() {
  state.curves = [
    createCurve({ name: "常温背景", color: "#4cc9f0", temperature: 300, emissivity: 0.96, lambdaMin: 8, lambdaMax: 14, sampleCount: 800 }),
    createCurve({ name: "中温目标", color: "#ff9f43", temperature: 600, emissivity: 0.92, lambdaMin: 3, lambdaMax: 14, sampleCount: 800 }),
    createCurve({ name: "高温热源", color: "#ff6b6b", temperature: 1000, emissivity: 0.88, lambdaMin: 1, lambdaMax: 12, sampleCount: 900 }),
  ];
  state.activeCurveId = state.curves[0].id;
  syncEditor();
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
  [
    elements.nameInput,
    elements.colorInput,
    elements.temperatureInput,
    elements.emissivityInput,
    elements.lambdaMinInput,
    elements.lambdaMaxInput,
    elements.sampleCountInput,
    elements.visibleInput,
    elements.spectralVariableInput,
    elements.radianceUnitInput,
    elements.scaleModeInput,
  ].forEach((element) => {
    element.addEventListener("input", updateView);
    element.addEventListener("change", updateView);
  });

  elements.addCurveButton.addEventListener("click", () => addCurve());
  elements.presetGroupButton.addEventListener("click", loadPresetGroup);
  elements.fitAllButton.addEventListener("click", () => {
    state.zoom.start = null;
    state.zoom.end = null;
    updateView();
  });
  elements.copyButton.addEventListener("click", copySummary);
  elements.zoomStartInput.addEventListener("change", () => {
    const domain = state.renderData.domain;
    if (!domain) {
      return;
    }
    const value = Number(elements.zoomStartInput.value);
    if (Number.isFinite(value)) {
      state.zoom.start = clamp(value, domain.minX, state.zoom.end ?? domain.maxX);
      if (state.zoom.end !== null && state.zoom.start >= state.zoom.end) {
        state.zoom.start = state.zoom.end - (domain.maxX - domain.minX) * 0.02;
      }
      updateView();
    }
  });
  elements.zoomEndInput.addEventListener("change", () => {
    const domain = state.renderData.domain;
    if (!domain) {
      return;
    }
    const value = Number(elements.zoomEndInput.value);
    if (Number.isFinite(value)) {
      state.zoom.end = clamp(value, state.zoom.start ?? domain.minX, domain.maxX);
      if (state.zoom.start !== null && state.zoom.end <= state.zoom.start) {
        state.zoom.end = state.zoom.start + (domain.maxX - domain.minX) * 0.02;
      }
      updateView();
    }
  });

  elements.theoryCards.forEach((card) => {
    card.addEventListener("click", () => renderTheory(card.dataset.theory));
  });

  const startDrag = (mode, event) => {
    const domain = state.renderData.domain;
    if (!domain) {
      return;
    }
    const range = Math.max(domain.maxX - domain.minX, Number.EPSILON);
    state.drag.mode = mode;
    state.drag.pointerX = event.clientX;
    state.drag.startRatio = (state.zoom.start - domain.minX) / range;
    state.drag.endRatio = (state.zoom.end - domain.minX) / range;
    elements.navigatorWindow.classList.add("is-dragging");
    event.preventDefault();
  };

  elements.navigatorWindow.addEventListener("mousedown", (event) => {
    if (event.target === elements.navigatorHandleLeft || event.target === elements.navigatorHandleRight) {
      return;
    }
    startDrag("move", event);
  });
  elements.navigatorHandleLeft.addEventListener("mousedown", (event) => startDrag("resize-left", event));
  elements.navigatorHandleRight.addEventListener("mousedown", (event) => startDrag("resize-right", event));

  window.addEventListener("mousemove", (event) => {
    if (!state.drag.mode) {
      return;
    }
    const domain = state.renderData.domain;
    const rect = elements.navigatorTrack.getBoundingClientRect();
    const deltaRatio = (event.clientX - state.drag.pointerX) / Math.max(rect.width, 1);
    let startRatio = state.drag.startRatio;
    let endRatio = state.drag.endRatio;

    if (state.drag.mode === "move") {
      const widthRatio = endRatio - startRatio;
      startRatio = clamp(startRatio + deltaRatio, 0, 1 - widthRatio);
      endRatio = startRatio + widthRatio;
    } else if (state.drag.mode === "resize-left") {
      startRatio = clamp(startRatio + deltaRatio, 0, endRatio - 0.04);
    } else if (state.drag.mode === "resize-right") {
      endRatio = clamp(endRatio + deltaRatio, startRatio + 0.04, 1);
    }

    const range = domain.maxX - domain.minX;
    state.zoom.start = domain.minX + startRatio * range;
    state.zoom.end = domain.minX + endRatio * range;
    updateView();
  });

  window.addEventListener("mouseup", () => {
    state.drag.mode = null;
    elements.navigatorWindow.classList.remove("is-dragging");
  });
}

function init() {
  state.curves = [
    createCurve({ name: "曲线 1", color: CURVE_COLORS[0], temperature: 500, emissivity: 0.96, lambdaMin: 3, lambdaMax: 14, sampleCount: 700 }),
    createCurve({ name: "曲线 2", color: CURVE_COLORS[1], temperature: 800, emissivity: 0.92, lambdaMin: 2, lambdaMax: 12, sampleCount: 700 }),
  ];
  state.activeCurveId = state.curves[0].id;
  bindEvents();
  renderTheory("planck");
  syncEditor();
  updateView();
}

init();
