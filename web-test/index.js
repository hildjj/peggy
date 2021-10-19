"use strict";

const puppeteer = require("puppeteer");
const path = require("path");

const TOP = `file://${path.resolve(
  __dirname, "..", "docs", "development", "test.html",
)}`;

async function main() {
  let done = null;
  const donePromise = new Promise((resolve, reject) => {
    done = { resolve, reject };
  });
  const browser = await puppeteer.launch({
    slowMo: 100,
    headless: false,
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = (pages.length > 0) ? pages[0] : await browser.newPage();
  page
    .on("console", message => {
      const txt = message.text();
      switch (txt) {
        case "PASS":
          done.resolve();
          break;
        case "FAIL":
          done.reject();
          break;
        default: {
          const type = message
            .type()
            .toUpperCase();
          console.log(`${type}: ${txt}`);
        }
      }
    })
    .on("pageerror", ({ message }) => console.log(`ERROR: ${message}`))
    .on("requestfailed", request => console.log(
      `FAIL: ${request.failure().errorText} ${request.url()}`,
    ));
  await page.goto(TOP, { waitUntil: "load" });
  await donePromise;
  await browser.close();
}

main().catch(console.error);
