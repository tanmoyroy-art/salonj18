const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const company = require("../config/company");
const qrPath = path.join(__dirname, "../temp/qr.png");

// Helper function to draw a horizontal line
function drawLine(doc, y, width = 520) {
    doc
        .strokeColor("#cccccc")
        .lineWidth(1)
        .moveTo(40, y)
        .lineTo(40 + width, y)
        .stroke();
}

// Helper function to format currency
function formatCurrency(amount) {
    return `${Number(amount).toFixed(2)}`;
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

async function generateInvoice(invoiceData) {
    if (!fs.existsSync(path.join(__dirname, "../temp"))) {
        fs.mkdirSync(path.join(__dirname, "../temp"), { recursive: true });
    }

    await QRCode.toFile(
        qrPath,
        company.business,
        {
            width: 120,
            margin: 1
        }
    );
    return new Promise((resolve, reject) => {
        const invoiceDir = path.join(__dirname, "../invoices");

        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        // Extract the actual invoice data
        const data = invoiceData.invoiceData || invoiceData;
        const fileName = `${data.invoiceNo || 'invoice'}.pdf`;
        const filePath = path.join(invoiceDir, fileName);

        const doc = new PDFDocument({
            size: "A4",
            margin: 40,
            bufferPages: true
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        /*
        ===========================================
        HEADER SECTION
        ===========================================
        */

        // Logo
        if (company.logo && fs.existsSync(company.logo)) {
            doc.image(company.logo, 40, 45, {
                width: 80,
                height: 80
            });
        }
        doc.image(qrPath, 470, 35, {
            width: 100
        });
        // Company Details
        const companyY = 40;
        doc
            .fillColor(company.primaryColor || "#f2b9cb")
            .font("Helvetica-Bold")
            .fontSize(16)
            .text(company.name, 130, companyY, {
                width: 300
            });

        doc
            .fillColor("#666666")
            .font("Helvetica")
            .fontSize(9)
            .text(company.address, 130, companyY + 32, {
                width: 300
            })
            .text(`Phone: ${company.phone}`, 130, companyY + 47)
            .text(`Email: ${company.email}`, 130, companyY + 62)
            .text(`Website: ${company.website}`, 130, companyY + 77)
            // .text(`GSTIN: ${company.gstin}`, 130, companyY + 92);

        // Header Line
        drawLine(doc, 145);

        /*
        ===========================================
        TITLE
        ===========================================
        */

        doc
            .fillColor(company.primaryColor || "#f2b9cb")
            .font("Helvetica-Bold")
            .fontSize(20)
            .text("TAX INVOICE", 40, 165, {
                align: "center"
            });

        drawLine(doc, 190);

        /*
        ===========================================
        INVOICE INFO BOX
        ===========================================
        */

        // Background box
        doc
            .rect(40, 205, 520, 65)
            .fill("#f8f9fa");

        // Invoice Details
        doc
            .fillColor("#000000")
            .font("Helvetica")
            .fontSize(10);

        const infoY = 220;
        const lineHeight = 20;

        // Left column
        doc
            .font("Helvetica-Bold")
            .text("Invoice No:", 60, infoY, { continued: true })
            .font("Helvetica")
            .text(` ${data.invoiceNo || '-'}`);

        doc
            .font("Helvetica-Bold")
            .text("Invoice Date:", 60, infoY + lineHeight, { continued: true })
            .font("Helvetica")
            .text(` ${data.invoiceDate || formatDate(data.appointment?.appointmentDate) || '-'}`);

        // Right column
        doc
            .font("Helvetica-Bold")
            .text("Appointment ID:", 320, infoY, { continued: true })
            .font("Helvetica")
            .text(` #${data.appointment?.id || data.appointmentId || '-'}`);

        doc
            .font("Helvetica-Bold")
            .text("Payment Status:", 320, infoY + lineHeight, { continued: true })
            .font("Helvetica")
            .text(` ${(data.appointment?.paymentStatus || 'pending').toUpperCase()}`);

        // PAID Badge
        if (data.appointment?.paymentStatus === 'paid') {
            doc
                .roundedRect(440, 210, 100, 28, 5)
                .fill(company.accentColor || "#28a745");

            doc
                .fillColor("white")
                .font("Helvetica-Bold")
                .fontSize(13)
                .text("PAID", 410, 217, { align: "center" });
        }

        /*
        ===========================================
        CUSTOMER SECTION
        ===========================================
        */

        drawLine(doc, 290);

        doc
            .fillColor(company.primaryColor || "#f2b9cb")
            .font("Helvetica-Bold")
            .fontSize(14)
            .text("Bill To", 40, 305);

        const customer = data.customer || {};
        doc
            .fillColor("#000000")
            .font("Helvetica")
            .fontSize(10)
            .text(customer.name || "Customer", 40, 330)
            .text(`Phone: ${customer.phone || '-'}`, 40, 348)
            .text(`Email: ${customer.email || '-'}`, 40, 366);

        drawLine(doc, 400);

        /*
        ===========================================
        SERVICES TABLE
        ===========================================
        */

        doc
            .fillColor(company.primaryColor || "#f2b9cb")
            .font("Helvetica-Bold")
            .fontSize(14)
            .text("Services", 40, 415);

        // Table Header
        const tableTop = 440;
        const col1 = 40;
        const col2 = 80;
        const col3 = 320;
        const col4 = 450;
        const col5 = 455;
        const rowHeight = 28;

        // Table header background
        doc
            .rect(col1, tableTop, 520, rowHeight)
            .fill(company.primaryColor || "#f2b9cb");

        doc
            .fillColor("white")
            .font("Helvetica-Bold")
            .fontSize(10)
            .text("#", col1 + 8, tableTop + 8, { width: 30, align: "center" })
            .text("Service Name", col2, tableTop + 8, { width: 220 })
            .text("Price", col3, tableTop + 8, { width: 80, align: "right" })
            .text("Qty", col4, tableTop + 8, { width: 50, align: "center" })
            .text("Amount", col5, tableTop + 8, { width: 80, align: "right" });

        // Table rows
        let yPosition = tableTop + rowHeight;
        const services = data.services || [];
        let total = 0;

        if (services.length === 0) {
            doc
                .fillColor("#666666")
                .font("Helvetica")
                .fontSize(11)
                .text("No services listed", 40, yPosition + 10);
            yPosition += 40;
        } else {
            services.forEach((service, index) => {
                const price = Number(service.price) || 0;
                const qty = Number(service.quantity) || 1;
                const amount = price * qty;
                total += amount;

                // Alternating row background
                if (index % 2 === 0) {
                    doc
                        .rect(col1, yPosition, 520, rowHeight)
                        .fill("#f8f9fa");
                }

                doc
                    .fillColor("#000000")
                    .font("Helvetica")
                    .fontSize(10)
                    .text((index + 1).toString(), col1 + 8, yPosition + 7, { width: 30, align: "center" })
                    .text(service.name || "Service", col2, yPosition + 7, { width: 220 })
                    .text(formatCurrency(price), col3, yPosition + 7, { width: 80, align: "right" })
                    .text(qty.toString(), col4, yPosition + 7, { width: 50, align: "center" })
                    .text(formatCurrency(amount), col5, yPosition + 7, { width: 80, align: "right" });

                yPosition += rowHeight;
            });
        }

        // Table bottom line
        drawLine(doc, yPosition);

        /*
        ===========================================
        TOTALS SECTION
        ===========================================
        */

        const totalsX = 360;
        let currentY = yPosition + 20;

        const subtotal = Number(data.appointment?.totalAmount || 0);
        const discount = Number(data.appointment?.discount || 0);
        const offerDiscount = Number(data.appointment?.offerDiscount || 0);
        const membershipDiscount = Number(data.appointment?.membershipDiscount || 0);
        const pointsDiscount = Number(data.appointment?.pointsDiscount || 0);

        const totalDiscount = discount + membershipDiscount + pointsDiscount + offerDiscount;
        const grandTotal = subtotal - totalDiscount;
        const amountPaid = Number(data.appointment?.amountPaid || 0);
        const balanceDue = grandTotal - amountPaid;

        // Background
        doc
            .roundedRect(totalsX - 15, currentY - 10, 180, 150, 6)
            .fill("#F8F9FA");

        doc.strokeColor("#DDDDDD")
            .roundedRect(totalsX - 15, currentY - 10, 180, 150, 6)
            .stroke();

        function totalRow(label, value, color = "#000", bold = false) {

            doc
                .fillColor(color)
                .font(bold ? "Helvetica-Bold" : "Helvetica")
                .fontSize(bold ? 11 : 10)
                .text(label, totalsX, currentY);

            doc
                .fillColor(color)
                .font(bold ? "Helvetica-Bold" : "Helvetica")
                .text(
                    formatCurrency(value),
                    totalsX + 80,
                    currentY,
                    {
                        width: 65,
                        align: "right"
                    }
                );

            currentY += 22;
        }

        totalRow("Subtotal", subtotal);

        if (membershipDiscount > 0)
            totalRow("Membership", -membershipDiscount);

        if (pointsDiscount > 0)
            totalRow("Reward Points", -pointsDiscount);

        if (offerDiscount > 0)
            totalRow(`Offer Discount (${data.appointment?.offerName})`, -offerDiscount);

        if (discount > 0)
            totalRow("Discount", -discount);

        // Divider
        doc
            .moveTo(totalsX, currentY + 2)
            .lineTo(totalsX + 145, currentY + 2)
            .strokeColor("#CCCCCC")
            .stroke();

        currentY += 12;

        totalRow(
            "Grand Total",
            grandTotal,
            company.primaryColor || "#1a237e",
            true
        );

        totalRow(
            "Amount Paid",
            amountPaid,
            "#28A745",
            true
        );

        if (balanceDue > 0) {
            totalRow(
                "Balance Due",
                balanceDue,
                "#DC3545",
                true
            );
        }

        /*
        ===========================================
        LOYALTY POINTS
        ===========================================
        */

        if (data.loyalty?.availablePoints > 0) {
            const pointsY = currentY + 30;
            doc
                .fillColor("#666666")
                .font("Helvetica")
                .fontSize(9)
                .text(`Loyalty Points Available: ${data.loyalty.availablePoints} points`, 40, pointsY);
        }

        /*
        ===========================================
        FOOTER
        ===========================================
        */

        // Footer line
        drawLine(doc, 720);
        doc
            .fillColor(company.primaryColor)
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(
                "Thank you for choosing J18 Salon!",
                40,
                730,
                {
                    width: 520,
                    align: "center"
                }
            );
        doc
            .fillColor("#666")
            .font("Helvetica")
            .fontSize(9)
            .text(
                "We look forward to serving you again.",
                40,
                750,
                {
                    width: 520,
                    align: "center"
                }
            );
        // Website & Phone
        doc
            .fillColor("#333")
            .fontSize(9)
            .text(
                `${company.phone}   |   ${company.website}`,
                40,
                770,
                {
                    width: 520,
                    align: "center"
                }
            );
        doc
            .fillColor("#666")
            .fontSize(8)
            .text(
                `Facebook: ${company.facebook}   |   Instagram: ${company.instagram}   |   X: ${company.twitter}`,
                40,
                790,
                {
                    width: 520,
                    align: "center"
                }
            );
        /*
        ===========================================
        END
        ===========================================
        */

        doc.end();

        stream.on("finish", () => {
            resolve(filePath);
        });

        stream.on("error", (err) => {
            reject(err);
        });
    });
}

module.exports = generateInvoice;