const fs = require("fs");
const company = require("../../config/company");
const styles = require("./styles");
const { text } = require("./helpers");

function drawHeader(doc, invoice) {

    /*
    =====================================================
    TOP BLUE BAR
    =====================================================
    */

    doc
        .roundedRect(40, 35, 515, 120, 8)
        .fill(styles.colors.primary);

    /*
    =====================================================
    LOGO
    =====================================================
    */

    if (fs.existsSync(company.logo)) {

        doc.image(company.logo, 60, 55, {
            width: 70
        });

    }

    /*
    =====================================================
    COMPANY NAME
    =====================================================
    */

    doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text(company.name, 145, 52);

    doc
        .font("Helvetica")
        .fontSize(10);

    doc.text(company.address, 145, 82);

    doc.text(company.phone);

    doc.text(company.email);

    doc.text(company.website);

    if (company.gstin) {
        doc.text("GSTIN : " + company.gstin);
    }

    /*
    =====================================================
    PAID BADGE
    =====================================================
    */

    const badgeColor =
        invoice.appointment.paymentStatus === "paid"
            ? styles.colors.success
            : styles.colors.danger;

    doc
        .roundedRect(455, 50, 75, 28, 14)
        .fill(badgeColor);

    doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(
            invoice.appointment.paymentStatus.toUpperCase(),
            468,
            59
        );

    /*
    =====================================================
    TITLE
    =====================================================
    */

    doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("TAX INVOICE", 430, 105);

    /*
    =====================================================
    INFORMATION CARD
    =====================================================
    */

    doc
        .roundedRect(40, 175, 515, 110, 8)
        .fill(styles.colors.light);

    doc
        .strokeColor(styles.colors.border)
        .roundedRect(40, 175, 515, 110, 8)
        .stroke();

    /*
    LEFT SIDE
    */

    text(doc, "Invoice No", 60, 192, {
        bold: true
    });

    text(doc, invoice.invoiceNo, 170, 192);

    text(doc, "Appointment", 60, 215, {
        bold: true
    });

    text(doc, "#" + invoice.appointment.id, 170, 215);

    text(doc, "Invoice Date", 60, 238, {
        bold: true
    });

    text(doc, invoice.invoiceDate, 170, 238);

    /*
    RIGHT SIDE
    */

    text(doc, "Payment", 330, 192, {
        bold: true
    });

    text(
        doc,
        invoice.appointment.paymentMethod || "-",
        430,
        192
    );

    text(doc, "Razorpay ID", 330, 215, {
        bold: true
    });

    text(
        doc,
        invoice.payment.razorpayPaymentId || "-",
        430,
        215
    );

    text(doc, "Order ID", 330, 238, {
        bold: true
    });

    text(
        doc,
        invoice.payment.razorpayOrderId || "-",
        430,
        238
    );

}

module.exports = drawHeader;