import React, { useState, useEffect, useCallback } from 'react';

interface SettingsData {
  custom_fields_enable: boolean;
  custom_fields_selected_ids: number[];
  custom_fields_write_mode: 'append' | 'replace' | 'update';
  restrict_tags_to_existing: boolean;
  restrict_correspondents_to_existing: boolean;
  restrict_document_types_to_existing: boolean;
}

const MetadataRestrictionsEditor: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('./api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data.settings);
      setInitialSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (initialSettings && settings) {
      setIsDirty(JSON.stringify(settings) !== JSON.stringify(initialSettings));
    }
  }, [settings, initialSettings]);

  const handleSaveSettings = useCallback(async () => {
    if (!isDirty || !settings) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('./api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save settings');
      }
      setInitialSettings(settings);
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [settings, isDirty]);

  const handleToggle = (key: keyof SettingsData) => {
    setSettings((prev) => (prev ? { ...prev, [key]: !prev[key] } : null));
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-6" role="alert">
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6">No settings found.</div>;
  }

  const restrictions = [
    {
      key: 'restrict_tags_to_existing' as const,
      label: 'Restrict tags to existing ones',
      description: 'Only suggest tags that already exist in Paperless. Overrides the CREATE_NEW_TAGS environment variable.',
    },
    {
      key: 'restrict_correspondents_to_existing' as const,
      label: 'Restrict correspondents to existing ones',
      description: 'Only use correspondents that already exist in Paperless. New correspondents will not be created.',
    },
    {
      key: 'restrict_document_types_to_existing' as const,
      label: 'Restrict document types to existing ones',
      description: 'Only suggest document types that already exist in Paperless.',
    },
  ];

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Metadata Restrictions</h1>
      </div>

      {successMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-transform transform animate-bounce" role="alert">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          When enabled, these settings ensure that proposed values are limited to ones that already exist in Paperless-ngx.
        </p>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {restrictions.map(({ key, label, description }) => (
            <div key={key} className="flex items-start gap-4 py-4">
              <div className="flex items-center h-5 mt-1">
                <input
                  type="checkbox"
                  id={key}
                  checked={!!settings[key]}
                  onChange={() => handleToggle(key)}
                  className="w-4 h-4 cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <label htmlFor={key} className="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  {label}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSaveSettings}
          disabled={!isDirty || isSaving}
          aria-busy={isSaving}
          className={`px-6 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform transform ${
            isSaving
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 focus:ring-blue-500'
          } ${!isDirty && !isSaving ? 'disabled:bg-gray-400 disabled:cursor-not-allowed' : ''}`}
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default MetadataRestrictionsEditor;
