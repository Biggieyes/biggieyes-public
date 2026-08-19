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


if __name__ == "__main__":
    unittest.main()
