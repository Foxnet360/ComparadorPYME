/**
 * One-off backfill: populate chunks.coverage_tags for rows indexed before
 * semanticChunker.detectCoverages existed (or via paths that skipped tagging).
 * Idempotent: only touches rows where coverage_tags IS NULL.
 *
 * Run: cd server && npx ts-node --transpile-only src/scripts/backfillCoverageTags.ts
 */
import { createSupabaseClient } from '../config/database';
import { semanticChunker } from '../services/semanticChunker';

async function main() {
  const supabase = createSupabaseClient();

  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .or('coverage_tags.is.null,coverage_tags.eq.{}')
    .limit(100000);

  if (error) throw error;
  if (!chunks || chunks.length === 0) {
    console.log('No chunks with NULL coverage_tags. Nothing to do.');
    return;
  }

  console.log(`Tagging ${chunks.length} chunks...`);
  let updated = 0;
  let tagged = 0;
  const failed: string[] = [];

  for (const chunk of chunks) {
    const tags = semanticChunker.detectCoverages(chunk.content || '');
    const { error: updErr } = await supabase
      .from('chunks')
      .update({ coverage_tags: tags })
      .eq('id', chunk.id);
    if (updErr) {
      failed.push(chunk.id);
    } else {
      updated++;
      if (tags.length > 0) tagged++;
    }
  }

  console.log(`Updated: ${updated}/${chunks.length}`);
  console.log(`Chunks with >=1 tag: ${tagged}`);
  if (failed.length > 0) console.log(`Failed: ${failed.length} (${failed.slice(0, 5).join(', ')}...)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
