const styles = require("./styles");
function money(value) {
    return "₹" + Number(value || 0).toFixed(2);
}
function line(doc, y) {
    doc
        .strokeColor(styles.colors.border)
        .lineWidth(1)
        .moveTo(40, y)
        .lineTo(555, y)
        .stroke();
}

function box(doc, x, y, w, h, color = "#fff") {
    doc
        .roundedRect(x, y, w, h, 6)
        .fillAndStroke(color, styles.colors.border);
}

function text(doc, txt, x, y, options = {}) {
    doc
        .fillColor(options.color || "#111827")
        .font(options.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(options.size || 10)
        .text(txt, x, y, {
            width: options.width,
            align: options.align
        });
}

module.exports = {
    money,
    line,
    box,
    text
};