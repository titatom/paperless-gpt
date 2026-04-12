import React, { useState } from "react";
import ArrowTopRightOnSquareIcon from "@heroicons/react/24/outline/ArrowTopRightOnSquareIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import { Document } from "../DocumentProcessor";

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: (documentId: number) => void;
  paperlessUrl?: string;
  onDelete?: (documentId: number) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  isSelected,
  onSelect,
  paperlessUrl,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete && onDelete(document.id);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <div
      className={`document-card bg-white dark:bg-gray-800 shadow-lg shadow-blue-500/50 rounded-md p-4 relative group overflow-hidden cursor-pointer ${isSelected ? "ring-2 ring-blue-500" : ""}`}
      onClick={() => onSelect && onSelect(document.id)}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(document.id)}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 h-6 w-6 z-10"
        />
      )}

      <div className="flex items-center gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
        {paperlessUrl && (
          <a
            href={`${paperlessUrl}/documents/${document.id}/details`}
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
                onClick={handleCancelDelete}
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

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{document.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 truncate">
        {document.content.length > 100
          ? `${document.content.substring(0, 100)}...`
          : document.content}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        Correspondent:{" "}
        <span className="font-bold text-blue-600 dark:text-blue-400">{document.correspondent}</span>
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
      <div className="absolute inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 rounded-md pointer-events-none">
        <div className="text-sm text-white p-2 bg-gray-800 dark:bg-gray-900 rounded-md w-full max-h-full overflow-y-auto">
          <h3 className="text-lg font-semibold text-white">{document.title}</h3>
          <p className="mt-2 whitespace-pre-wrap">{document.content}</p>
          <p className="mt-2">
            Correspondent:{" "}
            <span className="font-bold text-blue-400">{document.correspondent}</span>
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
      </div>
    </div>
  );
};

export default DocumentCard;
