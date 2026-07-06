const { pool } = require("../db/index");

class InvoiceService {
    static async getInvoiceData(appointmentId) {
        const query = `
            SELECT
                a.id,
                a.appointment_date,
                a.total_amount,
                a.discount,
                a.membership_discount,
                a.points_discount,
                a.amount_paid,
                a.payment_method,
                a.payment_status,
                a.points_earned,
                a.offer_discount,
                c.name AS customer_name,
                c.phone,
                c.email,

                cp.total_points,

                po.razorpay_order_id,
                po.razorpay_payment_id,
                po.currency,

                s.name AS service_name,
                o.name AS offer_name,
                aps.price

            FROM appointments a

            JOIN customers c
                ON c.id = a.customer_id

            LEFT JOIN customer_points cp
                ON cp.customer_id = c.id

            LEFT JOIN payment_orders po
                ON po.appointment_id = a.id

            LEFT JOIN offers o
                ON o.id = a.offer_id

            JOIN appointment_services aps
                ON aps.appointment_id = a.id

            JOIN services s
                ON s.id = aps.service_id

            WHERE a.id = $1

            ORDER BY aps.id;
        `;

        const { rows } = await pool.query(query, [appointmentId]);

        if (!rows.length) {
            throw new Error("Appointment not found.");
        }

        const first = rows[0];
        const now = new Date();
        return {
            invoiceNo: `J18-26-27-${String(first.id).padStart(6,"0")}`,
            invoiceDate: now.toLocaleDateString("en-IN"),
            appointment: {
                id: first.id,
                appointmentDate: first.appointment_date,
                totalAmount: Number(first.total_amount),
                discount: Number(first.discount || 0),
                membershipDiscount: Number(first.membership_discount || 0),
                pointsDiscount: Number(first.points_discount || 0),
                offerDiscount: Number(first.offer_discount || 0),
                offerName: first.offer_name,
                amountPaid: Number(first.amount_paid || 0),
                paymentMethod: first.payment_method,
                paymentStatus: first.payment_status,
                pointsEarned: Number(first.points_earned || 0)
            },

            customer: {
                name: first.customer_name,
                phone: first.phone,
                email: first.email
            },

            payment: {
                razorpayOrderId: first.razorpay_order_id,
                razorpayPaymentId: first.razorpay_payment_id,
                currency: first.currency
            },

            loyalty: {
                availablePoints: Number(first.total_points || 0)
            },

            services: rows.map(r => ({
                name: r.service_name,
                price: Number(r.price)
            }))
        };
    }
}

module.exports = InvoiceService;