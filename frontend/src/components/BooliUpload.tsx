import React, { useState } from 'react';
import { uploadBooliData, getBooliSummary } from '../services/api';

interface UploadStatus {
  uploading: boolean;
  success: boolean | null;
  message: string;
  summary: any | null;
}

export const BooliUpload: React.FC = () => {
  const [files, setFiles] = useState<{
    soldNew: File | null;
    soldOld: File | null;
    trendsNew: File | null;
    trendsOld: File | null;
  }>({
    soldNew: null,
    soldOld: null,
    trendsNew: null,
    trendsOld: null
  });

  const [region, setRegion] = useState('Umeå');
  const [status, setStatus] = useState<UploadStatus>({
    uploading: false,
    success: null,
    message: '',
    summary: null
  });

  const handleFileChange = (type: keyof typeof files) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleUpload = async () => {
    // Validate all files are selected
    if (!files.soldNew || !files.soldOld || !files.trendsNew || !files.trendsOld) {
      setStatus({
        uploading: false,
        success: false,
        message: 'Alla 4 filer måste väljas',
        summary: null
      });
      return;
    }

    setStatus({
      uploading: true,
      success: null,
      message: 'Laddar upp filer...',
      summary: null
    });

    try {
      const result = await uploadBooliData(files, region);

      setStatus({
        uploading: false,
        success: true,
        message: result.message,
        summary: result.summary
      });

      // Clear files after successful upload
      setFiles({
        soldNew: null,
        soldOld: null,
        trendsNew: null,
        trendsOld: null
      });

      // Reset file inputs
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      inputs.forEach(input => { input.value = ''; });

    } catch (error: any) {
      setStatus({
        uploading: false,
        success: false,
        message: error.message || 'Uppladdning misslyckades',
        summary: null
      });
    }
  };

  const allFilesSelected = files.soldNew && files.soldOld && files.trendsNew && files.trendsOld;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">Importera Booli-data</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Region
        </label>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="t.ex. Umeå, Stockholm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Sålda Nyproduktion */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sålda - Nyproduktion
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange('soldNew')}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {files.soldNew && (
            <p className="text-xs text-green-600 mt-1">✓ {files.soldNew.name}</p>
          )}
        </div>

        {/* Sålda Succession */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sålda - Succession
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange('soldOld')}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {files.soldOld && (
            <p className="text-xs text-green-600 mt-1">✓ {files.soldOld.name}</p>
          )}
        </div>

        {/* Utbud Nyproduktion */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Utbud - Nyproduktion
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange('trendsNew')}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {files.trendsNew && (
            <p className="text-xs text-green-600 mt-1">✓ {files.trendsNew.name}</p>
          )}
        </div>

        {/* Utbud Succession */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Utbud - Succession
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange('trendsOld')}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {files.trendsOld && (
            <p className="text-xs text-green-600 mt-1">✓ {files.trendsOld.name}</p>
          )}
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={!allFilesSelected || status.uploading}
        className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
          allFilesSelected && !status.uploading
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {status.uploading ? 'Laddar upp...' : 'Ladda upp Booli-data'}
      </button>

      {/* Status Messages */}
      {status.message && (
        <div className={`mt-4 p-4 rounded-md ${
          status.success
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p className="font-medium">{status.message}</p>

          {status.summary && (
            <div className="mt-2 text-sm">
              <p className="font-semibold mb-1">Uppladdad data:</p>
              <ul className="space-y-1">
                <li>Sålda nyproduktion: {status.summary.soldNewCount} objekt</li>
                <li>Sålda succession: {status.summary.soldOldCount} objekt</li>
                <li>Trender nyproduktion: {status.summary.trendsNewCount} perioder</li>
                <li>Trender succession: {status.summary.trendsOldCount} perioder</li>
                <li>Region: {status.summary.region}</li>
              </ul>
              {status.summary.statistics?.averages && status.summary.statistics.averages.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">Genomsnittspriser:</p>
                  {status.summary.statistics.averages.map((avg: any) => (
                    <div key={avg.category} className="ml-2">
                      <span className="capitalize">{avg.category}:</span>{' '}
                      {Math.round(parseFloat(avg.avg_price)).toLocaleString('sv-SE')} kr
                      ({Math.round(parseFloat(avg.avg_price_per_sqm)).toLocaleString('sv-SE')} kr/m²)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
