import React, { useState } from "react";
import ArrowTopRightOnSquareIcon from "@heroicons/react/24/outline/ArrowTopRightOnSquareIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import { ReactTags } from "react-tag-autocomplete";
import { DocumentIntegrationResult, DocumentSuggestion, TagOption } from "../DocumentProcessor";

interface SuggestionCardProps {
  suggestion: DocumentSuggestion;
  availableTags: TagOption[];
  onTitleChange: (docId: number, title: string) => void;
  onTagAddition: (docId: number, tag: TagOption) => void;
  onTagDeletion: (docId: number, index: number) => void;
  onCorrespondentChange: (docId: number, correspondent: string) => void;
  onDocumentTypeChange: (docId: number, documentType: string) => void;
  onCreatedDateChange: (docId: number, createdDate: string) => void;
  onCustomFieldSuggestionToggle: (docId: number, fieldId: number) => void;
  onJobberMatchChange: (docId: number, selectedJobId: string) => void;
  onGoogleDriveToggle: (docId: number, enabled: boolean) => void;
  jobberConnected: boolean;
  googleDriveConnected: boolean;
  integrationResult?: DocumentIntegrationResult;
  paperlessUrl?: string;
  onDelete?: (documentId: number) => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  availableTags,
  onTitleChange,
  onTagAddition,
  onTagDeletion,
  onCorrespondentChange,
  onDocumentTypeChange,
  onCreatedDateChange,
  onCustomFieldSuggestionToggle,
  onJobberMatchChange,
  onGoogleDriveToggle,
  jobberConnected,
  googleDriveConnected,
  integrationResult,
  paperlessUrl,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sortedAvailableTags = [...availableTags].sort((a, b) => a.name.localeCompare(b.name));
  const document = suggestion.original_document;

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete && onDelete(suggestion.id);
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg shadow-blue-500/50 rounded-md p-4 relative flex flex-col justify-between h-full">
      <div className="flex items-center gap-1 mb-2">
        {paperlessUrl && (
          <a
            href={`${paperlessUrl}/documents/${suggestion.id}/details`}
            target="_blank"
            rel="noopener noreferrer"
            title="View in Paperless-ngx"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            View
          </a>
        )}
        {onDelete && (
          confirmDelete ? (
            <>
              <button
                onClick={handleDeleteClick}
                title="Confirm delete"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Sure?
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                title="Cancel"
                className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleDeleteClick}
              title="Delete document"
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </button>
          )
        )}
      </div>
      <div className="flex items-center group relative">
        <div className="relative">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {document.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 truncate">
            {document.content.length > 40
              ? `${document.content.substring(0, 40)}...`
              : document.content}
          </p>
          <div className="mt-4">
            {document.tags.map((tag) => (
              <span
                key={tag}
                className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 rounded-md">
          <div className="text-sm text-white p-2 bg-gray-800 dark:bg-gray-900 rounded-md w-full max-h-full overflow-y-auto">
            <p className="mt-2 whitespace-pre-wrap">{document.content}</p>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Suggested Title
        </label>
        <input
          type="text"
          value={suggestion.suggested_title || ""}
          onChange={(e) => onTitleChange(suggestion.id, e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
        />
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Tags
          </label>
          <ReactTags
            selected={
              suggestion.suggested_tags?.map((tag, index) => ({
                id: index.toString(),
                name: tag,
                label: tag,
                value: index.toString(),
              })) || []
            }
            suggestions={sortedAvailableTags.map((tag) => ({
              id: tag.id,
              name: tag.name,
              label: tag.name,
              value: tag.id,
            }))}
            onAdd={(tag) =>
              onTagAddition(suggestion.id, {
                id: String(tag.value),
                name: String(tag.label),
              })
            }
            onDelete={(index) => onTagDeletion(suggestion.id, index)}
            allowNew={true}
            placeholderText="Add a tag"
            classNames={{
              root: "react-tags dark:bg-gray-800",
              rootIsActive: "is-active",
              rootIsDisabled: "is-disabled",
              rootIsInvalid: "is-invalid",
              label: "react-tags__label",
              tagList: "react-tags__list",
              tagListItem: "react-tags__list-item",
              tag: "react-tags__tag dark:bg-blue-900 dark:text-blue-200",
              tagName: "react-tags__tag-name",
              comboBox: "react-tags__combobox dark:bg-gray-700 dark:text-gray-200",
              input: "react-tags__combobox-input dark:bg-gray-700 dark:text-gray-200",
              listBox: "react-tags__listbox dark:bg-gray-700 dark:text-gray-200",
              option: "react-tags__listbox-option dark:bg-gray-700 dark:text-gray-200 hover:bg-blue-500 dark:hover:bg-blue-800",
              optionIsActive: "is-active",
              highlight: "react-tags__highlight dark:bg-gray-800",
            }}
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Correspondent
          </label>
          <input
            type="text"
            value={suggestion.suggested_correspondent || ""}
            onChange={(e) => onCorrespondentChange(suggestion.id, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Correspondent"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Document Type
          </label>
          <input
            type="text"
            value={suggestion.suggested_document_type || ""}
            onChange={(e) => onDocumentTypeChange(suggestion.id, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Document Type"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Created Date
          </label>
          <input
            type="text"
            value={suggestion.suggested_created_date || ""}
            onChange={(e) => onCreatedDateChange(suggestion.id, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Created Date"
          />
        </div>
        {suggestion.suggested_custom_fields && suggestion.suggested_custom_fields.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Suggested Custom Fields
            </label>
            <div className="mt-2 space-y-2">
              {suggestion.suggested_custom_fields?.map((field) => (
                <div key={field.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`custom-field-${suggestion.id}-${field.id}`}
                    checked={field.isSelected}
                    onChange={() => onCustomFieldSuggestionToggle(suggestion.id, field.id)}
                    className="w-4 h-4 mr-2"
                  />
                  <label htmlFor={`custom-field-${suggestion.id}-${field.id}`} className="text-sm">
                    <span className="font-semibold">{field.name}:</span> {String(field.value)}
                  </label>
                </div>
              )) || []}
            </div>
          </div>
        )}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Jobber Match
            </label>
            <select
              value={suggestion.selected_jobber_match_id || ""}
                onChange={(e) => onJobberMatchChange(suggestion.id, e.target.value)}
              disabled={!jobberConnected || !suggestion.jobber_candidates?.length}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-60"
            >
              <option value="">
                {!jobberConnected
                  ? "Connect Jobber in Settings"
                  : suggestion.jobber_candidates?.length
                    ? "No Jobber match"
                    : "No Jobber matches found"}
              </option>
              {suggestion.jobber_candidates?.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.job_number} - {candidate.client_name} - {candidate.job_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id={`google-drive-${suggestion.id}`}
              checked={suggestion.upload_to_google_drive ?? false}
              disabled={!googleDriveConnected}
              onChange={(e) => onGoogleDriveToggle(suggestion.id, e.target.checked)}
              className="w-4 h-4 mt-1"
            />
            <div>
              <label
                htmlFor={`google-drive-${suggestion.id}`}
                className="font-medium text-gray-700 dark:text-gray-300"
              >
                Upload to Google Drive
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {!googleDriveConnected
                  ? "Connect Google Drive in Settings to enable uploads."
                  : "Uploads the approved Paperless file to the configured folder."}
              </p>
            </div>
          </div>

          {(integrationResult?.jobber_applied ||
            integrationResult?.jobber_error ||
            integrationResult?.google_drive_uploaded ||
            integrationResult?.google_drive_error) && (
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3 text-sm">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Last apply result</h4>
              {integrationResult?.jobber_applied && (
                <p className="mt-1 text-green-700 dark:text-green-300">Jobber fields saved to Paperless.</p>
              )}
              {integrationResult?.jobber_error && (
                <p className="mt-1 text-red-700 dark:text-red-300">Jobber: {integrationResult.jobber_error}</p>
              )}
              {integrationResult?.google_drive_uploaded && (
                <p className="mt-1 text-green-700 dark:text-green-300">
                  Google Drive upload completed
                  {integrationResult.google_drive_url ? (
                    <>
                      {" "}
                      <a
                        className="underline"
                        href={integrationResult.google_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open file
                      </a>
                    </>
                  ) : "."}
                </p>
              )}
              {integrationResult?.google_drive_error && (
                <p className="mt-1 text-red-700 dark:text-red-300">
                  Google Drive: {integrationResult.google_drive_error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestionCard;
