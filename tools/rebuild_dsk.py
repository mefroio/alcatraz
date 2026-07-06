#!/usr/bin/env python3
import argparse
import os
import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import urllib.request


TOKENIZER_URL = (
    "https://raw.githubusercontent.com/farique1/"
    "MSX-Basic-Tokenizer/master/msxbatoken.py"
)

SECTOR_SIZE = 512
TOTAL_SECTORS = 1440
SECTORS_PER_CLUSTER = 2
RESERVED_SECTORS = 1
FAT_COUNT = 2
SECTORS_PER_FAT = 3
ROOT_ENTRIES = 112
MEDIA_DESCRIPTOR = 0xF9
ROOT_SECTORS = (ROOT_ENTRIES * 32 + SECTOR_SIZE - 1) // SECTOR_SIZE
DATA_START_SECTOR = RESERVED_SECTORS + FAT_COUNT * SECTORS_PER_FAT + ROOT_SECTORS
CLUSTER_SIZE = SECTOR_SIZE * SECTORS_PER_CLUSTER


def repo_root():
    return pathlib.Path(__file__).resolve().parents[1]


def numbered_source(path):
    lines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\d+\s", line):
            lines.append(line.rstrip())
    if not lines:
        raise RuntimeError(f"no numbered BASIC lines found in {path}")
    return "\r\n".join(lines) + "\r\n"


def tokenizer_candidates(root):
    candidates = []
    env_path = os.environ.get("MSXBATOKEN")
    if env_path:
        candidates.append(pathlib.Path(env_path))
    candidates.append(root / "tools" / "msxbatoken.py")
    candidates.append(root / ".build" / "msxbatoken.py")
    candidates.append(pathlib.Path(tempfile.gettempdir()) / "msxbatoken.py")
    return candidates


def ensure_tokenizer(root, allow_download=True):
    for candidate in tokenizer_candidates(root):
        if candidate.exists():
            return candidate

    if not allow_download:
        raise RuntimeError(
            "msxbatoken.py not found. Set MSXBATOKEN or allow download."
        )

    target = root / ".build" / "msxbatoken.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading tokenizer to {target}")
    urllib.request.urlretrieve(TOKENIZER_URL, target)
    return target


def tokenize(tokenizer, source_path, output_stem, build_dir):
    asc = build_dir / f"{output_stem}.ASC"
    bas = build_dir / f"{output_stem}.BAS"
    asc.write_text(numbered_source(source_path), encoding="ascii", newline="")
    if bas.exists():
        bas.unlink()

    subprocess.run(
        [
            sys.executable,
            str(tokenizer),
            "-vb",
            "2",
            "-frb",
            str(asc),
            str(bas),
        ],
        check=True,
    )

    data = bas.read_bytes()
    if not data or data[0] != 0xFF:
        raise RuntimeError(f"{output_stem}.BAS was not tokenized correctly")
    return data


def pack_fat12(entries):
    fat_bytes = bytearray(SECTORS_PER_FAT * SECTOR_SIZE)
    for i in range(0, len(entries), 2):
        first = entries[i] & 0xFFF
        second = entries[i + 1] & 0xFFF if i + 1 < len(entries) else 0
        offset = (i // 2) * 3
        if offset + 2 >= len(fat_bytes):
            break
        fat_bytes[offset] = first & 0xFF
        fat_bytes[offset + 1] = ((first >> 8) & 0x0F) | ((second & 0x0F) << 4)
        fat_bytes[offset + 2] = (second >> 4) & 0xFF
    return fat_bytes


def add_boot_sector(image):
    boot = bytearray(SECTOR_SIZE)
    boot[0:3] = b"\xC9\x00\x00"
    boot[3:11] = b"MSX-DOS "
    struct.pack_into("<H", boot, 11, SECTOR_SIZE)
    boot[13] = SECTORS_PER_CLUSTER
    struct.pack_into("<H", boot, 14, RESERVED_SECTORS)
    boot[16] = FAT_COUNT
    struct.pack_into("<H", boot, 17, ROOT_ENTRIES)
    struct.pack_into("<H", boot, 19, TOTAL_SECTORS)
    boot[21] = MEDIA_DESCRIPTOR
    struct.pack_into("<H", boot, 22, SECTORS_PER_FAT)
    struct.pack_into("<H", boot, 24, 9)
    struct.pack_into("<H", boot, 26, 2)
    image[0:SECTOR_SIZE] = boot


def build_dsk(output_path, files):
    image = bytearray(SECTOR_SIZE * TOTAL_SECTORS)
    add_boot_sector(image)

    fat = [0] * 720
    fat[0] = MEDIA_DESCRIPTOR | 0xF00
    fat[1] = 0xFFF
    next_cluster = 2
    root_entries = []

    for name, ext, data in files:
        clusters_needed = (len(data) + CLUSTER_SIZE - 1) // CLUSTER_SIZE
        start_cluster = next_cluster
        chain = list(range(start_cluster, start_cluster + clusters_needed))

        for idx, cluster in enumerate(chain):
            fat[cluster] = 0xFFF if idx == clusters_needed - 1 else chain[idx + 1]

        for idx, cluster in enumerate(chain):
            sector = DATA_START_SECTOR + (cluster - 2) * SECTORS_PER_CLUSTER
            offset = sector * SECTOR_SIZE
            chunk = data[idx * CLUSTER_SIZE : (idx + 1) * CLUSTER_SIZE]
            image[offset : offset + len(chunk)] = chunk

        root_entries.append((name, ext, start_cluster, len(data)))
        next_cluster += clusters_needed

    fat_bytes = pack_fat12(fat)
    for fat_index in range(FAT_COUNT):
        offset = (RESERVED_SECTORS + fat_index * SECTORS_PER_FAT) * SECTOR_SIZE
        image[offset : offset + len(fat_bytes)] = fat_bytes

    root_offset = (RESERVED_SECTORS + FAT_COUNT * SECTORS_PER_FAT) * SECTOR_SIZE
    for idx, (name, ext, start_cluster, size) in enumerate(root_entries):
        entry = bytearray(32)
        entry[0:8] = name.encode("ascii").ljust(8, b" ")
        entry[8:11] = ext.encode("ascii").ljust(3, b" ")
        entry[11] = 0x20
        struct.pack_into("<H", entry, 26, start_cluster)
        struct.pack_into("<I", entry, 28, size)
        offset = root_offset + idx * 32
        image[offset : offset + 32] = entry

    output_path.write_bytes(image)
    return root_entries


def inspect_basic(data):
    offset = 1
    line_count = 0
    last_line = 0
    ok = True

    while True:
        if offset + 2 > len(data):
            return ok, line_count, last_line, 0
        next_ptr = data[offset] | (data[offset + 1] << 8)
        if next_ptr == 0:
            return ok, line_count, last_line, 0x8000 + offset + 2
        if offset + 4 > len(data):
            return False, line_count, last_line, 0
        line_no = data[offset + 2] | (data[offset + 3] << 8)
        new_offset = next_ptr - 0x8000
        if new_offset <= offset or new_offset > len(data):
            return False, line_count, line_no, 0
        line_count += 1
        last_line = line_no
        offset = new_offset


def inspect_dsk(path):
    image = path.read_bytes()
    root_offset = (RESERVED_SECTORS + FAT_COUNT * SECTORS_PER_FAT) * SECTOR_SIZE
    rows = []
    for idx in range(ROOT_ENTRIES):
        entry = image[root_offset + idx * 32 : root_offset + (idx + 1) * 32]
        if entry[0] == 0:
            break
        if entry[0] == 0xE5:
            continue
        name = entry[:8].decode("ascii").rstrip()
        ext = entry[8:11].decode("ascii").rstrip()
        cluster = struct.unpack_from("<H", entry, 26)[0]
        size = struct.unpack_from("<I", entry, 28)[0]
        data_offset = (DATA_START_SECTOR + (cluster - 2) * SECTORS_PER_CLUSTER) * SECTOR_SIZE
        first = image[data_offset]
        rows.append((f"{name}.{ext}", cluster, size, first))
    return image, rows


def check_mojibake(paths):
    bad_sequences = [
        chr(0x00C3) + chr(0x00A0),
        chr(0x00C3) + chr(0x00A1),
        chr(0x00C3) + chr(0x00A2),
        chr(0x00C3) + chr(0x00A3),
        chr(0x00C3) + chr(0x00A7),
        chr(0x00C3) + chr(0x00A8),
        chr(0x00C3) + chr(0x00A9),
        chr(0x00C3) + chr(0x00AA),
        chr(0x00C3) + chr(0x00AD),
        chr(0x00C3) + chr(0x00B3),
        chr(0x00C3) + chr(0x00BA),
        chr(0xFFFD),
    ]
    hits = []
    for path in paths:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if any(seq in line for seq in bad_sequences):
                hits.append((path, line_no, line))
    return hits


def main():
    parser = argparse.ArgumentParser(description="Rebuild reference/ALCATRAZ.DSK")
    parser.add_argument("--no-download", action="store_true", help="do not download tokenizer")
    args = parser.parse_args()

    root = repo_root()
    reference = root / "reference"
    build_dir = root / ".build" / "msx"
    build_dir.mkdir(parents=True, exist_ok=True)

    sources = {
        "autoexec": reference / "AUTOEXEC.BAS",
        "alcatraz": reference / "ALCATRAZ.BAS",
        "alcatraz2": reference / "ALCATRAZ2.BAS",
    }

    missing = [path for path in sources.values() if not path.exists()]
    if missing:
        raise RuntimeError("missing source files: " + ", ".join(map(str, missing)))

    mojibake_hits = check_mojibake(sources.values())
    if mojibake_hits:
        for path, line_no, line in mojibake_hits:
            print(f"mojibake? {path}:{line_no}: {line}")
        raise RuntimeError("mojibake-like text found")

    tokenizer = ensure_tokenizer(root, allow_download=not args.no_download)
    print(f"tokenizer: {tokenizer}")

    autoexec = numbered_source(sources["autoexec"]).encode("ascii") + b"\x1a"
    alcatraz = tokenize(tokenizer, sources["alcatraz"], "ALCATRAZ", build_dir)
    alcatraz2 = tokenize(tokenizer, sources["alcatraz2"], "ALCATRA2", build_dir)

    output = reference / "ALCATRAZ.DSK"
    root_entries = build_dsk(
        output,
        [
            ("AUTOEXEC", "BAS", autoexec),
            ("ALCATRAZ", "BAS", alcatraz),
            ("ALCATRA2", "BAS", alcatraz2),
        ],
    )

    print(f"wrote {output} ({output.stat().st_size} bytes)")
    for name, ext, cluster, size in root_entries:
        print(f"{name}.{ext} cluster={cluster} size={size}")

    for label, data in [("ALCATRAZ.BAS", alcatraz), ("ALCATRA2.BAS", alcatraz2)]:
        ok, lines, last_line, program_end = inspect_basic(data)
        free = 0xDE3F - program_end if program_end else 0
        print(
            f"{label}: size={len(data)}, lines={lines}, "
            f"lastLine={last_line}, programEnd=0x{program_end:04x}, "
            f"freeToDE3F={free}, ok={ok}"
        )
        if not ok:
            raise RuntimeError(f"bad tokenized BASIC pointers in {label}")

    image, rows = inspect_dsk(output)
    print(f"boot {image[:3].hex(' ')} size {len(image)}")
    for filename, cluster, size, first in rows:
        print(f"{filename} cluster={cluster} size={size} first=0x{first:02x}")


if __name__ == "__main__":
    main()
