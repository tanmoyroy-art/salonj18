const pool = require('../db/index');

async function generateMembershipId(client = pool) {
  // Get the latest membership id
  const result = await client.query(`
    SELECT membership_card_id
    FROM customers
    WHERE membership_card_id IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `);
  if (result.rows.length === 0) {
    return 'J18000001';
  }
  const lastId = result.rows[0].membership_card_id;
//   const number = parseInt(lastId.replace(/\D/g, ''), 10);
  const number = parseInt(lastId.substring(3), 10);
  const nextNumber = number + 1;
  return `J18${String(nextNumber).padStart(6, '0')}`;
}
module.exports = {
  generateMembershipId
};