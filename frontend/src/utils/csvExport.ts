import { AggregatedMetrics } from '../types';

interface BooliData {
  sales: any[];
  summary: any;
}

/**
 * Converts aggregated metrics to CSV format and triggers download
 */
export function exportToCSV(
  metrics: AggregatedMetrics,
  desoCodes: string[],
  kommunName: string,
  booliData?: BooliData,
  propertyName?: string,
  coordinates?: [number, number]
): void {
  const rows: string[] = [];

  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = '\uFEFF';

  // Header with metadata
  rows.push('FASTIGHETSANALYS - EXPORT');
  rows.push(`Exportdatum,${new Date().toLocaleString('sv-SE')}`);
  rows.push(`Kommun,${kommunName}`);
  if (propertyName) {
    rows.push(`Fastighet,${propertyName}`);
  }
  if (coordinates) {
    rows.push(`Koordinater (Lon/Lat),"${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}"`);
  }
  rows.push(`Antal områden,${metrics.area_count}`);
  rows.push(`DeSO-koder,"${desoCodes.join(', ')}"`);
  rows.push('');

  // INKOMST
  rows.push('INKOMST');
  rows.push('Metric,Område,Kommun,Riket');
  rows.push(`Medianinkomst (kr),${metrics.metrics.income.median_income},${metrics.metrics.income.kommun_median},${metrics.metrics.income.riket_median}`);
  rows.push(`Medelinkomst (kr),${metrics.metrics.income.mean_income},,`);
  rows.push(`Percentil 20 (kr),${metrics.metrics.income.percentile_20},,`);
  rows.push(`Percentil 80 (kr),${metrics.metrics.income.percentile_80},,`);
  rows.push('');

  // BEFOLKNING
  rows.push('BEFOLKNING');
  rows.push('Metric,Område,Kommun');
  rows.push(`Total befolkning,${metrics.metrics.population.total},${metrics.metrics.population.kommun_avg?.total || 'N/A'}`);
  rows.push(`Tillväxttakt (%),"${(metrics.metrics.population.growth_rate || 0).toFixed(2)}%",`);
  rows.push('');

  // Åldersfördelning
  rows.push('ÅLDERSFÖRDELNING');
  rows.push('Åldersgrupp,Antal,Procent (%),Kommun Procent (%)');
  Object.entries(metrics.metrics.population.age_distribution || {}).forEach(([ageGroup, count]) => {
    const percentage = ((count as number) / metrics.metrics.population.total * 100).toFixed(1);
    const kommunCount = metrics.metrics.population.kommun_avg?.age_distribution?.[ageGroup as keyof typeof metrics.metrics.population.age_distribution] as number | undefined;
    const kommunTotal = metrics.metrics.population.kommun_avg?.total || 0;
    const kommunPercentage = kommunCount && kommunTotal > 0
      ? ((kommunCount / kommunTotal) * 100).toFixed(1)
      : 'N/A';
    rows.push(`${ageGroup} år,${count},${percentage},${kommunPercentage}`);
  });
  rows.push('');

  // UTBILDNING
  rows.push('UTBILDNING');
  rows.push('Nivå,Område (%),Kommun (%),Riket (%)');
  rows.push(`Förgymnasial,${metrics.metrics.education.forgymnasial.toFixed(1)},${metrics.metrics.education.kommun_avg?.forgymnasial || 'N/A'},${metrics.metrics.education.riket_avg?.forgymnasial || 'N/A'}`);
  rows.push(`Gymnasial,${metrics.metrics.education.gymnasial.toFixed(1)},${metrics.metrics.education.kommun_avg?.gymnasial || 'N/A'},${metrics.metrics.education.riket_avg?.gymnasial || 'N/A'}`);
  rows.push(`Eftergymnasial,${metrics.metrics.education.eftergymnasial.toFixed(1)},${metrics.metrics.education.kommun_avg?.eftergymnasial || 'N/A'},${metrics.metrics.education.riket_avg?.eftergymnasial || 'N/A'}`);
  rows.push('');

  // HÄRKOMST
  rows.push('HÄRKOMST');
  rows.push('Kategori,Antal,Procent (%),Kommun Procent (%)');
  const totalOrigin = metrics.metrics.origin.swedish_background + metrics.metrics.origin.foreign_background;
  const swedishPct = ((metrics.metrics.origin.swedish_background / totalOrigin) * 100).toFixed(1);
  const kommunSwedishPct = metrics.metrics.origin.kommun_avg
    ? (((metrics.metrics.origin.kommun_avg.swedish_background / (metrics.metrics.origin.kommun_avg.swedish_background + metrics.metrics.origin.kommun_avg.foreign_background)) * 100).toFixed(1))
    : 'N/A';
  rows.push(`Svensk bakgrund,${metrics.metrics.origin.swedish_background},${swedishPct},${kommunSwedishPct}`);
  rows.push(`Utländsk bakgrund,${metrics.metrics.origin.foreign_background},${metrics.metrics.origin.percentage_foreign.toFixed(1)},${metrics.metrics.origin.kommun_avg?.percentage_foreign.toFixed(1) || 'N/A'}`);
  rows.push('');

  // HUSHÅLLSSTORLEK
  rows.push('HUSHÅLLSSTORLEK');
  rows.push('Metric,Område,Kommun');
  rows.push(`Totalt antal hushåll,${metrics.metrics.household.total_households},${metrics.metrics.household.kommun_avg?.total_households || 'N/A'}`);
  rows.push(`Snitt storlek (personer/hushåll),${metrics.metrics.household.average_household_size.toFixed(2)},${metrics.metrics.household.kommun_avg?.average_household_size.toFixed(2) || 'N/A'}`);
  rows.push('');
  rows.push('Fördelning,Antal,Procent (%),Kommun Procent (%)');
  const singlePct = ((metrics.metrics.household.single_person / metrics.metrics.household.total_households) * 100).toFixed(1);
  const twoPct = ((metrics.metrics.household.two_person / metrics.metrics.household.total_households) * 100).toFixed(1);
  const threePlusPct = ((metrics.metrics.household.three_plus_person / metrics.metrics.household.total_households) * 100).toFixed(1);
  const kommunSinglePct = metrics.metrics.household.kommun_avg
    ? ((metrics.metrics.household.kommun_avg.single_person / metrics.metrics.household.kommun_avg.total_households) * 100).toFixed(1)
    : 'N/A';
  const kommunTwoPct = metrics.metrics.household.kommun_avg
    ? ((metrics.metrics.household.kommun_avg.two_person / metrics.metrics.household.kommun_avg.total_households) * 100).toFixed(1)
    : 'N/A';
  const kommunThreePlusPct = metrics.metrics.household.kommun_avg
    ? ((metrics.metrics.household.kommun_avg.three_plus_person / metrics.metrics.household.kommun_avg.total_households) * 100).toFixed(1)
    : 'N/A';
  rows.push(`1 person,${metrics.metrics.household.single_person},${singlePct},${kommunSinglePct}`);
  rows.push(`2 personer,${metrics.metrics.household.two_person},${twoPct},${kommunTwoPct}`);
  rows.push(`3+ personer,${metrics.metrics.household.three_plus_person},${threePlusPct},${kommunThreePlusPct}`);
  rows.push('');

  // HUSTYP
  rows.push('HUSTYP');
  rows.push('Typ,Antal personer,Procent (%),Kommun Procent (%)');
  rows.push(`Småhus,${metrics.metrics.housing_type.smahus},${metrics.metrics.housing_type.percentage_smahus.toFixed(1)},${metrics.metrics.housing_type.kommun_avg?.percentage_smahus.toFixed(1) || 'N/A'}`);
  const flerbostadshusPct = (100 - metrics.metrics.housing_type.percentage_smahus).toFixed(1);
  const kommunFlerbostadshusPct = metrics.metrics.housing_type.kommun_avg
    ? (100 - metrics.metrics.housing_type.kommun_avg.percentage_smahus).toFixed(1)
    : 'N/A';
  rows.push(`Flerbostadshus,${metrics.metrics.housing_type.flerbostadshus},${flerbostadshusPct},${kommunFlerbostadshusPct}`);
  rows.push('');

  // UPPLÅTELSEFORM
  rows.push('UPPLÅTELSEFORM');
  rows.push('Typ,Antal personer,Procent (%),Kommun Procent (%)');
  rows.push(`Äganderätt,${metrics.metrics.tenure_form.aganderatt},${metrics.metrics.tenure_form.percentage_aganderatt.toFixed(1)},${metrics.metrics.tenure_form.kommun_avg?.percentage_aganderatt.toFixed(1) || 'N/A'}`);
  rows.push(`Bostadsrätt,${metrics.metrics.tenure_form.bostadsratt},${metrics.metrics.tenure_form.percentage_bostadsratt.toFixed(1)},${metrics.metrics.tenure_form.kommun_avg?.percentage_bostadsratt.toFixed(1) || 'N/A'}`);
  rows.push(`Hyresrätt,${metrics.metrics.tenure_form.hyresratt},${metrics.metrics.tenure_form.percentage_hyresratt.toFixed(1)},${metrics.metrics.tenure_form.kommun_avg?.percentage_hyresratt.toFixed(1) || 'N/A'}`);
  rows.push('');

  // FLYTTMÖNSTER
  rows.push('FLYTTMÖNSTER');
  rows.push('Metric,Värde');
  rows.push(`Nettoinflyttning,${metrics.metrics.migration.netto}`);
  rows.push('');

  // EKONOMISK STANDARD
  if (metrics.metrics.economic_standard) {
    rows.push('EKONOMISK STANDARD');
    rows.push('Metric,Område,Kommun');
    rows.push(`Medianvärde (tkr),${metrics.metrics.economic_standard.median_value.toFixed(0)},${metrics.metrics.economic_standard.kommun_avg?.median_value.toFixed(0) || 'N/A'}`);
    rows.push(`Medelvärde (tkr),${metrics.metrics.economic_standard.mean_value.toFixed(0)},${metrics.metrics.economic_standard.kommun_avg?.mean_value.toFixed(0) || 'N/A'}`);
    rows.push(`Antal personer,${metrics.metrics.economic_standard.total_persons},${metrics.metrics.economic_standard.kommun_avg?.total_persons || 'N/A'}`);
    rows.push('');
    rows.push('Kvartil,Område (%),Kommun (%)');
    rows.push(`Kvartil 1,${metrics.metrics.economic_standard.quartile_1.toFixed(1)},${metrics.metrics.economic_standard.kommun_avg?.quartile_1.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 2,${metrics.metrics.economic_standard.quartile_2.toFixed(1)},${metrics.metrics.economic_standard.kommun_avg?.quartile_2.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 3,${metrics.metrics.economic_standard.quartile_3.toFixed(1)},${metrics.metrics.economic_standard.kommun_avg?.quartile_3.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 4,${metrics.metrics.economic_standard.quartile_4.toFixed(1)},${metrics.metrics.economic_standard.kommun_avg?.quartile_4.toFixed(1) || 'N/A'}`);
    rows.push('');
  }

  // FÖRVÄRVSINKOMST
  if (metrics.metrics.earned_income) {
    rows.push('FÖRVÄRVSINKOMST');
    rows.push('Metric,Område,Kommun');
    rows.push(`Medianvärde (tkr),${metrics.metrics.earned_income.median_value.toFixed(0)},${metrics.metrics.earned_income.kommun_avg?.median_value.toFixed(0) || 'N/A'}`);
    rows.push(`Medelvärde (tkr),${metrics.metrics.earned_income.mean_value.toFixed(0)},${metrics.metrics.earned_income.kommun_avg?.mean_value.toFixed(0) || 'N/A'}`);
    rows.push(`Antal personer,${metrics.metrics.earned_income.total_persons},${metrics.metrics.earned_income.kommun_avg?.total_persons || 'N/A'}`);
    rows.push('');
    rows.push('Kvartil,Område (%),Kommun (%)');
    rows.push(`Kvartil 1,${metrics.metrics.earned_income.quartile_1.toFixed(1)},${metrics.metrics.earned_income.kommun_avg?.quartile_1.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 2,${metrics.metrics.earned_income.quartile_2.toFixed(1)},${metrics.metrics.earned_income.kommun_avg?.quartile_2.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 3,${metrics.metrics.earned_income.quartile_3.toFixed(1)},${metrics.metrics.earned_income.kommun_avg?.quartile_3.toFixed(1) || 'N/A'}`);
    rows.push(`Kvartil 4,${metrics.metrics.earned_income.quartile_4.toFixed(1)},${metrics.metrics.earned_income.kommun_avg?.quartile_4.toFixed(1) || 'N/A'}`);
    rows.push('');
  }

  // BOSTADSFÖRSÄLJNINGAR (Booli data)
  if (booliData && booliData.summary) {
    rows.push('PRISANALYS (Booli)');
    rows.push('');

    // Summary statistics
    const avgNew = booliData.summary.averages?.find((a: any) => a.category === 'nyproduktion');
    const avgOld = booliData.summary.averages?.find((a: any) => a.category === 'succession');
    const salesNew = booliData.summary.sales?.find((s: any) => s.category === 'nyproduktion');
    const salesOld = booliData.summary.sales?.find((s: any) => s.category === 'succession');

    rows.push('GENOMSNITTSPRISER');
    rows.push('Kategori,Antal sålda,Medelpris (kr),Medel kr/m²,Tidigaste försäljning,Senaste försäljning');

    if (avgNew) {
      rows.push(`Nyproduktion,${salesNew?.count || 0},${Math.round(parseFloat(avgNew.avg_price))},${Math.round(parseFloat(avgNew.avg_price_per_sqm))},${avgNew.earliest_sale ? new Date(avgNew.earliest_sale).toLocaleDateString('sv-SE') : 'N/A'},${avgNew.latest_sale ? new Date(avgNew.latest_sale).toLocaleDateString('sv-SE') : 'N/A'}`);
    }

    if (avgOld) {
      rows.push(`Succession,${salesOld?.count || 0},${Math.round(parseFloat(avgOld.avg_price))},${Math.round(parseFloat(avgOld.avg_price_per_sqm))},${avgOld.earliest_sale ? new Date(avgOld.earliest_sale).toLocaleDateString('sv-SE') : 'N/A'},${avgOld.latest_sale ? new Date(avgOld.latest_sale).toLocaleDateString('sv-SE') : 'N/A'}`);
    }
    rows.push('');

    // Detailed sales data (top 50)
    if (booliData.sales && booliData.sales.length > 0) {
      rows.push('SENASTE FÖRSÄLJNINGAR (Max 50 st)');
      rows.push('Adress,Pris (kr),Kr/m²,Rum,Boarea (m²),Månadsavgift (kr),Såld datum,Kategori,BRF,Byggår,Våning');

      booliData.sales.slice(0, 50).forEach((sale: any) => {
        const address = (sale.address || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
        const price = sale.price ? Math.round(sale.price) : 'N/A';
        const pricePerSqm = sale.price_per_sqm ? Math.round(sale.price_per_sqm) : 'N/A';
        const rooms = sale.rooms || 'N/A';
        const area = sale.living_area || 'N/A';
        const monthlyFee = sale.monthly_fee ? Math.round(sale.monthly_fee) : 'N/A';
        const soldDate = sale.sold_date ? new Date(sale.sold_date).toLocaleDateString('sv-SE') : 'N/A';
        const category = sale.category === 'nyproduktion' ? 'Nyproduktion' : 'Succession';
        const brf = sale.brf || 'N/A';
        const buildYear = sale.build_year || 'N/A';
        const floor = sale.floor || 'N/A';

        rows.push(`"${address}",${price},${pricePerSqm},${rooms},${area},${monthlyFee},${soldDate},${category},${brf},${buildYear},${floor}`);
      });
      rows.push('');
    }
  }

  // Footer
  rows.push('---');
  rows.push('Genererat av Fastighetsanalysprogram');
  rows.push('Datakälla: SCB (Statistiska Centralbyrån)');

  // Create CSV content
  const csvContent = BOM + rows.join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Create filename with kommun name and date
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const kommunSlug = kommunName.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '_');
  const filename = `fastighet_${kommunSlug}_${dateStr}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports aggregated metrics as JSON for further analysis
 */
export function exportToJSON(
  metrics: AggregatedMetrics,
  desoCodes: string[],
  kommunName: string,
  booliData?: BooliData,
  propertyName?: string,
  coordinates?: [number, number]
): void {
  // Build comprehensive JSON structure
  const exportData = {
    metadata: {
      export_date: new Date().toISOString(),
      export_date_local: new Date().toLocaleString('sv-SE'),
      kommun: kommunName,
      property_name: propertyName || null,
      coordinates: coordinates ? {
        longitude: coordinates[0],
        latitude: coordinates[1]
      } : null,
      area_count: metrics.area_count,
      deso_codes: desoCodes
    },
    metrics: metrics.metrics,
    booli_data: booliData || null
  };

  // Convert to JSON with pretty printing
  const jsonContent = JSON.stringify(exportData, null, 2);

  // Create blob and download
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Create filename with kommun name and date
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const kommunSlug = kommunName.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '_');
  const filename = `fastighet_${kommunSlug}_${dateStr}.json`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
