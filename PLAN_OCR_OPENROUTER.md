# Implementation Plan: OCR Support with OpenRouter

## Background
Currently, OCR functionality in paperless-gpt retrieves its provider and model from environment variables (e.g., `VISION_LLM_PROVIDER`, `VISION_LLM_MODEL`), which is contrary to how LLM title generation works. Title generation uses the AI provider/model configured in the application settings UI. We need to make OCR follow the same pattern as title generation by using the configured provider plus a separately-selectable model stored in settings, not environment variables.

## Current Behavior

### LLM Provider Selection (works correctly)
- **File: ai_provider_settings.go:257**: `getLLMForTask()` function resolves provider configuration by calling `ResolveAIProviderConfig()`
- **File: ai_provider_settings.go:159**: `ResolveAIProviderConfig()` first tries to get enabled UI provider setting from database (AIProviderSetting table), falling back to environment variables if no UI setting is enabled
- **File: ai_provider_settings.go:203**: `envAIProviderConfig()` handles fallback to env vars when no UI setting is enabled
- **File: AIProviderSetting struct (local_db.go:100-110)**: Database model stores provider, model, API key, etc.
- **File: AIProvidersEditor.tsx (web-app/src/components/AIProvidersEditor.tsx)**: Frontend UI allows model selection

### OCR Provider Selection (needs improvement)
- **File: main.go:218-330**: OCR provider is initialized directly from environment variables (`OCR_PROVIDER`, `VISION_LLM_PROVIDER`, `VISION_LLM_MODEL`, etc.)
- **File: ocr/llm_provider.go:34**: `newLLMProvider()` uses environment variables to set up clients (e.g., `os.Getenv("OPENAI_API_KEY")`)
- **File: ocr/llm_provider.go:200-248**: Provider-specific client creation functions (`createOpenAIClient`, `createOllamaClient`, etc.) all rely on environment variables instead of UI settings
- **File: ocr.go:46**: `ProcessDocumentOCR()` uses the globally configured `app.ocrProvider` which is environment-variable driven

## Proposed Changes

### 1. Backend Struct Changes
- **File: ai_provider_settings.go**: Add OCR-specific model field to AIProviderConfig struct
  - Add `OCRModel string` field to store OCR-specific model
  - Modify `buildLLMFromConfig()` to support OCR provider routing
- **File: local_db.go:100-110**: Update AIProviderSetting struct to include OCR model field
  - Add `OCRModel` column to store OCR-specific model selection
- **File: ai_provider_settings.go**: Add new function `getOCRLLM()` that follows same pattern as `getLLMForTask()`

### 2. Backend OCR Provider Routing
- **File: ocr/llm_provider.go**: Modify `newLLMProvider()` to accept provider configuration from settings instead of environment variables
- **File: main.go:218-330**: Change OCR initialization to use UI-configured settings instead of environment variables
- **File: ocr/llm_provider.go:200-248**: Refactor provider-specific client creation functions to accept configuration from parameters instead of environment variables
- **File: main.go**: Add conditional logic to use UI settings when available, fallback to env vars

### 3. Settings API/Handlers
- **File: ai_provider_settings.go**: Extend `AIProviderSettingsResponse` and `AIProviderSettingsRequest` to include OCR model field
- **File: ai_provider_settings.go**: Update `getAIProviderSettings()` and `saveAIProviderSettings()` to handle OCR model field
- **File: app_http_handlers.go**: No changes needed - reuses existing AI provider endpoints

### 4. Frontend UI
- **File: web-app/src/components/AIProvidersEditor.tsx**: Add new field for OCR model selection directly under the existing "Default model" field
- **File: web-app/src/components/AIProvidersEditor.tsx**: Update the TypeScript interfaces to include OCR model field
- **File: web-app/src/components/AIProvidersEditor.tsx**: Include OCR model in API payload when saving settings

## Open Questions / Decisions
1. **TaskModelsJSON vs dedicated field**: Should we use the existing TaskModelsJSON field to store OCR as a task key, or use a dedicated OCRModel column? **RESOLVED**: Use a dedicated OCRModel column for clarity.

## Out of Scope
This is a plan-only document. No code has been modified in the repository.

## Ordered Task List
1. Add OCR model field to AIProviderSetting struct and database migration
2. Update AIProviderConfig struct to include OCR model field
3. Modify API response/request structs to include OCR model field
4. Update get/save AI provider settings functions to handle OCR model
5. Modify OCR provider initialization to use UI settings instead of env vars
6. Update OCR provider implementations to accept configuration from parameters
7. Add OCR model field to frontend UI component
8. Test the integration to ensure OCR works with OpenRouter using settings