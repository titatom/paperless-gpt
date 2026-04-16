import { ArrowPathIcon } from "@heroicons/react/24/outline";
import React from "react";

interface NoDocumentsProps {
  filterTag: string | null;
  onReload: () => void;
  processing: boolean;
}

const NoDocuments: React.FC<NoDocumentsProps> = ({
  filterTag,
  onReload,
  processing,
}) => (
  <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
    <div className="mx-auto max-w-2xl">
      <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
        Queue status
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        No documents are ready right now
      </h2>
      <p className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">
        {filterTag ? (
          <>
            This view only shows documents tagged with{" "}
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {filterTag}
            </span>
            . Matching documents will appear here automatically as they arrive.
          </>
        ) : (
          <>
            This view only shows documents that match your current Paperless GPT
            workflow. No filter tag is configured right now, so newly imported
            documents should appear here once they are available.
          </>
        )}
      </p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Check Paperless</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Confirm new documents were imported and tagged for this workflow.
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Refresh the queue</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Reload manually if you just added or retagged documents.
          </p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Automatic polling</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            The page keeps checking for new documents every few seconds.
          </p>
        </div>
      </div>
      <button
        onClick={onReload}
        disabled={processing}
        className="mt-8 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-800"
      >
        Reload documents
        <ArrowPathIcon className="ml-2 h-5 w-5" />
      </button>
    </div>
  </div>
);

export default NoDocuments;