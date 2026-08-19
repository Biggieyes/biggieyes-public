#!/usr/bin/env python3
"""BIGGI NFT metadata builder and Pinata helper.

This tool keeps the on-chain BIGGI filename scheme and the off-chain JSON
metadata in one place. It is intentionally stdlib-only so it can run from a
clean Python install.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import mimetypes
import os
import pathlib
import re
import shutil
import sys
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


MAIN_MAX_SUPPLY = 550
PUBLIC_MAX_SUPPLY = 100
BIGGI_OFFSET = 1001
TICKET_FILENAME = "Biggi_RANDOM_MINT_TICKET.json"
PINATA_LEGACY_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_LEGACY_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
DEFAULT_PINATA_GATEWAY = "https://biggieyes.mypinata.cloud"

BLOCK_NAMES = {
    1: "ORANGE",
    2: "BLACK",
    3: "WHITE",
    4: "BROWN",
    5: "BLUE",
    6: "GREEN",
    7: "VIOLET",
    8: "RED",
    9: "PINK",
    10: "RAINBOW",
}

BACKGROUND_SHORT = {
    1: "O",
    2: "B",
    3: "W",
    4: "BR",
    5: "BL",
    6: "G",
    7: "V",
    8: "R",
    9: "P",
    10: "RB",
}

BACKGROUND_LABEL = {
    1: "Orange",
    2: "Black",
    3: "White",
    4: "Brown",
    5: "Blue",
    6: "Green",
    7: "Violet",
    8: "Red",
    9: "Pink",
    10: "Rainbow",
}

LEGACY_BLOCKS = (
    ("ORANGE", 10),
    ("BLACK", 9),
    ("WHITE", 8),
    ("BROWN", 7),
    ("BLUE", 6),
    ("GREEN", 5),
    ("VIOLET", 4),
    ("RED", 3),
    ("PINK", 2),
    ("RAINBOW", 1),
)


@dataclass(frozen=True)
class LayoutRow:
    idx: int
    background: int
    block_idx: int
    main_id: int

    @property
    def token_id(self) -> int:
        return BIGGI_OFFSET + self.idx - 1

    def to_seed_item(self) -> dict[str, int]:
        return {
            "idx": self.idx,
            "background": self.background,
            "blockIdx": self.block_idx,
            "mainId": self.main_id,
        }


def fail(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def load_env_file(path: pathlib.Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def normalize_base_uri(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    return value if value.endswith("/") else f"{value}/"


def normalize_uri(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if value.startswith(("ipfs://", "http://", "https://", "ar://")):
        return value
    if value.startswith("/ipfs/"):
        return f"ipfs://{value[len('/ipfs/'):]}"
    if re.match(r"^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)(/.*)?$", value):
        return f"ipfs://{value}"
    return value


def safe_url_join(base: str, suffix: str, parameter: str = "token_id") -> str:
    base = base.strip()
    suffix = suffix.strip()
    if not base:
        return ""
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}{parameter}={suffix}"


def build_main_layout() -> list[LayoutRow]:
    rows: list[LayoutRow] = []
    idx = 1
    for block_idx in range(1, 11):
        background_count = 11 - block_idx
        min_main_id = ((block_idx - 1) * 10) + 1
        max_main_id = block_idx * 10
        for main_id in range(min_main_id, max_main_id + 1):
            for background in range(1, background_count + 1):
                rows.append(LayoutRow(idx, background, block_idx, main_id))
                idx += 1
    if len(rows) != MAIN_MAX_SUPPLY:
        fail(f"internal layout error: expected {MAIN_MAX_SUPPLY}, got {len(rows)}")
    return rows


def build_public_layout() -> list[LayoutRow]:
    return [
        LayoutRow(
            idx=idx,
            background=1,
            block_idx=((idx - 1) // 10) + 1,
            main_id=idx,
        )
        for idx in range(1, PUBLIC_MAX_SUPPLY + 1)
    ]


def build_layout(collection_kind: str = "main") -> list[LayoutRow]:
    return build_public_layout() if collection_kind == "main2" else build_main_layout()


def metadata_filename(row: LayoutRow, collection_kind: str) -> str:
    block_name = BLOCK_NAMES[row.block_idx]
    if collection_kind == "main2":
        suffix = "PUBLIC"
    else:
        suffix = BACKGROUND_SHORT[row.background]
    return f"Biggi_{row.main_id}_{block_name}_{suffix}.json"


def group_layout_rows(rows: list[LayoutRow], collection_kind: str) -> list[list[LayoutRow]]:
    grouped: dict[str, list[LayoutRow]] = {}
    for row in rows:
        grouped.setdefault(metadata_filename(row, collection_kind), []).append(row)
    return list(grouped.values())


def image_lookup_keys(row: LayoutRow, collection_kind: str) -> list[str]:
    filename = metadata_filename(row, collection_kind)
    block_name = BLOCK_NAMES[row.block_idx]
    background = "PUBLIC" if collection_kind == "main2" else BACKGROUND_SHORT[row.background]
    return [
        filename,
        filename.removesuffix(".json"),
        str(row.idx),
        str(row.token_id),
        f"{row.block_idx}:{row.main_id}:{row.background}",
        f"{block_name}:{row.main_id}:{background}",
    ]


def read_table(path: pathlib.Path) -> list[dict[str, Any]]:
    if not path.exists():
        fail(f"file not found: {path}")
    if path.suffix.lower() == ".json":
        parsed = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(parsed, list):
            return [dict(item) for item in parsed]
        if isinstance(parsed, dict):
            if isinstance(parsed.get("items"), list):
                return [dict(item) for item in parsed["items"]]
            return [{"key": key, **value} if isinstance(value, dict) else {"key": key, "image": value} for key, value in parsed.items()]
        fail(f"unsupported JSON shape in {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return [dict(row) for row in csv.DictReader(fh)]


def first_present(row: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def image_uri_from_row(row: dict[str, Any]) -> str:
    direct = first_present(row, ("image", "image_uri", "imageUri", "uri", "url"))
    if direct:
        return normalize_uri(direct)
    cid = first_present(row, ("cid", "image_cid", "imageCid", "ipfs_cid", "IpfsHash"))
    if not cid:
        return ""
    path = first_present(row, ("path", "file", "filename", "name"))
    if path:
        return normalize_uri(f"{cid.strip().removesuffix('/')}/{path.strip().lstrip('/')}")
    return normalize_uri(cid)


def load_image_map(path: pathlib.Path | None) -> dict[str, str]:
    if not path:
        return {}
    mapping: dict[str, str] = {}
    for row in read_table(path):
        image = image_uri_from_row(row)
        if not image:
            continue
        keys = [
            first_present(row, ("key", "metadata", "metadata_file", "metadataFilename")),
            first_present(row, ("file", "filename", "name")),
            first_present(row, ("idx", "index", "nftIndex", "tokenIndex")),
            first_present(row, ("token_id", "tokenId")),
        ]
        block_idx = first_present(row, ("blockIdx", "block", "blockIndex"))
        main_id = first_present(row, ("mainId", "main_id", "main"))
        background = first_present(row, ("background", "bg", "bgCode", "backgroundCode"))
        if block_idx and main_id and background:
            keys.append(f"{block_idx}:{main_id}:{background}")
        for key in keys:
            if key:
                mapping[key] = image
                if key.endswith(".png") or key.endswith(".jpg") or key.endswith(".webp"):
                    stem = pathlib.PurePosixPath(key).stem
                    mapping[stem] = image
                    mapping[f"{stem}.json"] = image
    return mapping


def select_image_uri(
    rows: list[LayoutRow],
    collection_kind: str,
    image_map: dict[str, str],
    placeholder_image_uri: str,
) -> tuple[str, bool]:
    resolved = {
        image_map[key]
        for row in rows
        for key in image_lookup_keys(row, collection_kind)
        if key in image_map
    }
    if len(resolved) > 1:
        filename = metadata_filename(rows[0], collection_kind)
        fail(
            f"conflicting image URIs for shared metadata file {filename}. "
            "MAIN2 requires one image per block/Main ID PUBLIC filename."
        )
    if resolved:
        return resolved.pop(), False
    return placeholder_image_uri, True


def build_metadata(
    row: LayoutRow,
    *,
    layout_rows: list[LayoutRow] | None = None,
    collection_kind: str,
    collection_name: str,
    description: str,
    image_uri: str,
    placeholder_used: bool,
    external_url: str,
    phase: str,
    chapter_id: int | None = None,
    series: str = "",
) -> dict[str, Any]:
    filename = metadata_filename(row, collection_kind)
    block_name = BLOCK_NAMES[row.block_idx]
    if collection_kind == "main2":
        display_name = f"{collection_name} #{row.main_id}"
        attributes: list[dict[str, Any]] = [
            {"trait_type": "Collection Kind", "value": "PUBLIC"},
            {"trait_type": "Phase", "value": phase},
            {"trait_type": "Block/Eye Color", "value": block_name},
            {"trait_type": "Block Index", "value": row.block_idx},
            {"trait_type": "Linked Block", "value": block_name},
            {"trait_type": "Price Source", "value": "Paired VRF Collection"},
            {"trait_type": "Main ID", "value": row.main_id},
            {"trait_type": "Image Finalized", "value": "No" if placeholder_used else "Yes"},
        ]
        external_suffix = str(row.main_id)
        external_parameter = "main_id"
    else:
        display_name = f"{collection_name} #{row.token_id}"
        attributes = [
            {"trait_type": "Collection Kind", "value": collection_kind.upper()},
            {"trait_type": "Phase", "value": phase},
            {"trait_type": "Block", "value": block_name},
            {"trait_type": "Block Index", "value": row.block_idx},
            {"trait_type": "Background", "value": BACKGROUND_LABEL[row.background]},
            {"trait_type": "Background Code", "value": BACKGROUND_SHORT[row.background]},
            {"trait_type": "Main ID", "value": row.main_id},
            {"trait_type": "Metadata Index", "value": row.idx},
            {"trait_type": "Token ID", "value": row.token_id},
            {"trait_type": "Image Finalized", "value": "No" if placeholder_used else "Yes"},
        ]
        external_suffix = str(row.token_id)
        external_parameter = "token_id"

    if chapter_id is not None:
        attributes.insert(2, {"trait_type": "Chapter", "value": chapter_id})
    if series:
        attributes.insert(3 if chapter_id is not None else 2, {"trait_type": "Series", "value": series})

    data: dict[str, Any] = {
        "name": display_name,
        "description": description,
        "external_url": safe_url_join(external_url, external_suffix, external_parameter) if external_url else "",
        "attributes": attributes,
        "compiler": "BIGGI metadata pipeline",
        "metadata_file": filename,
    }
    if image_uri:
        data["image"] = image_uri
    return {key: value for key, value in data.items() if value not in ("", None)}


def write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_seed_files(out_dir: pathlib.Path, rows: list[LayoutRow], collection_kind: str, metadata_cid_placeholder: str) -> None:
    items = [row.to_seed_item() for row in rows]
    write_json(out_dir / "layout.json", {"items": items})
    write_json(
        out_dir / "BATCH_UPLOAD.json",
        {
            "indices": [row.idx for row in rows],
            "bg_codes": [row.background for row in rows],
            "block_indices": [row.block_idx for row in rows],
            "main_ids": [row.main_id for row in rows],
        },
    )

    prefix = "PUBLIC" if collection_kind == "main2" else "MAIN"
    lines = [
        "# Fill <METADATA_FOLDER_CID> after uploading this metadata folder to Pinata/IPFS.",
        f"{prefix}_METADATA_FILE={out_dir / 'layout.json'}",
    ]
    for block_idx in range(1, 11):
        lines.append(f"{prefix}_BLOCK_URI_{block_idx}=ipfs://{metadata_cid_placeholder}/")
    (out_dir / "env.fragment.example").write_text("\n".join(lines) + "\n", encoding="utf-8")


def expected_legacy_main_files() -> list[tuple[str, str]]:
    expected: list[tuple[str, str]] = []
    bg_codes = [BACKGROUND_SHORT[i] for i in range(1, 11)]
    for block_pos, (block_name, background_count) in enumerate(LEGACY_BLOCKS, start=1):
        for main_id in range(((block_pos - 1) * 10) + 1, (block_pos * 10) + 1):
            for bg_code in bg_codes[:background_count]:
                expected.append((block_name, f"Biggi_{main_id}_{block_name}_{bg_code}"))
    return expected


def command_audit_legacy(args: argparse.Namespace) -> None:
    metadata_root = pathlib.Path(args.metadata_root).resolve()
    image_root = pathlib.Path(args.image_root).resolve() if args.image_root else None
    if not metadata_root.exists():
        fail(f"metadata root not found: {metadata_root}")
    if image_root and not image_root.exists():
        fail(f"image root not found: {image_root}")

    missing_metadata: list[str] = []
    invalid_metadata: list[str] = []
    missing_images: list[str] = []
    missing_image_field: list[str] = []

    for block_name, stem in expected_legacy_main_files():
        metadata_path = metadata_root / f"{block_name}_METADATA" / f"{stem}.json"
        if not metadata_path.exists():
            missing_metadata.append(str(metadata_path))
            continue
        try:
            data = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            invalid_metadata.append(f"{metadata_path}: {exc}")
            continue
        if not data.get("image"):
            missing_image_field.append(str(metadata_path))
        if image_root:
            image_path = image_root / f"{block_name}_EYES_NFT" / f"{stem}.png"
            if not image_path.exists():
                missing_images.append(str(image_path))

    ticket_metadata = metadata_root / "MINT_TICKET" / TICKET_FILENAME
    ticket_metadata_exists = ticket_metadata.exists()
    ticket_image = image_root / "MINT_TICKET" / "Biggi_RANDOM_MINT_TICKET.png" if image_root else None
    ticket_image_exists = bool(ticket_image and ticket_image.exists())

    report = {
        "metadataRoot": str(metadata_root),
        "imageRoot": str(image_root) if image_root else "",
        "expectedMainMetadata": 550,
        "missingMainMetadata": missing_metadata,
        "invalidMainMetadata": invalid_metadata,
        "missingImageField": missing_image_field,
        "missingLocalImages": missing_images,
        "ticketMetadataExists": ticket_metadata_exists,
        "ticketImageExists": ticket_image_exists,
        "ticketMetadataPath": str(ticket_metadata),
        "ticketImagePath": str(ticket_image) if ticket_image else "",
    }
    if args.report:
        write_json(pathlib.Path(args.report).resolve(), report)
    print(f"Metadata root: {metadata_root}")
    print(f"Main metadata missing: {len(missing_metadata)}")
    print(f"Main metadata invalid: {len(invalid_metadata)}")
    print(f"Main metadata missing image field: {len(missing_image_field)}")
    if image_root:
        print(f"Local main images missing: {len(missing_images)}")
        if missing_images:
            print(f"First missing local image: {missing_images[0]}")
    print(f"Ticket metadata exists: {ticket_metadata_exists}")
    print(f"Ticket image exists: {ticket_image_exists}")


def command_prepare_ticket_release(args: argparse.Namespace) -> None:
    if args.source_ticket_json:
        source = pathlib.Path(args.source_ticket_json).resolve()
    else:
        if not args.metadata_root:
            fail("provide --source-ticket-json or --metadata-root")
        source = pathlib.Path(args.metadata_root).resolve() / "MINT_TICKET" / TICKET_FILENAME
    if not source.exists():
        fail(f"ticket metadata not found: {source}")
    data = json.loads(source.read_text(encoding="utf-8"))
    if args.image_uri:
        data["image"] = normalize_uri(args.image_uri)
    if args.external_url:
        data["external_url"] = args.external_url
    if not data.get("image"):
        fail("ticket metadata has no image")

    marketing_count = args.marketing_count
    if marketing_count < 1 or marketing_count > MAIN_MAX_SUPPLY:
        fail("--marketing-count must be from 1 to 550")
    sale_cap = MAIN_MAX_SUPPLY - marketing_count

    out_dir = pathlib.Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(out_dir / TICKET_FILENAME, data)

    if args.copy_image and args.source_ticket_image:
        image_source = pathlib.Path(args.source_ticket_image).resolve()
        if not image_source.exists():
            fail(f"ticket image not found: {image_source}")
        shutil.copy2(image_source, out_dir / image_source.name)

    metadata_base = args.ticket_base_uri or f"ipfs://{args.metadata_cid_placeholder}/"
    write_json(
        out_dir / "marketing-ticket-release.json",
        {
            "generatedAt": now_iso(),
            "marketingCount": marketing_count,
            "saleCap": sale_cap,
            "marketingCap": marketing_count,
            "ticketMetadataFile": TICKET_FILENAME,
            "ticketBaseUri": metadata_base,
            "tokenUriBehavior": "All TicketHub tickets resolve to ticketBaseURI + Biggi_RANDOM_MINT_TICKET.json.",
            "marketingTicketIds": list(range(1, marketing_count + 1)),
        },
    )
    (out_dir / "env.fragment.example").write_text(
        "\n".join(
            [
                f"SALE_CAP={sale_cap}",
                f"MARKETING_CAP={marketing_count}",
                f"TICKET_BASE_URI={metadata_base}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Prepared marketing ticket metadata: {out_dir / TICKET_FILENAME}")
    print(f"Marketing tickets: {marketing_count}")
    print(f"SALE_CAP={sale_cap}")
    print(f"MARKETING_CAP={marketing_count}")


def command_build(args: argparse.Namespace) -> None:
    if args.chapter_id is not None and args.chapter_id < 1:
        fail("--chapter-id must be at least 1")
    placeholder = normalize_uri(args.placeholder_image_uri or os.environ.get("PLACEHOLDER_IMAGE_URI", ""))
    image_map = load_image_map(pathlib.Path(args.image_map).resolve() if args.image_map else None)
    rows = build_layout(args.collection_kind)
    row_groups = group_layout_rows(rows, args.collection_kind)
    out_dir = pathlib.Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    placeholder_count = 0
    finalized_count = 0

    for shared_rows in row_groups:
        row = shared_rows[0]
        filename = metadata_filename(row, args.collection_kind)
        image_uri, placeholder_used = select_image_uri(shared_rows, args.collection_kind, image_map, placeholder)
        if not image_uri and not args.allow_missing_image:
            fail(
                "image URI missing. Provide --placeholder-image-uri for prereveal/marketing "
                "metadata, --image-map for final metadata, or pass --allow-missing-image."
            )
        metadata = build_metadata(
            row,
            layout_rows=shared_rows,
            collection_kind=args.collection_kind,
            collection_name=args.collection_name,
            description=args.description,
            image_uri=image_uri,
            placeholder_used=placeholder_used,
            external_url=args.external_url,
            phase=args.phase,
            chapter_id=args.chapter_id,
            series=args.series,
        )
        write_json(out_dir / filename, metadata)
        if placeholder_used:
            placeholder_count += 1
        else:
            finalized_count += 1

    write_seed_files(out_dir, rows, args.collection_kind, args.metadata_cid_placeholder)
    manifest = {
        "collectionKind": args.collection_kind,
        "phase": args.phase,
        "chapterId": args.chapter_id,
        "series": args.series,
        "generatedAt": now_iso(),
        "maxSupply": len(rows),
        "layoutRows": len(rows),
        "metadataFiles": len(row_groups),
        "sharedTokenUriRows": len(rows) - len(row_groups),
        "placeholderImageCount": placeholder_count,
        "finalImageCount": finalized_count,
        "placeholderImageUriSet": bool(placeholder),
        "imageMap": str(pathlib.Path(args.image_map).resolve()) if args.image_map else "",
        "notes": [
            "MAIN uses 550 unique filenames.",
            "MAIN2 uses 100 unique PUBLIC filenames for 100 independently mintable NFTs, ten per block.",
            "Live MAIN2 prices come from the paired VRF collection; Public NFTs have no background variants or adjustments.",
            "Set all block base URIs to the uploaded metadata folder CID unless you intentionally split folders per block.",
        ],
    }
    write_json(out_dir / "_metadata_manifest.json", manifest)

    print(f"Generated metadata: {out_dir}")
    print(f"Layout rows: {len(rows)}")
    print(f"Metadata files: {len(row_groups)}")
    print(f"Final images: {finalized_count}")
    print(f"Placeholder images: {placeholder_count}")
    shared_rows = len(rows) - len(row_groups)
    if shared_rows:
        print(f"Layout rows sharing existing tokenURI files: {shared_rows}")


def iter_json_files(path: pathlib.Path) -> list[pathlib.Path]:
    if path.is_file():
        return [path]
    return sorted(p for p in path.rglob("*.json") if p.is_file())


def validate_metadata_file(path: pathlib.Path, require_image: bool, kind: str) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return [f"{path}: invalid JSON: {exc}"]
    if not isinstance(data, dict):
        return [f"{path}: metadata must be a JSON object"]

    effective_kind = kind
    if effective_kind == "auto":
        effective_kind = "contract" if "external_link" in data or "seller_fee_basis_points" in data else "token"

    required_fields = ("name", "description") if effective_kind == "contract" else ("name", "description", "attributes")
    for field in required_fields:
        if field not in data:
            errors.append(f"{path}: missing {field}")
    if require_image and not data.get("image"):
        errors.append(f"{path}: missing image")
    if effective_kind == "token" and "attributes" in data and not isinstance(data["attributes"], list):
        errors.append(f"{path}: attributes must be an array")
    if effective_kind == "contract" and "seller_fee_basis_points" in data:
        fee = data["seller_fee_basis_points"]
        if not isinstance(fee, int) or fee < 0 or fee > 10000:
            errors.append(f"{path}: seller_fee_basis_points must be an integer from 0 to 10000")
    return errors


def command_validate(args: argparse.Namespace) -> None:
    target = pathlib.Path(args.path).resolve()
    if not target.exists():
        fail(f"path not found: {target}")
    skipped = {"layout.json", "BATCH_UPLOAD.json", "_metadata_manifest.json", "marketing-ticket-release.json"}
    files = [p for p in iter_json_files(target) if p.name not in skipped]
    if not files:
        fail(f"no metadata JSON files found in {target}")
    errors: list[str] = []
    for path in files:
        errors.extend(validate_metadata_file(path, args.require_image, args.kind))
    if errors:
        for error in errors:
            print(error)
        fail(f"metadata validation failed with {len(errors)} error(s)")
    print(f"Metadata validation OK: {len(files)} file(s)")


def command_ticket(args: argparse.Namespace) -> None:
    image_uri = normalize_uri(args.image_uri or args.placeholder_image_uri or os.environ.get("PLACEHOLDER_IMAGE_URI", ""))
    if not image_uri and not args.allow_missing_image:
        fail("ticket image URI missing. Provide --image-uri or --placeholder-image-uri.")
    if args.chapter_id is not None and args.chapter_id < 1:
        fail("--chapter-id must be at least 1")
    attributes = [
        {"trait_type": "Token Type", "value": "Random Mint Ticket"},
        {"trait_type": "Redeem Source", "value": "VRF"},
        {"trait_type": "Phase", "value": args.phase},
        {"trait_type": "Image Finalized", "value": "No" if args.phase == "placeholder" else "Yes"},
    ]
    if args.chapter_id is not None:
        attributes.append({"trait_type": "Chapter", "value": args.chapter_id})
    if args.series:
        attributes.append({"trait_type": "Series", "value": args.series})
    attributes.append({"trait_type": "Redeem Status", "value": "Enabled when chapter activates"})
    metadata: dict[str, Any] = {
        "name": args.name,
        "description": args.description,
        "attributes": attributes,
        "compiler": "BIGGI metadata pipeline",
        "metadata_file": TICKET_FILENAME,
    }
    if image_uri:
        metadata["image"] = image_uri
    if args.external_url:
        metadata["external_url"] = args.external_url
    out_dir = pathlib.Path(args.out).resolve()
    write_json(out_dir / TICKET_FILENAME, metadata)
    write_json(
        out_dir / "_metadata_manifest.json",
        {
            "kind": "ticket",
            "phase": args.phase,
            "generatedAt": now_iso(),
            "metadataFiles": 1,
            "filename": TICKET_FILENAME,
            "ticketBaseUriEnv": f"TICKET_BASE_URI=ipfs://{args.metadata_cid_placeholder}/",
        },
    )
    (out_dir / "env.fragment.example").write_text(
        "\n".join(
            [
                "# Fill <TICKET_METADATA_FOLDER_CID> after uploading this folder.",
                f"TICKET_BASE_URI=ipfs://{args.metadata_cid_placeholder}/",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Generated ticket metadata: {out_dir / TICKET_FILENAME}")


def command_contract(args: argparse.Namespace) -> None:
    image_uri = normalize_uri(args.image_uri)
    if not image_uri and args.require_image:
        fail("contract image URI missing. Provide --image-uri or omit --require-image.")
    metadata: dict[str, Any] = {
        "name": args.name,
        "description": args.description,
    }
    if image_uri:
        metadata["image"] = image_uri
    if args.external_link:
        metadata["external_link"] = args.external_link
    if args.seller_fee_basis_points is not None:
        if args.seller_fee_basis_points < 0 or args.seller_fee_basis_points > 10000:
            fail("--seller-fee-basis-points must be between 0 and 10000")
        metadata["seller_fee_basis_points"] = args.seller_fee_basis_points
    if args.fee_recipient:
        metadata["fee_recipient"] = args.fee_recipient
    out = pathlib.Path(args.out).resolve()
    if out.suffix.lower() != ".json":
        out = out / "contract.json"
    write_json(out, metadata)
    print(f"Generated contract metadata: {out}")


def command_summary(args: argparse.Namespace) -> None:
    layout = build_layout()
    rows_by_block: dict[int, int] = {}
    unique_files_main = set()
    unique_files_main2 = set()
    for row in layout:
        rows_by_block[row.block_idx] = rows_by_block.get(row.block_idx, 0) + 1
        unique_files_main.add(metadata_filename(row, "main"))
        unique_files_main2.add(metadata_filename(row, "main2"))
    print(f"Rows: {len(layout)}")
    print(f"MAIN unique metadata files: {len(unique_files_main)}")
    print(f"MAIN2 unique metadata files: {len(unique_files_main2)}")
    for block_idx in range(1, 11):
        print(f"Block {block_idx} {BLOCK_NAMES[block_idx]}: {rows_by_block[block_idx]} rows")


def pinata_auth_headers() -> dict[str, str]:
    jwt = os.environ.get("PINATA_JWT", "").strip()
    if jwt:
        return {"Authorization": f"Bearer {jwt}"}
    api_key = os.environ.get("PINATA_API_KEY", "").strip()
    secret = os.environ.get("PINATA_SECRET_API_KEY", "").strip()
    if not api_key or not secret:
        fail("missing Pinata credentials. Set PINATA_JWT or PINATA_API_KEY + PINATA_SECRET_API_KEY.")
    return {"pinata_api_key": api_key, "pinata_secret_api_key": secret}


def gateway_url(cid: str) -> str:
    base = os.environ.get("PINATA_GATEWAY_BASE_URL") or os.environ.get("PINATA_GATEWAY_URL") or DEFAULT_PINATA_GATEWAY
    return f"{base.rstrip('/')}/ipfs/{cid}"


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        fail(f"Pinata HTTP {exc.code}: {detail}")


def build_multipart(fields: dict[str, str], files: list[tuple[str, str, str, bytes]]) -> tuple[bytes, str]:
    boundary = f"----biggi-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    for field, filename, content_type, data in files:
        safe_filename = filename.replace("\\", "/")
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{field}"; filename="{safe_filename}"\r\n'.encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                data,
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def collect_upload_files(path: pathlib.Path) -> list[tuple[str, str, str, bytes]]:
    if path.is_file():
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return [("file", path.name, mime, path.read_bytes())]
    files: list[tuple[str, str, str, bytes]] = []
    for child in sorted(p for p in path.rglob("*") if p.is_file()):
        rel = f"{path.name}/{child.relative_to(path).as_posix()}"
        mime = mimetypes.guess_type(child.name)[0] or "application/octet-stream"
        files.append(("file", rel, mime, child.read_bytes()))
    return files


def post_multipart(url: str, fields: dict[str, str], files: list[tuple[str, str, str, bytes]], headers: dict[str, str]) -> dict[str, Any]:
    body, boundary = build_multipart(fields, files)
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        fail(f"Pinata HTTP {exc.code}: {detail}")


def command_pinata_upload(args: argparse.Namespace) -> None:
    target = pathlib.Path(args.path).resolve()
    if not target.exists():
        fail(f"path not found: {target}")
    if args.env_file:
        load_env_file(pathlib.Path(args.env_file).resolve())
    name = args.name or target.name

    if target.is_file() and target.suffix.lower() == ".json" and args.json_endpoint:
        content = json.loads(target.read_text(encoding="utf-8"))
        payload = {
            "pinataOptions": {"cidVersion": 1},
            "pinataMetadata": {"name": name},
            "pinataContent": content,
        }
        if not args.execute:
            print(f"DRY RUN: would upload JSON to Pinata: {target}")
            print("Add --execute to perform the upload.")
            return
        result = post_json(PINATA_LEGACY_PIN_JSON_URL, payload, pinata_auth_headers())
    else:
        files = collect_upload_files(target)
        total_bytes = sum(len(item[3]) for item in files)
        print(f"Upload target: {target}")
        print(f"Files: {len(files)}")
        print(f"Total bytes: {total_bytes}")
        if not files:
            fail("upload path contains no files")
        if not args.execute:
            print("DRY RUN: would upload with Pinata pinFileToIPFS.")
            print("Add --execute to perform the upload.")
            return
        fields = {
            "pinataMetadata": json.dumps({"name": name}, ensure_ascii=False),
            "pinataOptions": json.dumps({"cidVersion": 1}),
        }
        result = post_multipart(PINATA_LEGACY_PIN_FILE_URL, fields, files, pinata_auth_headers())

    cid = result.get("IpfsHash") or result.get("cid") or result.get("data", {}).get("cid")
    if not cid:
        print(json.dumps(result, indent=2))
        fail("Pinata response did not include CID")
    print(f"CID: {cid}")
    print(f"IPFS URI: ipfs://{cid}")
    print(f"Gateway: {gateway_url(cid)}")
    if target.is_dir():
        print(f"IPFS folder base: ipfs://{cid}/")
        print(f"Gateway folder base: {gateway_url(cid)}/")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and validate BIGGI NFT metadata.")
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="generate BIGGI metadata JSON files")
    build.add_argument("--collection-kind", choices=("main", "main2"), default="main")
    build.add_argument("--phase", choices=("placeholder", "final"), default="placeholder")
    build.add_argument("--collection-name", default="BIGGI")
    build.add_argument("--description", default="BIGGI NFT collection metadata.")
    build.add_argument("--chapter-id", type=int, default=None)
    build.add_argument("--series", default="")
    build.add_argument("--external-url", default="")
    build.add_argument("--placeholder-image-uri", default="")
    build.add_argument("--image-map", default="", help="CSV or JSON mapping metadata rows/files to final image URIs/CIDs")
    build.add_argument("--out", required=True)
    build.add_argument("--allow-missing-image", action="store_true")
    build.add_argument("--metadata-cid-placeholder", default="<METADATA_FOLDER_CID>")
    build.set_defaults(func=command_build)

    validate = sub.add_parser("validate", help="validate OpenSea-compatible metadata files")
    validate.add_argument("--path", required=True)
    validate.add_argument("--require-image", action="store_true")
    validate.add_argument("--kind", choices=("token", "contract", "auto"), default="token")
    validate.set_defaults(func=command_validate)

    ticket = sub.add_parser("build-ticket", help="generate TicketHub metadata")
    ticket.add_argument("--phase", choices=("placeholder", "final"), default="placeholder")
    ticket.add_argument("--name", default="BIGGI Random Mint Ticket")
    ticket.add_argument("--description", default="BIGGI random mint ticket metadata.")
    ticket.add_argument("--chapter-id", type=int, default=None)
    ticket.add_argument("--series", default="")
    ticket.add_argument("--image-uri", default="")
    ticket.add_argument("--placeholder-image-uri", default="")
    ticket.add_argument("--external-url", default="")
    ticket.add_argument("--out", required=True)
    ticket.add_argument("--allow-missing-image", action="store_true")
    ticket.add_argument("--metadata-cid-placeholder", default="<TICKET_METADATA_FOLDER_CID>")
    ticket.set_defaults(func=command_ticket)

    contract = sub.add_parser("build-contract", help="generate collection-level contractURI metadata")
    contract.add_argument("--name", required=True)
    contract.add_argument("--description", required=True)
    contract.add_argument("--image-uri", default="")
    contract.add_argument("--external-link", default="")
    contract.add_argument("--seller-fee-basis-points", type=int, default=None)
    contract.add_argument("--fee-recipient", default="")
    contract.add_argument("--out", required=True)
    contract.add_argument("--require-image", action="store_true")
    contract.set_defaults(func=command_contract)

    audit = sub.add_parser("audit-legacy", help="audit existing BIGGI metadata/image folders")
    audit.add_argument("--metadata-root", required=True)
    audit.add_argument("--image-root", default="")
    audit.add_argument("--report", default="")
    audit.set_defaults(func=command_audit_legacy)

    ticket_release = sub.add_parser(
        "prepare-ticket-release",
        help="copy existing ticket metadata into a marketing-ticket release folder",
    )
    ticket_release.add_argument("--metadata-root", default="")
    ticket_release.add_argument("--source-ticket-json", default="")
    ticket_release.add_argument("--source-ticket-image", default="")
    ticket_release.add_argument("--image-uri", default="")
    ticket_release.add_argument("--external-url", default="")
    ticket_release.add_argument("--marketing-count", type=int, default=50)
    ticket_release.add_argument("--ticket-base-uri", default="")
    ticket_release.add_argument("--metadata-cid-placeholder", default="<TICKET_METADATA_FOLDER_CID>")
    ticket_release.add_argument("--copy-image", action="store_true")
    ticket_release.add_argument("--out", required=True)
    ticket_release.set_defaults(func=command_prepare_ticket_release)

    summary = sub.add_parser("summary", help="print BIGGI metadata matrix summary")
    summary.set_defaults(func=command_summary)

    upload = sub.add_parser("pinata-upload", help="upload one JSON file or a folder through Pinata")
    upload.add_argument("--path", required=True)
    upload.add_argument("--name", default="")
    upload.add_argument("--env-file", default="", help="optional .env file with Pinata credentials")
    upload.add_argument("--json-endpoint", action="store_true", help="use pinJSONToIPFS for a single JSON file")
    upload.add_argument("--execute", action="store_true", help="perform the external Pinata upload")
    upload.set_defaults(func=command_pinata_upload)

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
