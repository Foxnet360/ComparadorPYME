/**
 * Async clause indexing service
 * Processes clause PDFs in background: extract → chunk → embed → store
 */

import { supabase } from '../config/database';
import { pdfExtractor } from './pdfExtractor';
import { semanticChunker } from './semanticChunker';
import { embeddingService } from './vector/embeddingService';
import { ClauseDocument } from '../types';

interface IndexingJob {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    message: string;
    documentId?: string;
    error?: string;
}

// In-memory job store (replace with Redis/DB in production)
const jobStore = new Map<string, IndexingJob>();

export const clauseIndexer = {
    /**
     * Start async indexing of a clause document
     */
    startIndexing: async (
        pdfPath: string,
        metadata: {
            insurerName: string;
            documentType: string;
            documentName: string;
            documentId?: string;
        }
    ): Promise<string> => {
        const jobId = generateJobId();
        
        const job: IndexingJob = {
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
    },

    /**
     * Get job status
     */
    getJobStatus: (jobId: string): IndexingJob | undefined => {
        return jobStore.get(jobId);
    },

    /**
     * List all jobs
     */
    listJobs: (): IndexingJob[] => {
        return Array.from(jobStore.values());
    }
};

async function processClauseDocument(
    jobId: string,
    pdfPath: string,
    metadata: {
        insurerName: string;
        documentType: string;
        documentName: string;
        documentId?: string;
    }
): Promise<void> {
    const job = jobStore.get(jobId);
    if (!job) throw new Error('Job not found');

    try {
        // Step 1: Extract text from PDF
        job.status = 'processing';
        job.progress = 10;
        job.message = 'Extracting text from PDF...';
        jobStore.set(jobId, job);

        const extraction = await pdfExtractor.extractTextFromPdf(pdfPath);
        
        // Step 2: Get or create document record
        job.progress = 20;
        job.message = 'Creating document record...';
        jobStore.set(jobId, job);

        let documentId: string;
        
        if (metadata.documentId) {
            // Use existing document ID
            documentId = metadata.documentId;
            console.log(`📄 [clauseIndexer] Using existing document: ${documentId}`);
        } else {
            // Create new document record
            const { data: docData, error: docError } = await supabase
                .from('documents')
                .insert({
                    insurer_id: await getOrCreateInsurer(metadata.insurerName),
                    document_name: metadata.documentName,
                    document_type: metadata.documentType,
                    total_pages: extraction.pages.length,
                    storage_path: pdfPath,
                    is_active: true
                } as any)
                .select()
                .single();

            if (docError) throw docError;
            documentId = (docData as any).id;
        }
        
        job.documentId = documentId;

        // Step 3: Create chunks
        job.progress = 30;
        job.message = 'Creating semantic chunks...';
        jobStore.set(jobId, job);

        const chunks = semanticChunker.createChunksFromPages(
            extraction.pages,
            {
                documentName: metadata.documentName,
                insurerName: metadata.insurerName
            }
        );

        // Step 4: Generate embeddings
        job.progress = 50;
        job.message = `Generating embeddings for ${chunks.length} chunks...`;
        jobStore.set(jobId, job);

        const chunksWithEmbeddings = await Promise.all(
            chunks.map(async (chunk, index) => {
                const embedding = await embeddingService.generateEmbedding(chunk.content);
                
                // Truncate to 768 dimensions for clause_chunks compatibility
                const truncatedEmbedding = embedding.length > 768 
                    ? embedding.slice(0, 768) 
                    : embedding;
                
                return {
                    document_id: documentId,
                    insurer_name: metadata.insurerName,
                    document_type: metadata.documentType,
                    section_type: chunk.sectionType,
                    coverage_tags: chunk.coverageTags,
                    content: chunk.content,
                    embedding: truncatedEmbedding,
                    page_number: chunk.metadata.pageStart,
                    chunk_level: 2 // Chapter/section level
                };
            })
        );

        // Step 5: Store in database
        job.progress = 80;
        job.message = 'Storing chunks in database...';
        jobStore.set(jobId, job);

        // Insert in batches
        const batchSize = 50;
        for (let i = 0; i < chunksWithEmbeddings.length; i += batchSize) {
            const batch = chunksWithEmbeddings.slice(i, i + batchSize);
            
            const { error: insertError } = await supabase
                .from('clause_chunks')
                .insert(batch as any);

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

    } catch (error: any) {
        console.error(`❌ [clauseIndexer] Job ${jobId} failed:`, error);
        job.status = 'failed';
        job.error = error.message;
        job.progress = 100;
        jobStore.set(jobId, job);
        throw error;
    }
}

async function getOrCreateInsurer(insurerName: string): Promise<string> {
    // Check if insurer exists
    const { data: existing } = await supabase
        .from('insurers')
        .select('id')
        .eq('name', insurerName)
        .single();

    if (existing) {
        return (existing as any).id;
    }

    // Create new insurer
    const { data: newInsurer, error } = await supabase
        .from('insurers')
        .insert({ name: insurerName } as any)
        .select()
        .single();

    if (error) throw error;
    return (newInsurer as any).id;
}

function generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}