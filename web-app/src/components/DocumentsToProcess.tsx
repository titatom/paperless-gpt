import React from "react";
import { Document } from "../DocumentProcessor";
import DocumentCard from "./DocumentCard";

export interface DocumentsToProcessProps {
  documents: Document[];
  // Optional props for selection
  selectedDocuments?: number[];
  onSelectDocument?: (documentId: number) => void;
  // Optional prop for grid layout
  gridCols?: string;
  children?: React.ReactNode;
  paperlessUrl?: string;
  onDeleteDocument?: (documentId: number) => void;
}

const DocumentsToProcess: React.FC<DocumentsToProcessProps> = ({
  documents,
  selectedDocuments,
  onSelectDocument,
  gridCols = "1 md:grid-cols-2",
  children,
  paperlessUrl,
  onDeleteDocument,
}) => (
  <section>
    {children}
    <div className={`grid grid-cols-${gridCols} gap-4`}>
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          isSelected={selectedDocuments?.includes(doc.id)}
          onSelect={() => onSelectDocument && onSelectDocument(doc.id)}
          paperlessUrl={paperlessUrl}
          onDelete={onDeleteDocument}
        />
      ))}
    </div>
  </section>
);

export default DocumentsToProcess;
