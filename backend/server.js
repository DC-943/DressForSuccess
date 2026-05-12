require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const db = require('./database');
const path = require('path');

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dress for Success Referral System API',
      version: '1.0.0',
      description: 'API documentation for the DFS referral coordination system',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve swagger spec as JSON
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

const PORT = process.env.PORT || 3001;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLeadTimeHours(serviceType) {
  switch (serviceType) {
    case 'career_training':
      return 168;
    case 'styling':
      return 48;
    case 'mock_interview':
      return 72;
    default:
      return 48;
  }
}

function toHourNumber(timeString) {
  const [hour, minute] = timeString.split(':').map(Number);
  return hour + (minute || 0) / 60;
}

function isVolunteerAvailableAt(volPattern, date) {
  const dateStr = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const hour = date.getHours() + date.getMinutes() / 60;
  return volPattern.some((slot) => {
    // Check if slot has date field (new format) or day field (old format)
    if (slot.date) {
      return slot.date === dateStr && hour >= toHourNumber(slot.start) && hour + 1 <= toHourNumber(slot.end);
    } else if (slot.day) {
      const dayName = WEEKDAYS[date.getDay()];
      return slot.day === dayName && hour >= toHourNumber(slot.start) && hour + 1 <= toHourNumber(slot.end);
    }
    return false;
  });
}

function buildSlotKey(date) {
  return date.toISOString().slice(0, 16);
}

function findMatchingVolunteer(volunteers, scheduleTime) {
  const date = parseDate(scheduleTime);
  if (!date) return null;
  return volunteers.find((vol) => isVolunteerAvailableAt(vol.availability_pattern, date));
}

function generateAvailableSlots(volunteers, serviceType, interviewTime) {
  const now = new Date();
  if (!interviewTime || interviewTime <= now) {
    return [];
  }

  const leadHours = getLeadTimeHours(serviceType);
  const latestSlotTime = new Date(interviewTime.getTime() - leadHours * 60 * 60 * 1000);
  if (latestSlotTime <= now) {
    return [];
  }

  const slotStart = new Date(now);
  slotStart.setMinutes(0, 0, 0);
  slotStart.setHours(slotStart.getHours() + 1);

  const slots = [];
  const seen = new Set();

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const currentDay = new Date(slotStart);
    currentDay.setDate(slotStart.getDate() + dayOffset);

    for (const volunteer of volunteers) {
      const pattern = volunteer.availability_pattern;
      for (const chunk of pattern) {
        if (chunk.day !== WEEKDAYS[currentDay.getDay()]) continue;
        const startHour = dayOffset === 0
          ? Math.max(toHourNumber(chunk.start), currentDay.getHours())
          : toHourNumber(chunk.start);
        const endHour = toHourNumber(chunk.end);
        for (let hour = Math.ceil(startHour); hour + 1 <= endHour; hour += 1) {
          const candidate = new Date(currentDay);
          candidate.setHours(hour, 0, 0, 0);
          if (candidate > latestSlotTime || candidate <= now) continue;
          const key = buildSlotKey(candidate);
          if (!seen.has(key)) {
            seen.add(key);
            slots.push({ schedule_time: candidate.toISOString().slice(0, 16), day: chunk.day, volunteer_id: volunteer.volunteer_id });
            if (slots.length >= 8) return slots;
          }
        }
      }
    }
  }

  return slots;
}

// ==================== AGENCIES ROUTES ====================

/**
 * @swagger
 * components:
 *   schemas:
 *     Agency:
 *       type: object
 *       required:
 *         - agency_name
 *         - category
 *         - main_contact_name
 *         - contact_email
 *       properties:
 *         agency_id:
 *           type: integer
 *           description: Auto-generated agency ID
 *         agency_name:
 *           type: string
 *           description: Name of the referral agency
 *         category:
 *           type: string
 *           enum: [refugee_support, domestic_violence, employment_center, university]
 *           description: Category of the agency
 *         main_contact_name:
 *           type: string
 *           description: Main contact person name
 *         contact_email:
 *           type: string
 *           description: Contact email address
 *         auth_code:
 *           type: string
 *           description: Authentication code for the agency
 *         status:
 *           type: integer
 *           description: Agency status (1 = active, 0 = inactive)
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *     Client:
 *       type: object
 *       required:
 *         - referral_agency_id
 *         - first_name
 *         - last_name
 *       properties:
 *         client_id:
 *           type: integer
 *           description: Auto-generated client ID
 *         referral_agency_id:
 *           type: integer
 *           description: ID of the referring agency
 *         first_name:
 *           type: string
 *           description: Client's first name
 *         last_name:
 *           type: string
 *           description: Client's last name
 *         phone_number:
 *           type: string
 *           description: Client's phone number
 *         email:
 *           type: string
 *           description: Client's email address
 *         job_status:
 *           type: string
 *           enum: [unemployed, has_interview, employed]
 *           description: Client's employment status
 *         consent_flag:
 *           type: boolean
 *           description: Whether client has given consent
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *     Volunteer:
 *       type: object
 *       required:
 *         - full_name
 *       properties:
 *         volunteer_id:
 *           type: integer
 *           description: Auto-generated volunteer ID
 *         full_name:
 *           type: string
 *           description: Volunteer's full name
 *         specialty:
 *           type: string
 *           description: Volunteer's specialty area
 *         availability_pattern:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               day:
 *                 type: string
 *                 enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
 *               start:
 *                 type: string
 *                 description: Start time in HH:MM format
 *               end:
 *                 type: string
 *                 description: End time in HH:MM format
 *         training_completed:
 *           type: boolean
 *           description: Whether volunteer has completed training
 *         current_load:
 *           type: integer
 *           description: Current number of assigned appointments
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *     Appointment:
 *       type: object
 *       required:
 *         - client_id
 *         - service_type
 *       properties:
 *         appt_id:
 *           type: integer
 *           description: Auto-generated appointment ID
 *         client_id:
 *           type: integer
 *           description: ID of the client
 *         volunteer_id:
 *           type: integer
 *           description: ID of assigned volunteer
 *         service_type:
 *           type: string
 *           enum: [career_training, styling, mock_interview]
 *           description: Type of service
 *         schedule_time:
 *           type: string
 *           format: date-time
 *           description: Scheduled appointment time
 *         interview_time:
 *           type: string
 *           format: date-time
 *           description: Client's interview time
 *         status:
 *           type: string
 *           enum: [pending_confirmation, pending_assignment, matched, completed, absent]
 *           description: Appointment status
 *         confidence_score_pre:
 *           type: integer
 *           description: Pre-service confidence score
 *         confidence_score_post:
 *           type: integer
 *           description: Post-service confidence score
 *         outcome_notes:
 *           type: string
 *           description: Notes about the appointment outcome
 *         change_count:
 *           type: integer
 *           description: Number of times appointment was rescheduled
 *         assigned_at:
 *           type: string
 *           format: date-time
 *           description: When volunteer was assigned
 *         reminder_sent:
 *           type: boolean
 *           description: Whether reminder was sent
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /api/agencies:
 *   post:
 *     summary: Register a new referral agency
 *     tags: [Agencies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agency_name
 *               - category
 *               - main_contact_name
 *               - contact_email
 *             properties:
 *               agency_name:
 *                 type: string
 *                 description: Name of the agency
 *               category:
 *                 type: string
 *                 enum: [refugee_support, domestic_violence, employment_center, university]
 *                 description: Agency category
 *               main_contact_name:
 *                 type: string
 *                 description: Main contact person
 *               contact_email:
 *                 type: string
 *                 description: Contact email
 *     responses:
 *       200:
 *         description: Agency registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agency_id:
 *                   type: integer
 *                 auth_code:
 *                   type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// 机构注册
app.post('/api/agencies', (req, res) => {
  const { agency_name, category, main_contact_name, contact_email } = req.body;
  const auth_code = `AUTH_${Date.now()}`;

  db.run(
    `INSERT INTO referral_agencies (agency_name, category, main_contact_name, contact_email, auth_code) 
     VALUES (?, ?, ?, ?, ?)`,
    [agency_name, category, main_contact_name, contact_email, auth_code],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          agency_id: this.lastID,
          auth_code,
          message: 'Agency registered successfully'
        });
      }
    }
  );
});

/**
 * @swagger
 * /api/agencies:
 *   get:
 *     summary: Get all active agencies
 *     tags: [Agencies]
 *     responses:
 *       200:
 *         description: List of active agencies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agency'
 *       500:
 *         description: Server error
 */
// 获取所有机构
app.get('/api/agencies', (req, res) => {
  db.all('SELECT * FROM referral_agencies WHERE status = 1', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

/**
 * @swagger
 * /api/agencies/{agency_id}:
 *   delete:
 *     summary: Delete an agency
 *     tags: [Agencies]
 *     parameters:
 *       - in: path
 *         name: agency_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agency ID
 *     responses:
 *       200:
 *         description: Agency deleted successfully
 *       500:
 *         description: Server error
 */
app.delete('/api/agencies/:agency_id', (req, res) => {
  db.run('DELETE FROM referral_agencies WHERE agency_id = ?', [req.params.agency_id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: 'Agency deleted successfully' });
    }
  });
});

/**
 * @swagger
 * /api/agencies/{agency_id}/progress:
 *   get:
 *     summary: Get progress report for an agency
 *     tags: [Agencies]
 *     parameters:
 *       - in: path
 *         name: agency_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agency ID
 *     responses:
 *       200:
 *         description: Progress report for the agency
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   client_id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   job_status:
 *                     type: string
 *                   appointments:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         appt_id:
 *                           type: integer
 *                         service_type:
 *                           type: string
 *                         schedule_time:
 *                           type: string
 *                           format: date-time
 *                         interview_time:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                         volunteer_id:
 *                           type: integer
 *                         outcome_notes:
 *                           type: string
 *       500:
 *         description: Server error
 */
// 合作伙伴进度
app.get('/api/agencies/:agency_id/progress', (req, res) => {
  const agencyId = req.params.agency_id;
  db.all(
    `SELECT c.client_id, c.first_name, c.last_name, c.job_status, a.appt_id, a.service_type, a.schedule_time, a.interview_time, a.status, a.volunteer_id, a.outcome_notes
     FROM clients c
     LEFT JOIN appointments a ON c.client_id = a.client_id
     WHERE c.referral_agency_id = ?
     ORDER BY c.client_id, a.schedule_time`,
    [agencyId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const clients = {};
        rows.forEach((row) => {
          if (!clients[row.client_id]) {
            clients[row.client_id] = {
              client_id: row.client_id,
              name: `${row.first_name} ${row.last_name}`,
              job_status: row.job_status,
              appointments: [],
            };
          }
          if (row.appt_id) {
            clients[row.client_id].appointments.push({
              appt_id: row.appt_id,
              service_type: row.service_type,
              schedule_time: row.schedule_time,
              interview_time: row.interview_time,
              status: row.status,
              volunteer_id: row.volunteer_id,
              outcome_notes: row.outcome_notes,
            });
          }
        });
        res.json(Object.values(clients));
      }
    }
  );
});

// ==================== CLIENTS ROUTES ====================

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Create a new client referral
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referral_agency_id
 *               - first_name
 *               - last_name
 *             properties:
 *               referral_agency_id:
 *                 type: integer
 *                 description: ID of the referring agency
 *               first_name:
 *                 type: string
 *                 description: Client's first name
 *               last_name:
 *                 type: string
 *                 description: Client's last name
 *               phone_number:
 *                 type: string
 *                 description: Client's phone number
 *               email:
 *                 type: string
 *                 description: Client's email address
 *               job_status:
 *                 type: string
 *                 enum: [unemployed, has_interview, employed]
 *                 description: Client's employment status
 *     responses:
 *       200:
 *         description: Client created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 client_id:
 *                   type: integer
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// 创建客户（Partner推荐）
app.post('/api/clients', (req, res) => {
  const { referral_agency_id, first_name, last_name, phone_number, email, job_status } = req.body;

  db.run(
    `INSERT INTO clients (referral_agency_id, first_name, last_name, phone_number, email, job_status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [referral_agency_id, first_name, last_name, phone_number, email, job_status || 'unemployed'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ client_id: this.lastID, message: 'Client created successfully' });
      }
    }
  );
});

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Get all clients
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: List of all clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   client_id:
 *                     type: integer
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone_number:
 *                     type: string
 *                   agency_name:
 *                     type: string
 */
app.get('/api/clients', (req, res) => {
  db.all(
    `SELECT
      c.client_id,
      c.first_name,
      c.last_name,
      c.email,
      c.phone_number,
      c.job_status,
      c.created_at,
      ra.agency_name
    FROM clients c
    LEFT JOIN referral_agencies ra ON c.referral_agency_id = ra.agency_id
    ORDER BY c.created_at DESC`,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

/**
 * @swagger
 * /api/clients/{client_id}:
 *   get:
 *     summary: Get client details
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: client_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       500:
 *         description: Server error
 */
// 获取客户
app.get('/api/clients/:client_id', (req, res) => {
  db.get('SELECT * FROM clients WHERE client_id = ?', [req.params.client_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row);
    }
  });
});

/**
 * @swagger
 * /api/clients/{client_id}:
 *   delete:
 *     summary: Delete a client
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: client_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client deleted successfully
 *       500:
 *         description: Server error
 */
app.delete('/api/clients/:client_id', (req, res) => {
  const client_id = req.params.client_id;
  db.serialize(() => {
    db.run('DELETE FROM appointments WHERE client_id = ?', [client_id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('DELETE FROM clients WHERE client_id = ?', [client_id], function(err2) {
        if (err2) {
          res.status(500).json({ error: err2.message });
        } else {
          res.json({ message: 'Client deleted successfully' });
        }
      });
    });
  });
});

// ==================== VOLUNTEERS ROUTES ====================

/**
 * @swagger
 * /api/volunteers:
 *   post:
 *     summary: Create a new volunteer
 *     tags: [Volunteers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *             properties:
 *               full_name:
 *                 type: string
 *                 description: Volunteer's full name
 *               specialty:
 *                 type: string
 *                 description: Volunteer's specialty area
 *               availability_pattern:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                       description: Date in YYYY-MM-DD format
 *                     start:
 *                       type: string
 *                       description: Start time in HH:MM format
 *                     end:
 *                       type: string
 *                       description: End time in HH:MM format
 *               training_completed:
 *                 type: boolean
 *                 description: Whether volunteer has completed training
 *     responses:
 *       200:
 *         description: Volunteer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 volunteer_id:
 *                   type: integer
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// 创建志愿者
app.post('/api/volunteers', (req, res) => {
  const { full_name, specialty, availability_pattern, training_completed } = req.body;

  db.run(
    `INSERT INTO volunteers (full_name, specialty, availability_pattern, training_completed) 
     VALUES (?, ?, ?, ?)`,
    [full_name, specialty, JSON.stringify(availability_pattern), training_completed || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ volunteer_id: this.lastID, message: 'Volunteer created successfully' });
      }
    }
  );
});

/**
 * @swagger
 * /api/volunteers:
 *   get:
 *     summary: Get all volunteers
 *     tags: [Volunteers]
 *     responses:
 *       200:
 *         description: List of all volunteers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Volunteer'
 *       500:
 *         description: Server error
 */
// 获取所有志愿者
app.get('/api/volunteers', (req, res) => {
  db.all('SELECT * FROM volunteers', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows.map(row => ({
        ...row,
        availability_pattern: JSON.parse(row.availability_pattern)
      })));
    }
  });
});

/**
 * @swagger
 * /api/volunteers/{volunteer_id}:
 *   get:
 *     summary: Get volunteer details
 *     tags: [Volunteers]
 *     parameters:
 *       - in: path
 *         name: volunteer_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Volunteer ID
 *     responses:
 *       200:
 *         description: Volunteer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Volunteer'
 *       404:
 *         description: Volunteer not found
 *       500:
 *         description: Server error
 */
// 获取特定志愿者
app.get('/api/volunteers/:volunteer_id', (req, res) => {
  db.get('SELECT * FROM volunteers WHERE volunteer_id = ?', [req.params.volunteer_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      row.availability_pattern = JSON.parse(row.availability_pattern);
      res.json(row);
    } else {
      res.status(404).json({ error: 'Volunteer not found' });
    }
  });
});

/**
 * @swagger
 * /api/volunteers/{volunteer_id}:
 *   delete:
 *     summary: Delete a volunteer and associated appointments
 *     tags: [Volunteers]
 *     parameters:
 *       - in: path
 *         name: volunteer_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The volunteer ID to delete
 *     responses:
 *       200:
 *         description: Volunteer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// Delete volunteer
app.delete('/api/volunteers/:volunteer_id', (req, res) => {
  const volunteer_id = req.params.volunteer_id;
  db.serialize(() => {
    db.run('DELETE FROM appointments WHERE volunteer_id = ?', [volunteer_id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('DELETE FROM volunteers WHERE volunteer_id = ?', [volunteer_id], function(err2) {
        if (err2) {
          res.status(500).json({ error: err2.message });
        } else {
          res.json({ message: 'Volunteer deleted successfully' });
        }
      });
    });
  });
});

// ==================== APPOINTMENTS ROUTES ====================

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - service_type
 *               - interview_time
 *             properties:
 *               client_id:
 *                 type: integer
 *                 description: ID of the client
 *               service_type:
 *                 type: string
 *                 enum: [career_training, styling, mock_interview]
 *                 description: Type of service requested
 *               interview_time:
 *                 type: string
 *                 format: date-time
 *                 description: Client's interview time
 *               schedule_time:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled appointment time (optional)
 *     responses:
 *       200:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appt_id:
 *                   type: integer
 *                 volunteer_id:
 *                   type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
// 创建预约
app.post('/api/appointments', (req, res) => {
  const { client_id, service_type, interview_time, schedule_time } = req.body;
  const interviewDate = parseDate(interview_time);
  const scheduleDate = schedule_time ? parseDate(schedule_time) : null;
  const now = new Date();

  if (!interviewDate || interviewDate <= now) {
    return res.status(400).json({ error: 'Interview time must be in the future' });
  }

  if (scheduleDate && scheduleDate >= interviewDate) {
    return res.status(400).json({ error: 'Schedule time must be before interview time' });
  }

  const leadHours = getLeadTimeHours(service_type);
  if (scheduleDate) {
    const latestAllowed = new Date(interviewDate.getTime() - leadHours * 60 * 60 * 1000);
    if (scheduleDate > latestAllowed) {
      return res.status(400).json({ error: `Schedule time must be at least ${leadHours} hours before interview` });
    }
  }

  const status = schedule_time ? 'pending_assignment' : 'pending_confirmation';
  const values = [client_id, service_type, schedule_time || null, interview_time, status];
  const assignmentSql = schedule_time ? ', schedule_time = ?' : '';

  db.run(
    `INSERT INTO appointments (client_id, service_type, schedule_time, interview_time, status) 
     VALUES (?, ?, ?, ?, ?)`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const apptId = this.lastID;
        if (!schedule_time) {
          return res.json({ appt_id: apptId, message: 'Appointment created successfully' });
        }

        db.all('SELECT * FROM volunteers', (err, volunteersRows) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const volunteers = volunteersRows.map((row) => ({
            ...row,
            availability_pattern: JSON.parse(row.availability_pattern)
          }));
          const volunteer = findMatchingVolunteer(volunteers, schedule_time);
          if (!volunteer) {
            return res.json({ appt_id: apptId, message: 'Appointment created, waiting for volunteer assignment' });
          }

          db.run(
            `UPDATE appointments SET volunteer_id = ?, status = 'matched', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE appt_id = ?`,
            [volunteer.volunteer_id, apptId],
            function(err2) {
              if (err2) {
                return res.status(500).json({ error: err2.message });
              }
              res.json({ appt_id: apptId, volunteer_id: volunteer.volunteer_id, message: 'Appointment scheduled and matched with volunteer' });
            }
          );
        });
      }
    }
  );
});

/**
 * @swagger
 * /api/appointments/slots:
 *   get:
 *     summary: Get available time slots for appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: service_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [career_training, styling, mock_interview]
 *         description: Type of service
 *       - in: query
 *         name: interview_time
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Client's interview time
 *     responses:
 *       200:
 *         description: List of available time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   schedule_time:
 *                     type: string
 *                     format: date-time
 *                   day:
 *                     type: string
 *                   volunteer_id:
 *                     type: integer
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
// 获取可选时间段
app.get('/api/appointments/slots', (req, res) => {
  const { service_type, interview_time } = req.query;
  if (!service_type || typeof service_type !== 'string' || !interview_time || typeof interview_time !== 'string') {
    return res.status(400).json({ error: 'service_type and interview_time are required' });
  }

  const interviewDate = parseDate(interview_time);
  if (!interviewDate) {
    return res.status(400).json({ error: 'Invalid interview_time' });
  }

  db.all('SELECT * FROM volunteers', (err, volunteersRows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const volunteers = volunteersRows.map((row) => ({
      ...row,
      availability_pattern: JSON.parse(row.availability_pattern)
    }));

    const slots = generateAvailableSlots(volunteers, service_type, interviewDate);
    res.json(slots);
  });
});

/**
 * @swagger
 * /api/appointments/{appt_id}:
 *   get:
 *     summary: Get appointment details
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: appt_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Appointment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       500:
 *         description: Server error
 */
// 获取预约
app.get('/api/appointments/:appt_id', (req, res) => {
  db.get('SELECT * FROM appointments WHERE appt_id = ?', [req.params.appt_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row);
    }
  });
});

// 获取客户的所有预约
app.get('/api/clients/:client_id/appointments', (req, res) => {
  db.all('SELECT * FROM appointments WHERE client_id = ?', [req.params.client_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 更新预约时间
app.put('/api/appointments/:appt_id/schedule', (req, res) => {
  const { schedule_time } = req.body;
  const appt_id = req.params.appt_id;

  db.get('SELECT * FROM appointments WHERE appt_id = ?', [appt_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (row.change_count >= 3) {
      res.status(400).json({ error: 'Maximum changes reached (3)' });
      return;
    }

    db.run(
      `UPDATE appointments SET schedule_time = ?, change_count = change_count + 1, status = 'pending_assignment', volunteer_id = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE appt_id = ?`,
      [schedule_time, appt_id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ message: 'Appointment rescheduled successfully' });
        }
      }
    );
  });
});

/**
 * @swagger
 * /api/appointments/{appt_id}/assign/{volunteer_id}:
 *   put:
 *     summary: Assign appointment to volunteer
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: appt_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment ID
 *       - in: path
 *         name: volunteer_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Volunteer ID
 *     responses:
 *       200:
 *         description: Appointment assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// 志愿者认领预约
app.put('/api/appointments/:appt_id/assign/:volunteer_id', (req, res) => {
  const { appt_id, volunteer_id } = req.params;

  db.run(
    `UPDATE appointments SET volunteer_id = ?, status = 'matched', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE appt_id = ?`,
    [volunteer_id, appt_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Appointment assigned successfully' });
      }
    }
  );
});

/**
 * @swagger
 * /api/appointments/{appt_id}/complete:
 *   put:
 *     summary: Complete appointment and add feedback
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: appt_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confidence_score_pre:
 *                 type: integer
 *                 description: Pre-service confidence score
 *               confidence_score_post:
 *                 type: integer
 *                 description: Post-service confidence score
 *               outcome_notes:
 *                 type: string
 *                 description: Notes about the appointment outcome
 *     responses:
 *       200:
 *         description: Appointment completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
// 完成预约并填写反馈
app.put('/api/appointments/:appt_id/complete', (req, res) => {
  const { confidence_score_pre, confidence_score_post, outcome_notes } = req.body;
  const appt_id = req.params.appt_id;

  db.run(
    `UPDATE appointments SET status = 'completed', confidence_score_pre = ?, confidence_score_post = ?, outcome_notes = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE appt_id = ?`,
    [confidence_score_pre, confidence_score_post, outcome_notes, appt_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Appointment completed successfully' });
      }
    }
  );
});

// 获取待分配的预约（对志愿者）
app.get('/api/appointments/status/pending_assignment', (req, res) => {
  db.all(
    `SELECT a.*, c.first_name, c.last_name, c.phone_number, c.email 
     FROM appointments a 
     JOIN clients c ON a.client_id = c.client_id 
     WHERE a.status = 'pending_assignment'`,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// 获取志愿者本人任务
app.get('/api/appointments/volunteer/:volunteer_id', (req, res) => {
  const volunteerId = req.params.volunteer_id;
  db.all(
    `SELECT a.*, c.first_name, c.last_name, c.phone_number, c.email
     FROM appointments a
     JOIN clients c ON a.client_id = c.client_id
     WHERE a.volunteer_id = ?
     ORDER BY a.schedule_time`,
    [volunteerId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_clients:
 *                   type: integer
 *                 completed_appointments:
 *                   type: integer
 *                 pending_confirmations:
 *                   type: integer
 *                 total_volunteers:
 *                   type: integer
 *       500:
 *         description: Server error
 */
// 获取仪表板数据
app.get('/api/dashboard/stats', (req, res) => {
  db.serialize(() => {
    let stats = {};

    db.get('SELECT COUNT(*) as count FROM clients', (err, row) => {
      stats.total_clients = row?.count || 0;

      db.get('SELECT COUNT(*) as count FROM appointments WHERE status = "completed"', (err, row) => {
        stats.completed_appointments = row?.count || 0;

        db.get('SELECT COUNT(*) as count FROM appointments WHERE status = "pending_confirmation"', (err, row) => {
          stats.pending_confirmations = row?.count || 0;

          db.get('SELECT COUNT(*) as count FROM volunteers', (err, row) => {
            stats.total_volunteers = row?.count || 0;
            res.json(stats);
          });
        });
      });
    });
  });
});

/**
 * @swagger
 * /api/dashboard/agency-stats:
 *   get:
 *     summary: Get agency referral statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Agency referral statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   agency_id:
 *                     type: integer
 *                   agency_name:
 *                     type: string
 *                   category:
 *                     type: string
 *                   client_count:
 *                     type: integer
 *                   status:
 *                     type: integer
 */
app.get('/api/dashboard/agency-stats', (req, res) => {
  db.all(`
    SELECT
      ra.agency_id,
      ra.agency_name,
      ra.category,
      ra.status,
      COUNT(c.client_id) as client_count
    FROM referral_agencies ra
    LEFT JOIN clients c ON ra.agency_id = c.referral_agency_id
    GROUP BY ra.agency_id, ra.agency_name, ra.category, ra.status
    ORDER BY client_count DESC, ra.agency_name ASC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

/**
 * @swagger
 * /api/dashboard/client-progress:
 *   get:
 *     summary: Get client progress board data
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Client progress board data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   client_id:
 *                     type: integer
 *                   client_name:
 *                     type: string
 *                   agency_name:
 *                     type: string
 *                   has_appointment:
 *                     type: boolean
 *                   career_training:
 *                     type: boolean
 *                   styling:
 *                     type: boolean
 *                   interview_completed:
 *                     type: boolean
 *                   feedback:
 *                     type: boolean
 */
app.get('/api/dashboard/client-progress', (req, res) => {
  db.all(`
    SELECT
      c.client_id,
      c.first_name || ' ' || c.last_name AS client_name,
      ra.agency_name,
      MAX(CASE WHEN a.appt_id IS NOT NULL THEN 1 ELSE 0 END) as has_appointment,
      MAX(CASE WHEN a.service_type = 'career_training' AND a.status = 'completed' THEN 1 ELSE 0 END) as career_training,
      MAX(CASE WHEN a.service_type = 'styling' AND a.status = 'completed' THEN 1 ELSE 0 END) as styling,
      MAX(CASE WHEN a.service_type = 'mock_interview' AND a.status = 'completed' THEN 1 ELSE 0 END) as interview_completed,
      MAX(CASE WHEN TRIM(IFNULL(a.outcome_notes, '')) <> '' THEN 1 ELSE 0 END) as feedback
    FROM clients c
    JOIN referral_agencies ra ON c.referral_agency_id = ra.agency_id
    LEFT JOIN appointments a ON c.client_id = a.client_id
    GROUP BY c.client_id, c.first_name, c.last_name, ra.agency_name
    ORDER BY c.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows.map(row => ({
        ...row,
        has_appointment: Boolean(row.has_appointment),
        career_training: Boolean(row.career_training),
        styling: Boolean(row.styling),
        interview_completed: Boolean(row.interview_completed),
        feedback: Boolean(row.feedback),
      })));
    }
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 告诉 Express 去哪里找静态网页文件
app.use(express.static(path.join(__dirname, 'dist')));

// 这一行是为了兼容 React 的路由，确保刷新页面不报 404
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
