const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dfs.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 1. 合作伙伴机构表
    db.run(`
      CREATE TABLE IF NOT EXISTS referral_agencies (
        agency_id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_name VARCHAR(255) NOT NULL,
        category TEXT CHECK(category IN ('refugee_support', 'domestic_violence', 'employment_center', 'university')),
        main_contact_name VARCHAR(255),
        contact_email VARCHAR(255),
        auth_code VARCHAR(50) UNIQUE,
        status TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. 受助女性表
    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        client_id INTEGER PRIMARY KEY AUTOINCREMENT,
        referral_agency_id INTEGER NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20),
        email VARCHAR(255),
        job_status TEXT CHECK(job_status IN ('unemployed', 'has_interview', 'employed')) DEFAULT 'unemployed',
        consent_flag BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referral_agency_id) REFERENCES referral_agencies(agency_id)
      )
    `);

    // 3. 志愿者表
    db.run(`
      CREATE TABLE IF NOT EXISTS volunteers (
        volunteer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name VARCHAR(255) NOT NULL,
        specialty TEXT,
        availability_pattern TEXT,
        training_completed BOOLEAN DEFAULT 0,
        current_load INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. 预约记录表（核心表）
    db.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        appt_id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        volunteer_id INTEGER,
        service_type TEXT CHECK(service_type IN ('career_training', 'styling', 'mock_interview')) NOT NULL,
        schedule_time DATETIME,
        interview_time DATETIME,
        status TEXT CHECK(status IN ('pending_confirmation', 'pending_assignment', 'matched', 'completed', 'absent')) DEFAULT 'pending_confirmation',
        confidence_score_pre INTEGER,
        confidence_score_post INTEGER,
        outcome_notes TEXT,
        change_count INTEGER DEFAULT 0,
        assigned_at DATETIME,
        reminder_sent BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(client_id),
        FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id)
      )
    `);

    console.log('Database initialized successfully');
  });
}

module.exports = db;
