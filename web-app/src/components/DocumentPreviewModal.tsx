import { Dialog, DialogTitle, Transition } from "@headlessui/react";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import React, { Fragment } from "react";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  correspondent?: string;
  tags?: string[];
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  correspondent,
  tags = [],
}) => (
  <Transition show={isOpen} as={Fragment}>
    <Dialog
      as="div"
      className="fixed inset-0 z-20 overflow-y-auto"
      open={isOpen}
      onClose={onClose}
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/70" />
        </Transition.Child>

        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <Dialog.Panel className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </DialogTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  {correspondent && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      Correspondent: {correspondent}
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close preview"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-200">
                {content || "No OCR text available for this document yet."}
              </p>
            </div>

            <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Close preview
              </button>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
);

export default DocumentPreviewModal;
