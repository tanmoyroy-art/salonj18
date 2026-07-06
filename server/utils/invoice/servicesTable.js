const styles = require("./styles");
const { money } = require("./helpers");

function drawServicesTable(doc, invoice) {

    let startY = 315;

    /*
    ======================================
    TABLE HEADER
    ======================================
    */

    doc
        .roundedRect(40, startY, 515, 30, 4)
        .fill(styles.colors.primary);

    doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(10);

    doc.text("#", 55, startY + 10);

    doc.text("Service", 90, startY + 10);

    doc.text("Price", 470, startY + 10, {
        width: 60,
        align: "right"
    });

    startY += 30;

    /*
    ======================================
    SERVICES
    ======================================
    */

    doc.font("Helvetica");

    invoice.services.forEach((service, index) => {

        if (index % 2 === 0) {
            doc
                .rect(40, startY, 515, 28)
                .fill("#F8FAFC");
        }

        doc
            .fillColor("#111827")
            .fontSize(10);

        doc.text(index + 1, 55, startY + 8);

        doc.text(service.name, 90, startY + 8);

        doc.text(
            money(service.price),
            470,
            startY + 8,
            {
                width: 60,
                align: "right"
            }
        );

        startY += 28;

    });

    return startY;

}

module.exports = drawServicesTable;