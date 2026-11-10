# Dymchurch Holiday Park · 2027 Annual Licence Agreement

## Run it in VS Code

1. Extract the ZIP. Open the `dymchurch-licence-preview` folder in VS Code with **File → Open Folder**.
2. Open `index.html` and click **Go Live**, or right-click the file and choose **Open with Live Server**.
3. Test with dummy details. Read and initial pages 2–14, add a typed or drawn signature, confirm your name and email, and download the sample PDF.

You can also serve this folder with `python3 -m http.server 5500 --bind 127.0.0.1` and open `http://127.0.0.1:5500`. The browser loads every asset from this folder. No npm install or external service is needed.

## Project files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Form, agreement reader, signing screen and styles |
| `app.js` | Form validation, page initials, signing flow and UK date |
| `signature.js` | Draw or type a signature in the modal |
| `pdf.js` | Field placement and export using the source PDF |
| `assets/licence-2027.pdf` | Original 14-page licence template |
| `assets/pages/`, `assets/page-text.json` | Page images and text for the reader |
| `assets/park-signature.png` | Replaceable transparent sample image for Sam Sellers |
| `assets/vendor/` | Bundled PDF library and handwriting font with licences |

## Signature and release

The preview prints **Sam Sellers** in the park representative's name field. Both dates use the UK calendar date at download. The sample image can be swapped with another transparent PNG for a local positioning test. Use the final approved signature only in the server-side release. Everything under this static folder is served by Live Server.

The current build exports a sample-only PDF on the device. The hosted version needs private invitation links, delivery address verification, server-side PDF creation with the approved park signature, and mail delivery to the owner and `info@dymchurchholidaypark.com`. The current Park Rules also need to be added to the signing pack.
