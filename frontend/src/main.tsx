import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Mapbox CSS - måste importeras i JavaScript
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
