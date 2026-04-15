import React, { useState } from "react";
import ArrowTopRightOnSquareIcon from "@heroicons/react/24/outline/ArrowTopRightOnSquareIcon";
import EyeIcon from "@heroicons/react/24/outline/EyeIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import { ReactTags } from "react-tag-autocomplete";
import { DocumentSuggestion, TagOption } from "../DocumentProcessor";
import DocumentPreviewModal from "./DocumentPreviewModal";

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
  paperlessUrl,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
    <>
      <div className="relative flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            Preview
          </button>
          {paperlessUrl && (
            <a
              href={`${paperlessUrl}/documents/${suggestion.id}/details`}
              target="_blank"
              rel="noopener noreferrer"
              title="View in Paperless-ngx"
              className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              View
            </a>
          )}
          {onDelete &&
            (confirmDelete ? (
              <>
                <button
                  onClick={handleDeleteClick}
                  title="Confirm delete"
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Sure?
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  title="Cancel"
                  className="rounded-md bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteClick}
                title="Delete document"
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </button>
            ))}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {document.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {document.content.length > 120
              ? `${document.content.substring(0, 120)}...`
              : document.content || "No OCR text available yet."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {document.tags.length > 0 ? (
              document.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                No tags yet
              </span>
            )}
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
            className="mt-2 w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
                      className="mr-2 h-4 w-4"
                    />
                    <label
                      htmlFor={`custom-field-${suggestion.id}-${field.id}`}
                      className="text-sm"
                    >
                      <span className="font-semibold">{field.name}:</span>{" "}
                      {String(field.value)}
                    </label>
                  </div>
                )) || []}
              </div>
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={document.title}
        content={document.content}
        correspondent={document.correspondent}
        tags={document.tags}
      />
    </>
  );
};

export default SuggestionCard;
