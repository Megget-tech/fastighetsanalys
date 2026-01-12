import React, { useEffect, useState } from 'react';
import { getBooliSales, getBooliTrends, getBooliSummary } from '../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BooliSale {
  id: number;
  address: string;
  price: number;
  price_per_sqm: number;
  rooms: number;
  living_area: number;
  sold_date: string;
  category: string;
}

interface BooliTrend {
  id: number;
  year: number;
  period: string;
  supply: number;
  avg_price_per_sqm: number;
  avg_final_price: number;
  category: string;
}

export const BooliAnalysis: React.FC = () => {
  const [sales, setSales] = useState<BooliSale[]>([]);
  const [trends, setTrends] = useState<BooliTrend[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [salesData, trendsData, summaryData] = await Promise.all([
        getBooliSales(),
        getBooliTrends(),
        getBooliSummary()
      ]);

      setSales(salesData.data || []);
      setTrends(trendsData.data || []);
      setSummary(summaryData.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading Booli data:', err);
      setError(err.message || 'Kunde inte ladda Booli-data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600">Laddar prisanalys...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-gray-600 mt-2">Har du laddat upp Booli-data?</p>
      </div>
    );
  }

  if (sales.length === 0 && trends.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600">Ingen Booli-data uppladdad än. Ladda upp filer för att se prisanalys.</p>
      </div>
    );
  }

  // Prepare data for charts
  const newSales = sales.filter(s => s.category === 'nyproduktion');
  const oldSales = sales.filter(s => s.category === 'succession');

  const newTrends = trends.filter(t => t.category === 'nyproduktion');
  const oldTrends = trends.filter(t => t.category === 'succession');

  // Prepare chart data by combining both categories (last 52 weeks)
  const maxLength = Math.max(newTrends.length, oldTrends.length);
  const startIdx = Math.max(0, maxLength - 52);

  // Calculate average price by room count with min/max
  const calculatePriceByRooms = (salesData: BooliSale[]) => {
    const grouped = salesData.reduce((acc, sale) => {
      // Convert to numbers and validate
      const price = parseFloat(String(sale.price));
      const pricePerSqm = parseFloat(String(sale.price_per_sqm));
      const rooms = parseFloat(String(sale.rooms));

      if (!rooms || !price || !pricePerSqm || isNaN(price) || isNaN(pricePerSqm) || isNaN(rooms)) return acc;

      // Group into 1, 2, 3, 4, 5+ rooms
      const roomGroup = rooms >= 5 ? '5+' : rooms.toString();

      if (!acc[roomGroup]) {
        acc[roomGroup] = {
          count: 0,
          totalPrice: 0,
          totalPricePerSqm: 0,
          minPricePerSqm: Infinity,
          maxPricePerSqm: -Infinity
        };
      }

      acc[roomGroup].count++;
      acc[roomGroup].totalPrice += price;
      acc[roomGroup].totalPricePerSqm += pricePerSqm;
      acc[roomGroup].minPricePerSqm = Math.min(acc[roomGroup].minPricePerSqm, pricePerSqm);
      acc[roomGroup].maxPricePerSqm = Math.max(acc[roomGroup].maxPricePerSqm, pricePerSqm);

      return acc;
    }, {} as Record<string, { count: number; totalPrice: number; totalPricePerSqm: number; minPricePerSqm: number; maxPricePerSqm: number }>);

    // Calculate averages and convert to array
    return Object.entries(grouped)
      .map(([rooms, data]) => ({
        rooms,
        count: data.count,
        avgPrice: Math.round(data.totalPrice / data.count),
        avgPricePerSqm: Math.round(data.totalPricePerSqm / data.count),
        minPricePerSqm: Math.round(data.minPricePerSqm),
        maxPricePerSqm: Math.round(data.maxPricePerSqm)
      }))
      .sort((a, b) => {
        // Sort by room number (treat 5+ as 5)
        const aRooms = a.rooms === '5+' ? 5 : parseFloat(a.rooms);
        const bRooms = b.rooms === '5+' ? 5 : parseFloat(b.rooms);
        return aRooms - bRooms;
      });
  };

  const newPriceByRooms = calculatePriceByRooms(newSales);
  const oldPriceByRooms = calculatePriceByRooms(oldSales);

  // Get top 10 most expensive properties from the last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const top10Expensive = sales
    .filter(sale => {
      const soldDate = sale.sold_date ? new Date(sale.sold_date) : null;
      return soldDate && soldDate >= oneYearAgo && sale.price;
    })
    .sort((a, b) => parseFloat(String(b.price)) - parseFloat(String(a.price)))
    .slice(0, 10);

  // Supply chart data
  const newTrendsSlice = newTrends.slice(startIdx);
  const oldTrendsSlice = oldTrends.slice(startIdx);

  const supplyChartData = [];
  for (let i = 0; i < Math.max(newTrendsSlice.length, oldTrendsSlice.length); i++) {
    const newTrend = newTrendsSlice[i];
    const oldTrend = oldTrendsSlice[i];

    supplyChartData.push({
      period: newTrend?.period || oldTrend?.period || '',
      year: newTrend?.year || oldTrend?.year || 0,
      nyproduktion: newTrend?.supply ? Math.round(newTrend.supply) : null,
      succession: oldTrend?.supply ? Math.round(oldTrend.supply) : null
    });
  }

  // Sold units chart data - group sales by month
  const groupSalesByMonth = (salesData: BooliSale[]) => {
    const grouped: Record<string, number> = {};

    salesData.forEach(sale => {
      if (!sale.sold_date) return;

      const date = new Date(sale.sold_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const period = `${year}-${month}`;

      grouped[period] = (grouped[period] || 0) + 1;
    });

    return grouped;
  };

  const newSoldByMonth = groupSalesByMonth(newSales);
  const oldSoldByMonth = groupSalesByMonth(oldSales);

  // Get all unique periods from last year and sort
  const allPeriods = new Set([
    ...Object.keys(newSoldByMonth),
    ...Object.keys(oldSoldByMonth)
  ]);

  const sortedPeriods = Array.from(allPeriods)
    .sort()
    .slice(-12); // Last 12 months

  const soldChartData = sortedPeriods.map(period => ({
    period: period,
    nyproduktion: newSoldByMonth[period] || 0,
    succession: oldSoldByMonth[period] || 0
  }));

  // Calculate totals for the last 12 months
  const totalSoldNew = soldChartData.reduce((sum, item) => sum + item.nyproduktion, 0);
  const totalSoldOld = soldChartData.reduce((sum, item) => sum + item.succession, 0);
  const totalSoldAll = totalSoldNew + totalSoldOld;

  // Statistics from summary
  const avgNew = summary?.averages?.find((a: any) => a.category === 'nyproduktion');
  const avgOld = summary?.averages?.find((a: any) => a.category === 'succession');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Prisanalys</h2>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {avgNew && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Nyproduktion</h3>
              <p className="text-2xl font-bold text-blue-700">
                {Math.round(parseFloat(avgNew.avg_price_per_sqm)).toLocaleString('sv-SE')} kr/m²
              </p>
              <p className="text-sm text-gray-600">
                {Math.round(parseFloat(avgNew.avg_price)).toLocaleString('sv-SE')} kr
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Baserat på {summary?.sales?.find((s: any) => s.category === 'nyproduktion')?.count || 0} sålda objekt
              </p>
            </div>
          )}

          {avgOld && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Succession</h3>
              <p className="text-2xl font-bold text-green-700">
                {Math.round(parseFloat(avgOld.avg_price_per_sqm)).toLocaleString('sv-SE')} kr/m²
              </p>
              <p className="text-sm text-gray-600">
                {Math.round(parseFloat(avgOld.avg_price)).toLocaleString('sv-SE')} kr
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Baserat på {summary?.sales?.find((s: any) => s.category === 'succession')?.count || 0} sålda objekt
              </p>
            </div>
          )}
        </div>

        {/* Price by Room Count Tables */}
        {(newPriceByRooms.length > 0 || oldPriceByRooms.length > 0) && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Snittpris per antal rum</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nyproduktion Table */}
              {newPriceByRooms.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Nyproduktion</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Rum</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Antal</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Snittpris</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Snitt kr/m²</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Min-Max kr/m²</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {newPriceByRooms.map((row) => (
                          <tr key={row.rooms} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900">{row.rooms}</td>
                            <td className="px-3 py-2 text-gray-900">{row.count}</td>
                            <td className="px-3 py-2 text-gray-900">{row.avgPrice.toLocaleString('sv-SE')} kr</td>
                            <td className="px-3 py-2 text-gray-900">{row.avgPricePerSqm.toLocaleString('sv-SE')} kr/m²</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">
                              {row.minPricePerSqm.toLocaleString('sv-SE')} - {row.maxPricePerSqm.toLocaleString('sv-SE')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Succession Table */}
              {oldPriceByRooms.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-900 mb-2">Succession</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Rum</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Antal</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Snittpris</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Snitt kr/m²</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Min-Max kr/m²</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {oldPriceByRooms.map((row) => (
                          <tr key={row.rooms} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900">{row.rooms}</td>
                            <td className="px-3 py-2 text-gray-900">{row.count}</td>
                            <td className="px-3 py-2 text-gray-900">{row.avgPrice.toLocaleString('sv-SE')} kr</td>
                            <td className="px-3 py-2 text-gray-900">{row.avgPricePerSqm.toLocaleString('sv-SE')} kr/m²</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">
                              {row.minPricePerSqm.toLocaleString('sv-SE')} - {row.maxPricePerSqm.toLocaleString('sv-SE')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Supply Chart */}
        {supplyChartData.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Utbud - Senaste året</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={supplyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => `${value} objekt`}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="nyproduktion"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Nyproduktion"
                  dot={false}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="succession"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Succession"
                  dot={false}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sold Units Chart */}
        {soldChartData.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Antal sålda enheter - Senaste året</h3>

            {/* Totals Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-xs text-blue-900 mb-1">Nyproduktion</p>
                <p className="text-2xl font-bold text-blue-700">{totalSoldNew}</p>
                <p className="text-xs text-gray-600">st</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-xs text-green-900 mb-1">Succession</p>
                <p className="text-2xl font-bold text-green-700">{totalSoldOld}</p>
                <p className="text-xs text-gray-600">st</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-900 mb-1">Totalt</p>
                <p className="text-2xl font-bold text-gray-900">{totalSoldAll}</p>
                <p className="text-xs text-gray-600">st</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={soldChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => `${value} st`}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="nyproduktion"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Nyproduktion"
                  dot={true}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="succession"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Succession"
                  dot={true}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 10 Most Expensive Table */}
        {top10Expensive.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">10 dyraste objekten senaste året</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adress</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pris</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kr/m²</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rum</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Såld</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {top10Expensive.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.address}</td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                        {sale.price ? Math.round(parseFloat(String(sale.price))).toLocaleString('sv-SE') : '-'} kr
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {sale.price_per_sqm ? Math.round(parseFloat(String(sale.price_per_sqm))).toLocaleString('sv-SE') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.rooms || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.living_area ? `${sale.living_area} m²` : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {sale.sold_date ? new Date(sale.sold_date).toLocaleDateString('sv-SE') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${
                          sale.category === 'nyproduktion'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {sale.category === 'nyproduktion' ? 'Ny' : 'Succ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Sales Table */}
        {sales.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Senaste sålda objekt (10 st)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Adress</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pris</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kr/m²</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rum</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Såld</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.slice(0, 10).map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.address}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {sale.price ? Math.round(parseFloat(String(sale.price))).toLocaleString('sv-SE') : '-'} kr
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {sale.price_per_sqm ? Math.round(parseFloat(String(sale.price_per_sqm))).toLocaleString('sv-SE') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.rooms || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{sale.living_area ? `${sale.living_area} m²` : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {sale.sold_date ? new Date(sale.sold_date).toLocaleDateString('sv-SE') : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${
                          sale.category === 'nyproduktion'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {sale.category === 'nyproduktion' ? 'Ny' : 'Succ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
