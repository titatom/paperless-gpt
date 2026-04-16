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
