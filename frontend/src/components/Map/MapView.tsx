import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useAnalysisStore } from '../../store/analysisStore';
import { getDeSoBoundaries } from '../../services/api';
import type { GeoJSONPolygon } from '../../types';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const propertyMarker = useRef<mapboxgl.Marker | null>(null);

  const { setSelectedPolygon, setPropertyPoint, desoResult, propertyPoint } = useAnalysisStore();

  // Initialize map
  useEffect(() => {
    console.log('[MapView] useEffect triggered');
    console.log('[MapView] mapContainer.current:', mapContainer.current);
    console.log('[MapView] map.current:', map.current);
    console.log('[MapView] mapboxgl.accessToken:', mapboxgl.accessToken);
    console.log('[MapView] VITE_MAPBOX_TOKEN from env:', import.meta.env.VITE_MAPBOX_TOKEN);

    if (!mapContainer.current) {
      console.log('[MapView] No mapContainer.current, returning early');
      return;
    }
    if (map.current) {
      console.log('[MapView] map.current already exists, returning early');
      return; // Initialize only once
    }

    // Check if token is set
    if (!mapboxgl.accessToken || mapboxgl.accessToken === 'pk.your_token_here') {
      console.error('[MapView] Mapbox token not set! Update VITE_MAPBOX_TOKEN in .env');
      console.error('[MapView] Current token value:', mapboxgl.accessToken);
      return;
    }

    console.log('[MapView] All checks passed, creating map...');

    try {
      // Create map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [15.0, 62.0], // Central Sweden
        zoom: 4.5 // Show all of Sweden
      });

      console.log('[MapView] Map object created:', map.current);
    } catch (error) {
      console.error('[MapView] Error creating map:', error);
      return;
    }

    // Add navigation controls (zoom buttons)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add draw control for polygon drawing
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select'
    });

    map.current.addControl(draw.current, 'top-left');

    // Handle polygon events
    map.current.on('draw.create', handleDrawUpdate);
    map.current.on('draw.update', handleDrawUpdate);
    map.current.on('draw.delete', handleDrawDelete);

    console.log('[MapView] Map initialized');

    return () => {
      console.log('[MapView] Cleaning up map');
      map.current?.remove();
      map.current = null; // Reset ref so effect can re-create map in StrictMode
      draw.current = null; // Reset draw ref too
    };
  }, []);

  // Show property point marker and zoom to it
  useEffect(() => {
    if (!map.current) return;

    // Remove existing marker if any
    if (propertyMarker.current) {
      propertyMarker.current.remove();
      propertyMarker.current = null;
    }

    // Add new marker if propertyPoint is set
    if (propertyPoint) {
      console.log('[MapView] Adding property marker at:', propertyPoint.coordinates);

      // Create a red marker
      propertyMarker.current = new mapboxgl.Marker({
        color: '#ef4444' // Red color
      })
        .setLngLat(propertyPoint.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<div class="font-semibold">${propertyPoint.beteckning}</div>`)
        )
        .addTo(map.current);

      // Zoom to the property location
      map.current.flyTo({
        center: propertyPoint.coordinates,
        zoom: 15,
        duration: 2000
      });
    }
  }, [propertyPoint]);

  // Update DeSO boundaries when desoResult changes
  useEffect(() => {
    if (!map.current || !desoResult) return;

    console.log('[MapView] Adding DeSO boundaries for:', desoResult.deso_codes);

    // Fetch and display DeSO boundaries
    getDeSoBoundaries(desoResult.deso_codes)
      .then((geojson) => {
        if (!map.current) return;

        // Remove existing DeSO layer if any
        if (map.current.getLayer('deso-fill')) {
          map.current.removeLayer('deso-fill');
        }
        if (map.current.getLayer('deso-outline')) {
          map.current.removeLayer('deso-outline');
        }
        if (map.current.getSource('deso-boundaries')) {
          map.current.removeSource('deso-boundaries');
        }

        // Add new source
        map.current.addSource('deso-boundaries', {
          type: 'geojson',
          data: geojson
        });

        // Add fill layer (semi-transparent)
        map.current.addLayer({
          id: 'deso-fill',
          type: 'fill',
          source: 'deso-boundaries',
          paint: {
            'fill-color': '#3b82f6', // Blue
            'fill-opacity': 0.2
          }
        });

        // Add outline layer
        map.current.addLayer({
          id: 'deso-outline',
          type: 'line',
          source: 'deso-boundaries',
          paint: {
            'line-color': '#2563eb', // Darker blue
            'line-width': 2
          }
        });

        // Add labels with DeSO names
        map.current.addLayer({
          id: 'deso-labels',
          type: 'symbol',
          source: 'deso-boundaries',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': '#1e40af',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        });

        // Fit map to show all DeSO areas
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon: number[][][]) => {
              polygon[0].forEach((coord: number[]) => {
                bounds.extend(coord as [number, number]);
              });
            });
          } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: number[]) => {
              bounds.extend(coord as [number, number]);
            });
          }
        });

        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 14
        });

        console.log('[MapView] DeSO boundaries added');
      })
      .catch((error) => {
        console.error('[MapView] Failed to load DeSO boundaries:', error);
      });
  }, [desoResult]);

  function handleDrawUpdate() {
    if (!draw.current) return;

    const data = draw.current.getAll();

    if (data.features.length > 0) {
      const feature = data.features[0];

      if (feature.geometry.type === 'Polygon') {
        const polygon = feature.geometry as GeoJSONPolygon;
        console.log('[MapView] Polygon drawn, notifying store');

        // Clear property point marker when user draws polygon
        setPropertyPoint(null);

        setSelectedPolygon(polygon);
      }
    }
  }

  function handleDrawDelete() {
    console.log('[MapView] Polygon deleted');
    setSelectedPolygon(null);
    setPropertyPoint(null); // Also clear property point

    // Remove DeSO boundaries
    if (map.current) {
      if (map.current.getLayer('deso-fill')) {
        map.current.removeLayer('deso-fill');
      }
      if (map.current.getLayer('deso-outline')) {
        map.current.removeLayer('deso-outline');
      }
      if (map.current.getLayer('deso-labels')) {
        map.current.removeLayer('deso-labels');
      }
      if (map.current.getSource('deso-boundaries')) {
        map.current.removeSource('deso-boundaries');
      }
    }
  }

  // Show error if token not configured
  if (!mapboxgl.accessToken || mapboxgl.accessToken === 'pk.your_token_here') {
    return (
      <div className="w-full h-[600px] rounded-lg bg-red-50 border-2 border-red-200 flex items-center justify-center">
        <div className="text-center p-6">
          <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Mapbox Token Saknas
          </h3>
          <p className="text-sm text-red-700 mb-4">
            Du behöver konfigurera din Mapbox API token
          </p>
          <div className="bg-white rounded p-3 text-left text-xs">
            <p className="font-mono text-gray-700 mb-2">
              1. Gå till https://account.mapbox.com/auth/signup/
            </p>
            <p className="font-mono text-gray-700 mb-2">
              2. Skapa gratis konto och kopiera din token
            </p>
            <p className="font-mono text-gray-700">
              3. Lägg till i frontend/.env:<br/>
              <span className="text-blue-600">VITE_MAPBOX_TOKEN=pk.din_token_här</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />

      {/* Instructions overlay */}
      <div className="absolute top-4 left-16 bg-white rounded-lg shadow-lg p-3 text-sm max-w-xs">
        <p className="font-semibold text-gray-900 mb-1">Hur man använder:</p>
        <ol className="list-decimal list-inside text-gray-700 space-y-1">
          <li>Klicka på polygon-verktyget (⬡) till vänster</li>
          <li>Klicka på kartan för att rita en polygon</li>
          <li>Dubbelklicka för att slutföra</li>
          <li>Se DeSO-gränser och data till höger</li>
        </ol>
      </div>
    </div>
  );
}
