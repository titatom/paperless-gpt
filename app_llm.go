package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "image/jpeg"

	"github.com/sirupsen/logrus"
	"github.com/tmc/langchaingo/llms"
)

func (app *App) generateTaskContent(ctx context.Context, task string, prompt string, logger *logrus.Entry) (*llms.ContentResponse, error) {
	llm, model, err := app.getLLMForTask(ctx, task)
	if err != nil {
		return nil, err
	}
	if logger != nil && model != "" {
		logger.WithFields(logrus.Fields{"task": task, "model": model}).Debug("Using AI model for suggestion task")
	}
	return llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{
				llms.TextContent{
					Text: prompt,
				},
			},
			Role: llms.ChatMessageTypeHuman,
		},
	})
}

// llmYearFirstDateRegexp matches a year-first date (YYYY-M-D, YYYY/M/D, or
// YYYY.M.D). Year-first dates are unambiguous and always win over other
// formats, so we search for them first. Both separators are captured and must
// be identical (verified in code, since RE2 has no backreferences).
var llmYearFirstDateRegexp = regexp.MustCompile(`\b(\d{4})([-/.])(\d{1,2})([-/.])(\d{1,2})\b`)

// llmDayFirstDateRegexp matches a day-first or month-first date
// (D-M-YYYY, D.M.YYYY, D/M/YYYY, or M-D-YYYY, etc.). Both separators are
// captured and must be identical (verified in code, since RE2 has no
// backreferences). Ambiguity is resolved below based on the magnitude of the
// components and the separator used.
var llmDayFirstDateRegexp = regexp.MustCompile(`\b(\d{1,2})([-/.])(\d{1,2})([-/.])(\d{4})\b`)

// llmTextualDateRegexp matches dates written with textual month names, in
// either "5 October 2023", "5th October 2023", "October 5, 2023", or
// "Oct 5, 2023" style. It also tolerates trailing periods on abbreviations
// (e.g. "Oct. 5, 2023") and optional ordinal suffixes.
var llmTextualDateRegexp = regexp.MustCompile(`(?i)\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s+(\d{4})|([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4}))\b`)

// createdDateRetryInstruction is appended to the prompt when the first LLM
// response for the created date task cannot be parsed. Tokens for it are
// reserved up front so the retry prompt also stays within the token limit.
const createdDateRetryInstruction = "\n\nRespond with ONLY the date in YYYY-MM-DD format. Do not include any other text, punctuation, or formatting."

// monthNumber converts an English month name or abbreviation (case-insensitive,
// with or without a trailing period) to its 1-based month number, or 0 if the
// name is not a recognized month.
func monthNumber(name string) int {
	switch strings.ToLower(strings.TrimSuffix(name, ".")) {
	case "jan", "january":
		return 1
	case "feb", "february":
		return 2
	case "mar", "march":
		return 3
	case "apr", "april":
		return 4
	case "may":
		return 5
	case "jun", "june":
		return 6
	case "jul", "july":
		return 7
	case "aug", "august":
		return 8
	case "sep", "sept", "september":
		return 9
	case "oct", "october":
		return 10
	case "nov", "november":
		return 11
	case "dec", "december":
		return 12
	}
	return 0
}

// buildCandidate formats and validates a year/month/day triple into the strict
// YYYY-MM-DD string expected by the HTML <input type="date"> control, or ""
// if the combination is not a valid calendar date.
func buildCandidate(year string, month int, day int) string {
	if month < 1 || month > 12 || day < 1 || day > 31 {
		return ""
	}
	candidate := fmt.Sprintf("%s-%02d-%02d", year, month, day)
	if _, err := time.Parse("2006-01-02", candidate); err != nil {
		return ""
	}
	return candidate
}

// normalizeSuggestedCreatedDate cleans up an LLM date response and returns a
// strict YYYY-MM-DD string, or "" if no valid date could be extracted.
//
// LLMs frequently violate "respond only with YYYY-MM-DD" by wrapping the
// answer in code fences, prose, quotes, or trailing punctuation; or by using
// non-zero-padded months/days, alternative separators (- / .), day-first or
// month-first ordering, or textual month names. The HTML <input type="date">
// control silently ignores any value that isn't a strict YYYY-MM-DD, so we
// have to normalize before handing it to the front-end.
//
// Disambiguation rules for numeric dates:
//   - Year-first (e.g. 2023-05-10) always wins: it is unambiguous.
//   - If the first component is > 12 it must be a day, so we treat the date
//     as day-first (e.g. 31/12/2023).
//   - If the second component is > 12 it must be a day, so we treat the date
//     as month-first (e.g. 10/25/2023).
//   - If both components are <= 12 the date is ambiguous. We prefer day-first
//     for slash and dot separators (European style, e.g. 05/10/2023 or
//     05.10.2023) and month-first for dash separators (e.g. 05-10-2023).
func normalizeSuggestedCreatedDate(raw string) string {
	cleaned := stripReasoning(raw)
	cleaned = stripMarkdown(cleaned)
	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.Trim(cleaned, "\"'`")

	// 1. Year-first (ISO-like) dates always win over other formats.
	for _, match := range llmYearFirstDateRegexp.FindAllStringSubmatch(cleaned, -1) {
		if match[2] != match[4] {
			// Mixed separators (e.g. "2023-05/10") are not a date.
			continue
		}
		month, _ := strconv.Atoi(match[3])
		day, _ := strconv.Atoi(match[5])
		if candidate := buildCandidate(match[1], month, day); candidate != "" {
			return candidate
		}
	}

	// 2. Day-first / month-first numeric dates.
	for _, match := range llmDayFirstDateRegexp.FindAllStringSubmatch(cleaned, -1) {
		if match[2] != match[4] {
			// Mixed separators (e.g. "12-15/2023") are not a date.
			continue
		}
		first, _ := strconv.Atoi(match[1])
		second, _ := strconv.Atoi(match[3])
		separator := match[2]

		var day, month int
		switch {
		case first > 12 && second <= 12:
			// First component can only be a day.
			day, month = first, second
		case second > 12 && first <= 12:
			// Second component can only be a day, so the first is the month.
			day, month = second, first
		case first <= 12 && second <= 12:
			// Genuinely ambiguous: prefer day-first for slash/dot separators
			// (European style) and month-first for dashes.
			if separator == "/" || separator == "." {
				day, month = first, second
			} else {
				day, month = second, first
			}
		default:
			// Both components > 12: neither can be a month.
			continue
		}

		if candidate := buildCandidate(match[5], month, day); candidate != "" {
			return candidate
		}
	}

	// 3. Textual month-name dates ("5 October 2023", "October 5, 2023", ...).
	for _, match := range llmTextualDateRegexp.FindAllStringSubmatch(cleaned, -1) {
		var day, month, year string
		if match[1] != "" {
			// "5 October 2023" / "5th October 2023" shape.
			day, month, year = match[1], strconv.Itoa(monthNumber(match[2])), match[3]
		} else {
			// "October 5, 2023" / "Oct 5, 2023" shape.
			month, day, year = strconv.Itoa(monthNumber(match[4])), match[5], match[6]
		}
		m, _ := strconv.Atoi(month)
		d, _ := strconv.Atoi(day)
		if m == 0 {
			// The word we captured was not actually a month name; keep looking.
			continue
		}
		if candidate := buildCandidate(year, m, d); candidate != "" {
			return candidate
		}
	}

	return ""
}

// getSuggestedCorrespondent generates a suggested correspondent for a document using the LLM
func (app *App) getSuggestedCorrespondent(ctx context.Context, content string, suggestedTitle string, availableCorrespondents []string, correspondentBlackList []string) (string, error) {
	likelyLanguage := getLikelyLanguage()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	// Get available tokens for content
	templateData := map[string]interface{}{
		"Language":                likelyLanguage,
		"AvailableCorrespondents": availableCorrespondents,
		"BlackList":               correspondentBlackList,
		"Title":                   suggestedTitle,
	}

	availableTokens, err := getAvailableTokensForContent(correspondentTemplate, templateData)
	if err != nil {
		return "", fmt.Errorf("error calculating available tokens: %v", err)
	}

	// Truncate content if needed
	truncatedContent, err := truncateContentByTokens(content, availableTokens)
	if err != nil {
		return "", fmt.Errorf("error truncating content: %v", err)
	}

	// Execute template with truncated content
	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = correspondentTemplate.Execute(&promptBuffer, templateData)
	if err != nil {
		return "", fmt.Errorf("error executing correspondent template: %v", err)
	}

	prompt := promptBuffer.String()
	log.Debugf("Correspondent suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskCorrespondent, prompt, log.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("error getting response from LLM: %v", err)
	}
	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices for correspondent suggestion")
	}

	response := stripReasoning(strings.TrimSpace(completion.Choices[0].Content))
	return response, nil
}

// getSuggestedTags generates suggested tags for a document using the LLM
func (app *App) getSuggestedTags(
	ctx context.Context,
	content string,
	suggestedTitle string,
	availableTags []string,
	originalTags []string,
	logger *logrus.Entry) ([]string, error) {
	likelyLanguage := getLikelyLanguage()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	// Remove all paperless-gpt related tags from available tags
	availableTags = removeTagFromList(availableTags, manualTag)
	availableTags = removeTagFromList(availableTags, autoTag)
	availableTags = removeTagFromList(availableTags, autoOcrTag)

	// Determine effective createNewTags value (false if restricted by settings)
	settingsMutex.RLock()
	effectiveCreateNewTags := createNewTags && !settings.RestrictTagsToExisting
	settingsMutex.RUnlock()

	// Get available tokens for content
	templateData := map[string]interface{}{
		"Language":      likelyLanguage,
		"AvailableTags": availableTags,
		"OriginalTags":  originalTags,
		"Title":         suggestedTitle,
		"CreateNewTags": effectiveCreateNewTags,
	}

	availableTokens, err := getAvailableTokensForContent(tagTemplate, templateData)
	if err != nil {
		logger.Errorf("Error calculating available tokens: %v", err)
		return nil, fmt.Errorf("error calculating available tokens: %v", err)
	}

	// Truncate content if needed
	truncatedContent, err := truncateContentByTokens(content, availableTokens)
	if err != nil {
		logger.Errorf("Error truncating content: %v", err)
		return nil, fmt.Errorf("error truncating content: %v", err)
	}

	// Execute template with truncated content
	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = tagTemplate.Execute(&promptBuffer, templateData)
	if err != nil {
		logger.Errorf("Error executing tag template: %v", err)
		return nil, fmt.Errorf("error executing tag template: %v", err)
	}

	prompt := promptBuffer.String()
	logger.Debugf("Tag suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskTags, prompt, logger)
	if err != nil {
		logger.Errorf("Error getting response from LLM: %v", err)
		return nil, fmt.Errorf("error getting response from LLM: %v", err)
	}
	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices for tag suggestion")
	}

	response := stripReasoning(completion.Choices[0].Content)

	suggestedTags := strings.Split(response, ",")
	for i, tag := range suggestedTags {
		suggestedTags[i] = strings.TrimSpace(tag)
	}

	// append the original tags to the suggested tags
	suggestedTags = append(suggestedTags, originalTags...)
	// Remove duplicates
	slices.Sort(suggestedTags)
	suggestedTags = slices.Compact(suggestedTags)

	// Filter out tags that are not in the available tags list (unless CREATE_NEW_TAGS is enabled and not restricted by settings)
	if effectiveCreateNewTags {
		// When creating new tags is enabled, keep all non-empty suggested tags
		filteredTags := []string{}
		for _, tag := range suggestedTags {
			if tag != "" {
				// Use the available tag's casing if it exists
				matched := false
				for _, availableTag := range availableTags {
					if strings.EqualFold(tag, availableTag) {
						filteredTags = append(filteredTags, availableTag)
						matched = true
						break
					}
				}
				if !matched {
					filteredTags = append(filteredTags, tag)
				}
			}
		}
		return filteredTags, nil
	}

	filteredTags := []string{}
	for _, tag := range suggestedTags {
		for _, availableTag := range availableTags {
			if strings.EqualFold(tag, availableTag) {
				filteredTags = append(filteredTags, availableTag)
				break
			}
		}
	}

	return filteredTags, nil
}

// getSuggestedDocumentType generates a suggested document type for a document using the LLM
func (app *App) getSuggestedDocumentType(
	ctx context.Context,
	content string,
	suggestedTitle string,
	availableDocumentTypes []string,
	logger *logrus.Entry) (string, error) {
	likelyLanguage := getLikelyLanguage()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	// Get available tokens for content
	templateData := map[string]interface{}{
		"Language":               likelyLanguage,
		"AvailableDocumentTypes": availableDocumentTypes,
		"Title":                  suggestedTitle,
	}

	availableTokens, err := getAvailableTokensForContent(documentTypeTemplate, templateData)
	if err != nil {
		logger.Errorf("Error calculating available tokens: %v", err)
		return "", fmt.Errorf("error calculating available tokens: %v", err)
	}

	// Truncate content if needed
	truncatedContent, err := truncateContentByTokens(content, availableTokens)
	if err != nil {
		logger.Errorf("Error truncating content: %v", err)
		return "", fmt.Errorf("error truncating content: %v", err)
	}

	// Execute template with truncated content
	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = documentTypeTemplate.Execute(&promptBuffer, templateData)
	if err != nil {
		logger.Errorf("Error executing document type template: %v", err)
		return "", fmt.Errorf("error executing document type template: %v", err)
	}

	prompt := promptBuffer.String()
	logger.Debugf("Document type suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskDocumentType, prompt, logger)
	if err != nil {
		logger.Errorf("Error getting response from LLM: %v", err)
		return "", fmt.Errorf("error getting response from LLM: %v", err)
	}
	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices for document type suggestion")
	}

	response := strings.TrimSpace(stripReasoning(completion.Choices[0].Content))

	// Validate that the response is in the available document types list
	for _, docType := range availableDocumentTypes {
		if strings.EqualFold(response, docType) {
			return docType, nil // Return the exact name from available types
		}
	}

	// If not found in available types, return empty string
	if response != "" {
		logger.Warnf("LLM suggested document type '%s' not found in available types, ignoring", response)
	}
	return "", nil
}

// getSuggestedTitle generates a suggested title for a document using the LLM
func (app *App) getSuggestedTitle(ctx context.Context, content string, originalTitle string, logger *logrus.Entry) (string, error) {
	likelyLanguage := getLikelyLanguage()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	// Get available tokens for content
	templateData := map[string]interface{}{
		"Language": likelyLanguage,
		"Content":  content,
		"Title":    originalTitle,
	}

	availableTokens, err := getAvailableTokensForContent(titleTemplate, templateData)
	if err != nil {
		logger.Errorf("Error calculating available tokens: %v", err)
		return "", fmt.Errorf("error calculating available tokens: %v", err)
	}

	// Truncate content if needed
	truncatedContent, err := truncateContentByTokens(content, availableTokens)
	if err != nil {
		logger.Errorf("Error truncating content: %v", err)
		return "", fmt.Errorf("error truncating content: %v", err)
	}

	// Execute template with truncated content
	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = titleTemplate.Execute(&promptBuffer, templateData)

	if err != nil {
		return "", fmt.Errorf("error executing title template: %v", err)
	}

	prompt := promptBuffer.String()
	logger.Debugf("Title suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskTitle, prompt, logger)
	if err != nil {
		return "", fmt.Errorf("error getting response from LLM: %v", err)
	}
	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices for title suggestion")
	}
	result := stripReasoning(completion.Choices[0].Content)
	return strings.TrimSpace(strings.Trim(result, "\"")), nil
}

// getSuggestedCreatedDate generates a suggested createdDate for a document using the LLM
func (app *App) getSuggestedCreatedDate(ctx context.Context, title string, content string, logger *logrus.Entry) (string, error) {
	likelyLanguage := getLikelyLanguage()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	// Get available tokens for content
	templateData := map[string]interface{}{
		"Language": likelyLanguage,
		"Title":    title,
		"Content":  content,
		"Today":    getTodayDate(), // must be in YYYY-MM-DD format
	}

	availableTokens, err := getAvailableTokensForContent(createdDateTemplate, templateData)
	if err != nil {
		logger.Errorf("Error calculating available tokens: %v", err)
		return "", fmt.Errorf("error calculating available tokens: %v", err)
	}

	// Reserve tokens for the retry instruction so that even if we have to ask
	// the LLM again, the retry prompt still fits within the token limit.
	if tokenLimit > 0 {
		if retryTokens, err := getTokenCount(createdDateRetryInstruction); err == nil {
			availableTokens -= retryTokens
			if availableTokens < 0 {
				availableTokens = 0
			}
		}
	}

	// Truncate content if needed
	truncatedContent, err := truncateContentByTokens(content, availableTokens)
	if err != nil {
		logger.Errorf("Error truncating content: %v", err)
		return "", fmt.Errorf("error truncating content: %v", err)
	}

	// Execute template with truncated content
	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = createdDateTemplate.Execute(&promptBuffer, templateData)

	if err != nil {
		return "", fmt.Errorf("error executing createdDate template: %v", err)
	}

	prompt := promptBuffer.String()
	logger.Debugf("CreatedDate suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskCreatedDate, prompt, logger)
	if err != nil {
		return "", fmt.Errorf("error getting response from LLM: %v", err)
	}
	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices for created date suggestion")
	}
	raw := completion.Choices[0].Content
	normalized := normalizeSuggestedCreatedDate(raw)
	if normalized == "" {
		// The first response wasn't parseable; give the model one more shot
		// with a stricter instruction appended to the original prompt.
		logger.Warnf("LLM returned an unparseable created date (%q); retrying with stricter instruction", raw)
		retryPrompt := fmt.Sprintf("%s%s", prompt, createdDateRetryInstruction)
		retryCompletion, err := app.generateTaskContent(ctx, TaskCreatedDate, retryPrompt, logger)
		if err != nil {
			return "", fmt.Errorf("error getting retry response from LLM: %v", err)
		}
		if len(retryCompletion.Choices) == 0 {
			return "", fmt.Errorf("LLM returned no choices for created date suggestion retry")
		}
		retryRaw := retryCompletion.Choices[0].Content
		normalized = normalizeSuggestedCreatedDate(retryRaw)
		if normalized == "" {
			logger.Warnf("LLM returned an unparseable created date on retry; ignoring. Raw response: %q", retryRaw)
		}
	}
	return normalized, nil
}

// getSuggestedCustomFields generates suggested custom fields for a document using the LLM.
// allCustomFields must be pre-fetched by the caller to avoid redundant API calls per document.
func (app *App) getSuggestedCustomFields(ctx context.Context, doc Document, selectedFieldIDs []int, allCustomFields []CustomField, logger *logrus.Entry) ([]CustomFieldSuggestion, error) {
	// Filter to get only the selected custom fields
	var selectedCustomFields []CustomField
	for _, field := range allCustomFields {
		for _, selectedID := range selectedFieldIDs {
			if field.ID == selectedID {
				selectedCustomFields = append(selectedCustomFields, field)
				break
			}
		}
	}

	if len(selectedCustomFields) == 0 {
		return nil, nil // No fields to process
	}

	// Generate XML for the prompt
	var xmlBuilder strings.Builder
	xmlBuilder.WriteString("<custom_fields>\n")
	for _, field := range selectedCustomFields {
		xmlBuilder.WriteString(fmt.Sprintf("  <field name=\"%s\" type=\"%s\"></field>\n", field.Name, field.DataType))
	}
	xmlBuilder.WriteString("</custom_fields>")
	customFieldsXML := xmlBuilder.String()

	templateMutex.RLock()
	defer templateMutex.RUnlock()

	templateData := map[string]interface{}{
		"Language":        getLikelyLanguage(),
		"Title":           doc.Title,
		"CreatedDate":     doc.CreatedDate,
		"DocumentType":    doc.DocumentTypeName,
		"CustomFieldsXML": customFieldsXML,
	}

	availableTokens, err := getAvailableTokensForContent(customFieldTemplate, templateData)
	if err != nil {
		return nil, fmt.Errorf("error calculating available tokens for custom fields: %v", err)
	}

	truncatedContent, err := truncateContentByTokens(doc.Content, availableTokens)
	if err != nil {
		return nil, fmt.Errorf("error truncating content for custom fields: %v", err)
	}

	var promptBuffer bytes.Buffer
	templateData["Content"] = truncatedContent
	err = customFieldTemplate.Execute(&promptBuffer, templateData)
	if err != nil {
		return nil, fmt.Errorf("error executing custom field template: %v", err)
	}

	prompt := promptBuffer.String()
	logger.Debugf("Custom field suggestion prompt: %s", prompt)

	completion, err := app.generateTaskContent(ctx, TaskCustomFields, prompt, logger)
	if err != nil {
		return nil, fmt.Errorf("error getting response from LLM for custom fields: %v", err)
	}
	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices for custom field suggestion")
	}

	response := stripReasoning(completion.Choices[0].Content)
	response = stripMarkdown(response)
	logger.Debugf("LLM response for custom fields: %s", response)

	// Temporary struct to unmarshal LLM response with field name
	type LLMCustomFieldResponse struct {
		Field string      `json:"field"`
		Value interface{} `json:"value"`
	}

	var llmSuggestedFields []LLMCustomFieldResponse
	// Handle empty or non-JSON response gracefully
	if strings.TrimSpace(response) == "" || !strings.HasPrefix(strings.TrimSpace(response), "[") {
		return []CustomFieldSuggestion{}, nil
	}

	err = json.Unmarshal([]byte(response), &llmSuggestedFields)
	if err != nil {
		logger.Errorf("Error unmarshalling custom fields JSON from LLM response: %v. Response: %s", err, response)
		return nil, fmt.Errorf("LLM returned invalid JSON for custom fields: %w", err)
	}

	// Map field names back to IDs
	fieldNameIdMap := make(map[string]int)
	for _, field := range allCustomFields {
		fieldNameIdMap[field.Name] = field.ID
	}

	var finalSuggestedFields []CustomFieldSuggestion
	for _, llmField := range llmSuggestedFields {
		if id, ok := fieldNameIdMap[llmField.Field]; ok {
			finalSuggestedFields = append(finalSuggestedFields, CustomFieldSuggestion{
				ID:    id,
				Name:  llmField.Field,
				Value: llmField.Value,
			})
		} else {
			logger.Warnf("LLM returned unknown custom field name '%s', skipping.", llmField.Field)
		}
	}

	return finalSuggestedFields, nil
}

// generateDocumentSuggestions generates suggestions for a set of documents
func (app *App) generateDocumentSuggestions(ctx context.Context, suggestionRequest GenerateSuggestionsRequest, logger *logrus.Entry) ([]DocumentSuggestion, error) {
	// Fetch all available tags from paperless-ngx
	availableTagsMap, err := app.Client.GetAllTags(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch available tags: %v", err)
	}

	// Prepare a list of tag names
	availableTagNames := make([]string, 0, len(availableTagsMap))
	for tagName := range availableTagsMap {
		if tagName == manualTag {
			continue
		}
		availableTagNames = append(availableTagNames, tagName)
	}

	// Prepare a list of document correspodents
	availableCorrespondentsMap, err := app.Client.GetAllCorrespondents(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch available correspondents: %v", err)
	}

	// Prepare a list of correspondent names
	availableCorrespondentNames := make([]string, 0, len(availableCorrespondentsMap))
	for correspondentName := range availableCorrespondentsMap {
		availableCorrespondentNames = append(availableCorrespondentNames, correspondentName)
	}

	// Fetch all available document types from paperless-ngx
	availableDocumentTypes, err := app.Client.GetAllDocumentTypes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch available document types: %v", err)
	}

	// Prepare a list of document type names
	availableDocumentTypeNames := make([]string, 0, len(availableDocumentTypes))
	for _, docType := range availableDocumentTypes {
		availableDocumentTypeNames = append(availableDocumentTypeNames, docType.Name)
	}

	// Pre-fetch custom fields once for all documents to avoid N redundant API calls.
	var allCustomFields []CustomField
	if suggestionRequest.GenerateCustomFields {
		settingsMutex.RLock()
		hasSelectedIDs := len(settings.CustomFieldsSelectedIDs) > 0
		settingsMutex.RUnlock()
		if hasSelectedIDs {
			allCustomFields, err = app.Client.GetCustomFields(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch custom fields: %v", err)
			}
		}
	}

	documents := suggestionRequest.Documents
	documentSuggestions := []DocumentSuggestion{}

	var wg sync.WaitGroup
	var mu sync.Mutex
	errorsList := make([]error, 0)

	for i := range documents {
		wg.Add(1)
		go func(doc Document) {
			defer wg.Done()
			documentID := doc.ID
			docLogger := documentLogger(documentID)
			startTime := time.Now()
			docLogger.Printf("Processing Document ID %d...", documentID)

			content := doc.Content
			suggestedTitle := doc.Title
			var suggestedTags []string
			var suggestedCorrespondent string
			var suggestedDocumentType string
			var suggestedCreatedDate string
			var suggestedCustomFields []CustomFieldSuggestion

			// Each goroutine uses its own local err to avoid races on the shared outer variable.
			var gerr error

			if suggestionRequest.GenerateTitles {
				suggestedTitle, gerr = app.getSuggestedTitle(ctx, content, suggestedTitle, docLogger)
				if gerr != nil {
					mu.Lock()
					errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
					mu.Unlock()
					docLogger.Errorf("Error processing document %d: %v", documentID, gerr)
					return
				}
			}

			if suggestionRequest.GenerateTags {
				suggestedTags, gerr = app.getSuggestedTags(ctx, content, suggestedTitle, availableTagNames, doc.Tags, docLogger)
				if gerr != nil {
					mu.Lock()
					errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
					mu.Unlock()
					logger.Errorf("Error generating tags for document %d: %v", documentID, gerr)
					return
				}
			}

			if suggestionRequest.GenerateCorrespondents {
				suggestedCorrespondent, gerr = app.getSuggestedCorrespondent(ctx, content, suggestedTitle, availableCorrespondentNames, correspondentBlackList)
				if gerr != nil {
					mu.Lock()
					errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
					mu.Unlock()
					log.Errorf("Error generating correspondents for document %d: %v", documentID, gerr)
					return
				}
			}

			if suggestionRequest.GenerateDocumentTypes {
				if len(availableDocumentTypeNames) == 0 {
					docLogger.Debug("Document type generation is enabled, but no document types are available in paperless-ngx.")
				} else {
					suggestedDocumentType, gerr = app.getSuggestedDocumentType(ctx, content, suggestedTitle, availableDocumentTypeNames, docLogger)
					if gerr != nil {
						mu.Lock()
						errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
						mu.Unlock()
						log.Errorf("Error generating document type for document %d: %v", documentID, gerr)
						return
					}
				}
			}

			if suggestionRequest.GenerateCreatedDate {
				suggestedCreatedDate, gerr = app.getSuggestedCreatedDate(ctx, suggestedTitle, content, docLogger)
				if gerr != nil {
					mu.Lock()
					errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
					mu.Unlock()
					log.Errorf("Error generating createdDate for document %d: %v", documentID, gerr)
					return
				}
			}

			if suggestionRequest.GenerateCustomFields {
				settingsMutex.RLock()
				selectedIDs := settings.CustomFieldsSelectedIDs
				settingsMutex.RUnlock()

				if len(selectedIDs) == 0 {
					log.Warnf("Custom field generation is enabled, but no custom fields are selected in the settings. Please select at least one custom field for this feature to work.")
				} else {
					suggestedCustomFields, gerr = app.getSuggestedCustomFields(ctx, doc, selectedIDs, allCustomFields, docLogger)
					if gerr != nil {
						mu.Lock()
						errorsList = append(errorsList, fmt.Errorf("Document %d: %v", documentID, gerr))
						mu.Unlock()
						log.Errorf("Error generating custom fields for document %d: %v", documentID, gerr)
						return
					}
				}
			}

			mu.Lock()
			suggestion := DocumentSuggestion{
				ID:               documentID,
				OriginalDocument: doc,
			}
			settingsMutex.RLock()
			suggestion.CustomFieldsWriteMode = settings.CustomFieldsWriteMode
			suggestion.CustomFieldsEnable = settings.CustomFieldsEnable
			settingsMutex.RUnlock()
			// Titles
			if suggestionRequest.GenerateTitles {
				docLogger.Printf("Suggested title for document %d: %s", documentID, suggestedTitle)
				suggestion.SuggestedTitle = suggestedTitle
			} else {
				suggestion.SuggestedTitle = doc.Title
			}

			// Tags
			if suggestionRequest.GenerateTags {
				docLogger.Printf("Suggested tags for document %d: %v", documentID, suggestedTags)
				suggestion.SuggestedTags = suggestedTags
			} else {
				suggestion.SuggestedTags = doc.Tags
			}

			// Correspondents
			if suggestionRequest.GenerateCorrespondents {
				log.Printf("Suggested correspondent for document %d: %s", documentID, suggestedCorrespondent)
				suggestion.SuggestedCorrespondent = suggestedCorrespondent
			} else {
				suggestion.SuggestedCorrespondent = ""
			}

			// Document Type
			if suggestionRequest.GenerateDocumentTypes {
				log.Printf("Suggested document type for document %d: %s", documentID, suggestedDocumentType)
				suggestion.SuggestedDocumentType = suggestedDocumentType
			} else {
				suggestion.SuggestedDocumentType = ""
			}

			// CreatedDate
			if suggestionRequest.GenerateCreatedDate {
				log.Printf("Suggested createdDate for document %d: %s", documentID, suggestedCreatedDate)
				suggestion.SuggestedCreatedDate = suggestedCreatedDate
			} else {
				suggestion.SuggestedCreatedDate = ""
			}

			// Custom Fields
			if suggestionRequest.GenerateCustomFields {
				log.Printf("Suggested custom fields for document %d: %v", documentID, suggestedCustomFields)
				suggestion.SuggestedCustomFields = suggestedCustomFields
			}

			// Remove manual tag from the list of suggested tags
			suggestion.RemoveTags = []string{manualTag, autoTag}

			documentSuggestions = append(documentSuggestions, suggestion)
			mu.Unlock()

			elapsed := time.Since(startTime)
			// Format as HH:MM:SS using UTC zero-time base.
			runtime := time.Unix(0, elapsed.Nanoseconds()).UTC()
			docLogger.Printf("Document %d processed successfully. Runtime: %s",
				documentID, runtime.Format("15:04:05"))
		}(documents[i])
	}

	wg.Wait()

	if len(errorsList) > 0 {
		return nil, errors.Join(errorsList...)
	}

	return documentSuggestions, nil
}

// getTodayDate returns the current date in YYYY-MM-DD format
func getTodayDate() string {
	return time.Now().Format("2006-01-02")
}

// stripReasoning removes the reasoning from the content indicated by <think> and </think> tags.
func stripReasoning(content string) string {
	// Remove reasoning from the content
	reasoningStart := strings.Index(content, "<think>")
	if reasoningStart != -1 {
		reasoningEnd := strings.Index(content, "</think>")
		if reasoningEnd != -1 {
			content = content[:reasoningStart] + content[reasoningEnd+len("</think>"):]
		}
	}

	// Trim whitespace
	content = strings.TrimSpace(content)
	return content
}

// stripMarkdown removes the markdown code block from the content.
func stripMarkdown(content string) string {
	trimmed := strings.TrimSpace(content)
	// Strip ```json or plain ``` fences
	if strings.HasPrefix(trimmed, "```json") {
		trimmed = strings.TrimPrefix(trimmed, "```json")
	} else if strings.HasPrefix(trimmed, "```") {
		trimmed = strings.TrimPrefix(trimmed, "```")
	}
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}
