# Upload the final Star Dial app

Release: 17 October 2026 · Offline cache: v20

## 1. Extract the ZIP

Extract `Star-Dial-Final-GitHub.zip`. Open the extracted folder: you should see `index.html` alongside `assets`, `sources`, `scripts`, and `tests`.

GitHub Pages needs these extracted files. Uploading the ZIP by itself does not publish the app.

## 2. Upload in two batches

Create a public GitHub repository, or open your existing Star Dial repository. On the repository's main page, choose **Add file > Upload files** (or **uploading an existing file** for an empty repository).

1. **First batch:** drag in every extracted item except the `assets` folder. Include `.gitattributes`, `.gitignore`, and `.nojekyll`. Commit to your publishing branch, usually `main`.
2. Return to the repository's main page and open **Upload files** again. **Second batch:** drag in the entire `assets` folder, including its `atlas` and `fonts` subfolders. Commit to the same branch.

Both batches start at the repository root. Keep `index.html` there and preserve the folders. Do not drag in the outer extracted folder. If updating an existing repository, replace matching files with this release.

The `assets` batch has 94 files. GitHub permits up to 100 files per browser upload and 25 MiB per file, so each batch fits. [GitHub's upload instructions](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

After both uploads, the main page should contain:

```text
index.html
sw.js
manifest.json
observer.js
observatory.css
navigation.js
install.js
atlas.js / atlas.css / atlas-data.js
atlas-iau.json / atlas-boundaries.json / atlas-learning.json
icon-192.png / icon-512.png
assets/
  atlas/     (89 constellation charts)
  fonts/     (fonts, licenses, and README)
sources/     (official Bataan coordinate source)
scripts/
tests/
README.md
GITHUB_UPLOAD.md
ATLAS_REFERENCES.md
BATAAN_REFERENCE.md
THIRD_PARTY_NOTICES.md
.gitattributes
.gitignore
.nojekyll
```

## 3. Turn on GitHub Pages

Open **Settings > Pages**. Choose **Deploy from a branch**, select **main** (or your publishing branch) and **/ (root)**, then **Save**. Wait for the deployment to finish; Pages will show your live website link. [GitHub's Pages setup instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 4. Open the final app

Open the published link online and wait for **Ready for offline use**. Check Star Atlas, Star Dial, Free Roam, and Assessment. The Explain step now uses Claim, Evidence, and Reasoning.

If an installed copy still shows the earlier version, open it online, close all app tabs and windows, and reopen it so the downloaded update can activate. Keep your existing website URL when updating so saved browser work remains available.

The full project is included, with no build step or API key needed. Student work stays in the browser or in reports you export; it is not part of this release archive. Technical checks can be run with `node --test tests/*.cjs` from the extracted folder.
