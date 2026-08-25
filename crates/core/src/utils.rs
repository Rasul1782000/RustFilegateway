//! Small shared helpers.

/// Format a byte count as a human-readable string.
pub fn human_size(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.2} {}", value, UNITS[unit])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn human_size_zero() {
        assert_eq!(human_size(0), "0 B");
    }

    #[test]
    fn human_size_bytes() {
        assert_eq!(human_size(100), "100 B");
        assert_eq!(human_size(1023), "1023 B");
    }

    #[test]
    fn human_size_kilobytes() {
        assert_eq!(human_size(1024), "1.00 KB");
        assert_eq!(human_size(1536), "1.50 KB");
        assert_eq!(human_size(1048575), "1024.00 KB");
    }

    #[test]
    fn human_size_megabytes() {
        assert_eq!(human_size(1048576), "1.00 MB");
        assert_eq!(human_size(5242880), "5.00 MB");
    }

    #[test]
    fn human_size_gigabytes() {
        assert_eq!(human_size(1073741824), "1.00 GB");
        assert_eq!(human_size(5368709120), "5.00 GB");
    }

    #[test]
    fn human_size_terabytes() {
        assert_eq!(human_size(1099511627776), "1.00 TB");
    }
}
