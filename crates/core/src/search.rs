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

#[cfg(test)]
mod tests {
    use super::*;

    fn record(name: &str, hash: &str) -> FileRecord {
        FileRecord {
            id: "id".into(),
            name: name.into(),
            hash: hash.into(),
            original_size: 100,
            compressed_size: 50,
            chunk_count: 1,
            unique_chunks: 1,
            dedup_saved: 0,
            created_at: "2026-01-01T00:00:00Z".into(),
            chunk_hashes: vec![],
            chunk_sizes: vec![],
            chunk_compressions: vec![],
        }
    }

    #[test]
    fn empty_query_returns_all() {
        let records = vec![record("a.txt", "abc"), record("b.txt", "def")];
        let results = search_files(&records, "");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn search_by_name() {
        let records = vec![record("photo.jpg", "abc"), record("doc.pdf", "def")];
        let results = search_files(&records, "photo");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "photo.jpg");
    }

    #[test]
    fn search_by_hash() {
        let records = vec![record("a.txt", "abcdef"), record("b.txt", "123456")];
        let results = search_files(&records, "abc");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].hash, "abcdef");
    }

    #[test]
    fn search_case_insensitive() {
        let records = vec![record("Photo.JPG", "ABCdef")];
        let results = search_files(&records, "photo");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_no_match() {
        let records = vec![record("a.txt", "abc")];
        let results = search_files(&records, "xyz");
        assert!(results.is_empty());
    }

    #[test]
    fn search_multiple_matches() {
        let records = vec![
            record("photo1.jpg", "aaa"),
            record("photo2.png", "bbb"),
            record("doc.pdf", "ccc"),
        ];
        let results = search_files(&records, "photo");
        assert_eq!(results.len(), 2);
    }
}
