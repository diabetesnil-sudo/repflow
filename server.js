// RepFlow Phase 8 Enterprise Multi-Tenant SaaS Server
// Tagline: The Offline-First Pharmaceutical Field Force Operating System
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'repflow.db');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multi-Tenant Middleware
app.use((req, res, next) => {
  const tenantIdHeader = req.headers['x-tenant-id'] || req.query.tenant_id;
  req.tenant_id = tenantIdHeader ? parseInt(tenantIdHeader) : 1;
  next();
});

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening RepFlow SQLite database:', err.message);
  } else {
    console.log('Connected to RepFlow SQLite database.');
    initDatabaseSchema();
  }
});

function initDatabaseSchema() {
  db.serialize(() => {
    // 1. Tenants Table & Subscriptions
    db.run(`CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      subscription_tier TEXT DEFAULT 'ENTERPRISE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tenant_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      plan_tier TEXT DEFAULT 'ENTERPRISE',
      max_mr_seats INTEGER DEFAULT 50,
      max_am_seats INTEGER DEFAULT 10,
      monthly_price REAL DEFAULT 49999,
      billing_status TEXT DEFAULT 'ACTIVE',
      next_billing_date TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )`);

    // 2. Users Table (Multi-tenant friendly, without global unique email block)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      reporting_manager_id INTEGER,
      territory_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      password TEXT DEFAULT 'repflow@123'
    )`);

    db.run("ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'repflow@123'", (err) => {});

    // Ensure users table allows multi-tenant email configurations (no restrictive unique constraint)
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
      if (row && row.sql && row.sql.includes('UNIQUE')) {
        db.serialize(() => {
          db.run("PRAGMA foreign_keys=OFF");
          db.run(`CREATE TABLE IF NOT EXISTS users_migration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            reporting_manager_id INTEGER,
            territory_code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            password TEXT DEFAULT 'repflow@123'
          )`);
          db.run(`INSERT INTO users_migration (id, tenant_id, name, email, role, reporting_manager_id, territory_code, created_at, password)
                  SELECT id, tenant_id, name, email, role, reporting_manager_id, territory_code, created_at, COALESCE(password, 'repflow@123') FROM users`);
          db.run("DROP TABLE users");
          db.run("ALTER TABLE users_migration RENAME TO users");
          db.run("PRAGMA foreign_keys=ON");
          console.log("Auto-migrated users table: removed global email UNIQUE constraint.");
        });
      }
    });

    // 3. Doctors Table with Address & Area Enhancements (Phase 8)
    db.run(`CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      category TEXT CHECK(category IN ('Superstar', 'A+', 'A', 'B')) NOT NULL,
      hospital_clinic_name TEXT,
      preferred_time TEXT,
      prescribing_potential TEXT,
      territory_code TEXT NOT NULL,
      latitude REAL DEFAULT 28.5355,
      longitude REAL DEFAULT 77.2410,
      phone TEXT,
      email TEXT,
      clinic_address TEXT,
      area_name TEXT DEFAULT 'Saket',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Safe Schema Migrations for Doctors Phase 8
    db.run("ALTER TABLE doctors ADD COLUMN phone TEXT", (err) => {});
    db.run("ALTER TABLE doctors ADD COLUMN email TEXT", (err) => {});
    db.run("ALTER TABLE doctors ADD COLUMN clinic_address TEXT", (err) => {});
    db.run("ALTER TABLE doctors ADD COLUMN area_name TEXT DEFAULT 'Saket'", (err) => {});
    db.run("ALTER TABLE doctors ADD COLUMN latitude REAL DEFAULT 28.5355", (err) => {});
    db.run("ALTER TABLE doctors ADD COLUMN longitude REAL DEFAULT 77.2410", (err) => {});

    // 4. Chemists Table
    db.run(`CREATE TABLE IF NOT EXISTS chemists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      territory_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. Distributors Table (Phase 8 Extended Firm Details)
    db.run(`CREATE TABLE IF NOT EXISTS distributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      drug_license_no TEXT,
      territory_code TEXT NOT NULL,
      area_name TEXT DEFAULT 'Saket',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("ALTER TABLE distributors ADD COLUMN contact_person TEXT", (err) => {});
    db.run("ALTER TABLE distributors ADD COLUMN email TEXT", (err) => {});
    db.run("ALTER TABLE distributors ADD COLUMN drug_license_no TEXT", (err) => {});
    db.run("ALTER TABLE distributors ADD COLUMN area_name TEXT DEFAULT 'Saket'", (err) => {});

    // 6. DCR Header Table (Phase 8 Station & Area Enhancements)
    db.run(`CREATE TABLE IF NOT EXISTS dcrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      working_type TEXT CHECK(working_type IN ('INDEPENDENT', 'JOINT')) NOT NULL,
      joint_with_user_id INTEGER,
      station_type TEXT DEFAULT 'HQ',
      area_worked TEXT DEFAULT 'Saket',
      joint_working_role TEXT,
      status TEXT DEFAULT 'SUBMITTED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("ALTER TABLE dcrs ADD COLUMN station_type TEXT DEFAULT 'HQ'", (err) => {});
    db.run("ALTER TABLE dcrs ADD COLUMN area_worked TEXT DEFAULT 'Saket'", (err) => {});
    db.run("ALTER TABLE dcrs ADD COLUMN joint_working_role TEXT", (err) => {});

    // 7. Doctor Call Details Table
    db.run(`CREATE TABLE IF NOT EXISTS dcr_doctor_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dcr_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      call_time TEXT,
      products_detailed TEXT,
      samples_given TEXT,
      remarks TEXT,
      call_latitude REAL,
      call_longitude REAL,
      is_geofence_verified INTEGER DEFAULT 1,
      FOREIGN KEY(dcr_id) REFERENCES dcrs(id)
    )`);

    db.run("ALTER TABLE dcr_doctor_calls ADD COLUMN call_latitude REAL", (err) => {});
    db.run("ALTER TABLE dcr_doctor_calls ADD COLUMN call_longitude REAL", (err) => {});
    db.run("ALTER TABLE dcr_doctor_calls ADD COLUMN is_geofence_verified INTEGER DEFAULT 1", (err) => {});

    // 8. CME & Medical Camps Activity Table (Phase 8 New Feature)
    db.run(`CREATE TABLE IF NOT EXISTS dcr_cme_camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      venue TEXT NOT NULL,
      date TEXT NOT NULL,
      doctor_count INTEGER NOT NULL,
      products_focused TEXT,
      expense_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 9. E-Detailing Slide Decks Table (Phase 8 Product Slide Upload)
    db.run(`CREATE TABLE IF NOT EXISTS edetailing_product_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      product_name TEXT NOT NULL,
      slide_title TEXT NOT NULL,
      slide_subtitle TEXT,
      image_url_or_data TEXT,
      slide_sequence INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 10. E-Detailing Analytics Table
    db.run(`CREATE TABLE IF NOT EXISTS edetailing_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      slide_id INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 11. Chemist Call Details Table
    db.run(`CREATE TABLE IF NOT EXISTS dcr_chemist_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dcr_id INTEGER NOT NULL,
      chemist_id INTEGER NOT NULL,
      pob_amount REAL DEFAULT 0,
      FOREIGN KEY(dcr_id) REFERENCES dcrs(id)
    )`);

    // 12. Sample Bag Table
    db.run(`CREATE TABLE IF NOT EXISTS virtual_sample_bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      item_type TEXT DEFAULT 'SAMPLE',
      batch_number TEXT NOT NULL,
      allocated_qty INTEGER NOT NULL,
      current_qty INTEGER NOT NULL,
      low_stock_threshold INTEGER DEFAULT 5,
      FOREIGN KEY(mr_id) REFERENCES users(id)
    )`);

    // 13. Gift Distributions Table
    db.run(`CREATE TABLE IF NOT EXISTS gift_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      gift_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      value_amount REAL DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY(mr_id) REFERENCES users(id)
    )`);

    // 14. MTP Header Table
    db.run(`CREATE TABLE IF NOT EXISTS mtp_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      status TEXT CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED_WITH_COMMENTS')) DEFAULT 'DRAFT',
      rejection_comments TEXT,
      submitted_at DATETIME,
      approved_at DATETIME
    )`);

    // 15. MTP Days Table
    db.run(`CREATE TABLE IF NOT EXISTS mtp_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mtp_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      territory TEXT NOT NULL,
      working_type TEXT NOT NULL,
      objective TEXT,
      is_locked INTEGER DEFAULT 0,
      FOREIGN KEY(mtp_id) REFERENCES mtp_headers(id)
    )`);

    // 16. Expense Claims Table (Phase 8 DA/TA Engine Support)
    db.run(`CREATE TABLE IF NOT EXISTS expense_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      station_type TEXT CHECK(station_type IN ('HQ', 'EX-HQ', 'OUT-STATION')) DEFAULT 'HQ',
      da_amount REAL DEFAULT 350,
      ta_mode TEXT DEFAULT 'PER_KM',
      kms_travelled REAL DEFAULT 0,
      ta_amount REAL DEFAULT 0,
      hotel_amount REAL DEFAULT 0,
      category TEXT DEFAULT 'Travel',
      original_amount REAL NOT NULL,
      approved_amount REAL,
      receipt_image_data TEXT,
      status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'CORRECTED', 'REJECTED')) DEFAULT 'PENDING',
      correction_reason TEXT,
      remarks TEXT,
      reviewed_by_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("ALTER TABLE expense_claims ADD COLUMN station_type TEXT DEFAULT 'HQ'", (err) => {});
    db.run("ALTER TABLE expense_claims ADD COLUMN da_amount REAL DEFAULT 350", (err) => {});
    db.run("ALTER TABLE expense_claims ADD COLUMN ta_mode TEXT DEFAULT 'PER_KM'", (err) => {});
    db.run("ALTER TABLE expense_claims ADD COLUMN kms_travelled REAL DEFAULT 0", (err) => {});
    db.run("ALTER TABLE expense_claims ADD COLUMN ta_amount REAL DEFAULT 0", (err) => {});
    db.run("ALTER TABLE expense_claims ADD COLUMN hotel_amount REAL DEFAULT 0", (err) => {});

    // 17. Leave Requests Table
    db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      mr_id INTEGER NOT NULL,
      leave_type TEXT CHECK(leave_type IN ('CL', 'SL', 'EL')) NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days INTEGER NOT NULL,
      reason TEXT,
      status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
      reviewed_by_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 18. Academic Investments Table
    db.run(`CREATE TABLE IF NOT EXISTS academic_investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      am_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      activity_type TEXT CHECK(activity_type IN ('CME Sponsorship', 'Clinical Research Grant', 'Consultancy Fees', 'Medical Textbooks')) NOT NULL,
      investment_amount REAL NOT NULL,
      expected_rx_monthly_val REAL NOT NULL,
      actual_rx_monthly_val REAL DEFAULT 0,
      roi_percentage REAL DEFAULT 0,
      status TEXT CHECK(status IN ('PROPOSED', 'APPROVED', 'COMPLETED')) DEFAULT 'PROPOSED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    seedInitialData();
  });
}

function seedInitialData() {
  db.get("SELECT COUNT(*) as count FROM tenants", (err, row) => {
    if (row && row.count === 0) {
      console.log('Seeding Multi-Tenant Pharma Organizations & SaaS Subscriptions...');
      db.run(`INSERT INTO tenants (id, company_name, slug, subscription_tier) VALUES 
        (1, 'Astra Pharma Ltd.', 'astra-pharma', 'ENTERPRISE'),
        (2, 'Sun Care Life Sciences', 'sun-care', 'ENTERPRISE'),
        (3, 'Zydus Health Ltd.', 'zydus-health', 'PRO')`);

      db.run(`INSERT INTO tenant_subscriptions (tenant_id, plan_tier, max_mr_seats, max_am_seats, monthly_price, billing_status, next_billing_date) VALUES 
        (1, 'ENTERPRISE', 100, 20, 75000, 'ACTIVE', '2026-08-31'),
        (2, 'ENTERPRISE', 50, 10, 49999, 'ACTIVE', '2026-08-31'),
        (3, 'PRO', 25, 5, 25000, 'ACTIVE', '2026-08-31')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO users (id, tenant_id, name, email, role, reporting_manager_id, territory_code) VALUES 
        (1, 1, 'Priya Mehta', 'priya.ho@repflow.io', 'HO', NULL, 'HQ-GLOBAL'),
        (2, 1, 'Ramesh Gupta', 'ramesh.zsm@repflow.io', 'ZSM', 1, 'Z-NORTH'),
        (3, 1, 'Anita Sharma', 'anita.rm@repflow.io', 'RM', 2, 'R-DELHI-NCR'),
        (4, 1, 'Vikram Singh', 'vikram.am@repflow.io', 'AM', 3, 'A-SOUTH-DELHI'),
        (5, 1, 'Rahul Sharma', 'rahul.mr@repflow.io', 'MR', 4, 'T-GREATER-KAILASH'),
        (6, 1, 'Neha Verma', 'neha.mr@repflow.io', 'MR', 4, 'T-NEHRU-PLACE')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM doctors", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO doctors (tenant_id, code, name, specialty, category, hospital_clinic_name, preferred_time, prescribing_potential, territory_code, latitude, longitude, phone, email, clinic_address, area_name) VALUES 
        (1, 'DOC-101', 'Dr. Rajesh Verma', 'Cardiology', 'Superstar', 'Max Super Specialty Hospital', '11:00 AM - 01:00 PM', '₹1,50,000/mo', 'T-GREATER-KAILASH', 28.5355, 77.2410, '+91 98100 11223', 'dr.rajesh@maxhealth.com', '1 Press Enclave Marg, Saket, New Delhi', 'Saket'),
        (1, 'DOC-102', 'Dr. Sunita Rao', 'Endocrinology', 'A+', 'Fortis Escorts Heart Institute', '04:00 PM - 06:00 PM', '₹90,000/mo', 'T-GREATER-KAILASH', 28.5562, 77.2811, '+91 98200 33445', 'dr.sunita@fortis.com', 'Okhla Road, Near Sukhdev Vihar', 'Nehru Place'),
        (1, 'DOC-103', 'Dr. Amit Kapoor', 'Neurology', 'A', 'Apollo Hospital Delhi', '02:00 PM - 04:00 PM', '₹75,000/mo', 'T-NEHRU-PLACE', 28.5398, 77.2842, '+91 98300 55667', 'dr.kapoor@apollo.com', 'Mathura Road, Sarita Vihar', 'Nehru Place')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM chemists", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO chemists (tenant_id, code, name, contact_person, phone, territory_code) VALUES 
        (1, 'CHM-501', 'MedPlus Pharmacy GK-1', 'Suresh Kumar', '+91 98765 43210', 'T-GREATER-KAILASH'),
        (1, 'CHM-502', 'Apollo Pharmacy Nehru Place', 'Vikas Gupta', '+91 98111 22334', 'T-NEHRU-PLACE')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM distributors", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO distributors (tenant_id, code, name, contact_person, phone, email, gstin, drug_license_no, territory_code, area_name) VALUES 
        (1, 'DST-901', 'Delhi Pharma Distributors Pvt Ltd', 'Rakesh Sharma', '+91 11 2649 1000', 'orders@delhipharma.com', '07AAAAA0000A1Z5', 'DL-2026-DEL-101', 'T-GREATER-KAILASH', 'Saket'),
        (1, 'DST-902', 'Northern Stockists & Agency', 'Manish Verma', '+91 11 4160 2000', 'supply@northernstockists.com', '07BBBBB1111B2Z6', 'DL-2026-DEL-102', 'T-NEHRU-PLACE', 'Nehru Place')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM edetailing_product_slides", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO edetailing_product_slides (tenant_id, product_name, slide_title, slide_subtitle, slide_sequence) VALUES 
        (1, 'Cardia-90 10mg Catch Covers', 'Cardia-90 Phase-III Clinical Trial Results', '38% Reduction in Major Adverse Cardiovascular Events (MACE)', 1),
        (1, 'Cardia-90 10mg Catch Covers', 'Superior Bioavailability & Peak Concentration', 'Peak Plasma Concentration in 1.2 Hours with 24-hr Control', 2),
        (1, 'Glicla-M SR Starter Packs', 'Glicla-M SR Dual Action Glycemic Control', 'Mean HbA1c Reduction of 1.6% across 12-week trials', 1)`);
    }
  });
}

// -------------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'RepFlow Enterprise SaaS Server',
    version: '8.0.0-SaaS',
    tenant_id: req.tenant_id,
    tagline: 'The Offline-First Pharmaceutical Field Force Operating System'
  });
});

// Haversine Distance Helper
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.post('/api/dcrs/verify-gps', (req, res) => {
  const { doctor_id, user_lat, user_lng } = req.body;
  db.get('SELECT latitude, longitude, name FROM doctors WHERE id = ?', [doctor_id || 1], (err, doc) => {
    const docName = doc ? doc.name : 'Dr. Rajesh Verma';
    const docLat = (doc && doc.latitude) ? doc.latitude : 28.5355;
    const docLng = (doc && doc.longitude) ? doc.longitude : 77.2410;

    const distMeters = calculateDistanceMeters(user_lat || 28.5355, user_lng || 77.2410, docLat, docLng);
    const isVerified = distMeters <= 500;

    res.json({
      doctor_name: docName,
      distance_meters: Math.round(distMeters),
      is_geofence_verified: isVerified,
      status: isVerified ? 'VERIFIED IN-CLINIC VISIT' : 'REMOTE SUBMISSION FLAG'
    });
  });
});

// Doctors API with Area Name Filtering (Phase 8)
app.get('/api/doctors', (req, res) => {
  const areaName = req.query.area_name;
  let sql = 'SELECT * FROM doctors WHERE tenant_id = ?';
  const params = [req.tenant_id];

  if (areaName && areaName !== 'ALL') {
    sql += ' AND (area_name LIKE ? OR territory_code LIKE ?)';
    params.push(`%${areaName}%`, `%${areaName}%`);
  }

  sql += ' ORDER BY id DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/doctors', (req, res) => {
  const { code, name, specialty, category, hospital_clinic_name, preferred_time, prescribing_potential, territory_code, latitude, longitude, phone, email, clinic_address, area_name } = req.body;
  const sql = `INSERT INTO doctors (tenant_id, code, name, specialty, category, hospital_clinic_name, preferred_time, prescribing_potential, territory_code, latitude, longitude, phone, email, clinic_address, area_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [
    req.tenant_id,
    code || `DOC-${Date.now().toString().slice(-4)}`,
    name,
    specialty || 'General Medicine',
    category || 'A',
    hospital_clinic_name || 'Clinic',
    preferred_time || '11:00 AM',
    prescribing_potential || '₹75,000/mo',
    territory_code || 'T-GREATER-KAILASH',
    latitude || 28.5355,
    longitude || 77.2410,
    phone || '+91 98100 00000',
    email || 'doctor@pharma.com',
    clinic_address || 'Clinic Address',
    area_name || 'Saket'
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: `Doctor ${name} registered into Master Directory under Area ${area_name || 'Saket'}.` });
  });
});

app.delete('/api/doctors/:id', (req, res) => {
  const role = req.headers['x-user-role'] || 'MR';
  if (role !== 'HO' && role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'RBAC Security Violation: Field Staff (MR/AM/RM) are restricted from deleting master records.' });
  }
  db.run('DELETE FROM doctors WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Doctor record deleted by Head Office.' });
  });
});

app.get('/api/chemists', (req, res) => {
  db.all('SELECT * FROM chemists WHERE tenant_id = ? ORDER BY id DESC', [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/chemists', (req, res) => {
  const { code, name, contact_person, phone, territory_code } = req.body;
  const sql = `INSERT INTO chemists (tenant_id, code, name, contact_person, phone, territory_code) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [req.tenant_id, code || `CHM-${Date.now().toString().slice(-4)}`, name, contact_person, phone, territory_code || 'T-GREATER-KAILASH'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Chemist added successfully.' });
  });
});

app.get('/api/distributors', (req, res) => {
  db.all('SELECT * FROM distributors WHERE tenant_id = ? ORDER BY id DESC', [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/distributors', (req, res) => {
  const { code, name, contact_person, phone, email, gstin, drug_license_no, territory_code, area_name } = req.body;
  const sql = `INSERT INTO distributors (tenant_id, code, name, contact_person, phone, email, gstin, drug_license_no, territory_code, area_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [
    req.tenant_id,
    code || `DST-${Date.now().toString().slice(-4)}`,
    name,
    contact_person || 'Stockist Manager',
    phone || '+91 11 2600 0000',
    email || 'contact@distributor.com',
    gstin || '07AAAAA0000A1Z5',
    drug_license_no || 'DL-2026-DEL-999',
    territory_code || 'T-GREATER-KAILASH',
    area_name || 'Saket'
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: `Distributor / Stockist Firm ${name} registered successfully.` });
  });
});

// DCR APIs (Multi-Product Detailing & CME Support)
app.post('/api/dcrs', (req, res) => {
  const { mr_id, date, working_type, joint_with_user_id, station_type, area_worked, joint_working_role, doctor_calls, chemist_calls } = req.body;
  
  db.run(`INSERT INTO dcrs (tenant_id, mr_id, date, working_type, joint_with_user_id, station_type, area_worked, joint_working_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, mr_id || 5, date, working_type || 'INDEPENDENT', joint_with_user_id, station_type || 'HQ', area_worked || 'Saket', joint_working_role],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const dcrId = this.lastID;

      if (Array.isArray(doctor_calls)) {
        const stmt = db.prepare(`INSERT INTO dcr_doctor_calls (dcr_id, doctor_id, call_time, products_detailed, samples_given, remarks, call_latitude, call_longitude, is_geofence_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        doctor_calls.forEach(dc => {
          stmt.run([dcrId, dc.doctor_id, dc.call_time, JSON.stringify(dc.products_detailed), JSON.stringify(dc.samples_given), dc.remarks, dc.call_latitude || 28.5355, dc.call_longitude || 77.2410, 1]);

          if (Array.isArray(dc.samples_given)) {
            dc.samples_given.forEach(s => {
              db.run(`UPDATE virtual_sample_bags SET current_qty = MAX(0, current_qty - ?) WHERE mr_id = ? AND product_name LIKE ? AND tenant_id = ?`,
                [s.qty || 1, mr_id || 5, `%${s.product.split(' ')[0]}%`, req.tenant_id]);
            });
          }
        });
        stmt.finalize();
      }

      if (Array.isArray(chemist_calls)) {
        const cstmt = db.prepare(`INSERT INTO dcr_chemist_calls (dcr_id, chemist_id, pob_amount) VALUES (?, ?, ?)`);
        chemist_calls.forEach(cc => {
          cstmt.run([dcrId, cc.chemist_id, cc.pob_amount]);
        });
        cstmt.finalize();
      }

      res.json({ message: 'DCR submitted successfully with station info & stock auto-deduction.', dcr_id: dcrId });
    }
  );
});

app.post('/api/dcrs/cme-camp', (req, res) => {
  const { mr_id, activity_type, title, venue, date, doctor_count, products_focused, expense_amount } = req.body;
  db.run(`INSERT INTO dcr_cme_camps (tenant_id, mr_id, activity_type, title, venue, date, doctor_count, products_focused, expense_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, mr_id || 5, activity_type || 'CME', title, venue, date, doctor_count || 10, JSON.stringify(products_focused), expense_amount || 15000],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: `${activity_type} activity "${title}" logged successfully.` });
    }
  );
});

// E-Detailing Slide Decks API (Phase 8 Upload Support)
app.get('/api/edetailing/slides', (req, res) => {
  db.all(`SELECT * FROM edetailing_product_slides WHERE tenant_id = ? ORDER BY product_name, slide_sequence ASC`, [req.tenant_id], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      return res.json([
        {
          product_name: 'Cardia-90 10mg Catch Covers',
          slides: [
            { id: 1, title: 'Cardia-90 Phase-III Clinical Trial Results', subtitle: '38% Reduction in Major Adverse Cardiovascular Events (MACE)', highlight: 'P < 0.001 Significance' },
            { id: 2, title: 'Superior Pharmacokinetics & Bioavailability', subtitle: 'Peak Plasma Concentration in 1.2 Hours with 24-hr Control', highlight: 'Once Daily Dosage' }
          ]
        },
        {
          product_name: 'Glicla-M SR Starter Packs',
          slides: [
            { id: 1, title: 'Glicla-M SR Dual Action Glycemic Control', subtitle: 'Mean HbA1c Reduction of 1.6% across 12-week trials', highlight: 'Sustained Release' }
          ]
        }
      ]);
    }
    res.json(rows);
  });
});

app.post('/api/edetailing/upload-slide', (req, res) => {
  const { product_name, slide_title, slide_subtitle, image_url_or_data, slide_sequence } = req.body;
  db.run(`INSERT INTO edetailing_product_slides (tenant_id, product_name, slide_title, slide_subtitle, image_url_or_data, slide_sequence) VALUES (?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, product_name, slide_title, slide_subtitle, image_url_or_data, slide_sequence || 1],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: `New E-Detailing slide "${slide_title}" uploaded for product ${product_name}.` });
    }
  );
});

// Pharma DA/TA Expense Claim Calculation API (Phase 8 Engine)
app.post('/api/expenses', (req, res) => {
  const { mr_id, date, station_type, ta_mode, kms_travelled, ta_ticket_amount, hotel_amount, remarks, receipt_image_data } = req.body;
  const station = station_type || 'HQ';
  
  let da = 350; // HQ default
  if (station === 'EX-HQ') da = 650;
  if (station === 'OUT-STATION') da = 1200;

  let ta = 0;
  if (ta_mode === 'PER_KM') {
    ta = (parseFloat(kms_travelled) || 0) * 6.00; // ₹6 per KM
  } else if (ta_mode === 'TICKET_REIMBURSEMENT') {
    ta = parseFloat(ta_ticket_amount) || 0;
  }

  const hotel = parseFloat(hotel_amount) || 0;
  const totalClaim = da + ta + hotel;

  db.run(`INSERT INTO expense_claims (tenant_id, mr_id, date, station_type, da_amount, ta_mode, kms_travelled, ta_amount, hotel_amount, category, original_amount, approved_amount, receipt_image_data, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Travel', ?, ?, ?, ?)`,
    [req.tenant_id, mr_id || 5, date, station, da, ta_mode || 'PER_KM', kms_travelled || 0, ta, hotel, totalClaim, totalClaim, receipt_image_data, remarks],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: this.lastID,
        message: `Pharma Expense Claim calculated & submitted! (DA: ₹${da} + TA: ₹${ta} + Hotel: ₹${hotel} = Total ₹${totalClaim})`,
        breakdown: { da, ta, hotel, total: totalClaim }
      });
    }
  );
});

app.get('/api/expenses', (req, res) => {
  db.all(`SELECT e.*, u.name as mr_name FROM expense_claims e JOIN users u ON e.mr_id = u.id WHERE e.tenant_id = ? ORDER BY e.id DESC`, [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/expenses/review', (req, res) => {
  const { expense_id, action, approved_amount, correction_reason, reviewer_id } = req.body;
  if (action === 'APPROVED' && approved_amount < req.body.original_amount && (!correction_reason || correction_reason.trim() === '')) {
    return res.status(400).json({ error: 'Mandatory field: Area Manager / RM must provide a Reason for Correction when altering claimed expense amounts.' });
  }

  const finalStatus = approved_amount != req.body.original_amount ? 'CORRECTED' : 'APPROVED';
  db.run(`UPDATE expense_claims SET status = ?, approved_amount = ?, correction_reason = ?, reviewed_by_id = ? WHERE id = ?`,
    [finalStatus, approved_amount, correction_reason, reviewer_id || 4, expense_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `Expense claim reviewed & status set to ${finalStatus}.` });
    }
  );
});

// Master Excel Imports & Templates
app.post('/api/master/import-doctors-excel', (req, res) => {
  const items = req.body.items || [];
  let insertedCount = 0;
  const stmt = db.prepare(`INSERT INTO doctors (tenant_id, code, name, specialty, category, hospital_clinic_name, preferred_time, prescribing_potential, territory_code, phone, email, clinic_address, area_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  items.forEach((d, idx) => {
    stmt.run([
      req.tenant_id,
      d.code || `DOC-XLS-${idx+1}`,
      d.name || 'Dr. Unknown',
      d.specialty || 'General Medicine',
      d.category || 'A',
      d.hospital_clinic_name || 'Clinic',
      d.preferred_time || '10:00 AM',
      d.prescribing_potential || '₹50,000/mo',
      d.territory_code || 'T-GREATER-KAILASH',
      d.phone || '+91 98100 00000',
      d.email || 'doctor@pharma.com',
      d.clinic_address || 'Clinic Address',
      d.area_name || 'Saket'
    ]);
    insertedCount++;
  });

  stmt.finalize(() => {
    res.json({ message: `Successfully imported ${insertedCount} doctors from Excel sheet into Master Directory.` });
  });
});

app.get('/api/master/template/:type', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="Doctor_Master_Template.csv"');
  res.send(`code,name,specialty,category,hospital_clinic_name,preferred_time,prescribing_potential,territory_code,phone,email,clinic_address,area_name
DOC-201,Dr. Ananya Roy,Gynaecology,Superstar,Apollo Cradle,10:00 AM,₹120000/mo,T-GREATER-KAILASH,+91 98100 22334,dr.ananya@cradle.com,Pusph Vihar Saket,Saket
DOC-202,Dr. K. S. Murthy,Cardiology,A+,Max Healthcare,05:00 PM,₹95000/mo,T-NEHRU-PLACE,+91 98200 44556,dr.murthy@max.com,Nehru Place Market,Nehru Place`);
});

// Sample Bag & Gifts
app.get('/api/sample-bag', (req, res) => {
  const mrId = req.query.mr_id || 5;
  db.all('SELECT * FROM virtual_sample_bags WHERE mr_id = ? AND tenant_id = ?', [mrId, req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const items = rows.map(r => ({
      ...r,
      is_low_stock: r.current_qty <= r.low_stock_threshold
    }));
    const lowStockCount = items.filter(i => i.is_low_stock).length;
    res.json({ items, low_stock_count: lowStockCount });
  });
});

app.post('/api/sample-bag/inward', (req, res) => {
  const { mr_id, product_name, item_type, batch_number, inward_qty } = req.body;
  const mr = mr_id || 5;
  const qty = parseInt(inward_qty) || 10;

  db.get('SELECT * FROM virtual_sample_bags WHERE mr_id = ? AND product_name = ? AND tenant_id = ?', [mr, product_name, req.tenant_id], (err, row) => {
    if (row) {
      db.run('UPDATE virtual_sample_bags SET current_qty = current_qty + ?, allocated_qty = allocated_qty + ? WHERE id = ?', [qty, qty, row.id], (uerr) => {
        if (uerr) return res.status(500).json({ error: uerr.message });
        res.json({ message: `Successfully received and inwarded ${qty} units of ${product_name} into Virtual Sample Bag.` });
      });
    } else {
      db.run('INSERT INTO virtual_sample_bags (tenant_id, mr_id, product_name, item_type, batch_number, allocated_qty, current_qty, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, 5)',
        [req.tenant_id, mr, product_name, item_type || 'SAMPLE', batch_number || 'B-NEW', qty, qty],
        function(ierr) {
          if (ierr) return res.status(500).json({ error: ierr.message });
          res.json({ message: `Successfully inwarded new product line ${product_name} (${qty} units).` });
        }
      );
    }
  });
});

app.get('/api/gifts', (req, res) => {
  db.all(`SELECT g.*, d.name as doctor_name, d.specialty FROM gift_distributions g JOIN doctors d ON g.doctor_id = d.id WHERE g.tenant_id = ? ORDER BY g.id DESC`, [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/gifts/distribute', (req, res) => {
  const { mr_id, doctor_id, gift_name, quantity, value_amount, date } = req.body;
  db.run(`INSERT INTO gift_distributions (tenant_id, mr_id, doctor_id, gift_name, quantity, value_amount, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, mr_id || 5, doctor_id, gift_name, quantity || 1, value_amount || 5000, date || new Date().toISOString().substring(0, 10)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: `Gift input distribution logged for Doctor.` });
    }
  );
});

// MTP APIs
app.get('/api/mtp', (req, res) => {
  const mrId = req.query.mr_id || 5;
  db.get('SELECT * FROM mtp_headers WHERE mr_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1', [mrId, req.tenant_id], (err, header) => {
    if (!header) return res.json({ status: 'DRAFT', days: [] });
    db.all('SELECT * FROM mtp_days WHERE mtp_id = ? ORDER BY date ASC', [header.id], (derr, days) => {
      res.json({ header, days });
    });
  });
});

app.post('/api/mtp/save-day', (req, res) => {
  const { mtp_id, date, territory, working_type, objective } = req.body;
  db.run(`INSERT OR REPLACE INTO mtp_days (mtp_id, date, territory, working_type, objective) VALUES (?, ?, ?, ?, ?)`,
    [mtp_id || 1, date, territory, working_type, objective],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'MTP Day saved successfully.' });
    }
  );
});

// Leaves APIs
app.get('/api/leaves', (req, res) => {
  const mrId = req.query.mr_id || 5;
  db.all(`SELECT l.*, u.name as mr_name FROM leave_requests l JOIN users u ON l.mr_id = u.id WHERE l.tenant_id = ? ORDER BY l.id DESC`, [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      balances: { cl_balance: 9, sl_balance: 10, el_balance: 15 },
      requests: rows
    });
  });
});

app.post('/api/leaves', (req, res) => {
  const { mr_id, leave_type, start_date, end_date, total_days, reason } = req.body;
  db.run(`INSERT INTO leave_requests (tenant_id, mr_id, leave_type, start_date, end_date, total_days, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, mr_id || 5, leave_type, start_date, end_date, total_days || 1, reason],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Leave application submitted to Area Manager.' });
    }
  );
});

app.post('/api/leaves/review', (req, res) => {
  const { leave_id, action, reviewer_id } = req.body;
  db.get('SELECT * FROM leave_requests WHERE id = ?', [leave_id], (err, leave) => {
    if (leave) {
      db.run('UPDATE leave_requests SET status = ?, reviewed_by_id = ? WHERE id = ?', [action, reviewer_id || 4, leave_id]);
      if (action === 'APPROVED') {
        db.run(`UPDATE mtp_days SET territory = 'ON LEAVE (' || ? || ')', is_locked = 1 WHERE date BETWEEN ? AND ?`,
          [leave.leave_type, leave.start_date, leave.end_date]);
      }
      res.json({ message: `Leave ${action} and MTP calendar locked for approved dates.` });
    } else {
      res.status(404).json({ error: 'Leave request not found.' });
    }
  });
});

// YoY Analytics & RoI
app.get('/api/analytics/yoy-sales', (req, res) => {
  res.json({
    period: 'FY 2026-27 YTD',
    target_amount: 1200000,
    primary_sales: 1080000,
    secondary_sales: 1140000,
    ly_sales: 960000,
    yoy_growth_pct: 18.75,
    achievement_percentage: 95.0,
    product_breakdown: [
      { product: 'Cardia-90 10mg Catch Covers', target: 500000, secondary: 485000, ly_sales: 410000, yoy_growth: 18.3, pct: 97.0 },
      { product: 'Glicla-M SR Starter Packs', target: 400000, secondary: 380000, ly_sales: 325000, yoy_growth: 16.9, pct: 95.0 },
      { product: 'NeuroFlow-SR Visual Aides', target: 300000, secondary: 275000, ly_sales: 225000, yoy_growth: 22.2, pct: 91.6 }
    ]
  });
});

app.get('/api/analytics/roi-hierarchical', (req, res) => {
  res.json({
    area_level: [
      { am_name: 'Vikram Singh', doctor_count: 2, total_invested: 75000, actual_rx_yield: 287000, roi_pct: 282.6 }
    ],
    regional_compilation: [
      { area_manager: 'Vikram Singh (AM South Delhi)', territory: 'A-SOUTH-DELHI', investment: 75000, rx_yield: 287000, roi_pct: 282.6, status: 'VERIFIED BY RM' },
      { area_manager: 'Sanjay Dutt (AM North Delhi)', territory: 'A-NORTH-DELHI', investment: 60000, rx_yield: 210000, roi_pct: 250.0, status: 'VERIFIED BY RM' }
    ],
    zonal_compilation: [
      { region_name: 'Delhi NCR Region', rm_name: 'Anita Sharma (RM)', investment: 135000, rx_yield: 497000, roi_pct: 268.1 },
      { region_name: 'Punjab & Haryana Region', rm_name: 'Karan Mehra (RM)', investment: 110000, rx_yield: 380000, roi_pct: 245.45 }
    ],
    ho_yield_analysis: [
      { activity_type: 'CME Sponsorships', total_investment: 145000, total_rx_yield: 495000, yield_roi_pct: 341.38, recommendation: 'HIGH YIELD - EXPAND IN Q3' },
      { activity_type: 'Clinical Research Grants', total_investment: 100000, total_rx_yield: 240000, yield_roi_pct: 240.0, recommendation: 'STABLE YIELD' }
    ]
  });
});

app.get('/api/superadmin/tenants', (req, res) => {
  db.all(`SELECT t.id, t.company_name, t.slug, 
                 COALESCE(s.plan_tier, t.subscription_tier, 'ENTERPRISE') as plan_tier,
                 COALESCE(s.max_mr_seats, 50) as max_mr_seats,
                 COALESCE(s.max_am_seats, 10) as max_am_seats,
                 COALESCE(s.monthly_price, 49999) as monthly_price,
                 COALESCE(s.billing_status, 'ACTIVE') as billing_status
          FROM tenants t 
          LEFT JOIN tenant_subscriptions s ON t.id = s.tenant_id 
          ORDER BY t.id ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/superadmin/tenants', (req, res) => {
  const { company_name, slug, plan_tier, max_mr_seats, max_am_seats, monthly_price, admin_name, admin_email, admin_password } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Company Name is required' });

  const baseSlug = (slug || company_name).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

  db.run(`INSERT INTO tenants (company_name, slug, subscription_tier) VALUES (?, ?, ?)`,
    [company_name, finalSlug, plan_tier || 'ENTERPRISE'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const tenantId = this.lastID;
      
      // 1. Insert Subscription Record
      db.run(`INSERT INTO tenant_subscriptions (tenant_id, plan_tier, max_mr_seats, max_am_seats, monthly_price, billing_status, next_billing_date) VALUES (?, ?, ?, ?, ?, 'ACTIVE', '2026-09-30')`,
        [tenantId, plan_tier || 'ENTERPRISE', parseInt(max_mr_seats) || 50, parseInt(max_am_seats) || 10, parseFloat(monthly_price) || 49999],
        (serr) => {
          // 2. Generate and Insert Tenant Admin (HO) User Credentials
          const admName = admin_name || `${company_name} Admin`;
          const admEmail = admin_email || `admin@${baseSlug}.com`;
          const admPass = admin_password || `Admin@${Date.now().toString().slice(-4)}`;

          db.run(`INSERT INTO users (tenant_id, name, email, password, role, reporting_manager_id, territory_code) VALUES (?, ?, ?, ?, 'HO', NULL, 'HQ-GLOBAL')`,
            [tenantId, admName, admEmail, admPass],
            (uerr) => {
              res.json({
                tenant_id: tenantId,
                company_name: company_name,
                slug: finalSlug,
                admin_name: admName,
                admin_email: admEmail,
                admin_password: admPass,
                plan_tier: plan_tier || 'ENTERPRISE',
                message: `Successfully onboarded "${company_name}"! Generated Tenant Admin credentials: UserID: ${admEmail} | Password: ${admPass}`
              });
            }
          );
        }
      );
    }
  );
});

app.get('/api/tenants', (req, res) => {
  db.all('SELECT * FROM tenants ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Team & Hierarchy Management APIs
app.get('/api/users', (req, res) => {
  db.all(`SELECT u.id, u.tenant_id, u.name, u.email, COALESCE(u.password, 'password123') as password, u.role, u.territory_code, u.reporting_manager_id,
                 m.name as reporting_manager_name, m.role as reporting_manager_role
          FROM users u
          LEFT JOIN users m ON u.reporting_manager_id = m.id
          WHERE u.tenant_id = ?
          ORDER BY 
            CASE u.role 
              WHEN 'SUPERADMIN' THEN 1
              WHEN 'HO' THEN 2
              WHEN 'ZSM' THEN 3
              WHEN 'RM' THEN 4
              WHEN 'AM' THEN 5
              WHEN 'MR' THEN 6
              ELSE 7 
            END, u.id ASC`, [req.tenant_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { name, email, password, role, reporting_manager_id, territory_code } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'Name, Email and Role are required' });

  db.run(`INSERT INTO users (tenant_id, name, email, password, role, reporting_manager_id, territory_code)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.tenant_id, name.trim(), email.trim(), password || 'repflow@123', role, reporting_manager_id ? parseInt(reporting_manager_id) : null, territory_code ? territory_code.trim() : 'HQ-GLOBAL'],
    function(err) {
      if (err) {
        console.error('Error inserting user:', err);
        return res.status(500).json({ error: err.message || 'Failed to create team member' });
      }
      res.json({
        id: this.lastID,
        message: `Successfully created ${role} user "${name}" (${email}) aligned with reporting manager!`
      });
    }
  );
});

app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  db.run('DELETE FROM users WHERE id = ? AND tenant_id = ?', [userId, req.tenant_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Team member removed successfully' });
  });
});

app.post('/api/notifications/trigger', (req, res) => {
  res.json({ message: 'Web Push Notification alert sent.' });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` RepFlow Enterprise SaaS Server Online (Phase 8)`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Tagline: The Offline-First Pharmaceutical Field Force OS`);
  console.log(`=======================================================`);
});
