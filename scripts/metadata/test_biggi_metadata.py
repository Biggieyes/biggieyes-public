import csv
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest


SCRIPT_PATH = pathlib.Path(__file__).with_name("biggi_metadata.py")
SPEC = importlib.util.spec_from_file_location("biggi_metadata", SCRIPT_PATH)
assert SPEC and SPEC.loader
metadata = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = metadata
SPEC.loader.exec_module(metadata)


def trait_map(document):
    return {item["trait_type"]: item["value"] for item in document["attributes"]}


class Main2MetadataTests(unittest.TestCase):
    def test_main_layout_and_background_traits_remain_unchanged(self):
        rows = metadata.build_main_layout()
        self.assertEqual(len(rows), 550)
        self.assertEqual(len({metadata.metadata_filename(row, "main") for row in rows}), 550)
        self.assertEqual([row.background for row in rows[:10]], list(range(1, 11)))
        self.assertEqual([sum(row.block_idx == block for row in rows) for block in range(1, 11)],
                         [100, 90, 80, 70, 60, 50, 40, 30, 20, 10])
        document = metadata.build_metadata(
            rows[1], collection_kind="main", collection_name="BIGGI",
            description="VRF", image_uri="ipfs://bafyexample/Biggi_1_ORANGE_B.png",
            placeholder_used=False, external_url="", phase="final",
        )
        traits = trait_map(document)
        self.assertEqual(traits["Background"], "Black")
        self.assertEqual(traits["Background Code"], "B")
        self.assertEqual(traits["Block"], "ORANGE")

    def test_main2_has_100_unique_rows_with_ten_nfts_per_block(self):
        rows = metadata.build_layout("main2")
        groups = metadata.group_layout_rows(rows, "main2")

        self.assertEqual(len(rows), 100)
        self.assertEqual(len(groups), 100)
        self.assertEqual(metadata.metadata_filename(groups[0][0], "main2"), "Biggi_1_ORANGE_PUBLIC.json")
        self.assertEqual(len(groups[0]), 1)
        self.assertEqual(metadata.metadata_filename(groups[-1][0], "main2"), "Biggi_100_RAINBOW_PUBLIC.json")
        self.assertEqual(len(groups[-1]), 1)
        self.assertTrue(all(row.background == 1 for row in rows))
        self.assertEqual([row.block_idx for row in rows[:10]], [1] * 10)
        self.assertEqual([row.block_idx for row in rows[-10:]], [10] * 10)
        self.assertTrue(all(row.main_id == row.idx for row in rows))

    def test_main2_metadata_has_no_per_token_or_background_price_traits(self):
        group = metadata.group_layout_rows(metadata.build_layout("main2"), "main2")[0]
        document = metadata.build_metadata(
            group[0],
            layout_rows=group,
            collection_kind="main2",
            collection_name="BIGGI Universe Public",
            description="Public companion collection.",
            image_uri="ipfs://bafyexample/Biggi_1_ORANGE_PUBLIC.png",
            placeholder_used=False,
            external_url="https://biggieyes.com/collection",
            phase="final",
            chapter_id=2,
            series="Universe",
        )
        traits = trait_map(document)

        self.assertEqual(document["name"], "BIGGI Universe Public #1")
        self.assertEqual(document["metadata_file"], "Biggi_1_ORANGE_PUBLIC.json")
        self.assertEqual(document["external_url"], "https://biggieyes.com/collection?main_id=1")
        self.assertEqual(traits["Collection Kind"], "PUBLIC")
        self.assertEqual(traits["Block/Eye Color"], "ORANGE")
        self.assertEqual(traits["Price Source"], "Paired VRF Collection")
        self.assertEqual(traits["Chapter"], 2)
        self.assertEqual(traits["Series"], "Universe")
        forbidden = {
            "Metadata Index",
            "Token ID",
            "Block Increase",
            "Background Bonus",
            "Base Block Price",
            "Current Block Price",
            "Final Price",
            "Ticket Price",
            "Public Copies",
            "Background",
            "Background Color",
            "Background Code",
        }
        self.assertTrue(forbidden.isdisjoint(traits))

    def test_main2_resolves_a_unique_image_per_public_nft(self):
        groups = metadata.group_layout_rows(metadata.build_layout("main2"), "main2")
        image, placeholder = metadata.select_image_uri(
            groups[1],
            "main2",
            {"2": "ipfs://bafytwo/2.png"},
            "",
        )
        self.assertEqual(image, "ipfs://bafytwo/2.png")
        self.assertFalse(placeholder)

    def test_build_writes_100_metadata_files_and_100_seed_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result = metadata.main(
                [
                    "build",
                    "--collection-kind",
                    "main2",
                    "--phase",
                    "placeholder",
                    "--collection-name",
                    "BIGGI Universe Public",
                    "--chapter-id",
                    "2",
                    "--series",
                    "Universe",
                    "--placeholder-image-uri",
                    "ipfs://bafyplaceholder/public.png",
                    "--out",
                    temp_dir,
                ]
            )
            output = pathlib.Path(temp_dir)
            public_files = list(output.glob("Biggi_*_PUBLIC.json"))
            layout = json.loads((output / "layout.json").read_text(encoding="utf-8"))
            manifest = json.loads((output / "_metadata_manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(result, 0)
            self.assertEqual(len(public_files), 100)
            self.assertEqual(len(layout["items"]), 100)
            self.assertEqual(layout["items"][0], {"idx": 1, "background": 1, "blockIdx": 1, "mainId": 1})
            self.assertEqual(layout["items"][-1], {"idx": 100, "background": 1, "blockIdx": 10, "mainId": 100})
            self.assertEqual(manifest["metadataFiles"], 100)
            self.assertEqual(manifest["layoutRows"], 100)
            self.assertEqual(manifest["sharedTokenUriRows"], 0)
            self.assertEqual(manifest["chapterId"], 2)
            self.assertEqual(manifest["series"], "Universe")

    def test_pinata_folder_upload_uses_one_common_root_path(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            (root / "Biggi_1_ORANGE_PUBLIC.json").write_text("{}", encoding="utf-8")
            nested = root / "nested"
            nested.mkdir()
            (nested / "example.json").write_text("{}", encoding="utf-8")

            upload_files = metadata.collect_upload_files(root)
            paths = [item[1] for item in upload_files]

            root_name = root.name
            self.assertEqual(
                paths,
                [f"{root_name}/Biggi_1_ORANGE_PUBLIC.json", f"{root_name}/nested/example.json"],
            )


class PublicFinalReleaseTests(unittest.TestCase):
    def image_map(self):
        return {
            metadata.metadata_filename(row, "main2"):
                f"ipfs://bafyexample/Biggi_{row.main_id}_{metadata.BLOCK_NAMES[row.block_idx]}_PUBLIC.png"
            for row in metadata.build_public_layout()
        }

    def run_build(self, root, images, *extra):
        image_map = root / "images.json"
        image_map.write_text(json.dumps(images), encoding="utf-8")
        return metadata.main([
            "build", "--collection-kind", "main2", "--phase", "final",
            "--collection-name", "BIGGI Originals Public", "--chapter-id", "1",
            "--series", "Original", "--image-map", str(image_map),
            "--out", str(root / "release"), *extra,
        ])

    def test_complete_final_release_preserves_all_public_mappings(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            self.assertEqual(self.run_build(root, self.image_map()), 0)
            release = root / "release"
            manifest = json.loads((release / "_metadata_manifest.json").read_text())
            self.assertEqual(manifest["finalImageCount"], 100)
            self.assertEqual(manifest["placeholderImageCount"], 0)
            layout = json.loads((release / "layout.json").read_text())
            self.assertEqual(layout["items"], [row.to_seed_item() for row in metadata.build_public_layout()])
            for row in metadata.build_public_layout():
                document = json.loads((release / metadata.metadata_filename(row, "main2")).read_text())
                traits = trait_map(document)
                self.assertEqual(traits["Main ID"], row.idx)
                self.assertEqual(traits["Block Index"], row.block_idx)
                self.assertEqual(traits["Block/Eye Color"], metadata.BLOCK_NAMES[row.block_idx])
                self.assertEqual(traits["Linked Block"], metadata.BLOCK_NAMES[row.block_idx])
                self.assertEqual(traits["Price Source"], "Paired VRF Collection")
                self.assertEqual(traits["Chapter"], 1)
                self.assertEqual(traits["Image Finalized"], "Yes")
                self.assertFalse(any("Background" in name for name in traits))

    def test_missing_final_image_cannot_fall_back_or_write_partial_release(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            images = self.image_map()
            del images["Biggi_100_RAINBOW_PUBLIC.json"]
            with self.assertRaisesRegex(SystemExit, "Biggi_100_RAINBOW_PUBLIC"):
                self.run_build(root, images, "--placeholder-image-uri", "ipfs://bafyplaceholder/image.png", "--allow-missing-image")
            self.assertFalse((root / "release").exists())

    def test_placeholder_duplicate_and_local_image_uris_are_rejected(self):
        for uri in ("ipfs://bafyplaceholder/image.png", "./local.png", "ipfs://<IMAGE_CID>/1.png", "https:///1.png", ""):
            with self.subTest(uri=uri), tempfile.TemporaryDirectory() as temp_dir:
                root = pathlib.Path(temp_dir)
                images = self.image_map()
                images["Biggi_1_ORANGE_PUBLIC.json"] = uri
                with self.assertRaisesRegex(SystemExit, "explicit final image"):
                    self.run_build(root, images, "--placeholder-image-uri", "ipfs://bafyplaceholder/image.png")
                self.assertFalse((root / "release").exists())
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            images = self.image_map()
            images["Biggi_2_ORANGE_PUBLIC.json"] = images["Biggi_1_ORANGE_PUBLIC.json"]
            with self.assertRaisesRegex(SystemExit, "already assigned"):
                self.run_build(root, images)

    def test_conflicting_image_map_rows_do_not_silently_overwrite(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            images = [{"metadata_file": key, "image": value} for key, value in self.image_map().items()]
            images.append({"metadata_file": "Biggi_1_ORANGE_PUBLIC.json", "image": "ipfs://bafyother/1.png"})
            with self.assertRaisesRegex(SystemExit, "conflicting image URIs"):
                self.run_build(root, images)
            self.assertFalse((root / "release").exists())

    def test_background_variants_and_wrong_nft_image_names_are_rejected(self):
        for stem in ("Biggi_1_ORANGE_O", "Biggi_1_PUBLIC_ORANGE_O", "Biggi_2_ORANGE_PUBLIC", "Biggi_1_BLUE_PUBLIC"):
            with self.subTest(stem=stem), tempfile.TemporaryDirectory() as temp_dir:
                root = pathlib.Path(temp_dir)
                images = self.image_map()
                images["Biggi_1_ORANGE_PUBLIC.json"] = f"ipfs://bafyother/{stem}.png"
                with self.assertRaisesRegex(SystemExit, "another NFT or a background variant"):
                    self.run_build(root, images)
                self.assertFalse((root / "release").exists())

    def test_previous_release_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            (root / "release").mkdir()
            existing = root / "release" / "Biggi_1_ORANGE_PUBLIC.json"
            existing.write_text("previous metadata", encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "empty output directory"):
                self.run_build(root, self.image_map())
            self.assertEqual(existing.read_text(), "previous metadata")


class PublicArtworkAuditTests(unittest.TestCase):
    def write_image(self, root, name, content=b"image"):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"\x89PNG\r\n\x1a\n" + content)
        return path

    def test_missing_and_wrong_block_names_are_reported_without_changing_sources(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            self.write_image(root, "ORANGE/Biggi_1_ORANGE_PUBLIC.png")
            self.write_image(root, "BLUE/Biggi_11_BLUE_PUBLIC.png")
            self.write_image(root, "ORANGE/Biggi_1_PUBLIC_ORANGE_O.png")
            self.write_image(root, "ORANGE/Biggi_1_ORANGE_O.png")
            self.write_image(root, "gen_unassigned.png")
            before = {str(path): path.read_bytes() for path in root.rglob("*.png")}
            report = metadata.audit_public_artwork(root)
            self.assertEqual(report["matchedCount"], 1)
            self.assertEqual(report["missingCount"], 99)
            self.assertEqual(report["invalidPublicNames"], ["BLUE/Biggi_11_BLUE_PUBLIC.png"])
            self.assertEqual(len(report["legacyBackgroundVariants"]), 2)
            self.assertEqual(len(report["unassignedImages"]), 1)
            self.assertFalse(report["mappingComplete"])
            self.assertFalse(report["artworkApproved"])
            self.assertEqual(before, {str(path): path.read_bytes() for path in root.rglob("*.png")})

    def test_ambiguous_names_duplicate_content_and_invalid_headers_are_blocked(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            self.write_image(root, "one/Biggi_1_ORANGE_PUBLIC.png", b"one")
            self.write_image(root, "two/Biggi_1_ORANGE_PUBLIC.png", b"two")
            self.write_image(root, "Biggi_2_ORANGE_PUBLIC.png", b"duplicate")
            self.write_image(root, "Biggi_3_ORANGE_PUBLIC.png", b"duplicate")
            (root / "Biggi_4_ORANGE_PUBLIC.png").write_bytes(b"not an image")
            report = metadata.audit_public_artwork(root)
            self.assertEqual([item["status"] for item in report["items"][:4]], [
                "ambiguous", "duplicate-content", "duplicate-content", "invalid-image-header",
            ])
            self.assertEqual(report["matchedCount"], 0)

    def test_complete_mapping_does_not_imply_artwork_approval(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            for row in metadata.build_public_layout():
                self.write_image(root, metadata.metadata_filename(row, "main2").replace(".json", ".png"), str(row.idx).encode())
            report = metadata.audit_public_artwork(root)
            self.assertTrue(report["mappingComplete"])
            self.assertFalse(report["artworkApproved"])
            self.assertEqual(report["matchedCount"], 100)

    def test_cli_writes_a_100_row_template_but_returns_failure_for_incomplete_set(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = pathlib.Path(temp_dir)
            source = root / "source"
            source.mkdir()
            out = root / "audit"
            with self.assertRaisesRegex(SystemExit, "mapping is incomplete"):
                metadata.main(["audit-public-artwork", "--image-root", str(source), "--out", str(out)])
            with (out / "public-image-map.csv").open(encoding="utf-8", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 100)
            self.assertEqual(rows[0]["metadata_file"], "Biggi_1_ORANGE_PUBLIC.json")
            self.assertEqual(rows[-1]["metadata_file"], "Biggi_100_RAINBOW_PUBLIC.json")
            self.assertTrue(all(row["image"] == "" for row in rows))
            with self.assertRaisesRegex(SystemExit, "overwriting an edited image map"):
                metadata.main(["audit-public-artwork", "--image-root", str(source), "--out", str(out)])
            with self.assertRaisesRegex(SystemExit, "outside the source"):
                metadata.main(["audit-public-artwork", "--image-root", str(source), "--out", str(source / "audit")])


class TicketMetadataTests(unittest.TestCase):
    def test_ticket_traits_are_stable_and_opensea_friendly(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result = metadata.main(
                [
                    "build-ticket",
                    "--phase",
                    "final",
                    "--name",
                    "BIGGI Universe Random Mint Ticket",
                    "--description",
                    "BIGGI ticket for Chapter 2: Universe.",
                    "--chapter-id",
                    "2",
                    "--series",
                    "Universe",
                    "--image-uri",
                    "ipfs://bafyexample/ticket.png",
                    "--out",
                    temp_dir,
                ]
            )
            document = json.loads(
                (pathlib.Path(temp_dir) / "Biggi_RANDOM_MINT_TICKET.json").read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual(result, 0)
            self.assertEqual(
                trait_map(document),
                {
                    "Ticket Type": "Random Mint Ticket",
                    "Chapter": "Chapter 2",
                    "Series": "Universe",
                    "Mint Mechanism": "Chainlink VRF",
                },
            )
            internal_traits = {
                "Phase",
                "Image Finalized",
                "Redeem Source",
                "Redeem Status",
                "Ticket Price",
                "Utility",
            }
            self.assertTrue(internal_traits.isdisjoint(trait_map(document)))


if __name__ == "__main__":
    unittest.main()
