# Implementation Tasks

## 1. Infrastructure Setup

- [x] 1.1 Install dependencies: groq, @xenova/transformers, chromadb
- [x] 1.2 Configure Railway deployment with Dockerfile
- [x] 1.3 Set up environment variables: GROQ_API_KEY, CHROMA_HOST, CHROMA_PORT
- [x] 1.4 Create Docker multi-stage build for server
- [x] 1.5 Create docker-compose.yml for ChromaDB + server

## 2. PDF Text Extraction Service

- [x] 2.1 Implement pdfExtractor.ts using pdf-lib
- [x] 2.2 Add text cleaning utilities (remove page numbers, normalize whitespace)
- [x] 2.3 Add metadata extraction (page count)
- [x] 2.4 Add error handling for corrupted/invalid PDFs
- [ ] 2.5 Write unit tests for pdfExtractor
- [ ] 2.6 Test with sample clause and quote PDFs

## 3. Semantic Chunking Service

- [x] 3.1 Implement regex patterns for CAPÍTULO/SECCIÓN/NUMERAL detection
- [x] 3.2 Create chunk builder with metadata (chapter, section, clause_id, page refs)
- [x] 3.3 Implement fallback LLM chunking for unstructured documents
- [x] 3.4 Add ARTÍCULO pattern support as alternative structure
- [ ] 3.5 Write unit tests for chunker
- [ ] 3.6 Test with AXA COLPATRIA clause PDF

## 4. Embedding Generation Service

- [x] 4.1 Set up HuggingFace transformer (all-MiniLM-L6-v2)
- [x] 4.2 Create embedding service with batch processing
- [x] 4.3 Implement embedding caching for repeated queries
- [x] 4.4 Add error handling for embedding generation failures

## 5. Vector Storage Service

- [x] 5.1 Configure ChromaDB client with persistence
- [x] 5.2 Implement collection management by insurer
- [x] 5.3 Create chunk storage with metadata
- [x] 5.4 Implement upsert (update or insert) for re-indexing
- [x] 5.5 Implement document deletion
- [ ] 5.6 Write integration tests for vector store

## 6. RAG Retrieval Service

- [x] 6.1 Implement similarity search with filtering
- [x] 6.2 Add hybrid search (keyword + vector)
- [x] 6.3 Create citation metadata builder
- [x] 6.4 Add limit parameter support
- [x] 6.5 Handle empty results gracefully

## 7. Groq Analysis Service

- [x] 7.1 Configure Groq client with API key
- [x] 7.2 Implement quote text extraction from raw PDF text
- [x] 7.3 Create analysis prompt with RAG context
- [x] 7.4 Implement JSON output parsing
- [x] 7.5 Add retry logic with exponential backoff for rate limits
- [x] 7.6 Add citation extraction from LLM response

## 8. Clause Library Management API

- [x] 8.1 Create POST /api/clauses/upload endpoint
- [x] 8.2 Create GET /api/clauses endpoint (list with filters)
- [x] 8.3 Create DELETE /api/clauses/:id endpoint
- [x] 8.4 Create POST /api/clauses/:id/reindex endpoint
- [x] 8.5 Add validation (PDF type, non-empty text)

## 9. Integration: Analyze Quote with RAG

- [x] 9.1 Update /api/analyze endpoint to use RAG pipeline
- [x] 9.2 Implement: extract quote text → extract coverages → retrieve relevant chunks → generate analysis
- [x] 9.3 Add citation data to analysis response
- [x] 9.4 Update response format to match existing API contract

## 10. Frontend Updates

- [ ] 10.1 Update ComparisonReport to display citations
- [ ] 10.2 Add clause library management UI (upload, list, delete)
- [ ] 10.3 Add loading states for indexing operations
- [ ] 10.4 Add error handling UI for API failures

## 11. Testing & Validation

- [ ] 11.1 End-to-end test: upload clause → search → analyze quote
- [ ] 11.2 Test with multiple insurers and clause documents
- [ ] 11.3 Validate citations in output match source documents
- [ ] 11.4 Performance test: measure token reduction vs full document
- [ ] 11.5 Test error scenarios (invalid PDF, rate limits, empty results)

## 12. Deployment

- [ ] 12.1 Deploy to Railway staging
- [ ] 12.2 Run E2E tests in production
- [ ] 12.3 Configure custom domain if needed
- [ ] 12.4 Monitor Groq API usage and costs
- [ ] 12.5 Document API endpoints and integration guide
