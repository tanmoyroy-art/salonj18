const axios = require("axios");

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

async function sendLead(user) {

    const body = {
        data: [
            {
                event_name: "Lead",
                event_time: Math.floor(Date.now()/1000),

                action_source: "website",

                user_data: {
                    em: [user.email],
                    ph: [user.phone]
                },

                custom_data: {
                    value: 100,
                    currency: "USD"
                }
            }
        ]
    };

    try {

        const response = await axios.post(
            `https://graph.facebook.com/v23.0/${PIXEL_ID}/events`,
            body,
            {
                params:{
                    access_token: ACCESS_TOKEN
                }
            }
        );

        console.log(response.data);

    } catch(err){
        console.log(err.response?.data || err.message);
    }
}

async function sendPageView(req){
    const body = {
        data: [
            {
                event_name: "PageView",
                event_time: Math.floor(Date.now() / 1000),
                event_id: req.body.eventId,
                action_source: "website",

                user_data: {
                    client_ip_address: req.ip,
                    client_user_agent: req.headers["user-agent"]
                }
            }
        ]
    };

    try {
        await axios.post(
            `https://graph.facebook.com/v23.0/${PIXEL_ID}/events`,
            body,
            {
                params: {
                    access_token: ACCESS_TOKEN
                }
            }
        );
    } catch (err) {
        console.log(err.response?.data);
        throw err;
    }
}

module.exports = {
    sendLead,
    sendPageView
};