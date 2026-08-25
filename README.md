<div align="center">

# File Gateway

**High-performance file storage with content-defined chunking, deduplication & intelligent compression**

*Built entirely in safe Rust*

[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://rust-lang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-28%20passing-brightgreen)](#testing)

</div>

---

## What is File Gateway?

File Gateway is a **pure-Rust file management system** that ingests files, splits them into content-defined chunks, deduplicates identical data, intelligently compresses each chunk, and stores everything with full metadata tracking. It exposes a REST API and a modern web frontend for managing your files.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FILE GATEWAY                             │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Upload   │───▶│ FastCDC  │───▶│ Dedup    │───▶│ Compress │  │
│  │  (multipart)  │ Chunking │    │ (blake3) │    │ (LZ4/    │  │
│  │           │    │          │    │          │    │  Deflate) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                      │          │
│                                                      ▼          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │ Download │◀───│ Reassemble│◀───│   Chunk Storage (disk)   │  │
│  │          │    │          │    │   + Metadata DB (redb)    │  │
│  └──────────┘    └──────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Content-Defined Chunking** -- FastCDC splits files into variable-size chunks based on content, enabling cross-file deduplication
- **Intelligent Deduplication** -- blake3 hashing with DashMap hot cache + redb persistence; identical chunks stored only once
- **Smart Compression** -- Entropy-based algorithm selection chooses None / LZ4 / Deflate for each chunk individually
- **File Reassembly** -- Download original files reconstructed from stored chunks on the fly
- **Chunk Cleanup** -- Deleting a file removes its chunks from disk, preventing orphaned data
- **Pure Rust** -- `#![forbid(unsafe_code)]`; uses `lz4_flex` and `flate2` with `rust_backend` (miniz_oxide) -- no C FFI
- **Embedded Database** -- `redb` for metadata persistence; zero external services required
- **Modern Frontend** -- Next.js 15 + React 19 + Tailwind CSS with drag-and-drop uploads, dark mode, live stats
- **RESTful API** -- Axum HTTP server with multipart upload, search, download, and statistics endpoints
- **Configurable** -- CLI flags or TOML config files with proper precedence

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Core Engine | Rust, blake3, FastCDC, lz4_flex, flate2, redb, DashMap |
| HTTP Server | Axum, Tower-HTTP, Tokio |
| Frontend | Next.js 15, React 19, TypeScript 5, Tailwind CSS 3 |
| State Management | TanStack Query (React Query v5) |
| File Upload | FilePond |

## Quick Start

### Prerequisites

- **Rust** 1.75+ (install via [rustup](https://rustup.rs/))
- **Node.js** 18.18+ (for the frontend)

### 1. Start the Backend

```bash
# Clone the repository
git clone https://github.com/Rasul1782000/RustFilegateway.git
cd RustFilegateway

# Build and run the server
cargo run --release --bin file-gateway-server
```

The server starts on `http://0.0.0.0:3000` by default.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:3001` and proxies API calls to the backend.

### 3. Upload a File

```bash
# Via curl
curl -X POST http://localhost:3000/api/upload \
  -F "file=@myfile.pdf"

# Or open http://localhost:3001 in your browser and drag & drop
```

## Configuration

### CLI Flags

```bash
file-gateway-server [OPTIONS]

Options:
  --config <PATH>              Path to TOML config file
  --storage-path <PATH>        Storage directory [default: ./storage]
  --port <PORT>                HTTP port [default: 3000]
  --chunk-size <BYTES>         Average chunk size in bytes [default: 1048576]
  --compression-level <1-9>    Deflate compression level [default: 3]
```

### TOML Config

Create a `gateway.toml` file:

```toml
storage_path = "/data/file-gateway"
chunk_size = 2097152      # 2 MB chunks
compression_level = 6     # Balanced compression
```

Then run:

```bash
cargo run --release --bin file-gateway-server -- --config gateway.toml
```

**Precedence:** CLI flags > TOML file > Built-in defaults.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level filter | `file_gateway=debug,info` |

## API Reference

### Upload Files

```http
POST /api/upload
Content-Type: multipart/form-data
```

Upload one or more files. Returns processing metadata for each file.

**Response:**
```json
{
  "success": true,
  "processed": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "document.pdf",
      "hash": "a1b2c3d4...",
      "original_size": 1048576,
      "compressed_size": 524288,
      "dedup_saved": 0,
      "chunk_count": 4,
      "unique_chunks": 4,
      "compression_ratio": 50.0,
      "dedup_ratio": 0.0,
      "processing_time_ms": 12.5
    }
  ],
  "errors": []
}
```

### List All Files

```http
GET /api/files
```

### Get File Metadata

```http
GET /api/files/:id
```

### Download / Reassemble File

```http
GET /api/files/:id/download
```

Returns the original file bytes reconstructed from stored chunks.

### Delete File

```http
DELETE /api/files/:id
```

Removes the file record and cleans up orphaned chunks from disk.

### Search Files

```http
GET /api/search?q=<query>
```

Case-insensitive substring search across file names and hashes.

### Statistics

```http
GET /api/stats
```

**Response:**
```json
{
  "total_files": 42,
  "total_original": 1073741824,
  "total_compressed": 536870912,
  "total_dedup_saved": 268435456,
  "compression_ratio": 50.0,
  "dedup_ratio": 25.0
}
```

## Architecture

```
file-gateway/
├── Cargo.toml                  # Workspace root
├── crates/
│   ├── core/                   # Core engine library
│   │   ├── src/
│   │   │   ├── lib.rs          # Gateway orchestrator
│   │   │   ├── chunking.rs     # FastCDC content-defined chunking
│   │   │   ├── compression.rs  # Entropy-based compression selection
│   │   │   ├── dedup.rs        # blake3 deduplication engine
│   │   │   ├── storage.rs      # Chunk blobs + metadata DB
│   │   │   ├── search.rs       # Substring search
│   │   │   └── utils.rs        # Helpers
│   │   └── Cargo.toml
│   └── server/                 # HTTP server binary
│       ├── src/
│       │   ├── main.rs         # Axum server entry point
│       │   ├── handlers.rs     # Request handlers
│       │   └── config.rs       # CLI + TOML config
│       └── Cargo.toml
└── frontend/                   # Next.js web app
    ├── app/
    │   ├── page.tsx            # Main SPA
    │   ├── layout.tsx          # Root layout
    │   ├── providers.tsx       # React Query provider
    │   └── globals.css         # Tailwind styles
    ├── package.json
    └── next.config.js          # API proxy
```

### Processing Pipeline

1. **Upload** -- Multipart file arrives at the Axum server, written to a temp file
2. **Hash** -- blake3 hash computed over the entire file for identification
3. **Chunk** -- FastCDC splits the data into content-defined chunks (min/avg/max sizes configurable)
4. **Dedup** -- Each chunk's blake3 hash is checked against DashMap cache + redb database
5. **Compress** -- New chunks are compressed with the optimal algorithm selected by entropy analysis
6. **Store** -- Unique chunks saved to disk; metadata persisted to redb
7. **Download** -- Chunks read in order, decompressed, and concatenated to reconstruct the original file

### Compression Strategy

| Condition | Algorithm | Rationale |
|-----------|-----------|-----------|
| Data < 1 KB | None | Overhead not worth it |
| Entropy < 2.5 bits/byte | None | Already repetitive/compressible |
| Entropy > 7.5 bits/byte | Deflate | High entropy benefits from strong compression |
| Otherwise | LZ4 | Fast with moderate ratio |

## Testing

```bash
# Run all unit tests
cargo test

# Run with output
cargo test -- --nocapture
```

Tests cover:
- **Chunking** -- empty input, single chunk, multi-chunk, gap detection, bounds checking
- **Compression** -- roundtrip tests for LZ4, Deflate, and None; entropy calculation; algorithm selection
- **Search** -- name search, hash search, case insensitivity, multi-match, empty query
- **Utils** -- human-readable size formatting across all units

## Performance

File Gateway is designed for high throughput:

- **Async I/O** -- Non-blocking file reads via `tokio::task::spawn_blocking`
- **Lock-free dedup** -- `DashMap` provides concurrent hash lookups without contention
- **Parallel hashing** -- blake3 with rayon for multi-threaded chunk hashing
- **Embedded DB** -- `redb` avoids network overhead of external databases
- **Content-defined boundaries** -- FastCDC produces stable chunks across file versions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Run the backend in watch mode
cargo install cargo-watch
cargo watch -x 'run --bin file-gateway-server'

# Run the frontend in dev mode
cd frontend && npm run dev
```

## License

This project is licensed under the MIT License -- see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with Rust, Axum, Next.js & Tailwind CSS**

</div>
