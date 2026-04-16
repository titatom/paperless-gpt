package main

import "testing"

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
