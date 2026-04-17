package main

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	jobCancellersMu sync.Mutex
	jobCancellers   = make(map[string]context.CancelFunc)

	reOcrCancellersMu sync.Mutex
	reOcrCancellers   = make(map[string]context.CancelFunc)
)

// Job represents an OCR job
type Job struct {
	ID         string
	DocumentID int
	Status     string // "pending", "in_progress", "completed", "failed", "cancelled"
	Result     string // OCR result (combined text) or error message
	CreatedAt  time.Time
	UpdatedAt  time.Time
	PagesDone  int        // Number of pages processed
	TotalPages int        // Total number of pages in the document
	Options    OCROptions // OCR processing options
}

// JobStore manages jobs and their statuses
type JobStore struct {
	sync.RWMutex
	jobs map[string]*Job
}

var (
	jobStore = &JobStore{
		jobs: make(map[string]*Job),
	}
	jobQueue = make(chan *Job, 100) // Buffered channel with capacity of 100 jobs
)

func generateJobID() string {
	return uuid.New().String()
}

func (store *JobStore) addJob(job *Job) {
	store.Lock()
	defer store.Unlock()
	job.PagesDone = 0 // Initialize PagesDone to 0
	store.jobs[job.ID] = job
	log.Infof("Job added: %v", job)
}

func (store *JobStore) getJob(jobID string) (*Job, bool) {
	store.RLock()
	defer store.RUnlock()
	job, exists := store.jobs[jobID]
	return job, exists
}

func (store *JobStore) GetAllJobs() []*Job {
	store.RLock()
	defer store.RUnlock()

	jobs := make([]*Job, 0, len(store.jobs))
	for _, job := range store.jobs {
		jobs = append(jobs, job)
	}

	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].CreatedAt.After(jobs[j].CreatedAt)
	})

	return jobs
}

func (store *JobStore) updateJobStatus(jobID, status, result string) {
	store.Lock()
	defer store.Unlock()
	if job, exists := store.jobs[jobID]; exists {
		job.Status = status
		if result != "" {
			job.Result = result
		}
		job.UpdatedAt = time.Now()
		log.Infof("Job status updated: %v", job)
	}
}

func (store *JobStore) updatePagesDone(jobID string, pagesDone int) {
	store.Lock()
	defer store.Unlock()
	if job, exists := store.jobs[jobID]; exists {
		job.PagesDone = pagesDone
		job.UpdatedAt = time.Now()
		log.Infof("Job pages done updated: %v", job)
	}
}

// jobTTL is how long completed/failed/cancelled jobs are kept in memory before eviction.
const jobTTL = 2 * time.Hour

// evictOldJobs removes terminal jobs that are older than jobTTL.
func (store *JobStore) evictOldJobs() {
	store.Lock()
	defer store.Unlock()
	cutoff := time.Now().Add(-jobTTL)
	for id, job := range store.jobs {
		terminal := job.Status == "completed" || job.Status == "failed" || job.Status == "cancelled"
		if terminal && job.UpdatedAt.Before(cutoff) {
			delete(store.jobs, id)
			log.Debugf("Evicted old job %s (status: %s, updated: %s)", id, job.Status, job.UpdatedAt)
		}
	}
}

func startWorkerPool(app *App, numWorkers int, serverCtx context.Context) {
	for i := 0; i < numWorkers; i++ {
		go func(workerID int) {
			log.Infof("Worker %d started", workerID)
			for {
				select {
				case <-serverCtx.Done():
					log.Infof("Worker %d shutting down", workerID)
					return
				case job, ok := <-jobQueue:
					if !ok {
						return
					}
					log.Infof("Worker %d processing job: %s", workerID, job.ID)
					processJob(app, job, serverCtx)
				}
			}
		}(i)
	}

	// Periodically evict old terminal jobs to prevent unbounded memory growth.
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-serverCtx.Done():
				return
			case <-ticker.C:
				jobStore.evictOldJobs()
			}
		}
	}()
}

func processJob(app *App, job *Job, serverCtx context.Context) {
	jobStore.updateJobStatus(job.ID, "in_progress", "")

	jobCtx, cancel := context.WithCancel(serverCtx)
	jobCancellersMu.Lock()
	jobCancellers[job.ID] = cancel
	jobCancellersMu.Unlock()
	defer func() {
		cancel()
		jobCancellersMu.Lock()
		delete(jobCancellers, job.ID)
		jobCancellersMu.Unlock()
	}()

	// Delete old OCR page results for this document before starting new OCR
	if err := DeleteOcrPageResults(app.Database, job.DocumentID); err != nil {
		log.Errorf("Failed to delete old OCR page results for document %d: %v", job.DocumentID, err)
		// Continue processing even if deletion fails
	}

	// Create OCR options from job options or app defaults
	options := job.Options
	if (options == OCROptions{}) {
		// Use app defaults if job options are not set
		options = OCROptions{
			UploadPDF:       app.pdfUpload,
			ReplaceOriginal: app.pdfReplace,
			CopyMetadata:    app.pdfCopyMetadata,
			LimitPages:      limitOcrPages,
		}
	}

	processedDoc, err := app.ProcessDocumentOCR(jobCtx, job.DocumentID, options, job.ID)
	if err != nil {
		if jobCtx.Err() == context.Canceled {
			jobStore.updateJobStatus(job.ID, "cancelled", "Job cancelled by user")
			log.Infof("Job cancelled: %s", job.ID)
		} else {
			log.Errorf("Error processing document OCR for job %s: %v", job.ID, err)
			jobStore.updateJobStatus(job.ID, "failed", err.Error())
		}
		return
	}
	if processedDoc == nil {
		log.Infof("OCR processing skipped for job %s (document %d)", job.ID, job.DocumentID)
		jobStore.updateJobStatus(job.ID, "completed", "Skipped (already processed or other reason)")
		return
	}

	jobStore.updateJobStatus(job.ID, "completed", processedDoc.Text)
	log.Infof("Job completed: %s", job.ID)
}
