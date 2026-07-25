const express = require('express');
const router = express.Router();

const sendPageView = require('../services/meta.service');

router.post('/', async (req, res) => {
    try {
        await sendPageView.sendPageView(req);
        res.json({
            success: true
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false
        });
    }
});


module.exports = router;