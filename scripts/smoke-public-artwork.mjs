import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer, transformWithEsbuild } from "vite";
import { chromium } from "playwright";

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/index.css';
import '/src/App.css';
import '/src/features/rewards/COLLECTION/COLLECTIONBlocksGrid.css';
import Panel from '/src/features/rewards/COLLECTION/CollectionBlocksGrid.Collection2Panel.jsx';
import release from '/src/features/rewards/COLLECTION/publicOriginalsArtwork.json';
import {getPublicArtworkPreview} from '/src/features/rewards/COLLECTION/publicArtworkPreview.js';
import {DEFAULT_BLOCKS} from '/src/shared/blocks';
function Fixture() {
  const [index,setIndex]=React.useState(1);
  const block=Math.floor((index-1)/10)+1;
  const color=DEFAULT_BLOCKS[block-1];
  const artwork={valid:true,finalized:false,metadataUri:'ipfs://'+release.sourceMetadataCid+'/Biggi_'+index+'_'+color+'_PUBLIC.json'};
  const preview=getPublicArtworkPreview({release,chainId:137,chapterId:1,contractAddress:release.contract,index,artwork});
  const selectedArtwork={...artwork,name:'BiggiEyesPublic #'+index,imageUrl:preview.imageUri ? 'https://biggieyes.mypinata.cloud/ipfs/'+preview.imageUri.slice(7):'',previewOnly:!preview.awaitingArtwork,awaitingArtwork:preview.awaitingArtwork};
  const blocks=DEFAULT_BLOCKS.map((name,i)=>({id:name,name,folder:name,currentPrice:100*(i+1),minted:0,hasData:true}));
  return <div className="collection-grid"><div className="collection-grid__surface"><Panel
    blockEntries={blocks} desiredTokenId={String(index)} selectedBlock={block}
    selectedNftInfo={{configured:true,minted:false,background:1,blockIdx:block,mainId:String(index)}}
    selectedArtwork={selectedArtwork}
    COLLECTIONTotals={{paused:true,chapterActive:true,metadataFullyConfigured:true,rewardMatrixConsistent:true,publicUnlocked:false,metadataConfiguredCount:100,biggiMinted:0,maxSupply:100}}
    onTokenIdChange={value=>setIndex(Number(value))} onBlockSelect={value=>setIndex((value-1)*10+1)}
    onMint={()=>{throw Error('Mint must remain blocked')}} walletAccount="" walletChainId={137}
    mintState={{status:'idle',message:'',txHash:''}}
  /></div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const server = await createServer({
  configFile: false,
  envFile: false,
  envPrefix: "AUDIT_DISABLED_",
  logLevel: "error",
  resolve: { alias: { "@": resolve("src") } },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "public-artwork-fixture",
      resolveId(id) {
        if (id === "/__public-entry.jsx") return "\0public-entry.jsx";
      },
      async load(id) {
        if (id === "\0public-entry.jsx") {
          return transformWithEsbuild(entry, "public-entry.jsx", {
            loader: "jsx",
          });
        }
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__public-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#090b15;color:#ffe800}</style><div id="root"></div><script type="module" src="/__public-entry.jsx"></script>',
          );
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const errors = [];
    page.on("pageerror", (error) =>
      errors.push(`${error.name}: ${error.message}`),
    );
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin ||
        url.origin === "https://biggieyes.mypinata.cloud" ||
        url.protocol === "data:"
        ? route.continue()
        : route.abort();
    });
    try {
      await page.goto(`${origin}/__public-fixture`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const picture = page.locator(".collection-public__preview img");
      await picture.waitFor({ timeout: 60000 });
      await picture.evaluate((image) => image.decode());
      assert(
        (await picture.getAttribute("src")).endsWith(
          "Biggi_1_ORANGE_PUBLIC.png",
        ),
      );
      await page.screenshot({
        path: `tmp-public-artwork-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: /^WHITE\b/ }).click();
      await page.getByRole("button", { name: "#23", exact: true }).click();
      await page.waitForFunction(() =>
        document
          .querySelector(".collection-public__preview img")
          ?.src.endsWith("Biggi_23_WHITE_PUBLIC.webp"),
      );
      await picture.evaluate((image) => image.decode());
      for (const id of [29, 30]) {
        await page.getByRole("button", { name: `#${id}`, exact: true }).click();
        await page.waitForFunction(
          (id) =>
            document
              .querySelector(".collection-public__preview img")
              ?.src.endsWith(`Biggi_${id}_WHITE_PUBLIC.webp`),
          id,
        );
        await picture.evaluate((image) => image.decode());
        assert.equal(
          await page
            .locator(".collection-public__preview")
            .getByText("Soon", { exact: true })
            .count(),
          0,
        );
        await page.screenshot({
          path: `tmp-public-artwork-white-${id}-${width}.png`,
          fullPage: true,
        });
      }
      assert(
        await page
          .getByRole("button", { name: "Mint paused", exact: true })
          .isDisabled(),
      );
      await page.screenshot({
        path: `tmp-public-artwork-complete-${width}.png`,
        fullPage: true,
      });
      assert(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 2,
        ),
        `Overflow ${width}`,
      );
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          width,
          status: "PASS",
          png: true,
          webp: true,
          white29: true,
          white30: true,
          mintBlocked: true,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          width,
          errors,
          body: (await page.locator("body").innerText()).slice(0, 1000),
        }),
      );
      await page.screenshot({
        path: `tmp-public-artwork-failure-${width}.png`,
        fullPage: true,
      });
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
