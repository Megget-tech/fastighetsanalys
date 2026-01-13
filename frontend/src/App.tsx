import { useState, useEffect } from 'react';
import { useAnalysisStore } from './store/analysisStore';
import { findDeSoByPolygon, getAggregatedMetrics, getTimeSeries, healthCheck, getBooliSales, getBooliSummary, clearBooliData } from './services/api';
import { MapView } from './components/Map/MapView';
import { PropertySearch } from './components/PropertySearch';
import { BooliUpload } from './components/BooliUpload';
import { BooliAnalysis } from './components/BooliAnalysis';
import { exportToCSV, exportToJSON } from './utils/csvExport';

function App() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [booliData, setBooliData] = useState<any>(null);
  const {
    selectedPolygon,
    desoResult,
    selectedDesoCodes,
    propertyPoint,
    aggregatedMetrics,
    loading,
    error,
    selectedMetric,
    setDesoResult,
    setSelectedDesoCodes,
    setAggregatedMetrics,
    setTimeSeries,
    setLoading,
    setError
  } = useAnalysisStore();

  // Check backend health on mount
  useEffect(() => {
    healthCheck()
      .then(() => setHealthStatus('connected'))
      .catch(() => setHealthStatus('disconnected'));
  }, []);

  // Load Booli data on mount and refresh periodically
  useEffect(() => {
    const loadBooliData = async () => {
      try {
        const [salesData, summaryData] = await Promise.all([
          getBooliSales(),
          getBooliSummary()
        ]);

        if (salesData.data && summaryData.data) {
          setBooliData({
            sales: salesData.data,
            summary: summaryData.data
          });
        }
      } catch (err) {
        console.log('No Booli data available yet');
        setBooliData(null);
      }
    };

    loadBooliData();

    // Refresh Booli data every 30 seconds to catch new uploads
    const interval = setInterval(loadBooliData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle polygon selection - Find DeSO areas
  useEffect(() => {
    if (!selectedPolygon) return;

    const fetchDeSoAreas = async () => {
      try {
        setLoading(true);
        setError(null);

        // Find DeSO areas
        const result = await findDeSoByPolygon(selectedPolygon);
        setDesoResult(result);

        // Auto-select all matched DeSO areas
        setSelectedDesoCodes(result.deso_codes);

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching DeSO areas:', err);
        setError(err.response?.data?.message || 'Failed to fetch DeSO areas');
        setLoading(false);
      }
    };

    fetchDeSoAreas();
  }, [selectedPolygon]);

  // Fetch aggregated metrics when selected DeSO codes change
  useEffect(() => {
    if (selectedDesoCodes.length === 0) return;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get aggregated metrics for selected areas
        const aggregated = await getAggregatedMetrics(selectedDesoCodes);
        setAggregatedMetrics(aggregated);

        // Get time series for first selected area (for now)
        if (selectedDesoCodes.length > 0) {
          const timeSeriesData = await getTimeSeries(selectedDesoCodes[0], selectedMetric);
          setTimeSeries(timeSeriesData);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching metrics:', err);
        setError(err.response?.data?.message || 'Failed to fetch metrics');
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedDesoCodes, selectedMetric]);

  // Handle "New Analysis" - Clear everything and start fresh
  const handleNewAnalysis = async () => {
    if (!confirm('Vill du starta en ny analys? Detta rensar all prisdata och nuvarande områdesval.')) {
      return;
    }

    try {
      // Clear Booli data from backend
      await clearBooliData();

      // Clear frontend state
      setBooliData(null);
      setDesoResult(null);
      setSelectedDesoCodes([]);
      setAggregatedMetrics(null);
      setTimeSeries(null);
      setError(null);

      alert('Analysen har rensats. Rita ett nytt område på kartan för att börja.');
    } catch (err: any) {
      console.error('Error clearing analysis:', err);
      alert('Kunde inte rensa analysen: ' + (err.message || 'Okänt fel'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Fastighetsanalys
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Backend:</span>
              <span className={`text-sm font-medium ${
                healthStatus === 'connected' ? 'text-green-600' :
                healthStatus === 'disconnected' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {healthStatus}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Print Header - only visible when printing */}
        <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Fastighetsanalys</h1>
          <p className="text-lg text-gray-700 mt-2">
            {desoResult?.kommun_name && `Kommun: ${desoResult.kommun_name}`}
          </p>
          <p className="text-sm text-gray-600">
            Exportdatum: {new Date().toLocaleDateString('sv-SE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {selectedDesoCodes.length > 0 && (
            <p className="text-sm text-gray-600">
              Antal områden: {selectedDesoCodes.length} ({selectedDesoCodes.join(', ')})
            </p>
          )}
        </div>

        {/* Booli Upload - hidden when printing */}
        <div className="print:hidden">
          <BooliUpload />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map Panel */}
          <div className="space-y-4">
            {/* Property Search */}
            <PropertySearch />

            {/* Map */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Kartvy</h2>
              <MapView />
            </div>
          </div>

          {/* Data Panel */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Analys</h2>

            {loading && (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Hämtar data...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Ett fel uppstod</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && !desoResult && (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-lg font-medium">Välj ett område</p>
                  <p className="text-sm mt-2">Rita en polygon på kartan för att börja</p>
                </div>
              </div>
            )}

            {!loading && !error && desoResult && aggregatedMetrics && (
              <div className="space-y-6">
                {/* Area Info & Checklist */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-blue-900">Valda områden</h3>
                    <span className="text-sm text-blue-700">
                      {selectedDesoCodes.length} av {desoResult.deso_codes.length}
                    </span>
                  </div>

                  {aggregatedMetrics.area_count > 1 && (
                    <p className="text-xs text-blue-700 mb-2">
                      📊 Aggregerad data för {aggregatedMetrics.area_count} områden (viktad efter population)
                    </p>
                  )}

                  <p className="text-sm text-blue-700 mb-3">{desoResult.kommun_name}</p>

                  {/* DeSO Checklist */}
                  <div className="max-h-48 overflow-y-auto bg-white rounded border border-blue-200 p-2">
                    <div className="space-y-1">
                      {desoResult.deso_codes.map((code, idx) => (
                        <label key={code} className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDesoCodes.includes(code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDesoCodes([...selectedDesoCodes, code]);
                              } else {
                                setSelectedDesoCodes(selectedDesoCodes.filter(c => c !== code));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-700">
                            {desoResult.deso_names[idx] || code}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {desoResult.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-blue-600">
                      {desoResult.warnings.map((w, i) => (
                        <p key={i}>⚠️ {w}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Metrics */}
                <div>
                  <h3 className="font-semibold mb-3">Nyckeltal</h3>
                  <div className="space-y-3">
                    {/* Income */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">
                        Medianinkomst {aggregatedMetrics.metrics.income.year && <span className="text-gray-400">({aggregatedMetrics.metrics.income.year})</span>}
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {aggregatedMetrics.metrics.income.median_income.toLocaleString('sv-SE')} kr
                      </p>
                      <div className="mt-2 flex gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">Kommun: </span>
                          <span className={aggregatedMetrics.metrics.income.median_income > aggregatedMetrics.metrics.income.kommun_median ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {aggregatedMetrics.metrics.income.kommun_median.toLocaleString('sv-SE')} kr
                            {aggregatedMetrics.metrics.income.median_income > aggregatedMetrics.metrics.income.kommun_median ? ' ↑' : ' ↓'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Riket: </span>
                          <span className={aggregatedMetrics.metrics.income.median_income > aggregatedMetrics.metrics.income.riket_median ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {aggregatedMetrics.metrics.income.riket_median.toLocaleString('sv-SE')} kr
                            {aggregatedMetrics.metrics.income.median_income > aggregatedMetrics.metrics.income.riket_median ? ' ↑' : ' ↓'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Education */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">
                        Eftergymnasial utbildning {aggregatedMetrics.metrics.education.year && <span className="text-gray-400">({aggregatedMetrics.metrics.education.year})</span>}
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {aggregatedMetrics.metrics.education.eftergymnasial.toFixed(1)}%
                      </p>
                      <div className="mt-2 flex gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">Kommun: </span>
                          <span className={aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.kommun_avg.eftergymnasial ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {aggregatedMetrics.metrics.education.kommun_avg.eftergymnasial.toFixed(1)}%
                            {aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.kommun_avg.eftergymnasial ? ' ↑' : ' ↓'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Riket: </span>
                          <span className={aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.riket_avg.eftergymnasial ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {aggregatedMetrics.metrics.education.riket_avg.eftergymnasial.toFixed(1)}%
                            {aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.riket_avg.eftergymnasial ? ' ↑' : ' ↓'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Population */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600">
                        Befolkning (totalt) {aggregatedMetrics.metrics.population.year && <span className="text-gray-400">({aggregatedMetrics.metrics.population.year})</span>}
                      </p>
                      <p className="text-lg font-semibold">
                        {aggregatedMetrics.metrics.population.total.toLocaleString('sv-SE')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Snitt tillväxt: {aggregatedMetrics.metrics.population.growth_rate > 0 ? '+' : ''}{aggregatedMetrics.metrics.population.growth_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Education Breakdown (Utbildningsnivå) */}
                {aggregatedMetrics.metrics.education && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Utbildningsnivå {aggregatedMetrics.metrics.education.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.education.year})</span>}
                    </h3>
                    <div className="space-y-2">
                      {[
                        {
                          label: 'Förgymnasial',
                          percentage: aggregatedMetrics.metrics.education.forgymnasial,
                          color: 'bg-red-600',
                          description: 'Grundskola eller lägre'
                        },
                        {
                          label: 'Gymnasial',
                          percentage: aggregatedMetrics.metrics.education.gymnasial,
                          color: 'bg-yellow-600',
                          description: 'Gymnasium'
                        },
                        {
                          label: 'Eftergymnasial',
                          percentage: aggregatedMetrics.metrics.education.eftergymnasial,
                          color: 'bg-green-600',
                          description: 'Högskola/Universitet'
                        }
                      ].map(({ label, percentage, color, description }) => {
                        // Calculate absolute count from percentage
                        const count = Math.round((percentage / 100) * aggregatedMetrics.metrics.population.total);

                        return (
                          <div key={label} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <div>
                                <span className="text-gray-700 font-medium">{label}</span>
                                <span className="text-gray-500 text-xs ml-2">({description})</span>
                              </div>
                              <span className="font-medium text-gray-900">
                                {count.toLocaleString('sv-SE')} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`${color} h-2 rounded-full transition-all`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Comparison with kommun/riket */}
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Jämförelse eftergymnasial utbildning:</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-gray-600">Område</p>
                          <p className="font-semibold text-gray-900">
                            {aggregatedMetrics.metrics.education.eftergymnasial.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Kommun</p>
                          <p className={`font-semibold ${
                            aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.kommun_avg.eftergymnasial
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {aggregatedMetrics.metrics.education.kommun_avg.eftergymnasial.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Riket</p>
                          <p className={`font-semibold ${
                            aggregatedMetrics.metrics.education.eftergymnasial > aggregatedMetrics.metrics.education.riket_avg.eftergymnasial
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {aggregatedMetrics.metrics.education.riket_avg.eftergymnasial.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Booli Stats - Only for single area (not available in aggregated data) */}
                {aggregatedMetrics.area_count === 1 && aggregatedMetrics.metrics.booli && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Bostadsförsäljningar (senaste 2 åren)</h3>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Mock data</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Totalt antal:</span>
                        <span className="font-medium">{aggregatedMetrics.metrics.booli.total_sales} st</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Snittpris:</span>
                        <span className="font-medium">
                          {aggregatedMetrics.metrics.booli.avg_price.toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Nyproduktion:</span>
                        <span className="font-medium">
                          {aggregatedMetrics.metrics.booli.new_production.count} st ({
                            ((aggregatedMetrics.metrics.booli.new_production.count / aggregatedMetrics.metrics.booli.total_sales) * 100).toFixed(0)
                          }%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Age Distribution */}
                {aggregatedMetrics.metrics.population.age_distribution && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Åldersfördelning {aggregatedMetrics.metrics.population.age_year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.population.age_year})</span>}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(aggregatedMetrics.metrics.population.age_distribution).map(([ageGroup, count]) => {
                        const total = aggregatedMetrics.metrics.population.total;
                        const countNumber = count as number;
                        const percentage = (countNumber / total) * 100;

                        // Get kommun percentage for this age group
                        const kommunAgeDistribution = aggregatedMetrics.metrics.population.kommun_avg?.age_distribution;
                        const kommunTotal = aggregatedMetrics.metrics.population.kommun_avg?.total || 0;
                        const kommunCount = kommunAgeDistribution?.[ageGroup] as number | undefined;
                        const kommunPercentage = kommunCount && kommunTotal > 0 ? (kommunCount / kommunTotal) * 100 : null;

                        return (
                          <div key={ageGroup} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">{ageGroup} år</span>
                              <div className="flex gap-3">
                                <span className="font-medium text-gray-900">
                                  {countNumber.toLocaleString('sv-SE')} ({percentage.toFixed(1)}%)
                                </span>
                                {kommunPercentage !== null && (
                                  <span className="text-gray-600 text-xs">
                                    Kommun: {kommunPercentage.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {/* Area bar */}
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              {/* Kommun bar */}
                              {kommunPercentage !== null && (
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-blue-300 h-2 rounded-full transition-all"
                                    style={{ width: `${kommunPercentage}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Historical Population (Befolkningsutveckling) */}
                {aggregatedMetrics.metrics.population.historical_population && aggregatedMetrics.metrics.population.historical_population.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Befolkningsutveckling
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      {(() => {
                        const startData = aggregatedMetrics.metrics.population.historical_population[0];
                        const endData = aggregatedMetrics.metrics.population.historical_population[aggregatedMetrics.metrics.population.historical_population.length - 1];
                        const change = endData.population - startData.population;
                        const changePercent = (change / startData.population) * 100;

                        return (
                          <>
                            {/* Start year */}
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm text-gray-600 mb-1">Startår</div>
                              <div className="text-2xl font-bold text-gray-900">{startData.year}</div>
                              <div className="text-lg text-gray-700 mt-2">
                                {startData.population.toLocaleString('sv-SE')}
                              </div>
                              <div className="text-xs text-gray-500">personer</div>
                            </div>

                            {/* End year */}
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="text-sm text-gray-600 mb-1">Slutår</div>
                              <div className="text-2xl font-bold text-gray-900">{endData.year}</div>
                              <div className="text-lg text-gray-700 mt-2">
                                {endData.population.toLocaleString('sv-SE')}
                              </div>
                              <div className="text-xs text-gray-500">personer</div>
                            </div>

                            {/* Change */}
                            <div className={`rounded-lg p-4 ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <div className="text-sm text-gray-600 mb-1">Förändring</div>
                              <div className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                              </div>
                              <div className={`text-lg mt-2 ${change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {change >= 0 ? '+' : ''}{change.toLocaleString('sv-SE')}
                              </div>
                              <div className="text-xs text-gray-500">personer</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Age Distribution Comparison (2019 vs 2023) */}
                {aggregatedMetrics.metrics.population.age_distribution_comparison && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Åldersfördelning: {aggregatedMetrics.metrics.population.age_distribution_comparison.start_year} vs{' '}
                      {aggregatedMetrics.metrics.population.age_distribution_comparison.end_year}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(aggregatedMetrics.metrics.population.age_distribution_comparison.end_distribution).map(([ageGroup]) => {
                        const countStart = aggregatedMetrics.metrics.population.age_distribution_comparison!.start_distribution[ageGroup as keyof typeof aggregatedMetrics.metrics.population.age_distribution_comparison.start_distribution];
                        const countEnd = aggregatedMetrics.metrics.population.age_distribution_comparison!.end_distribution[ageGroup as keyof typeof aggregatedMetrics.metrics.population.age_distribution_comparison.end_distribution];

                        const totalStart = (Object.values(aggregatedMetrics.metrics.population.age_distribution_comparison!.start_distribution) as number[]).reduce((sum, val) => sum + val, 0);
                        const totalEnd = (Object.values(aggregatedMetrics.metrics.population.age_distribution_comparison!.end_distribution) as number[]).reduce((sum, val) => sum + val, 0);

                        const percentageStart = (countStart as number / totalStart) * 100;
                        const percentageEnd = (countEnd as number / totalEnd) * 100;
                        const change = countEnd - countStart;
                        const percentageChange = percentageEnd - percentageStart;

                        const startYear = aggregatedMetrics.metrics.population.age_distribution_comparison!.start_year;
                        const endYear = aggregatedMetrics.metrics.population.age_distribution_comparison!.end_year;

                        return (
                          <div key={ageGroup} className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-700 w-20">{ageGroup} år</span>
                              <div className="flex-1 flex gap-2">
                                {/* Start year label */}
                                <div className="flex-1">
                                  <span className="text-gray-600 text-xs">
                                    {startYear}: {countStart.toLocaleString('sv-SE')} ({percentageStart.toFixed(1)}%)
                                  </span>
                                </div>
                                {/* End year label */}
                                <div className="flex-1">
                                  <span className="font-medium text-gray-900 text-xs">
                                    {endYear}: {countEnd.toLocaleString('sv-SE')} ({percentageEnd.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              {/* Change indicator */}
                              <span className={`text-xs w-24 text-right ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {change >= 0 ? '+' : ''}{change.toLocaleString('sv-SE')}
                                {' '}({percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}pp)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20"></div> {/* Spacer to align with age group label */}
                              <div className="flex-1 flex gap-2">
                                {/* Start year bar */}
                                <div className="flex-1">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-gray-500 h-2 rounded-full transition-all"
                                      style={{ width: `${percentageStart}%` }}
                                    />
                                  </div>
                                </div>
                                {/* End year bar */}
                                <div className="flex-1">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full transition-all"
                                      style={{ width: `${percentageEnd}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="w-24"></div> {/* Spacer to align with change indicator */}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Origin (Härkomst) */}
                {aggregatedMetrics.metrics.origin && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Härkomst {aggregatedMetrics.metrics.origin.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.origin.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Total overview */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-700 font-medium mb-1">Svensk bakgrund</p>
                          <p className="text-lg font-semibold text-green-900">
                            {aggregatedMetrics.metrics.origin.swedish_background.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            {((aggregatedMetrics.metrics.origin.swedish_background / (aggregatedMetrics.metrics.origin.swedish_background + aggregatedMetrics.metrics.origin.foreign_background)) * 100).toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.origin.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-green-200 pt-2">
                              <span className="text-green-700">Kommun: </span>
                              <span className="font-medium text-green-800">
                                {((aggregatedMetrics.metrics.origin.kommun_avg.swedish_background / (aggregatedMetrics.metrics.origin.kommun_avg.swedish_background + aggregatedMetrics.metrics.origin.kommun_avg.foreign_background)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-purple-700 font-medium mb-1">Utländsk bakgrund</p>
                          <p className="text-lg font-semibold text-purple-900">
                            {aggregatedMetrics.metrics.origin.foreign_background.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            {aggregatedMetrics.metrics.origin.percentage_foreign.toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.origin.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-purple-200 pt-2">
                              <span className="text-purple-700">Kommun: </span>
                              <span className="font-medium text-purple-800">
                                {aggregatedMetrics.metrics.origin.kommun_avg.percentage_foreign.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Svensk</span>
                          <span>Utländsk</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{ width: `${100 - aggregatedMetrics.metrics.origin.percentage_foreign}%` }}
                          />
                          <div
                            className="bg-purple-500 h-full transition-all"
                            style={{ width: `${aggregatedMetrics.metrics.origin.percentage_foreign}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Household Size (Hushållsstorlek) */}
                {aggregatedMetrics.metrics.household && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Hushållsstorlek {aggregatedMetrics.metrics.household.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.household.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Total households */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Totalt antal hushåll</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {aggregatedMetrics.metrics.household.total_households.toLocaleString('sv-SE')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Snitt storlek: {aggregatedMetrics.metrics.household.average_household_size.toFixed(2)} personer/hushåll
                        </p>
                        {aggregatedMetrics.metrics.household.kommun_avg && (
                          <div className="mt-2 text-xs border-t border-gray-300 pt-2">
                            <span className="text-gray-600">Kommun snitt: </span>
                            <span className={aggregatedMetrics.metrics.household.average_household_size > aggregatedMetrics.metrics.household.kommun_avg.average_household_size ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {aggregatedMetrics.metrics.household.kommun_avg.average_household_size.toFixed(2)} personer/hushåll
                              {aggregatedMetrics.metrics.household.average_household_size > aggregatedMetrics.metrics.household.kommun_avg.average_household_size ? ' ↑' : ' ↓'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Breakdown by household type */}
                      <div className="space-y-2">
                        {[
                          { label: 'Ensamstående', count: aggregatedMetrics.metrics.household.ensamstaende_utan_barn, kommunKey: 'ensamstaende_utan_barn', color: 'bg-blue-600', lightColor: 'bg-blue-300' },
                          { label: 'Ensamstående med barn', count: aggregatedMetrics.metrics.household.ensamstaende_med_barn, kommunKey: 'ensamstaende_med_barn', color: 'bg-cyan-600', lightColor: 'bg-cyan-300' },
                          { label: 'Par', count: aggregatedMetrics.metrics.household.par_utan_barn, kommunKey: 'par_utan_barn', color: 'bg-indigo-600', lightColor: 'bg-indigo-300' },
                          { label: 'Familjer', count: aggregatedMetrics.metrics.household.familjer, kommunKey: 'familjer', color: 'bg-purple-600', lightColor: 'bg-purple-300' },
                          { label: 'Övriga', count: aggregatedMetrics.metrics.household.ovriga, kommunKey: 'ovriga', color: 'bg-gray-600', lightColor: 'bg-gray-300' }
                        ].map(({ label, count, kommunKey, color, lightColor }) => {
                          const percentage = ((count as number) / aggregatedMetrics.metrics.household.total_households) * 100;

                          // Get kommun percentage
                          const kommunAvg = aggregatedMetrics.metrics.household.kommun_avg;
                          const kommunCount = kommunAvg?.[kommunKey as keyof typeof kommunAvg] as number | undefined;
                          const kommunTotal = kommunAvg?.total_households || 0;
                          const kommunPercentage = kommunCount && kommunTotal > 0 ? (kommunCount / kommunTotal) * 100 : null;

                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">{label}</span>
                                <div className="flex gap-3">
                                  <span className="font-medium text-gray-900">
                                    {count.toLocaleString('sv-SE')} ({percentage.toFixed(1)}%)
                                  </span>
                                  {kommunPercentage !== null && (
                                    <span className="text-gray-600 text-xs">
                                      Kommun: {kommunPercentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                {/* Area bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`${color} h-2 rounded-full transition-all`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                {/* Kommun bar */}
                                {kommunPercentage !== null && (
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`${lightColor} h-2 rounded-full transition-all`}
                                      style={{ width: `${kommunPercentage}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Housing Type (Hustyp) */}
                {aggregatedMetrics.metrics.housing_type && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Hustyp {aggregatedMetrics.metrics.housing_type.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.housing_type.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Grid overview */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-amber-700 font-medium mb-1">Småhus</p>
                          <p className="text-lg font-semibold text-amber-900">
                            {aggregatedMetrics.metrics.housing_type.smahus.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            {aggregatedMetrics.metrics.housing_type.percentage_smahus.toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.housing_type.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-amber-200 pt-2">
                              <span className="text-amber-700">Kommun: </span>
                              <span className="font-medium text-amber-800">
                                {aggregatedMetrics.metrics.housing_type.kommun_avg.percentage_smahus.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-slate-700 font-medium mb-1">Flerbostadshus</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {aggregatedMetrics.metrics.housing_type.flerbostadshus.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            {(100 - aggregatedMetrics.metrics.housing_type.percentage_smahus).toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.housing_type.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-slate-200 pt-2">
                              <span className="text-slate-700">Kommun: </span>
                              <span className="font-medium text-slate-800">
                                {(100 - aggregatedMetrics.metrics.housing_type.kommun_avg.percentage_smahus).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Småhus (Villa, Radhus)</span>
                          <span>Flerbostadshus (Lägenheter)</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
                          <div
                            className="bg-amber-500 h-full transition-all"
                            style={{ width: `${aggregatedMetrics.metrics.housing_type.percentage_smahus}%` }}
                          />
                          <div
                            className="bg-slate-500 h-full transition-all"
                            style={{ width: `${100 - aggregatedMetrics.metrics.housing_type.percentage_smahus}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tenure Form (Upplåtelseform) */}
                {aggregatedMetrics.metrics.tenure_form && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Upplåtelseform {aggregatedMetrics.metrics.tenure_form.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.tenure_form.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Grid overview */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-teal-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-teal-700 font-medium mb-1">Äganderätt</p>
                          <p className="text-base font-semibold text-teal-900">
                            {aggregatedMetrics.metrics.tenure_form.aganderatt.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-teal-600 mt-1">
                            {aggregatedMetrics.metrics.tenure_form.percentage_aganderatt.toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.tenure_form.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-teal-200 pt-2">
                              <span className="text-teal-700">Kommun: </span>
                              <span className="font-medium text-teal-800">
                                {aggregatedMetrics.metrics.tenure_form.kommun_avg.percentage_aganderatt.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-cyan-700 font-medium mb-1">Bostadsrätt</p>
                          <p className="text-base font-semibold text-cyan-900">
                            {aggregatedMetrics.metrics.tenure_form.bostadsratt.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-cyan-600 mt-1">
                            {aggregatedMetrics.metrics.tenure_form.percentage_bostadsratt.toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.tenure_form.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-cyan-200 pt-2">
                              <span className="text-cyan-700">Kommun: </span>
                              <span className="font-medium text-cyan-800">
                                {aggregatedMetrics.metrics.tenure_form.kommun_avg.percentage_bostadsratt.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-sky-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-sky-700 font-medium mb-1">Hyresrätt</p>
                          <p className="text-base font-semibold text-sky-900">
                            {aggregatedMetrics.metrics.tenure_form.hyresratt.toLocaleString('sv-SE')}
                          </p>
                          <p className="text-xs text-sky-600 mt-1">
                            {aggregatedMetrics.metrics.tenure_form.percentage_hyresratt.toFixed(1)}%
                          </p>
                          {aggregatedMetrics.metrics.tenure_form.kommun_avg && (
                            <div className="mt-2 text-xs border-t border-sky-200 pt-2">
                              <span className="text-sky-700">Kommun: </span>
                              <span className="font-medium text-sky-800">
                                {aggregatedMetrics.metrics.tenure_form.kommun_avg.percentage_hyresratt.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Breakdown bars */}
                      <div className="space-y-2">
                        {[
                          { label: 'Äganderätt', count: aggregatedMetrics.metrics.tenure_form.aganderatt, percentage: aggregatedMetrics.metrics.tenure_form.percentage_aganderatt, kommunKey: 'percentage_aganderatt', color: 'bg-teal-600', lightColor: 'bg-teal-300' },
                          { label: 'Bostadsrätt', count: aggregatedMetrics.metrics.tenure_form.bostadsratt, percentage: aggregatedMetrics.metrics.tenure_form.percentage_bostadsratt, kommunKey: 'percentage_bostadsratt', color: 'bg-cyan-600', lightColor: 'bg-cyan-300' },
                          { label: 'Hyresrätt', count: aggregatedMetrics.metrics.tenure_form.hyresratt, percentage: aggregatedMetrics.metrics.tenure_form.percentage_hyresratt, kommunKey: 'percentage_hyresratt', color: 'bg-sky-600', lightColor: 'bg-sky-300' }
                        ].map(({ label, count, percentage, kommunKey, color, lightColor }) => {
                          // Get kommun percentage
                          const kommunAvg = aggregatedMetrics.metrics.tenure_form.kommun_avg;
                          const kommunPercentage = kommunAvg?.[kommunKey as keyof typeof kommunAvg] as number | undefined;

                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">{label}</span>
                                <div className="flex gap-3">
                                  <span className="font-medium text-gray-900">
                                    {count.toLocaleString('sv-SE')} ({percentage.toFixed(1)}%)
                                  </span>
                                  {kommunPercentage !== undefined && (
                                    <span className="text-gray-600 text-xs">
                                      Kommun: {kommunPercentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                {/* Area bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`${color} h-2 rounded-full transition-all`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                {/* Kommun bar */}
                                {kommunPercentage !== undefined && (
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`${lightColor} h-2 rounded-full transition-all`}
                                      style={{ width: `${kommunPercentage}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Economic Standard (Ekonomisk standard) */}
                {aggregatedMetrics.metrics.economic_standard && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Ekonomisk standard {aggregatedMetrics.metrics.economic_standard.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.economic_standard.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Median and Mean values */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 rounded-lg p-3">
                          <p className="text-xs text-emerald-700 font-medium mb-1">Medianvärde</p>
                          <p className="text-lg font-semibold text-emerald-900">
                            {aggregatedMetrics.metrics.economic_standard.median_value.toFixed(0)} tkr
                          </p>
                          {aggregatedMetrics.metrics.economic_standard.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className={aggregatedMetrics.metrics.economic_standard.median_value > aggregatedMetrics.metrics.economic_standard.kommun_avg.median_value ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {aggregatedMetrics.metrics.economic_standard.kommun_avg.median_value.toFixed(0)} tkr
                                {aggregatedMetrics.metrics.economic_standard.median_value > aggregatedMetrics.metrics.economic_standard.kommun_avg.median_value ? ' ↑' : ' ↓'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3">
                          <p className="text-xs text-teal-700 font-medium mb-1">Medelvärde</p>
                          <p className="text-lg font-semibold text-teal-900">
                            {aggregatedMetrics.metrics.economic_standard.mean_value.toFixed(0)} tkr
                          </p>
                          {aggregatedMetrics.metrics.economic_standard.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className={aggregatedMetrics.metrics.economic_standard.mean_value > aggregatedMetrics.metrics.economic_standard.kommun_avg.mean_value ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {aggregatedMetrics.metrics.economic_standard.kommun_avg.mean_value.toFixed(0)} tkr
                                {aggregatedMetrics.metrics.economic_standard.mean_value > aggregatedMetrics.metrics.economic_standard.kommun_avg.mean_value ? ' ↑' : ' ↓'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5-year change */}
                      {aggregatedMetrics.metrics.economic_standard.change_5y_percent !== undefined && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              aggregatedMetrics.metrics.economic_standard.change_5y_percent >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {aggregatedMetrics.metrics.economic_standard.change_5y_percent >= 0 ? '🟢' : '🔴'}
                              {aggregatedMetrics.metrics.economic_standard.change_5y_percent >= 0 ? '+' : ''}
                              {aggregatedMetrics.metrics.economic_standard.change_5y_percent.toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-600">förändring 2019-2023</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Utveckling av disponibel inkomst per konsumtionsenhet under de senaste 5 åren
                          </p>
                        </div>
                      )}

                      {/* Quartile distribution */}
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 font-medium">Fördelning över kvartiler:</p>
                        {[
                          { label: 'Kvartil 1 (lägst)', key: 'quartile_1', color: 'bg-red-500', lightColor: 'bg-red-200' },
                          { label: 'Kvartil 2', key: 'quartile_2', color: 'bg-yellow-500', lightColor: 'bg-yellow-200' },
                          { label: 'Kvartil 3', key: 'quartile_3', color: 'bg-lime-500', lightColor: 'bg-lime-200' },
                          { label: 'Kvartil 4 (högst)', key: 'quartile_4', color: 'bg-green-600', lightColor: 'bg-green-200' }
                        ].map(({ label, key, color, lightColor }) => {
                          const areaValue = aggregatedMetrics.metrics.economic_standard[key];
                          const kommunValue = aggregatedMetrics.metrics.economic_standard.kommun_avg?.[key];

                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">{label}</span>
                                <div className="flex gap-3">
                                  <span className="font-medium text-gray-900">
                                    Område: {areaValue.toFixed(1)}%
                                  </span>
                                  {kommunValue !== undefined && (
                                    <span className="text-gray-600">
                                      Kommun: {kommunValue.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                {/* Area bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`${color} h-2 rounded-full transition-all`}
                                    style={{ width: `${areaValue}%` }}
                                  />
                                </div>
                                {/* Kommun bar */}
                                {kommunValue !== undefined && (
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`${lightColor} h-2 rounded-full transition-all`}
                                      style={{ width: `${kommunValue}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">
                          Baserat på {aggregatedMetrics.metrics.economic_standard.total_persons.toLocaleString('sv-SE')} personer
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Earned Income (Förvärvsinkomst) */}
                {aggregatedMetrics.metrics.earned_income && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Förvärvsinkomst {aggregatedMetrics.metrics.earned_income.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.earned_income.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Median and Mean values */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-violet-50 rounded-lg p-3">
                          <p className="text-xs text-violet-700 font-medium mb-1">Medianvärde</p>
                          <p className="text-lg font-semibold text-violet-900">
                            {aggregatedMetrics.metrics.earned_income.median_value.toFixed(0)} tkr
                          </p>
                          {aggregatedMetrics.metrics.earned_income.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className={aggregatedMetrics.metrics.earned_income.median_value > aggregatedMetrics.metrics.earned_income.kommun_avg.median_value ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {aggregatedMetrics.metrics.earned_income.kommun_avg.median_value.toFixed(0)} tkr
                                {aggregatedMetrics.metrics.earned_income.median_value > aggregatedMetrics.metrics.earned_income.kommun_avg.median_value ? ' ↑' : ' ↓'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs text-purple-700 font-medium mb-1">Medelvärde</p>
                          <p className="text-lg font-semibold text-purple-900">
                            {aggregatedMetrics.metrics.earned_income.mean_value.toFixed(0)} tkr
                          </p>
                          {aggregatedMetrics.metrics.earned_income.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className={aggregatedMetrics.metrics.earned_income.mean_value > aggregatedMetrics.metrics.earned_income.kommun_avg.mean_value ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {aggregatedMetrics.metrics.earned_income.kommun_avg.mean_value.toFixed(0)} tkr
                                {aggregatedMetrics.metrics.earned_income.mean_value > aggregatedMetrics.metrics.earned_income.kommun_avg.mean_value ? ' ↑' : ' ↓'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5-year change */}
                      {aggregatedMetrics.metrics.earned_income.change_5y_percent !== undefined && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              aggregatedMetrics.metrics.earned_income.change_5y_percent >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {aggregatedMetrics.metrics.earned_income.change_5y_percent >= 0 ? '🟢' : '🔴'}
                              {aggregatedMetrics.metrics.earned_income.change_5y_percent >= 0 ? '+' : ''}
                              {aggregatedMetrics.metrics.earned_income.change_5y_percent.toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-600">förändring 2019-2023</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Utveckling av förvärvsinkomst (lön, företagsvinst) under de senaste 5 åren
                          </p>
                        </div>
                      )}

                      {/* Quartile distribution */}
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 font-medium">Fördelning över kvartiler:</p>
                        {[
                          { label: 'Kvartil 1 (lägst)', key: 'quartile_1', color: 'bg-red-500', lightColor: 'bg-red-200' },
                          { label: 'Kvartil 2', key: 'quartile_2', color: 'bg-yellow-500', lightColor: 'bg-yellow-200' },
                          { label: 'Kvartil 3', key: 'quartile_3', color: 'bg-lime-500', lightColor: 'bg-lime-200' },
                          { label: 'Kvartil 4 (högst)', key: 'quartile_4', color: 'bg-green-600', lightColor: 'bg-green-200' }
                        ].map(({ label, key, color, lightColor }) => {
                          const areaValue = aggregatedMetrics.metrics.earned_income[key];
                          const kommunValue = aggregatedMetrics.metrics.earned_income.kommun_avg?.[key];

                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">{label}</span>
                                <div className="flex gap-3">
                                  <span className="font-medium text-gray-900">
                                    Område: {areaValue.toFixed(1)}%
                                  </span>
                                  {kommunValue !== undefined && (
                                    <span className="text-gray-600">
                                      Kommun: {kommunValue.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                {/* Area bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`${color} h-2 rounded-full transition-all`}
                                    style={{ width: `${areaValue}%` }}
                                  />
                                </div>
                                {/* Kommun bar */}
                                {kommunValue !== undefined && (
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`${lightColor} h-2 rounded-full transition-all`}
                                      style={{ width: `${kommunValue}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">
                          Sammanräknad förvärvsinkomst för {aggregatedMetrics.metrics.earned_income.total_persons.toLocaleString('sv-SE')} personer
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vehicles (Fordon) */}
                {aggregatedMetrics.metrics.vehicles && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Fordon {aggregatedMetrics.metrics.vehicles.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.vehicles.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Overview cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-700 font-medium mb-1">Totalt antal bilar</p>
                          <p className="text-lg font-semibold text-blue-900">
                            {aggregatedMetrics.metrics.vehicles.total_vehicles.toLocaleString('sv-SE')}
                          </p>
                          {aggregatedMetrics.metrics.vehicles.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className="text-gray-700">
                                {aggregatedMetrics.metrics.vehicles.kommun_avg.total_vehicles.toLocaleString('sv-SE')}
                              </span>
                            </div>
                          )}
                        </div>

                        {aggregatedMetrics.metrics.vehicles.vehicles_per_household && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-700 font-medium mb-1">Bilar per hushåll</p>
                            <p className="text-lg font-semibold text-green-900">
                              {aggregatedMetrics.metrics.vehicles.vehicles_per_household.toFixed(2)}
                            </p>
                            {aggregatedMetrics.metrics.vehicles.kommun_avg?.vehicles_per_household && (
                              <div className="mt-2 text-xs">
                                <span className="text-gray-600">Kommun: </span>
                                <span className={aggregatedMetrics.metrics.vehicles.vehicles_per_household > aggregatedMetrics.metrics.vehicles.kommun_avg.vehicles_per_household ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {aggregatedMetrics.metrics.vehicles.kommun_avg.vehicles_per_household.toFixed(2)}
                                  {aggregatedMetrics.metrics.vehicles.vehicles_per_household > aggregatedMetrics.metrics.vehicles.kommun_avg.vehicles_per_household ? ' ↑' : ' ↓'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">I trafik</span>
                          <span className="text-sm font-medium">
                            {aggregatedMetrics.metrics.vehicles.vehicles_in_traffic.toLocaleString('sv-SE')} ({((aggregatedMetrics.metrics.vehicles.vehicles_in_traffic / aggregatedMetrics.metrics.vehicles.total_vehicles) * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(aggregatedMetrics.metrics.vehicles.vehicles_in_traffic / aggregatedMetrics.metrics.vehicles.total_vehicles) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Info note */}
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">
                          Personbilar registrerade på folkbokförda personer per 31 december. Inkluderar bilar från enskild firma och leasade bilar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Building Age (Byggnadsålder) */}
                {aggregatedMetrics.metrics.building_age && aggregatedMetrics.metrics.building_age.periods.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Byggnadsålder {aggregatedMetrics.metrics.building_age.year && <span className="text-sm text-gray-400 font-normal">({aggregatedMetrics.metrics.building_age.year})</span>}
                    </h3>
                    <div className="space-y-3">
                      {/* Overview cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-xs text-amber-700 font-medium mb-1">Totalt antal byggnader</p>
                          <p className="text-lg font-semibold text-amber-900">
                            {aggregatedMetrics.metrics.building_age.total_buildings.toLocaleString('sv-SE')}
                          </p>
                          {aggregatedMetrics.metrics.building_age.kommun_avg && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-600">Kommun: </span>
                              <span className="text-gray-700">
                                {aggregatedMetrics.metrics.building_age.kommun_avg.total_buildings.toLocaleString('sv-SE')}
                              </span>
                            </div>
                          )}
                        </div>

                        {aggregatedMetrics.metrics.building_age.average_age && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs text-orange-700 font-medium mb-1">Genomsnittlig ålder</p>
                            <p className="text-lg font-semibold text-orange-900">
                              {Math.round(aggregatedMetrics.metrics.building_age.average_age)} år
                            </p>
                            {aggregatedMetrics.metrics.building_age.kommun_avg?.average_age && (
                              <div className="mt-2 text-xs">
                                <span className="text-gray-600">Kommun: </span>
                                <span className={aggregatedMetrics.metrics.building_age.average_age < aggregatedMetrics.metrics.building_age.kommun_avg.average_age ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                                  {Math.round(aggregatedMetrics.metrics.building_age.kommun_avg.average_age)} år
                                  {aggregatedMetrics.metrics.building_age.average_age < aggregatedMetrics.metrics.building_age.kommun_avg.average_age ? ' (nyare)' : ' (äldre)'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Period breakdown with dual bars */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">Fördelning per byggnadsperiod:</p>
                        {aggregatedMetrics.metrics.building_age.periods.map((period: any) => {
                          const kommunPeriod = aggregatedMetrics.metrics.building_age?.kommun_avg?.periods.find((p: any) => p.period === period.period);

                          return (
                            <div key={period.period} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-gray-700">{period.period}</span>
                                <div className="flex gap-4">
                                  <span className="text-gray-900">
                                    {period.count.toLocaleString('sv-SE')} ({period.percentage.toFixed(1)}%)
                                  </span>
                                  {kommunPeriod && (
                                    <span className="text-gray-500">
                                      Kom: {kommunPeriod.percentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Area bar (dark) */}
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-amber-600 h-2 rounded-full transition-all"
                                  style={{ width: `${period.percentage}%` }}
                                />
                              </div>

                              {/* Kommun bar (light) */}
                              {kommunPeriod && (
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-amber-300 h-2 rounded-full transition-all"
                                    style={{ width: `${kommunPeriod.percentage}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Info note */}
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">
                          Antal bostadsbyggnader per byggnadsperiod. Data visar när byggnaderna ursprungligen uppfördes enligt fastighetsregistret.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Export Buttons */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      onClick={() => {
                        if (aggregatedMetrics && desoResult) {
                          exportToCSV(
                            aggregatedMetrics,
                            selectedDesoCodes,
                            desoResult.kommun_name,
                            booliData,
                            propertyPoint?.beteckning,
                            propertyPoint?.coordinates
                          );
                        }
                      }}
                      disabled={!aggregatedMetrics || !desoResult}
                      title={!aggregatedMetrics || !desoResult ? 'Välj ett område först' : 'Exportera alla data till CSV'}
                    >
                      📥 CSV
                    </button>

                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      onClick={() => {
                        if (aggregatedMetrics && desoResult) {
                          exportToJSON(
                            aggregatedMetrics,
                            selectedDesoCodes,
                            desoResult.kommun_name,
                            booliData,
                            propertyPoint?.beteckning,
                            propertyPoint?.coordinates
                          );
                        }
                      }}
                      disabled={!aggregatedMetrics || !desoResult}
                      title={!aggregatedMetrics || !desoResult ? 'Välj ett område först' : 'Exportera alla data till JSON'}
                    >
                      📦 JSON
                    </button>
                  </div>

                  <button
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed print:hidden"
                    onClick={() => window.print()}
                    disabled={!aggregatedMetrics || !desoResult}
                    title={!aggregatedMetrics || !desoResult ? 'Välj ett område först' : 'Skriv ut eller spara som PDF'}
                  >
                    🖨️ Skriv ut / Spara som PDF
                  </button>

                  {/* Analysis Buttons */}
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs text-gray-600 mb-2 font-medium">Vidare Analys:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        onClick={() => alert('Quick Analys kommer snart!')}
                        disabled={!aggregatedMetrics || !desoResult}
                        title="Snabb analys av områdets potential"
                      >
                        ⚡ Quick Analys
                      </button>

                      <button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        onClick={() => alert('Full Analys kommer snart!')}
                        disabled={!aggregatedMetrics || !desoResult}
                        title="Fullständig analys med rekommendationer"
                      >
                        📊 Full Analys
                      </button>
                    </div>
                  </div>

                  <button
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition print:hidden"
                    onClick={handleNewAnalysis}
                    title="Rensa all data och starta en ny analys från början"
                  >
                    🔄 Ny analys
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booli Price Analysis */}
        <BooliAnalysis />
      </main>
    </div>
  );
}

export default App;
