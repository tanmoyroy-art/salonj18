const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Initialize Google Calendar client
function initializeGoogleCalendar() {
  try {
    const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ [GOOGLE CALENDAR] GOOGLE_CALENDAR_PRIVATE_KEY is missing in .env');
      return null;
    }

    const projectId = process.env.GOOGLE_CALENDAR_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
    const calendarId = process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID;
    
    console.log('📅 [GOOGLE CALENDAR] Initializing with:');
    console.log('   Project ID:', projectId);
    console.log('   Client Email:', clientEmail);
    console.log('   Calendar ID:', calendarId);

    if (!projectId || !clientEmail || !calendarId) {
      console.error('❌ [GOOGLE CALENDAR] Missing required environment variables');
      console.error('   - PROJECT_ID:', !!projectId);
      console.error('   - CLIENT_EMAIL:', !!clientEmail);
      console.error('   - CALENDAR_ID:', !!calendarId);
      return null;
    }

    // Parse the private key properly (handle \n escaping)
    const parsedKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: projectId,
        private_key_id: process.env.GOOGLE_CALENDAR_PRIVATE_KEY_ID,
        private_key: parsedKey,
        client_email: clientEmail,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    console.log('✅ [GOOGLE CALENDAR] Client initialized successfully');
    return calendar;
  } catch (err) {
    console.error('❌ [GOOGLE CALENDAR] Failed to initialize:', err.message);
    return null;
  }
}

// Create event on Google Calendar
async function createGoogleCalendarEvent(appointmentData) {
  try {
    console.log('📅 [GOOGLE CALENDAR] Starting event creation...');
    console.log('📅 [GOOGLE CALENDAR] Appointment Data:', JSON.stringify(appointmentData, null, 2));

    const calendar = initializeGoogleCalendar();
    if (!calendar) {
      console.error('❌ [GOOGLE CALENDAR] Client not available, skipping event creation');
      return null;
    }
    console.log('✅ [GOOGLE CALENDAR] Client initialized successfully');

    const { customer_name, services, appointment_date, notes, total_duration_minutes } = appointmentData;

    // Validate required fields
    if (!customer_name) {
      console.error('❌ [GOOGLE CALENDAR] Missing customer_name');
      return null;
    }
    if (!services || services.length === 0) {
      console.error('❌ [GOOGLE CALENDAR] Missing services');
      return null;
    }
    if (!appointment_date) {
      console.error('❌ [GOOGLE CALENDAR] Missing appointment_date');
      return null;
    }
    console.log('✅ [GOOGLE CALENDAR] All required fields present');

    // Format service names
    const serviceNames = services.map(s => s.name).join(' + ');
    console.log('📅 [GOOGLE CALENDAR] Service names:', serviceNames);

    // Calculate end time
    const startTime = new Date(appointment_date);
    const endTime = new Date(startTime.getTime() + total_duration_minutes * 60000);
    console.log('📅 [GOOGLE CALENDAR] Start time:', startTime.toISOString());
    console.log('📅 [GOOGLE CALENDAR] End time:', endTime.toISOString());
    console.log('📅 [GOOGLE CALENDAR] Duration:', total_duration_minutes, 'minutes');

    // Build event description
    const description = `Customer: ${customer_name}${notes ? '\nNotes: ' + notes : ''}`;
    console.log('📅 [GOOGLE CALENDAR] Description:', description);

    const event = {
      summary: serviceNames,
      description: description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    };

    console.log('📅 [GOOGLE CALENDAR] Calendar ID:', process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID);
    console.log('📅 [GOOGLE CALENDAR] Event payload:', JSON.stringify(event, null, 2));

    console.log('📅 [GOOGLE CALENDAR] Calling Google Calendar API...');
    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID,
      requestBody: event,
    });

    console.log('✅ [GOOGLE CALENDAR] Event created successfully!');
    console.log('✅ [GOOGLE CALENDAR] Event ID:', response.data.id);
    console.log('✅ [GOOGLE CALENDAR] Event URL:', response.data.htmlLink);
    return response.data.id;
  } catch (err) {
    console.error('❌ [GOOGLE CALENDAR] Error creating event:', err.message);
    if (err.response?.data) {
      console.error('❌ [GOOGLE CALENDAR] API Error Response:', JSON.stringify(err.response.data, null, 2));
    }
    if (err.errors) {
      console.error('❌ [GOOGLE CALENDAR] Errors:', err.errors);
    }
    console.error('❌ [GOOGLE CALENDAR] Full error:', err);
    return null;
  }
}

// Update event on Google Calendar
async function updateGoogleCalendarEvent(eventId, appointmentData) {
  try {
    const calendar = initializeGoogleCalendar();
    if (!calendar || !eventId) return null;

    const { customer_name, services, appointment_date, notes, total_duration_minutes } = appointmentData;

    const serviceNames = services.map(s => s.name).join(' + ');
    const startTime = new Date(appointment_date);
    const endTime = new Date(startTime.getTime() + total_duration_minutes * 60000);
    const description = `Customer: ${customer_name}${notes ? '\nNotes: ' + notes : ''}`;

    const event = {
      summary: serviceNames,
      description: description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    };

    const response = await calendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID,
      eventId: eventId,
      requestBody: event,
    });

    console.log(`✅ Google Calendar event updated: ${eventId}`);
    return response.data.id;
  } catch (err) {
    console.error('❌ Failed to update Google Calendar event:', err.message);
    return null;
  }
}

// Delete event from Google Calendar
async function deleteGoogleCalendarEvent(eventId) {
  try {
    const calendar = initializeGoogleCalendar();
    if (!calendar || !eventId) return false;

    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID,
      eventId: eventId,
    });

    console.log(`✅ Google Calendar event deleted: ${eventId}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to delete Google Calendar event:', err.message);
    return false;
  }
}

// Mark event as completed (update status)
async function markGoogleCalendarEventCompleted(eventId) {
  try {
    const calendar = initializeGoogleCalendar();
    if (!calendar || !eventId) return null;

    // Get the event first
    const event = await calendar.events.get({
      calendarId: process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID,
      eventId: eventId,
    });

    // Update description to mark as completed
    const updatedEvent = {
      ...event.data,
      summary: `✅ ${event.data.summary}`,
      description: (event.data.description || '') + '\n\n✅ Appointment Completed',
    };

    const response = await calendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ADMIN_CALENDAR_ID,
      eventId: eventId,
      requestBody: updatedEvent,
    });

    console.log(`✅ Google Calendar event marked completed: ${eventId}`);
    return response.data.id;
  } catch (err) {
    console.error('❌ Failed to mark Google Calendar event as completed:', err.message);
    return null;
  }
}

module.exports = {
  initializeGoogleCalendar,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  markGoogleCalendarEventCompleted,
};
