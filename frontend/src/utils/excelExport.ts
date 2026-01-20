import ExcelJS from 'exceljs';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AggregatedMetrics } from '../types';

// Register Chart.js components
Chart.register(...registerables);

interface BooliData {
  sales: any[];
  summary: any;
}

// Color palette
const COLORS = {
  primary: '2563EB',      // Blue
  primaryLight: 'DBEAFE', // Light blue
  secondary: '059669',    // Green
  secondaryLight: 'D1FAE5', // Light green
  header: '1E3A8A',       // Dark blue
  headerText: 'FFFFFF',   // White
  border: 'D1D5DB',       // Gray border
  background: 'F9FAFB',   // Light gray background
};

// Chart colors
const CHART_COLORS = {
  area: 'rgba(37, 99, 235, 0.8)',      // Blue
  kommun: 'rgba(156, 163, 175, 0.6)',  // Gray
  areaLight: 'rgba(37, 99, 235, 0.5)',
  kommunLight: 'rgba(156, 163, 175, 0.4)',
};

/**
 * Generate chart as base64 PNG image
 */
async function generateChartImage(config: ChartConfiguration, width: number = 600, height: number = 400): Promise<string> {
  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Create chart
  const chart = new Chart(ctx, {
    ...config,
    options: {
      ...config.options,
      responsive: false,
      animation: false,
      plugins: {
        ...config.options?.plugins,
        legend: {
          ...config.options?.plugins?.legend,
          labels: {
            font: { size: 12 }
          }
        }
      }
    }
  });

  // Wait for chart to render
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get base64 data
  const base64 = canvas.toDataURL('image/png').split(',')[1];

  // Destroy chart to free memory
  chart.destroy();

  return base64;
}

/**
 * Creates a styled header row
 */
function styleHeaderRow(row: ExcelJS.Row, numCols: number) {
  row.eachCell((cell, colNumber) => {
    if (colNumber <= numCols) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.header }
      };
      cell.font = {
        bold: true,
        color: { argb: COLORS.headerText },
        size: 11
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } }
      };
    }
  });
  row.height = 22;
}

/**
 * Styles data cells with alternating colors
 */
function styleDataRow(row: ExcelJS.Row, numCols: number, isEven: boolean) {
  row.eachCell((cell, colNumber) => {
    if (colNumber <= numCols) {
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.background }
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } }
      };
      cell.alignment = { vertical: 'middle' };
    }
  });
}

/**
 * Adds a section title
 */
function addSectionTitle(sheet: ExcelJS.Worksheet, title: string, row: number) {
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, size: 14, color: { argb: COLORS.header } };
  cell.alignment = { vertical: 'middle' };
  sheet.getRow(row).height = 25;
  return row + 1;
}

/**
 * Export to Excel with multiple sheets and charts
 */
export async function exportToExcel(
  metrics: AggregatedMetrics,
  desoCodes: string[],
  kommunName: string,
  booliData?: BooliData,
  propertyName?: string,
  coordinates?: [number, number]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fastighetsanalys';
  workbook.created = new Date();

  // ========== GENERATE CHARTS ==========

  // Age distribution chart
  const ageGroups = Object.entries(metrics.metrics.population.age_distribution || {});
  const ageLabels = ageGroups.map(([group]) => group + ' år');
  const ageAreaData = ageGroups.map(([, count]) => ((count as number) / metrics.metrics.population.total * 100));
  const ageKommunData = ageGroups.map(([group]) => {
    const kommunCount = metrics.metrics.population.kommun_avg?.age_distribution?.[group as keyof typeof metrics.metrics.population.age_distribution] as number | undefined;
    const kommunTotal = metrics.metrics.population.kommun_avg?.total || 0;
    return kommunCount && kommunTotal > 0 ? (kommunCount / kommunTotal * 100) : 0;
  });

  const ageChartBase64 = await generateChartImage({
    type: 'bar',
    data: {
      labels: ageLabels,
      datasets: [
        {
          label: 'Område (%)',
          data: ageAreaData,
          backgroundColor: CHART_COLORS.area,
        },
        {
          label: 'Kommun (%)',
          data: ageKommunData,
          backgroundColor: CHART_COLORS.kommun,
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Åldersfördelning',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Procent (%)' }
        }
      }
    }
  }, 700, 400);

  // Education chart
  const eduChartBase64 = await generateChartImage({
    type: 'bar',
    data: {
      labels: ['Förgymnasial', 'Gymnasial', 'Eftergymnasial'],
      datasets: [
        {
          label: 'Område (%)',
          data: [
            metrics.metrics.education.forgymnasial,
            metrics.metrics.education.gymnasial,
            metrics.metrics.education.eftergymnasial
          ],
          backgroundColor: CHART_COLORS.area,
        },
        {
          label: 'Kommun (%)',
          data: [
            metrics.metrics.education.kommun_avg?.forgymnasial || 0,
            metrics.metrics.education.kommun_avg?.gymnasial || 0,
            metrics.metrics.education.kommun_avg?.eftergymnasial || 0
          ],
          backgroundColor: CHART_COLORS.kommun,
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Utbildningsnivå',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Procent (%)' }
        }
      }
    }
  }, 500, 350);

  // Housing type pie chart
  const housingPieBase64 = await generateChartImage({
    type: 'pie',
    data: {
      labels: ['Småhus', 'Flerbostadshus'],
      datasets: [{
        data: [
          metrics.metrics.housing_type.smahus,
          metrics.metrics.housing_type.flerbostadshus
        ],
        backgroundColor: ['rgba(37, 99, 235, 0.8)', 'rgba(16, 185, 129, 0.8)'],
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Hustyp - Fördelning',
          font: { size: 16, weight: 'bold' }
        }
      }
    }
  }, 400, 350);

  // Tenure form pie chart
  const tenurePieBase64 = await generateChartImage({
    type: 'pie',
    data: {
      labels: ['Äganderätt', 'Bostadsrätt', 'Hyresrätt'],
      datasets: [{
        data: [
          metrics.metrics.tenure_form.aganderatt,
          metrics.metrics.tenure_form.bostadsratt,
          metrics.metrics.tenure_form.hyresratt
        ],
        backgroundColor: ['rgba(37, 99, 235, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)'],
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Upplåtelseform - Fördelning',
          font: { size: 16, weight: 'bold' }
        }
      }
    }
  }, 400, 350);

  // Origin bar chart
  const originChartBase64 = await generateChartImage({
    type: 'bar',
    data: {
      labels: ['Svensk bakgrund', 'Utländsk bakgrund'],
      datasets: [
        {
          label: 'Område (%)',
          data: [
            100 - metrics.metrics.origin.percentage_foreign,
            metrics.metrics.origin.percentage_foreign
          ],
          backgroundColor: CHART_COLORS.area,
        },
        {
          label: 'Kommun (%)',
          data: [
            metrics.metrics.origin.kommun_avg ? (100 - metrics.metrics.origin.kommun_avg.percentage_foreign) : 0,
            metrics.metrics.origin.kommun_avg?.percentage_foreign || 0
          ],
          backgroundColor: CHART_COLORS.kommun,
        }
      ]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Härkomst',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Procent (%)' }
        }
      }
    }
  }, 450, 350);

  // ========== ÖVERSIKT ==========
  const overviewSheet = workbook.addWorksheet('Översikt', {
    properties: { tabColor: { argb: COLORS.primary } }
  });

  // Set column widths
  overviewSheet.columns = [
    { width: 25 },
    { width: 30 },
    { width: 20 },
    { width: 20 }
  ];

  // Title
  overviewSheet.mergeCells('A1:D1');
  const titleCell = overviewSheet.getCell('A1');
  titleCell.value = 'FASTIGHETSANALYS';
  titleCell.font = { bold: true, size: 20, color: { argb: COLORS.header } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(1).height = 35;

  // Metadata
  let currentRow = 3;
  const metadataItems = [
    ['Exportdatum', new Date().toLocaleString('sv-SE')],
    ['Kommun', kommunName],
    ...(propertyName ? [['Fastighet', propertyName]] : []),
    ...(coordinates ? [['Koordinater', `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`]] : []),
    ['Antal DeSO-områden', metrics.area_count.toString()],
    ['DeSO-koder', desoCodes.join(', ')]
  ];

  metadataItems.forEach(([label, value], index) => {
    const row = overviewSheet.getRow(currentRow + index);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  currentRow += metadataItems.length + 2;

  // Key metrics summary
  currentRow = addSectionTitle(overviewSheet, 'Nyckeltal', currentRow);

  const keyMetricsHeader = overviewSheet.getRow(currentRow);
  keyMetricsHeader.values = ['Metric', 'Område', 'Kommun', 'Riket'];
  styleHeaderRow(keyMetricsHeader, 4);
  currentRow++;

  const keyMetrics = [
    ['Befolkning', metrics.metrics.population.total.toLocaleString('sv-SE'), metrics.metrics.population.kommun_avg?.total?.toLocaleString('sv-SE') || '-', '-'],
    ['Medianinkomst (kr)', metrics.metrics.income.median_income.toLocaleString('sv-SE'), metrics.metrics.income.kommun_median?.toLocaleString('sv-SE') || '-', metrics.metrics.income.riket_median?.toLocaleString('sv-SE') || '-'],
    ['Eftergymnasial utbildning (%)', metrics.metrics.education.eftergymnasial.toFixed(1), metrics.metrics.education.kommun_avg?.eftergymnasial?.toFixed(1) || '-', metrics.metrics.education.riket_avg?.eftergymnasial?.toFixed(1) || '-'],
    ['Utländsk bakgrund (%)', metrics.metrics.origin.percentage_foreign.toFixed(1), metrics.metrics.origin.kommun_avg?.percentage_foreign?.toFixed(1) || '-', '-'],
    ['Småhus (%)', metrics.metrics.housing_type.percentage_smahus.toFixed(1), metrics.metrics.housing_type.kommun_avg?.percentage_smahus?.toFixed(1) || '-', '-'],
    ['Äganderätt (%)', metrics.metrics.tenure_form.percentage_aganderatt.toFixed(1), metrics.metrics.tenure_form.kommun_avg?.percentage_aganderatt?.toFixed(1) || '-', '-'],
  ];

  keyMetrics.forEach((rowData, index) => {
    const row = overviewSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });

  // ========== DEMOGRAFI ==========
  const demoSheet = workbook.addWorksheet('Demografi', {
    properties: { tabColor: { argb: '10B981' } }
  });

  demoSheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  currentRow = 1;

  // Befolkning section
  currentRow = addSectionTitle(demoSheet, 'Befolkning', currentRow);

  const popHeader = demoSheet.getRow(currentRow);
  popHeader.values = ['Metric', 'Område', 'Kommun'];
  styleHeaderRow(popHeader, 3);
  currentRow++;

  const popData = [
    ['Total befolkning', metrics.metrics.population.total.toLocaleString('sv-SE'), metrics.metrics.population.kommun_avg?.total?.toLocaleString('sv-SE') || '-'],
    ['Tillväxttakt (%)', (metrics.metrics.population.growth_rate || 0).toFixed(2) + '%', '-'],
  ];

  popData.forEach((rowData, index) => {
    const row = demoSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 3, index % 2 === 0);
  });
  currentRow += popData.length + 2;

  // Åldersfördelning
  currentRow = addSectionTitle(demoSheet, 'Åldersfördelning', currentRow);

  const ageHeader = demoSheet.getRow(currentRow);
  ageHeader.values = ['Åldersgrupp', 'Antal', 'Område (%)', 'Kommun (%)'];
  styleHeaderRow(ageHeader, 4);
  currentRow++;

  ageGroups.forEach(([ageGroup, count], index) => {
    const percentage = ((count as number) / metrics.metrics.population.total * 100);
    const kommunCount = metrics.metrics.population.kommun_avg?.age_distribution?.[ageGroup as keyof typeof metrics.metrics.population.age_distribution] as number | undefined;
    const kommunTotal = metrics.metrics.population.kommun_avg?.total || 0;
    const kommunPercentage = kommunCount && kommunTotal > 0 ? (kommunCount / kommunTotal * 100) : null;

    const row = demoSheet.getRow(currentRow + index);
    row.values = [
      ageGroup + ' år',
      count,
      percentage.toFixed(1),
      kommunPercentage?.toFixed(1) || '-'
    ];
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += ageGroups.length + 1;

  // Add age distribution chart
  const ageChartImageId = workbook.addImage({
    base64: ageChartBase64,
    extension: 'png',
  });
  demoSheet.addImage(ageChartImageId, {
    tl: { col: 5, row: 5 },
    ext: { width: 600, height: 350 }
  });

  currentRow += 2;

  // Härkomst section
  currentRow = addSectionTitle(demoSheet, 'Härkomst', currentRow);

  const originHeader = demoSheet.getRow(currentRow);
  originHeader.values = ['Kategori', 'Antal', 'Område (%)', 'Kommun (%)'];
  styleHeaderRow(originHeader, 4);
  currentRow++;

  const totalOrigin = metrics.metrics.origin.swedish_background + metrics.metrics.origin.foreign_background;
  const swedishPct = (metrics.metrics.origin.swedish_background / totalOrigin * 100);
  const kommunSwedishPct = metrics.metrics.origin.kommun_avg
    ? (metrics.metrics.origin.kommun_avg.swedish_background / (metrics.metrics.origin.kommun_avg.swedish_background + metrics.metrics.origin.kommun_avg.foreign_background) * 100)
    : null;

  const originData = [
    ['Svensk bakgrund', metrics.metrics.origin.swedish_background, swedishPct.toFixed(1), kommunSwedishPct?.toFixed(1) || '-'],
    ['Utländsk bakgrund', metrics.metrics.origin.foreign_background, metrics.metrics.origin.percentage_foreign.toFixed(1), metrics.metrics.origin.kommun_avg?.percentage_foreign?.toFixed(1) || '-'],
  ];

  originData.forEach((rowData, index) => {
    const row = demoSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += originData.length + 2;

  // Add origin chart
  const originChartImageId = workbook.addImage({
    base64: originChartBase64,
    extension: 'png',
  });
  demoSheet.addImage(originChartImageId, {
    tl: { col: 5, row: currentRow - 5 },
    ext: { width: 400, height: 300 }
  });

  // Hushåll section
  currentRow = addSectionTitle(demoSheet, 'Hushåll', currentRow);

  const householdHeader = demoSheet.getRow(currentRow);
  householdHeader.values = ['Metric', 'Område', 'Kommun'];
  styleHeaderRow(householdHeader, 3);
  currentRow++;

  const householdData = [
    ['Totalt antal hushåll', metrics.metrics.household.total_households.toLocaleString('sv-SE'), metrics.metrics.household.kommun_avg?.total_households?.toLocaleString('sv-SE') || '-'],
    ['Snitt storlek (pers/hushåll)', metrics.metrics.household.average_household_size.toFixed(2), metrics.metrics.household.kommun_avg?.average_household_size?.toFixed(2) || '-'],
  ];

  householdData.forEach((rowData, index) => {
    const row = demoSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 3, index % 2 === 0);
  });
  currentRow += householdData.length + 2;

  // Hushållstyper
  currentRow = addSectionTitle(demoSheet, 'Hushållstyper', currentRow);

  const hhTypeHeader = demoSheet.getRow(currentRow);
  hhTypeHeader.values = ['Typ', 'Antal', 'Område (%)', 'Kommun (%)'];
  styleHeaderRow(hhTypeHeader, 4);
  currentRow++;

  const totalHH = metrics.metrics.household.total_households;
  const kommunTotalHH = metrics.metrics.household.kommun_avg?.total_households || 0;

  const hhTypes = [
    ['Ensamstående utan barn', metrics.metrics.household.ensamstaende_utan_barn, metrics.metrics.household.kommun_avg?.ensamstaende_utan_barn],
    ['Ensamstående med barn', metrics.metrics.household.ensamstaende_med_barn, metrics.metrics.household.kommun_avg?.ensamstaende_med_barn],
    ['Par utan barn', metrics.metrics.household.par_utan_barn, metrics.metrics.household.kommun_avg?.par_utan_barn],
    ['Familjer', metrics.metrics.household.familjer, metrics.metrics.household.kommun_avg?.familjer],
    ['Övriga', metrics.metrics.household.ovriga, metrics.metrics.household.kommun_avg?.ovriga],
  ];

  hhTypes.forEach(([label, count, kommunCount], index) => {
    const pct = ((count as number) / totalHH * 100);
    const kommunPct = kommunCount && kommunTotalHH > 0 ? ((kommunCount as number) / kommunTotalHH * 100) : null;

    const row = demoSheet.getRow(currentRow + index);
    row.values = [label, count, pct.toFixed(1), kommunPct?.toFixed(1) || '-'];
    styleDataRow(row, 4, index % 2 === 0);
  });

  // ========== EKONOMI ==========
  const econSheet = workbook.addWorksheet('Ekonomi', {
    properties: { tabColor: { argb: 'F59E0B' } }
  });

  econSheet.columns = [
    { width: 25 },
    { width: 18 },
    { width: 18 },
    { width: 18 }
  ];

  currentRow = 1;

  // Inkomst section
  currentRow = addSectionTitle(econSheet, 'Inkomst', currentRow);

  const incomeHeader = econSheet.getRow(currentRow);
  incomeHeader.values = ['Metric', 'Område', 'Kommun', 'Riket'];
  styleHeaderRow(incomeHeader, 4);
  currentRow++;

  const incomeData = [
    ['Medianinkomst (kr)', metrics.metrics.income.median_income.toLocaleString('sv-SE'), metrics.metrics.income.kommun_median?.toLocaleString('sv-SE') || '-', metrics.metrics.income.riket_median?.toLocaleString('sv-SE') || '-'],
    ['Medelinkomst (kr)', metrics.metrics.income.mean_income.toLocaleString('sv-SE'), '-', '-'],
    ['Percentil 20 (kr)', metrics.metrics.income.percentile_20?.toLocaleString('sv-SE') || '-', '-', '-'],
    ['Percentil 80 (kr)', metrics.metrics.income.percentile_80?.toLocaleString('sv-SE') || '-', '-', '-'],
  ];

  incomeData.forEach((rowData, index) => {
    const row = econSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += incomeData.length + 2;

  // Utbildning section
  currentRow = addSectionTitle(econSheet, 'Utbildningsnivå', currentRow);

  const eduHeader = econSheet.getRow(currentRow);
  eduHeader.values = ['Nivå', 'Område (%)', 'Kommun (%)', 'Riket (%)'];
  styleHeaderRow(eduHeader, 4);
  currentRow++;

  const eduData = [
    ['Förgymnasial', metrics.metrics.education.forgymnasial.toFixed(1), metrics.metrics.education.kommun_avg?.forgymnasial?.toFixed(1) || '-', metrics.metrics.education.riket_avg?.forgymnasial?.toFixed(1) || '-'],
    ['Gymnasial', metrics.metrics.education.gymnasial.toFixed(1), metrics.metrics.education.kommun_avg?.gymnasial?.toFixed(1) || '-', metrics.metrics.education.riket_avg?.gymnasial?.toFixed(1) || '-'],
    ['Eftergymnasial', metrics.metrics.education.eftergymnasial.toFixed(1), metrics.metrics.education.kommun_avg?.eftergymnasial?.toFixed(1) || '-', metrics.metrics.education.riket_avg?.eftergymnasial?.toFixed(1) || '-'],
  ];

  eduData.forEach((rowData, index) => {
    const row = econSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += eduData.length + 1;

  // Add education chart
  const eduChartImageId = workbook.addImage({
    base64: eduChartBase64,
    extension: 'png',
  });
  econSheet.addImage(eduChartImageId, {
    tl: { col: 5, row: 7 },
    ext: { width: 450, height: 300 }
  });

  currentRow += 2;

  // Ekonomisk standard
  if (metrics.metrics.economic_standard) {
    currentRow = addSectionTitle(econSheet, 'Ekonomisk Standard', currentRow);

    const econStdHeader = econSheet.getRow(currentRow);
    econStdHeader.values = ['Metric', 'Område', 'Kommun'];
    styleHeaderRow(econStdHeader, 3);
    currentRow++;

    const econStdData = [
      ['Medianvärde (tkr)', metrics.metrics.economic_standard.median_value.toFixed(0), metrics.metrics.economic_standard.kommun_avg?.median_value?.toFixed(0) || '-'],
      ['Medelvärde (tkr)', metrics.metrics.economic_standard.mean_value.toFixed(0), metrics.metrics.economic_standard.kommun_avg?.mean_value?.toFixed(0) || '-'],
      ['Antal personer', metrics.metrics.economic_standard.total_persons.toLocaleString('sv-SE'), metrics.metrics.economic_standard.kommun_avg?.total_persons?.toLocaleString('sv-SE') || '-'],
    ];

    if (metrics.metrics.economic_standard.change_5y_percent !== undefined) {
      const changeStr = metrics.metrics.economic_standard.change_5y_percent >= 0
        ? `+${metrics.metrics.economic_standard.change_5y_percent.toFixed(1)}%`
        : `${metrics.metrics.economic_standard.change_5y_percent.toFixed(1)}%`;
      econStdData.push(['Förändring 2019-2023', changeStr, '-']);
    }

    econStdData.forEach((rowData, index) => {
      const row = econSheet.getRow(currentRow + index);
      row.values = rowData;
      styleDataRow(row, 3, index % 2 === 0);
    });
    currentRow += econStdData.length + 2;

    // Kvartiler
    currentRow = addSectionTitle(econSheet, 'Ekonomisk Standard - Kvartilfördelning', currentRow);

    const quartileHeader = econSheet.getRow(currentRow);
    quartileHeader.values = ['Kvartil', 'Område (%)', 'Kommun (%)'];
    styleHeaderRow(quartileHeader, 3);
    currentRow++;

    const quartileData = [
      ['Kvartil 1 (lägst)', metrics.metrics.economic_standard.quartile_1.toFixed(1), metrics.metrics.economic_standard.kommun_avg?.quartile_1?.toFixed(1) || '-'],
      ['Kvartil 2', metrics.metrics.economic_standard.quartile_2.toFixed(1), metrics.metrics.economic_standard.kommun_avg?.quartile_2?.toFixed(1) || '-'],
      ['Kvartil 3', metrics.metrics.economic_standard.quartile_3.toFixed(1), metrics.metrics.economic_standard.kommun_avg?.quartile_3?.toFixed(1) || '-'],
      ['Kvartil 4 (högst)', metrics.metrics.economic_standard.quartile_4.toFixed(1), metrics.metrics.economic_standard.kommun_avg?.quartile_4?.toFixed(1) || '-'],
    ];

    quartileData.forEach((rowData, index) => {
      const row = econSheet.getRow(currentRow + index);
      row.values = rowData;
      styleDataRow(row, 3, index % 2 === 0);
    });
    currentRow += quartileData.length + 2;
  }

  // Förvärvsinkomst
  if (metrics.metrics.earned_income) {
    currentRow = addSectionTitle(econSheet, 'Förvärvsinkomst', currentRow);

    const earnedHeader = econSheet.getRow(currentRow);
    earnedHeader.values = ['Metric', 'Område', 'Kommun'];
    styleHeaderRow(earnedHeader, 3);
    currentRow++;

    const earnedData = [
      ['Medianvärde (tkr)', metrics.metrics.earned_income.median_value.toFixed(0), metrics.metrics.earned_income.kommun_avg?.median_value?.toFixed(0) || '-'],
      ['Medelvärde (tkr)', metrics.metrics.earned_income.mean_value.toFixed(0), metrics.metrics.earned_income.kommun_avg?.mean_value?.toFixed(0) || '-'],
      ['Antal personer', metrics.metrics.earned_income.total_persons.toLocaleString('sv-SE'), metrics.metrics.earned_income.kommun_avg?.total_persons?.toLocaleString('sv-SE') || '-'],
    ];

    if (metrics.metrics.earned_income.change_5y_percent !== undefined) {
      const changeStr = metrics.metrics.earned_income.change_5y_percent >= 0
        ? `+${metrics.metrics.earned_income.change_5y_percent.toFixed(1)}%`
        : `${metrics.metrics.earned_income.change_5y_percent.toFixed(1)}%`;
      earnedData.push(['Förändring 2019-2023', changeStr, '-']);
    }

    earnedData.forEach((rowData, index) => {
      const row = econSheet.getRow(currentRow + index);
      row.values = rowData;
      styleDataRow(row, 3, index % 2 === 0);
    });
  }

  // ========== BOSTAD ==========
  const housingSheet = workbook.addWorksheet('Bostad', {
    properties: { tabColor: { argb: 'EF4444' } }
  });

  housingSheet.columns = [
    { width: 25 },
    { width: 18 },
    { width: 18 },
    { width: 18 }
  ];

  currentRow = 1;

  // Hustyp section
  currentRow = addSectionTitle(housingSheet, 'Hustyp', currentRow);

  const housingTypeHeader = housingSheet.getRow(currentRow);
  housingTypeHeader.values = ['Typ', 'Antal personer', 'Område (%)', 'Kommun (%)'];
  styleHeaderRow(housingTypeHeader, 4);
  currentRow++;

  const housingTypeData = [
    ['Småhus', metrics.metrics.housing_type.smahus.toLocaleString('sv-SE'), metrics.metrics.housing_type.percentage_smahus.toFixed(1), metrics.metrics.housing_type.kommun_avg?.percentage_smahus?.toFixed(1) || '-'],
    ['Flerbostadshus', metrics.metrics.housing_type.flerbostadshus.toLocaleString('sv-SE'), (100 - metrics.metrics.housing_type.percentage_smahus).toFixed(1), metrics.metrics.housing_type.kommun_avg ? (100 - metrics.metrics.housing_type.kommun_avg.percentage_smahus).toFixed(1) : '-'],
  ];

  housingTypeData.forEach((rowData, index) => {
    const row = housingSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += housingTypeData.length + 1;

  // Add housing type pie chart
  const housingPieImageId = workbook.addImage({
    base64: housingPieBase64,
    extension: 'png',
  });
  housingSheet.addImage(housingPieImageId, {
    tl: { col: 5, row: 1 },
    ext: { width: 350, height: 300 }
  });

  currentRow += 2;

  // Upplåtelseform section
  currentRow = addSectionTitle(housingSheet, 'Upplåtelseform', currentRow);

  const tenureHeader = housingSheet.getRow(currentRow);
  tenureHeader.values = ['Typ', 'Antal personer', 'Område (%)', 'Kommun (%)'];
  styleHeaderRow(tenureHeader, 4);
  currentRow++;

  const tenureData = [
    ['Äganderätt', metrics.metrics.tenure_form.aganderatt.toLocaleString('sv-SE'), metrics.metrics.tenure_form.percentage_aganderatt.toFixed(1), metrics.metrics.tenure_form.kommun_avg?.percentage_aganderatt?.toFixed(1) || '-'],
    ['Bostadsrätt', metrics.metrics.tenure_form.bostadsratt.toLocaleString('sv-SE'), metrics.metrics.tenure_form.percentage_bostadsratt.toFixed(1), metrics.metrics.tenure_form.kommun_avg?.percentage_bostadsratt?.toFixed(1) || '-'],
    ['Hyresrätt', metrics.metrics.tenure_form.hyresratt.toLocaleString('sv-SE'), metrics.metrics.tenure_form.percentage_hyresratt.toFixed(1), metrics.metrics.tenure_form.kommun_avg?.percentage_hyresratt?.toFixed(1) || '-'],
  ];

  tenureData.forEach((rowData, index) => {
    const row = housingSheet.getRow(currentRow + index);
    row.values = rowData;
    styleDataRow(row, 4, index % 2 === 0);
  });
  currentRow += tenureData.length + 1;

  // Add tenure pie chart
  const tenurePieImageId = workbook.addImage({
    base64: tenurePieBase64,
    extension: 'png',
  });
  housingSheet.addImage(tenurePieImageId, {
    tl: { col: 5, row: 8 },
    ext: { width: 350, height: 300 }
  });

  currentRow += 2;

  // Flyttmönster
  currentRow = addSectionTitle(housingSheet, 'Flyttmönster', currentRow);

  const migrationHeader = housingSheet.getRow(currentRow);
  migrationHeader.values = ['Metric', 'Värde'];
  styleHeaderRow(migrationHeader, 2);
  currentRow++;

  const migrationRow = housingSheet.getRow(currentRow);
  migrationRow.values = ['Nettoinflyttning', metrics.metrics.migration.netto];
  styleDataRow(migrationRow, 2, false);
  currentRow += 3;

  // Booli data if available
  if (booliData && booliData.summary) {
    currentRow = addSectionTitle(housingSheet, 'Prisanalys (Booli)', currentRow);

    const booliHeader = housingSheet.getRow(currentRow);
    booliHeader.values = ['Kategori', 'Antal sålda', 'Medelpris (kr)', 'Kr/m²'];
    styleHeaderRow(booliHeader, 4);
    currentRow++;

    const avgNew = booliData.summary.averages?.find((a: any) => a.category === 'nyproduktion');
    const avgOld = booliData.summary.averages?.find((a: any) => a.category === 'succession');
    const salesNew = booliData.summary.sales?.find((s: any) => s.category === 'nyproduktion');
    const salesOld = booliData.summary.sales?.find((s: any) => s.category === 'succession');

    const booliRows = [];
    if (avgNew) {
      booliRows.push(['Nyproduktion', salesNew?.count || 0, Math.round(parseFloat(avgNew.avg_price)).toLocaleString('sv-SE'), Math.round(parseFloat(avgNew.avg_price_per_sqm)).toLocaleString('sv-SE')]);
    }
    if (avgOld) {
      booliRows.push(['Succession', salesOld?.count || 0, Math.round(parseFloat(avgOld.avg_price)).toLocaleString('sv-SE'), Math.round(parseFloat(avgOld.avg_price_per_sqm)).toLocaleString('sv-SE')]);
    }

    booliRows.forEach((rowData, index) => {
      const row = housingSheet.getRow(currentRow + index);
      row.values = rowData;
      styleDataRow(row, 4, index % 2 === 0);
    });
  }

  // ========== GENERATE FILE ==========
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Create filename
  const dateStr = new Date().toISOString().split('T')[0];
  const kommunSlug = kommunName.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '_');
  const filename = `fastighetsanalys_${kommunSlug}_${dateStr}.xlsx`;

  // Download
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
