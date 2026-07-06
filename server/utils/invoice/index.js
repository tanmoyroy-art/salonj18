const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const drawHeader = require("./header");
const drawServicesTable = require("./servicesTable");
const drawSummary = require("./summary");
const drawHeader = require("./header");

async function generateInvoice(invoice) {

    return new Promise((resolve, reject) => {

        const dir = path.join(__dirname, "../../invoices");

        if (!fs.existsSync(dir))
            fs.mkdirSync(dir);

        const filePath = path.join(
            dir,
            `${invoice.invoiceNo}.pdf`
        );

        const doc = new PDFDocument({

            size: "A4",

            margin: 0

        });

        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        drawHeader(doc, invoice);

        const tableEnd = drawServicesTable(doc, invoice);

        drawSummary(doc, invoice, tableEnd);

        doc.end();

        stream.on("finish", () => {

            resolve(filePath);

        });

        stream.on("error", reject);

    });

}

module.exports = generateInvoice;