import { useState } from 'react';
import { searchProperty } from '../services/api';
import { useAnalysisStore } from '../store/analysisStore';

export function PropertySearch() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const { setSelectedPolygon, setPropertyPoint } = useAnalysisStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!search.trim()) {
      setError('Ange en fastighetsbeteckning');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      console.log('[PropertySearch] Searching for:', search);

      // Search for property
      const property = await searchProperty(search);

      console.log('[PropertySearch] Found property:', property);

      // Check if property has geometry
      if (!property.geometry || !property.geometry.coordinates) {
        setError(
          `Fastigheten "${property.properties.beteckning}" hittades men saknar kartgeometri. ` +
          `Försök rita området manuellt på kartan istället.`
        );
        setLoading(false);
        return;
      }

      // Check if geometry is a Point (not a Polygon)
      if (property.geometry.type === 'Point' || property.properties.geometryType === 'point') {
        setWarning(
          `Fastigheten "${property.properties.beteckning}" hittades! ` +
          `En röd punkt visas på kartan. Rita ett polygon runt fastigheten för att fortsätta analysen.`
        );

        // Set property point in store to trigger map marker display
        setPropertyPoint({
          coordinates: property.geometry.coordinates as [number, number],
          beteckning: property.properties.beteckning
        });

        setLoading(false);
        setSearch('');
        return;
      }

      // Convert to GeoJSON polygon format expected by the app
      const polygon = {
        type: 'Polygon' as const,
        coordinates: property.geometry.coordinates
      };

      // Calculate centroid from polygon for propertyPoint
      const coords = property.geometry.coordinates[0] as number[][];
      const n = coords.length;
      let sumLon = 0, sumLat = 0;
      for (const c of coords) {
        sumLon += c[0];
        sumLat += c[1];
      }
      const centroid: [number, number] = [sumLon / n, sumLat / n];

      // Set property point with beteckning and centroid
      setPropertyPoint({
        coordinates: centroid as [number, number],
        beteckning: property.properties.beteckning
      });

      // Set polygon (this will trigger DeSO search)
      setSelectedPolygon(polygon);

      // Clear search
      setSearch('');
      setLoading(false);

    } catch (err: any) {
      console.error('[PropertySearch] Error:', err);

      if (err.response?.status === 404) {
        setError(`Fastigheten "${search}" hittades inte`);
      } else if (err.response?.status === 400) {
        setError(err.response.data.message || 'Ogiltigt format');
      } else {
        setError('Ett fel uppstod vid sökning. Kontrollera att backend körs på http://localhost:3000');
      }

      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Sök på fastighetsbeteckning
      </h3>

      <form onSubmit={handleSearch} className="space-y-2">
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: NACKA SALTSJÖ-BOO 1:123"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: KOMMUN TRAKT BLOCK:ENHET
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {warning && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm">
            {warning}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !search.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md text-sm transition"
        >
          {loading ? 'Söker...' : 'Sök fastighet'}
        </button>
      </form>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          ℹ️ Kräver API-nyckel från Lantmäteriet.
          <a
            href="https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/fastighet-och-samfallighet-direkt/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline ml-1"
          >
            Läs mer
          </a>
        </p>
      </div>
    </div>
  );
}
