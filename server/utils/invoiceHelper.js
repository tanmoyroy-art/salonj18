const drawLine = (doc, y) => {
    doc
        .strokeColor("#d1d5db")
        .lineWidth(1)
        .moveTo(40, y)
        .lineTo(555, y)
        .stroke();
};

const formatMoney = (amount) => {
    return "₹" + Number(amount).toFixed(2);
};
const centerText = (doc, text, y, size = 12) => {
    doc
        .fontSize(size)
        .text(text, 0, y, {
            align: "center"
        });
};
module.exports = {
    drawLine,
    formatMoney,
    centerText
};