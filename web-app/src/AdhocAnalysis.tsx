import React, { useEffect, useState } from "react";
import axios from "axios";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import { AxiosError } from "axios";
import { Document } from "./DocumentProcessor";
import DocumentsToProcess from "./components/DocumentsToProcess";
import NoDocuments from "./components/NoDocuments";

const AdhocAnalysis: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const [documentsRes, filterTagRes] = await Promise.all([
        axios.get<Document[]>("./api/documents"),
        axios.get<{ tag: string }>("./api/filter-tag"),
      ]);
      setDocuments(documentsRes.data || []);
      setFilterTag(filterTagRes.data.tag);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromptTemplate = async () => {
    try {
      const res = await axios.get<Record<string, string>>("./api/prompts");
      const defaultPrompt = res.data["adhoc-analysis_prompt.tmpl"] || "";
      setPrompt(defaultPrompt);
      setOriginalPrompt(defaultPrompt);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchPromptTemplate();
  }, []);

  const handleSelectDocument = (docId: number) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAll = () => {
    setSelectedDocuments(documents.map((doc) => doc.id));
  };

  const handleSelectNone = () => {
    setSelectedDocuments([]);
  };

  const handleStartAnalysis = async () => {
    try {
      setProcessing(true);
      setError("");
      setAnalysisResult("");
      const res = await axios.post<{ result: string }>("./api/analyze-documents", {
        document_ids: selectedDocuments,
        prompt,
      });
      setAnalysisResult(res.data.result);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      setError(
        axiosError.response?.data?.error ||
          axiosError.message ||
          "An unknown error occurred."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 text-gray-800 dark:text-gray-200">
      <header className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Analysis
            </p>
            <h1 className="mt-2 text-4xl font-bold text-gray-900 dark:text-gray-100">
              Ad-hoc Analysis
            </h1>
            <p className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">
              Run one-off prompts against selected Paperless documents and review
              the generated analysis before taking any follow-up action.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Documents</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {documents.length}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Selected</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedDocuments.length}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Filter tag</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {filterTag || "No filter tag configured"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Documents to Analyze
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Select the documents you want to include in this analysis run.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fetchDocuments}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  Reload
                </button>
                <button
                  onClick={handleSelectAll}
                  className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Select None
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[18rem] items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <NoDocuments
                filterTag={filterTag}
                onReload={fetchDocuments}
                processing={processing}
              />
            ) : (
              <DocumentsToProcess
                documents={documents}
                selectedDocuments={selectedDocuments}
                onSelectDocument={handleSelectDocument}
                gridCols="3"
              />
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Analysis Prompt
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Tailor the prompt for this run, or reset back to the saved default.
              </p>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-64 w-full rounded-2xl border border-gray-300 bg-gray-50 p-4 text-sm leading-6 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setPrompt(originalPrompt)}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Reset to Default
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={processing || selectedDocuments.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {processing ? "Analyzing..." : "Start Analysis"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Analysis Result
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Results appear here after the analysis request finishes.
            </p>
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                !analysisResult && !error
                  ? "border-dashed border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
              }`}
            >
              {error ? (
                <pre className="whitespace-pre-wrap text-red-500 dark:text-red-300">
                  {error}
                </pre>
              ) : analysisResult ? (
                <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-100">
                  {analysisResult}
                </pre>
              ) : (
                <p>Start analysis to show results.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdhocAnalysis;
