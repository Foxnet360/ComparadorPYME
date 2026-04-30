"use strict";
/**
 * Async clause indexing service
 * Processes clause PDFs in background: extract → chunk → embed → store
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clauseIndexer = void 0;
const database_1 = require("../config/database");
const pdfExtractor_1 = require("./pdfExtractor");
const semanticChunker_1 = require("./semanticChunker");
const embeddingService_1 = require("./vector/embeddingService");
// In-memory job store (replace with Redis/DB in production)
const jobStore = new Map();
exports.clauseIndexer = {
    /**
     * Start async indexing of a clause document
     */
    startIndexing: (pdfPath, metadata) => __awaiter(void 0, void 0, void 0, function* () {
        const jobId = generateJobId();
        const job = {
            id: jobId,
            status: 'pending',
            progress: 0,
            message: 'Job queued'
        };
        jobStore.set(jobId, job);
        // Process asynchronously
        processClauseDocument(jobId, pdfPath, metadata).catch(error => {
            console.error(`❌ [clauseIndexer] Job ${jobId} failed:`, error);
            job.status = 'failed';
            job.error = error.message;
            job.progress = 100;
            jobStore.set(jobId, job);
        });
        return jobId;
    }),
    /**
     * Get job status
     */
    getJobStatus: (jobId) => {
        return jobStore.get(jobId);
    },
    /**
     * List all jobs
     */
    listJobs: () => {
        return Array.from(jobStore.values());
    }
};
function processClauseDocument(jobId, pdfPath, metadata) {
    return __awaiter(this, void 0, void 0, function* () {
        const job = jobStore.get(jobId);
        if (!job)
            throw new Error('Job not found');
        try {
            // Step 1: Extract text from PDF
            job.status = 'processing';
            job.progress = 10;
            job.message = 'Extracting text from PDF...';
            jobStore.set(jobId, job);
            const extraction = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(pdfPath);
            // Step 2: Create document record
            job.progress = 20;
            job.message = 'Creating document record...';
            jobStore.set(jobId, job);
            const { data: docData, error: docError } = yield database_1.supabase
                .from('documents')
                .insert({
                insurer_id: yield getOrCreateInsurer(metadata.insurerName),
                document_name: metadata.documentName,
                document_type: metadata.documentType,
                total_pages: extraction.pages.length,
                storage_path: pdfPath,
                is_active: true
            })
                .select()
                .single();
            if (docError)
                throw docError;
            const documentId = docData.id;
            job.documentId = documentId;
            // Step 3: Create chunks
            job.progress = 30;
            job.message = 'Creating semantic chunks...';
            jobStore.set(jobId, job);
            const chunks = semanticChunker_1.semanticChunker.createChunksFromPages(extraction.pages, {
                documentName: metadata.documentName,
                insurerName: metadata.insurerName
            });
            // Step 4: Generate embeddings
            job.progress = 50;
            job.message = `Generating embeddings for ${chunks.length} chunks...`;
            jobStore.set(jobId, job);
            const chunksWithEmbeddings = yield Promise.all(chunks.map((chunk, index) => __awaiter(this, void 0, void 0, function* () {
                const embedding = yield embeddingService_1.embeddingService.generateEmbedding(chunk.content);
                return {
                    document_id: documentId,
                    insurer_name: metadata.insurerName,
                    document_type: metadata.documentType,
                    section_type: chunk.sectionType,
                    coverage_tags: chunk.coverageTags,
                    content: chunk.content,
                    embedding,
                    page_number: chunk.metadata.pageStart,
                    chunk_level: 2 // Chapter/section level
                };
            })));
            // Step 5: Store in database
            job.progress = 80;
            job.message = 'Storing chunks in database...';
            jobStore.set(jobId, job);
            // Insert in batches
            const batchSize = 50;
            for (let i = 0; i < chunksWithEmbeddings.length; i += batchSize) {
                const batch = chunksWithEmbeddings.slice(i, i + batchSize);
                const { error: insertError } = yield database_1.supabase
                    .from('clause_chunks')
                    .insert(batch);
                if (insertError) {
                    console.error(`❌ Error inserting batch ${i / batchSize}:`, insertError);
                    throw insertError;
                }
            }
            // Complete
            job.status = 'completed';
            job.progress = 100;
            job.message = `Successfully indexed ${chunks.length} chunks`;
            jobStore.set(jobId, job);
            console.log(`✅ [clauseIndexer] Job ${jobId} completed: ${chunks.length} chunks indexed`);
        }
        catch (error) {
            console.error(`❌ [clauseIndexer] Job ${jobId} failed:`, error);
            job.status = 'failed';
            job.error = error.message;
            job.progress = 100;
            jobStore.set(jobId, job);
            throw error;
        }
    });
}
function getOrCreateInsurer(insurerName) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if insurer exists
        const { data: existing } = yield database_1.supabase
            .from('insurers')
            .select('id')
            .eq('name', insurerName)
            .single();
        if (existing) {
            return existing.id;
        }
        // Create new insurer
        const { data: newInsurer, error } = yield database_1.supabase
            .from('insurers')
            .insert({ name: insurerName })
            .select()
            .single();
        if (error)
            throw error;
        return newInsurer.id;
    });
}
function generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
