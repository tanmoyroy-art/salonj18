const styles = require("./styles");
const { money } = require("./helpers");

function drawSummary(doc, invoice, startY) {

    const x = 320;
    const w = 235;

    doc
        .roundedRect(x, startY + 20, w, 170, 8)
        .fill(styles.colors.light);

    doc
        .strokeColor(styles.colors.border)
        .roundedRect(x, startY + 20, w, 170, 8)
        .stroke();

    let y = startY + 40;

    function row(label, value, bold = false) {

        doc
            .fillColor("#111827")
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(10);

        doc.text(label, x + 20, y);

        doc.text(
            money(value),
            x + 120,
            y,
            {
                width: 90,
                align: "right"
            }
        );

        y += 24;
    }

    row("Subtotal", invoice.appointment.totalAmount);

    row("Membership", -invoice.appointment.membershipDiscount);

    row("Points Used", -invoice.appointment.pointsDiscount);

    row("Discount", -invoice.appointment.discount);

    doc
        .moveTo(x + 15, y + 5)
        .lineTo(x + w - 15, y + 5)
        .strokeColor("#CBD5E1")
        .stroke();

    y += 15;

    row("Grand Total", invoice.appointment.amountPaid, true);

    row("Amount Paid", invoice.appointment.amountPaid, true);

}

module.exports = drawSummary;