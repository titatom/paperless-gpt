package main

import (
	"testing"
	"time"
)

func TestJobberMatchCandidateDisplayLabel(t *testing.T) {
	candidate := JobberMatchCandidate{
		JobNumber:  "1109",
		ClientName: "Paul Remy",
		JobName:    "Untitled job",
	}

	got := candidate.DisplayLabel()
	want := "#1109 - Paul Remy - Untitled job"
	if got != want {
		t.Fatalf("DisplayLabel() = %q, want %q", got, want)
	}
}

func TestRankJobberCandidatesPrefersJobNumberClientAndTitleMatches(t *testing.T) {
	document := Document{
		Title:            "Paint receipt for job 1107",
		Content:          "Materials purchased for Imene Benaissa and peinture retouche.",
		Correspondent:    "Benjamin Moore",
		DocumentTypeName: "Receipt",
	}

	candidates := []JobberMatchCandidate{
		{
			ID:         "job-1",
			JobNumber:  "1103",
			ClientName: "Monica Bialobrzeski",
			JobName:    "Hardwood floor restauration estimate",
		},
		{
			ID:         "job-2",
			JobNumber:  "1107",
			ClientName: "Imene Benaissa",
			JobName:    "Retouche de peinture et travaux divers",
		},
	}

	ranked := rankJobberCandidates(document, candidates)
	if len(ranked) != 2 {
		t.Fatalf("expected 2 ranked candidates, got %d", len(ranked))
	}

	if ranked[0].ID != "job-2" {
		t.Fatalf("expected best ranked candidate to be job-2, got %s", ranked[0].ID)
	}
}

func TestIssueAndConsumeReceiptAccessToken(t *testing.T) {
	db, err := InitializeTestDB()
	if err != nil {
		t.Fatalf("InitializeTestDB() error = %v", err)
	}

	service := NewIntegrationsService(db)
	token, err := service.IssueReceiptAccessToken(t.Context(), 42, time.Minute)
	if err != nil {
		t.Fatalf("IssueReceiptAccessToken() error = %v", err)
	}
	if token.Token == "" {
		t.Fatal("expected non-empty token")
	}

	record, err := service.ConsumeReceiptAccessToken(t.Context(), token.Token)
	if err != nil {
		t.Fatalf("ConsumeReceiptAccessToken() error = %v", err)
	}
	if record.DocumentID != 42 {
		t.Fatalf("expected document ID 42, got %d", record.DocumentID)
	}

	record2, err := service.ConsumeReceiptAccessToken(t.Context(), token.Token)
	if err != nil {
		t.Fatalf("second ConsumeReceiptAccessToken() error = %v", err)
	}
	if record2.DocumentID != 42 {
		t.Fatalf("expected second lookup document ID 42, got %d", record2.DocumentID)
	}
}

func TestResolveJobberExpenseFieldValuePrefersSuggestedBuiltInFields(t *testing.T) {
	suggestion := DocumentSuggestion{
		SuggestedTitle:         "Approved receipt title",
		SuggestedCorrespondent: "Approved vendor",
		SuggestedDocumentType:  "Receipt",
		OriginalDocument: Document{
			Title:            "Original title",
			Correspondent:    "Original vendor",
			DocumentTypeName: "Invoice",
		},
	}

	title, ok := resolveJobberExpenseFieldValue(suggestion, paperlessFieldRefDocumentTitle)
	if !ok || title != "Approved receipt title" {
		t.Fatalf("expected suggested title, got %#v (ok=%v)", title, ok)
	}

	correspondent, ok := resolveJobberExpenseFieldValue(suggestion, paperlessFieldRefDocumentCorrespondent)
	if !ok || correspondent != "Approved vendor" {
		t.Fatalf("expected suggested correspondent, got %#v (ok=%v)", correspondent, ok)
	}

	documentType, ok := resolveJobberExpenseFieldValue(suggestion, paperlessFieldRefDocumentType)
	if !ok || documentType != "Receipt" {
		t.Fatalf("expected suggested document type, got %#v (ok=%v)", documentType, ok)
	}
}

func TestResolveJobberExpenseFieldValueSupportsCustomFieldReferences(t *testing.T) {
	suggestion := DocumentSuggestion{
		SuggestedCustomFields: []CustomFieldSuggestion{
			{ID: 17, Name: "Total", Value: "123.45"},
		},
		OriginalDocument: Document{
			CustomFields: []CustomFieldResponse{
				{Field: 19, Value: "fallback"},
			},
		},
	}

	value, ok := resolveJobberExpenseFieldValue(suggestion, customFieldReference(17))
	if !ok || value != "123.45" {
		t.Fatalf("expected suggested custom field value, got %#v (ok=%v)", value, ok)
	}

	value, ok = resolveJobberExpenseFieldValue(suggestion, customFieldReference(19))
	if !ok || value != "fallback" {
		t.Fatalf("expected original custom field fallback, got %#v (ok=%v)", value, ok)
	}
}

func TestDeriveJobberExpenseDateUsesMappedField(t *testing.T) {
	suggestion := DocumentSuggestion{
		SuggestedCreatedDate: "2026-04-15",
	}

	got, err := deriveJobberExpenseDate(suggestion, paperlessFieldRefDocumentCreatedDate)
	if err != nil {
		t.Fatalf("deriveJobberExpenseDate() error = %v", err)
	}
	if got != "2026-04-15T00:00:00Z" {
		t.Fatalf("deriveJobberExpenseDate() = %q, want %q", got, "2026-04-15T00:00:00Z")
	}
}

func TestDeriveJobberExpenseTotalUsesMappedField(t *testing.T) {
	suggestion := DocumentSuggestion{
		SuggestedCustomFields: []CustomFieldSuggestion{
			{ID: 21, Name: "Amount", Value: "$456.78"},
		},
	}

	got, ok := deriveJobberExpenseTotal(suggestion, customFieldReference(21))
	if !ok {
		t.Fatal("expected mapped total to be detected")
	}
	if got != 456.78 {
		t.Fatalf("deriveJobberExpenseTotal() = %v, want %v", got, 456.78)
	}
}
