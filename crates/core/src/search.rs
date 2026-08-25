//! Lightweight full-text-ish search over file records.

use crate::storage::FileRecord;

/// Return the records whose name or hash contains `query` (case-insensitive).
pub fn search_files(records: &[FileRecord], query: &str) -> Vec<FileRecord> {
    let q = query.to_lowercase();
    if q.is_empty() {
        return records.to_vec();
    }
    records
        .iter()
        .filter(|f| {
            f.name.to_lowercase().contains(&q) || f.hash.to_lowercase().contains(&q)
        })
        .cloned()
        .collect()
}
