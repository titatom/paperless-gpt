import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface CustomField {
  id: number;
  name: string;
  data_type: string;
}

interface FieldOption {
  value: string;
  label: string;
}

interface SettingsData {
  jobber_enabled: boolean;
  jobber_job_id_field_id: number;
  jobber_job_number_field_id: number;
  jobber_client_field_id: number;
  jobber_job_name_field_id: number;
  jobber_expense_enabled: boolean;
  jobber_expense_title_field_ref: string;
  jobber_expense_description_field_ref: string;
  jobber_expense_date_field_ref: string;
  jobber_expense_total_field_ref: string;
  google_drive_enabled: boolean;
  google_drive_folder_id: string;
  quickbooks_enabled: boolean;
}

interface IntegrationStatus {
  provider: string;
  configured: boolean;
  connected: boolean;
  account_name?: string;
  account_id?: string;
  reason?: string;
}

const defaultSettings: SettingsData = {
  jobber_enabled: false,
  jobber_job_id_field_id: 0,
  jobber_job_number_field_id: 0,
  jobber_client_field_id: 0,
  jobber_job_name_field_id: 0,
  jobber_expense_enabled: false,
  jobber_expense_title_field_ref: '',
  jobber_expense_description_field_ref: '',
  jobber_expense_date_field_ref: '',
  jobber_expense_total_field_ref: '',
  google_drive_enabled: false,
  google_drive_folder_id: '',
  quickbooks_enabled: false,
};

const CUSTOM_FIELD_REF_PREFIX = 'custom_field:';

const builtInPaperlessFieldOptions: FieldOption[] = [
  { value: 'document.title', label: 'Document title' },
  { value: 'document.content', label: 'Document content' },
  { value: 'document.correspondent', label: 'Correspondent' },
  { value: 'document.created_date', label: 'Created date' },
  { value: 'document.document_type', label: 'Document type' },
  { value: 'document.original_file_name', label: 'Original filename' },
  { value: 'document.archived_file_name', label: 'Archived filename' },
];

function normalizeFieldRef(fieldRef: unknown, legacyFieldId: unknown): string {
  if (typeof fieldRef === 'string') {
    return fieldRef;
  }

  const parsedFieldId = Number(legacyFieldId || 0);
  if (parsedFieldId > 0) {
    return `${CUSTOM_FIELD_REF_PREFIX}${parsedFieldId}`;
  }

  return '';
}

function extractCustomFieldId(fieldRef: string): number {
  if (!fieldRef.startsWith(CUSTOM_FIELD_REF_PREFIX)) {
    return 0;
  }

  const parsed = Number(fieldRef.slice(CUSTOM_FIELD_REF_PREFIX.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const IntegrationsEditor: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [initialSettings, setInitialSettings] = useState<SettingsData>(defaultSettings);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [settingsRes, statusesRes] = await Promise.all([
        fetch('./api/settings'),
        fetch('./api/integrations'),
      ]);

      if (!settingsRes.ok) {
        throw new Error('Failed to fetch settings');
      }
      if (!statusesRes.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const settingsData = await settingsRes.json();
      const integrationsData = await statusesRes.json();

      const nextSettings: SettingsData = {
        jobber_enabled: !!settingsData.settings?.jobber_enabled,
        jobber_job_id_field_id: Number(settingsData.settings?.jobber_job_id_field_id || 0),
        jobber_job_number_field_id: Number(settingsData.settings?.jobber_job_number_field_id || 0),
        jobber_client_field_id: Number(settingsData.settings?.jobber_client_field_id || 0),
        jobber_job_name_field_id: Number(settingsData.settings?.jobber_job_name_field_id || 0),
        jobber_expense_enabled: !!settingsData.settings?.jobber_expense_enabled,
        jobber_expense_title_field_ref: normalizeFieldRef(
          settingsData.settings?.jobber_expense_title_field_ref,
          settingsData.settings?.jobber_expense_title_field_id,
        ),
        jobber_expense_description_field_ref: normalizeFieldRef(
          settingsData.settings?.jobber_expense_description_field_ref,
          settingsData.settings?.jobber_expense_description_field_id,
        ),
        jobber_expense_date_field_ref: normalizeFieldRef(
          settingsData.settings?.jobber_expense_date_field_ref,
          settingsData.settings?.jobber_expense_date_field_id,
        ),
        jobber_expense_total_field_ref: normalizeFieldRef(
          settingsData.settings?.jobber_expense_total_field_ref,
          settingsData.settings?.jobber_expense_total_field_id,
        ),
        google_drive_enabled: !!settingsData.settings?.google_drive_enabled,
        google_drive_folder_id: settingsData.settings?.google_drive_folder_id || '',
        quickbooks_enabled: !!settingsData.settings?.quickbooks_enabled,
      };

      setSettings(nextSettings);
      setInitialSettings(nextSettings);
      setCustomFields(settingsData.custom_fields || []);

      const statusMap: Record<string, IntegrationStatus> = {};
      for (const status of integrationsData.providers || integrationsData.integrations || []) {
        statusMap[status.provider] = status;
      }
      setStatuses(statusMap);
    } catch (err) {
      console.error('Error fetching integration data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(initialSettings));
  }, [settings, initialSettings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get('integration');
    const status = params.get('status');
    const result = params.get('result');
    if (!integration) {
      return;
    }

    if (status === 'connected' && result === 'ok') {
      setSuccessMessage(`${prettyProviderName(integration)} connected successfully.`);
      refreshData();
    } else if (status === 'error') {
      setError(`${prettyProviderName(integration)} connection failed. Please verify your server-side app credentials, redirect URL, and scopes.`);
    }

    params.delete('integration');
    params.delete('status');
    params.delete('result');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [refreshData]);

  const handleSettingChange = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = useCallback(async () => {
    if (!isDirty) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        ...settings,
        jobber_expense_title_field_id: extractCustomFieldId(settings.jobber_expense_title_field_ref),
        jobber_expense_description_field_id: extractCustomFieldId(settings.jobber_expense_description_field_ref),
        jobber_expense_date_field_id: extractCustomFieldId(settings.jobber_expense_date_field_ref),
        jobber_expense_total_field_id: extractCustomFieldId(settings.jobber_expense_total_field_ref),
      };
      const response = await fetch('./api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save settings');
      }
      setInitialSettings(settings);
      setSuccessMessage('Integration settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving integration settings:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, settings]);

  const handleConnect = useCallback(async (provider: string) => {
    setConnectingProvider(provider);
    setError(null);

    // Open the popup immediately within the user-gesture context so browsers
    // do not treat it as a pop-up blocker candidate.  We navigate it to the
    // real auth URL once we receive it from the server.
    const popup = window.open('about:blank', '_blank', 'width=640,height=800');
    if (!popup) {
      setError('Popup blocked. Please allow popups and try again.');
      setConnectingProvider(null);
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      window.removeEventListener('message', onMessage);
    };

    const onMessage = (event: MessageEvent) => {
      // Only handle messages that look like our OAuth result.
      if (!event.data || typeof event.data !== 'object') return;
      const { type, error } = event.data as { type?: string; error?: string };
      if (type === 'oauth_success') {
        cleanup();
        setSuccessMessage(`${prettyProviderName(provider)} connected successfully.`);
        refreshData();
      } else if (type === 'oauth_error') {
        cleanup();
        setError(`${prettyProviderName(provider)} connection failed: ${error || 'unknown error'}`);
        refreshData();
      }
    };

    window.addEventListener('message', onMessage);

    try {
      const response = await fetch(`./api/integrations/${provider}/connect/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_path: '/settings' }),
      });
      const payload = await response.json();
      if (!response.ok) {
        popup.close();
        cleanup();
        throw new Error(payload.error || 'Failed to start connection');
      }

      const authURL = payload.redirect_url || payload.url;
      if (!authURL) {
        popup.close();
        cleanup();
        throw new Error('No redirect URL returned from server');
      }

      // Navigate the already-open popup to the OAuth authorization page.
      popup.location.href = authURL;

      // Also poll for popup close as a fallback (postMessage may be blocked by
      // the browser if the callback page's origin differs).
      pollInterval = setInterval(() => {
        try {
          if (popup.closed) {
            cleanup();
            refreshData();
          }
        } catch {
          // Ignore cross-origin access errors during polling.
          cleanup();
          refreshData();
        }
      }, 500);
    } catch (err) {
      console.error(`Error connecting ${provider}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setConnectingProvider(null);
    }
  }, [refreshData]);

  const handleDisconnect = useCallback(async (provider: string) => {
    setDisconnectingProvider(provider);
    setError(null);
    try {
      const response = await fetch(`./api/integrations/${provider}/disconnect`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to disconnect provider');
      }
      setSuccessMessage(`${prettyProviderName(provider)} disconnected.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await refreshData();
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setDisconnectingProvider(null);
    }
  }, [refreshData]);

  const customFieldOptions = useMemo(
    () => [{ id: 0, name: 'Not mapped' }, ...customFields.map((field) => ({ id: field.id, name: field.name }))],
    [customFields],
  );

  const expenseFieldOptions = useMemo(
    () => [
      { value: '', label: 'Use default behavior' },
      ...builtInPaperlessFieldOptions,
      ...customFields.map((field) => ({
        value: `${CUSTOM_FIELD_REF_PREFIX}${field.id}`,
        label: `Custom field: ${field.name}`,
      })),
    ],
    [customFields],
  );

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Integrations</h1>
      </div>

      {successMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-transform transform animate-bounce" role="alert">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <IntegrationCard
          title="Jobber"
          status={statuses.jobber}
          onConnect={() => handleConnect('jobber')}
          onDisconnect={() => handleDisconnect('jobber')}
          connecting={connectingProvider === 'jobber'}
          disconnecting={disconnectingProvider === 'jobber'}
        >
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="jobberEnabled"
              checked={settings.jobber_enabled}
              onChange={(e) => handleSettingChange('jobber_enabled', e.target.checked)}
              className="w-4 h-4 mr-2"
            />
            <label htmlFor="jobberEnabled">Enable Jobber matching</label>
          </div>

          <fieldset disabled={!settings.jobber_enabled} className="grid grid-cols-1 md:grid-cols-2 gap-4 disabled:opacity-50">
            <FieldMappingSelect
              label="Job ID field"
              value={settings.jobber_job_id_field_id}
              options={customFieldOptions}
              onChange={(value) => handleSettingChange('jobber_job_id_field_id', value)}
            />
            <FieldMappingSelect
              label="Job # field"
              value={settings.jobber_job_number_field_id}
              options={customFieldOptions}
              onChange={(value) => handleSettingChange('jobber_job_number_field_id', value)}
            />
            <FieldMappingSelect
              label="Client field"
              value={settings.jobber_client_field_id}
              options={customFieldOptions}
              onChange={(value) => handleSettingChange('jobber_client_field_id', value)}
            />
            <FieldMappingSelect
              label="Job name field"
              value={settings.jobber_job_name_field_id}
              options={customFieldOptions}
              onChange={(value) => handleSettingChange('jobber_job_name_field_id', value)}
            />
          </fieldset>

          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="jobberExpenseEnabled"
                checked={settings.jobber_expense_enabled}
                onChange={(e) => handleSettingChange('jobber_expense_enabled', e.target.checked)}
                className="w-4 h-4 mr-2"
              />
              <label htmlFor="jobberExpenseEnabled">Enable Jobber expense creation</label>
            </div>

            <fieldset
              disabled={!settings.jobber_enabled || !settings.jobber_expense_enabled}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 disabled:opacity-50"
            >
              <FieldReferenceSelect
                label="Expense title field"
                value={settings.jobber_expense_title_field_ref}
                options={expenseFieldOptions}
                onChange={(value) => handleSettingChange('jobber_expense_title_field_ref', value)}
              />
              <FieldReferenceSelect
                label="Expense description field"
                value={settings.jobber_expense_description_field_ref}
                options={expenseFieldOptions}
                onChange={(value) => handleSettingChange('jobber_expense_description_field_ref', value)}
              />
              <FieldReferenceSelect
                label="Expense date field"
                value={settings.jobber_expense_date_field_ref}
                options={expenseFieldOptions}
                onChange={(value) => handleSettingChange('jobber_expense_date_field_ref', value)}
              />
              <FieldReferenceSelect
                label="Expense total field"
                value={settings.jobber_expense_total_field_ref}
                options={expenseFieldOptions}
                onChange={(value) => handleSettingChange('jobber_expense_total_field_ref', value)}
              />
            </fieldset>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              On approval, a matched receipt can create a Jobber expense linked to the selected job using mapped built-in Paperless fields or custom fields when available.
            </p>
          </div>
        </IntegrationCard>

        <IntegrationCard
          title="Google Drive"
          status={statuses.google_drive}
          onConnect={() => handleConnect('google_drive')}
          onDisconnect={() => handleDisconnect('google_drive')}
          connecting={connectingProvider === 'google_drive'}
          disconnecting={disconnectingProvider === 'google_drive'}
        >
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="googleDriveEnabled"
              checked={settings.google_drive_enabled}
              onChange={(e) => handleSettingChange('google_drive_enabled', e.target.checked)}
              className="w-4 h-4 mr-2"
            />
            <label htmlFor="googleDriveEnabled">Enable Google Drive uploads</label>
          </div>

          <fieldset disabled={!settings.google_drive_enabled} className="disabled:opacity-50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Google Drive folder ID
            </label>
            <input
              type="text"
              value={settings.google_drive_folder_id}
              onChange={(e) => handleSettingChange('google_drive_folder_id', e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
              placeholder="Folder ID"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Uploaded files will use the latest filename from Paperless-ngx.
            </p>
          </fieldset>
        </IntegrationCard>

        <IntegrationCard
          title="QuickBooks"
          status={statuses.quickbooks}
          onConnect={() => handleConnect('quickbooks')}
          onDisconnect={() => handleDisconnect('quickbooks')}
          connecting={connectingProvider === 'quickbooks'}
          disconnecting={disconnectingProvider === 'quickbooks'}
        >
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="quickbooksEnabled"
              checked={settings.quickbooks_enabled}
              onChange={(e) => handleSettingChange('quickbooks_enabled', e.target.checked)}
              className="w-4 h-4 mr-2"
            />
            <label htmlFor="quickbooksEnabled">Enable QuickBooks connection</label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            QuickBooks is connection-only for now. No receipt upload action will appear on document cards yet.
          </p>
        </IntegrationCard>
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

interface IntegrationCardProps {
  title: string;
  status?: IntegrationStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
  disconnecting: boolean;
  children: React.ReactNode;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  title,
  status,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
  children,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {status?.configured ? (
              status.connected ? (
                <>
                  Connected{status.account_name ? ` as ${status.account_name}` : ''}.
                </>
              ) : (
                'Configured on the server but not connected.'
              )
            ) : (
              status?.reason || 'Provider is not configured on the server.'
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConnect}
            disabled={!status?.configured || connecting}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
          <button
            onClick={onDisconnect}
            disabled={!status?.connected || disconnecting}
            className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {children}
    </div>
  );
};

interface FieldMappingSelectProps {
  label: string;
  value: number;
  options: Array<{ id: number; name: string }>;
  onChange: (value: number) => void;
}

const FieldMappingSelect: React.FC<FieldMappingSelectProps> = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  </div>
);

interface FieldReferenceSelectProps {
  label: string;
  value: string;
  options: FieldOption[];
  onChange: (value: string) => void;
}

const FieldReferenceSelect: React.FC<FieldReferenceSelectProps> = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

function prettyProviderName(provider: string): string {
  switch (provider) {
    case 'google_drive':
      return 'Google Drive';
    case 'quickbooks':
      return 'QuickBooks';
    case 'jobber':
      return 'Jobber';
    default:
      return provider;
  }
}

export default IntegrationsEditor;
