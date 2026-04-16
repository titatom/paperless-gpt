import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import "react-tag-autocomplete/example/src/styles.css"; // Ensure styles are loaded
import DocumentsToProcess from "./components/DocumentsToProcess";
import NoDocuments from "./components/NoDocuments";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import SuccessModal from "./components/SuccessModal";
import SuggestionsReview from "./components/SuggestionsReview";

export interface Document {
  id: number;
  title: string;
  content: string;
  tags: string[];
  correspondent: string;
  created_date?: string;
  original_file_name?: string;
  archived_file_name?: string;
  document_type_name?: string;
}

export interface GenerateSuggestionsRequest {
  documents: Document[];
  generate_titles?: boolean;
  generate_tags?: boolean;
  generate_correspondents?: boolean;
  generate_document_types?: boolean;
  generate_created_date?: boolean;
  generate_custom_fields?: boolean;
  selected_custom_field_ids?: number[];
  custom_field_write_mode?: string;
}

export interface CustomFieldSuggestion {
  id: number;
  value: any;
  name: string;
  isSelected: boolean;
}

export interface JobberMatchCandidate {
  id: string;
  job_number: string;
  client_name: string;
  job_name: string;
}

export interface DocumentIntegrationResult {
  document_id: number;
  paperless_updated: boolean;
  jobber_applied: boolean;
  jobber_error?: string;
  jobber_expense_created?: boolean;
  jobber_expense_id?: string;
  jobber_expense_error?: string;
  google_drive_uploaded: boolean;
  google_drive_error?: string;
  google_drive_file_id?: string;
  google_drive_url?: string;
}

export interface IntegrationStatus {
  provider: string;
  configured: boolean;
  connected: boolean;
  account_name?: string;
  account_id?: string;
  reason?: string;
}

export interface DocumentSuggestion {
  id: number;
  original_document: Document;
  suggested_title?: string;
  suggested_tags?: string[];
  suggested_content?: string;
  suggested_correspondent?: string;
  suggested_document_type?: string;
  suggested_created_date?: string;
  suggested_custom_fields?: CustomFieldSuggestion[];
  jobber_candidates?: JobberMatchCandidate[];
  selected_jobber_match_id?: string;
  create_jobber_expense?: boolean;
  upload_to_google_drive?: boolean;
}

export interface TagOption {
  id: string;
  name: string;
}

interface CustomField {
  id: number;
  name: string;
  data_type: string;
}

const DocumentProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [allCustomFields, setAllCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [paperlessUrl, setPaperlessUrl] = useState<string>("");
  const [integrationStatuses, setIntegrationStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [integrationResults, setIntegrationResults] = useState<DocumentIntegrationResult[]>([]);
  const [generateTitles, setGenerateTitles] = useState(true);
  const [generateTags, setGenerateTags] = useState(true);
  const [generateCorrespondents, setGenerateCorrespondents] = useState(true);
  const [generateDocumentTypes, setGenerateDocumentTypes] = useState(true);
  const [generateCreatedDate, setGenerateCreatedDate] = useState(true);
  const [generateCustomFields, setGenerateCustomFields] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSelectDocument = (docId: number) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAll = () => setSelectedDocuments(documents.map((d) => d.id));
  const handleSelectNone = () => setSelectedDocuments([]);

  // Custom hook to fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      const [filterTagRes, documentsRes, tagsRes, customFieldsRes, paperlessUrlRes, integrationsRes] = await Promise.all([
        axios.get<{ tag: string }>("./api/filter-tag"),
        axios.get<Document[]>("./api/documents"),
        axios.get<Record<string, number>>("./api/tags"),
        axios.get<CustomField[]>('./api/custom_fields'),
        axios.get<{ url: string }>("./api/paperless-url"),
        axios.get<{ providers: IntegrationStatus[] }>("./api/integrations"),
      ]);

      setFilterTag(filterTagRes.data.tag);
      setAllCustomFields(customFieldsRes.data || []);
      setPaperlessUrl(paperlessUrlRes.data.url || "");
      setIntegrationStatuses(
        Object.fromEntries(
          (integrationsRes.data.providers || []).map((provider) => [provider.provider, provider])
        )
      );
      setDocuments(documentsRes.data);
      setSelectedDocuments(documentsRes.data.map((d: Document) => d.id));
      const tags = Object.keys(tagsRes.data).map((tag) => ({
        id: tag,
        name: tag,
      }));
      setAvailableTags(tags);
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError("Failed to fetch initial data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleProcessDocuments = async () => {
    setProcessing(true);
    setError(null);
    try {
      const docsToProcess = documents.filter((d) => selectedDocuments.includes(d.id));
      if (docsToProcess.length === 0) {
        setError("No documents selected. Please select at least one document to process.");
        setProcessing(false);
        return;
      }
      const requestPayload: GenerateSuggestionsRequest = {
        documents: docsToProcess,
        generate_titles: generateTitles,
        generate_tags: generateTags,
        generate_correspondents: generateCorrespondents,
        generate_document_types: generateDocumentTypes,
        generate_created_date: generateCreatedDate,
        generate_custom_fields: generateCustomFields,
      };

      const { data } = await axios.post<DocumentSuggestion[]>(
        "./api/generate-suggestions",
        requestPayload
      );

      // Post-process suggestions to add names and isSelected flag
      const customFieldMap = new Map((allCustomFields || []).map(cf => [cf.id, cf.name]));
      const processedSuggestions = data.map(suggestion => ({
        ...suggestion,
        suggested_custom_fields: suggestion.suggested_custom_fields?.map(cf => ({
          ...cf,
          name: customFieldMap.get(cf.id) || 'Unknown Field',
          isSelected: true,
        })),
        jobber_candidates: [],
        selected_jobber_match_id: suggestion.selected_jobber_match_id || "",
        create_jobber_expense: !!suggestion.create_jobber_expense,
        upload_to_google_drive: !!suggestion.upload_to_google_drive,
      }));

      setSuggestions(processedSuggestions);
      setIntegrationResults([]);

      if (integrationStatuses.jobber?.connected) {
        try {
          const jobberResponse = await axios.post<{ candidates: Record<string, JobberMatchCandidate[]> }>(
            "./api/integrations/jobber/match-candidates",
            { document_ids: docsToProcess.map((d) => d.id) }
          );

          setSuggestions((current) =>
            current.map((suggestion) => ({
              ...suggestion,
              jobber_candidates: jobberResponse.data.candidates?.[String(suggestion.id)] || [],
            }))
          );
        } catch (jobberError) {
          console.error("Error fetching Jobber candidates:", jobberError);
          setError("Suggestions generated, but Jobber candidates could not be loaded.");
        }
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      setError("Failed to generate suggestions.");
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateDocuments = async () => {
    setUpdating(true);
    setError(null);
    try {
      // Filter out deselected custom fields before sending
      const payload = suggestions.map(suggestion => {
        const { suggested_custom_fields, ...rest } = suggestion;
        return {
          ...rest,
          suggested_custom_fields: suggested_custom_fields?.filter(cf => cf.isSelected),
        };
      });

      const response = await axios.patch<{ results: DocumentIntegrationResult[] }>("./api/update-documents", payload);
      setIntegrationResults(response.data.results || []);
      setIsSuccessModalOpen(true);
      setSuggestions([]);
    } catch (err) {
      console.error("Error updating documents:", err);
      setError("Failed to update documents.");
    } finally {
      setUpdating(false);
    }
  };

  const handleTagAddition = (docId: number, tag: TagOption) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              suggested_tags: [...(doc.suggested_tags || []), tag.name],
            }
          : doc
      )
    );
  };

  const handleCustomFieldSuggestionToggle = (docId: number, fieldId: number) => {
    setSuggestions(prevSuggestions =>
      prevSuggestions.map(doc =>
        doc.id === docId
          ? {
              ...doc,
              suggested_custom_fields: doc.suggested_custom_fields?.map(cf =>
                cf.id === fieldId ? { ...cf, isSelected: !cf.isSelected } : cf
              ),
            }
          : doc
      )
    );
  };

  const handleJobberSelectionChange = (docId: number, selectedJobberMatchId: string) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              selected_jobber_match_id: selectedJobberMatchId,
              create_jobber_expense: selectedJobberMatchId ? doc.create_jobber_expense : false,
            }
          : doc
      )
    );
  };

  const handleJobberExpenseToggle = (docId: number, enabled: boolean) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, create_jobber_expense: enabled } : doc
      )
    );
  };

  const handleGoogleDriveToggle = (docId: number, enabled: boolean) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, upload_to_google_drive: enabled } : doc
      )
    );
  };

  const handleTagDeletion = (docId: number, index: number) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              suggested_tags: doc.suggested_tags?.filter((_, i) => i !== index),
            }
          : doc
      )
    );
  };


  const handleTitleChange = (docId: number, title: string) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, suggested_title: title } : doc
      )
    );
  };

  const handleCorrespondentChange = (docId: number, correspondent: string) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, suggested_correspondent: correspondent } : doc
      )
    );
  }

  const handleDocumentTypeChange = (docId: number, documentType: string) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, suggested_document_type: documentType } : doc
      )
    );
  }

  const handleCreatedDateChange = (docId: number, createdDate: string) => {
    setSuggestions((prevSuggestions) =>
      prevSuggestions.map((doc) =>
        doc.id === docId ? { ...doc, suggested_created_date: createdDate } : doc
      )
    );
  }

  const resetSuggestions = () => {
    setSuggestions([]);
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await axios.delete(`./api/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocuments((prev) => prev.filter((id) => id !== docId));
      setSuggestions((prev) => {
        const next = prev.filter((s) => s.id !== docId);
        return next;
      });
    } catch (err) {
      console.error("Error deleting document:", err);
      setError("Failed to delete document.");
    }
  };

  const reloadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<Document[]>("./api/documents");
      setDocuments(data);
      setSelectedDocuments(data.map((d: Document) => d.id));
    } catch (err) {
      console.error("Error reloading documents:", err);
      setError("Failed to reload documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documents.length === 0) {
      const interval = setInterval(async () => {
        setError(null);
        try {
          const { data } = await axios.get<Document[]>("./api/documents");
          if (data.length > 0) {
            setDocuments(data);
            setSelectedDocuments(data.map((d: Document) => d.id));
          }
        } catch (err) {
          console.error("Error reloading documents:", err);
          setError("Failed to reload documents.");
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [documents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Loading documents...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-8">Paperless GPT</h1>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <NoDocuments
          filterTag={filterTag}
          onReload={reloadDocuments}
          processing={processing}
        />
      ) : suggestions.length === 0 ? (
        <DocumentsToProcess
          documents={documents}
          selectedDocuments={selectedDocuments}
          onSelectDocument={handleSelectDocument}
          paperlessUrl={paperlessUrl}
          onDeleteDocument={handleDeleteDocument}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Documents to Process</h2>
            <div className="flex space-x-2">
              <button
                onClick={reloadDocuments}
                disabled={processing}
                className="bg-blue-600 text-white dark:bg-blue-800 dark:text-gray-200 px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-900 focus:outline-none"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleProcessDocuments}
                disabled={processing || selectedDocuments.length === 0}
                className="bg-blue-600 text-white dark:bg-blue-800 dark:text-gray-200 px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-900 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? "Processing..." : `Generate Suggestions (${selectedDocuments.length})`}
              </button>
            </div>
          </div>
          <div className="flex space-x-2 mb-4">
            <button onClick={handleSelectAll} className="text-sm bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500">Select All</button>
            <button onClick={handleSelectNone} className="text-sm bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500">Select None</button>
          </div>

          <div className="flex space-x-4 mb-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateTitles}
                onChange={(e) => setGenerateTitles(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Titles</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateTags}
                onChange={(e) => setGenerateTags(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Tags</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateCorrespondents}
                onChange={(e) => setGenerateCorrespondents(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Correspondents</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateDocumentTypes}
                onChange={(e) => setGenerateDocumentTypes(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Document Types</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateCreatedDate}
                onChange={(e) => setGenerateCreatedDate(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Created Date</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={generateCustomFields}
                onChange={(e) => setGenerateCustomFields(e.target.checked)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">Generate Custom Fields</span>
            </label>
          </div>
        </DocumentsToProcess>
      ) : (
        <SuggestionsReview
          suggestions={suggestions}
          availableTags={availableTags}
          onTitleChange={handleTitleChange}
          onTagAddition={handleTagAddition}
          onTagDeletion={handleTagDeletion}
          onCorrespondentChange={handleCorrespondentChange}
          onDocumentTypeChange={handleDocumentTypeChange}
          onCreatedDateChange={handleCreatedDateChange}
          onCustomFieldSuggestionToggle={handleCustomFieldSuggestionToggle}
          onJobberMatchChange={handleJobberSelectionChange}
          onJobberExpenseToggle={handleJobberExpenseToggle}
          onGoogleDriveToggle={handleGoogleDriveToggle}
          onBack={resetSuggestions}
          onUpdate={handleUpdateDocuments}
          updating={updating}
          paperlessUrl={paperlessUrl}
          onDeleteDocument={handleDeleteDocument}
          integrationStatuses={integrationStatuses}
          integrationResults={integrationResults}
        />
      )}

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          reloadDocuments();
        }}
      />
    </div>
  );
};

export default DocumentProcessor;
