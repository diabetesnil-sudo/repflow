const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'repflow.db');
const db = new sqlite3.Database(dbPath);

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function initDatabase() {
  console.log("Initializing Phase 4 Database Schema for Healthfluence AI...");

  // Drop tables if recreating clean schema for Phase 4
  const tables = [
    'rm_joint_dcrs', 'academic_roi', 'sales_actuals', 'sales_targets',
    'virtual_sample_bags', 'leave_requests', 'leave_balances', 'expenses',
    'dcr_chemist_calls', 'dcr_doctor_calls', 'dcrs', 'mtp_days', 'mtps',
    'chemists', 'doctors', 'users'
  ];

  for (const table of tables) {
    await runQuery(`DROP TABLE IF EXISTS ${table}`);
  }

  // 1. Users (5-Tier RBAC Hierarchy)
  await runQuery(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('MR', 'AM', 'RM', 'ZSM', 'HO')),
      reporting_manager_id INTEGER,
      headquarter TEXT NOT NULL,
      territory_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporting_manager_id) REFERENCES users(id)
    )
  `);

  // 2. Doctors Master
  await runQuery(`
    CREATE TABLE doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Class A', 'Class B', 'Class C')),
      qualification TEXT,
      hospital_clinic_name TEXT NOT NULL,
      address TEXT,
      city TEXT NOT NULL,
      preferred_time TEXT,
      prescribing_potential TEXT CHECK(prescribing_potential IN ('High', 'Medium', 'Low')),
      created_by_user_id INTEGER NOT NULL,
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `);

  // 3. Chemists Master
  await runQuery(`
    CREATE TABLE chemists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      territory_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. MTPs
  await runQuery(`
    CREATE TABLE mtps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
      am_remarks TEXT,
      submitted_at DATETIME,
      reviewed_at DATETIME,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 5. MTP Days
  await runQuery(`
    CREATE TABLE mtp_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mtp_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      territory TEXT NOT NULL,
      working_type TEXT NOT NULL CHECK(working_type IN ('INDEPENDENT', 'JOINT')),
      joint_with_user_id INTEGER,
      target_doctor_ids TEXT,
      objective TEXT,
      FOREIGN KEY (mtp_id) REFERENCES mtps(id)
    )
  `);

  // 6. DCRs Header
  await runQuery(`
    CREATE TABLE dcrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT UNIQUE,
      mr_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      working_type TEXT NOT NULL CHECK(working_type IN ('INDEPENDENT', 'JOINT')),
      joint_with_user_id INTEGER,
      am_cc_notified INTEGER DEFAULT 1,
      ho_cc_notified INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      is_synced_offline INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 7. DCR Doctor Calls
  await runQuery(`
    CREATE TABLE dcr_doctor_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dcr_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      call_time TEXT,
      products_detailed TEXT,
      samples_given TEXT,
      inputs_given TEXT,
      remarks TEXT,
      next_visit_date TEXT,
      FOREIGN KEY (dcr_id) REFERENCES dcrs(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);

  // 8. DCR Chemist Calls
  await runQuery(`
    CREATE TABLE dcr_chemist_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dcr_id INTEGER NOT NULL,
      chemist_id INTEGER NOT NULL,
      pob_amount REAL DEFAULT 0.0,
      stock_details TEXT,
      remarks TEXT,
      FOREIGN KEY (dcr_id) REFERENCES dcrs(id),
      FOREIGN KEY (chemist_id) REFERENCES chemists(id)
    )
  `);

  // 9. Expenses Table
  await runQuery(`
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Travel', 'Boarding', 'Meals', 'Misc')),
      original_amount REAL NOT NULL,
      approved_amount REAL NOT NULL,
      correction_reason TEXT,
      receipt_image_data TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTED')),
      reimbursed_status TEXT DEFAULT 'UNPAID' CHECK(reimbursed_status IN ('UNPAID', 'REIMBURSED')),
      reviewed_by_user_id INTEGER,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 10. Leave Balances Table
  await runQuery(`
    CREATE TABLE leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      cl_balance INTEGER DEFAULT 12,
      sl_balance INTEGER DEFAULT 10,
      el_balance INTEGER DEFAULT 15,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 11. Leave Requests Table
  await runQuery(`
    CREATE TABLE leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('CL', 'SL', 'EL')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      reviewed_by_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 12. Virtual Sample Bags Table
  await runQuery(`
    CREATE TABLE virtual_sample_bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('SAMPLE', 'GIFT_INPUT', 'BRAND_LIT')),
      batch_number TEXT NOT NULL,
      allocated_qty INTEGER NOT NULL,
      current_qty INTEGER NOT NULL,
      low_stock_threshold INTEGER DEFAULT 5,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 13. Sales Targets & Actuals
  await runQuery(`
    CREATE TABLE sales_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      target_amount REAL NOT NULL,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  await runQuery(`
    CREATE TABLE sales_actuals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mr_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      primary_sales_amount REAL NOT NULL,
      secondary_sales_amount REAL NOT NULL,
      FOREIGN KEY (mr_id) REFERENCES users(id)
    )
  `);

  // 14. Academic RoI & Investment Tracker
  await runQuery(`
    CREATE TABLE academic_roi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      am_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      investment_amount REAL NOT NULL,
      expected_rx_monthly_val REAL NOT NULL,
      actual_rx_monthly_val REAL NOT NULL,
      roi_percentage REAL NOT NULL,
      status TEXT DEFAULT 'APPROVED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (am_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);

  // 15. RM Joint Working DCRs Table
  await runQuery(`
    CREATE TABLE rm_joint_dcrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rm_id INTEGER NOT NULL,
      mr_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      doctor_id INTEGER NOT NULL,
      coaching_feedback TEXT NOT NULL,
      status TEXT DEFAULT 'SUBMITTED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rm_id) REFERENCES users(id),
      FOREIGN KEY (mr_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);

  // Seed Initial 5-Tier User Hierarchy
  console.log("Seeding Healthfluence AI 5-Tier User Hierarchy...");
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (1, 'Priya Mehta', 'priya.ho@healthfluence.ai', 'HO', NULL, 'Corporate HQ (Mumbai)', 'HO-NAT-01')`);
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (2, 'Ramesh Gupta', 'ramesh.zsm@healthfluence.ai', 'ZSM', 1, 'Zonal HQ (North)', 'ZS-NORTH-01')`);
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (3, 'Anita Sharma', 'anita.rm@healthfluence.ai', 'RM', 2, 'Regional HQ (Delhi NCR)', 'RM-DEL-01')`);
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (4, 'Vikram Singh', 'vikram.am@healthfluence.ai', 'AM', 3, 'Area HQ (South Delhi)', 'AM-DEL-SOUTH')`);
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (5, 'Rahul Sharma', 'rahul.mr@healthfluence.ai', 'MR', 4, 'South Delhi - Green Park', 'TR-DEL-S1')`);
  await runQuery(`INSERT INTO users (id, name, email, role, reporting_manager_id, headquarter, territory_code) VALUES (6, 'Neha Verma', 'neha.mr@healthfluence.ai', 'MR', 4, 'South Delhi - Hauz Khas', 'TR-DEL-S2')`);

  // Seed Doctors
  await runQuery(`INSERT INTO doctors (id, code, name, specialty, category, qualification, hospital_clinic_name, address, city, preferred_time, prescribing_potential, created_by_user_id) VALUES (1, 'DOC-1001', 'Dr. Rajesh Verma', 'Cardiology', 'Class A', 'MD, DM (Cardio)', 'Max Super Speciality Hospital', '1 Press Enclave Road, Saket', 'New Delhi', '11:00 AM - 01:00 PM', 'High', 5)`);
  await runQuery(`INSERT INTO doctors (id, code, name, specialty, category, qualification, hospital_clinic_name, address, city, preferred_time, prescribing_potential, created_by_user_id) VALUES (2, 'DOC-1002', 'Dr. Priya Nair', 'Diabetology', 'Class A', 'MD (Medicine)', 'Apollo Sugar Clinic', 'Green Park Extension', 'New Delhi', '05:00 PM - 07:00 PM', 'High', 5)`);
  await runQuery(`INSERT INTO doctors (id, code, name, specialty, category, qualification, hospital_clinic_name, address, city, preferred_time, prescribing_potential, created_by_user_id) VALUES (3, 'DOC-1003', 'Dr. Amit Malhotra', 'General Medicine', 'Class B', 'MBBS', 'Malhotra Clinic', 'Hauz Khas Market', 'New Delhi', '10:00 AM - 01:00 PM', 'Medium', 6)`);

  // Seed Chemists
  await runQuery(`INSERT INTO chemists (id, code, name, contact_person, phone, address, territory_code) VALUES (1, 'CHM-5001', 'Apollo Pharmacy', 'Suresh Kumar', '9876543210', 'Saket Metro Station Arcade', 'TR-DEL-S1')`);
  await runQuery(`INSERT INTO chemists (id, code, name, contact_person, phone, address, territory_code) VALUES (2, 'CHM-5002', 'Sanjeevani Medicos', 'Ramesh Chand', '9811223344', 'Green Park Main Market', 'TR-DEL-S1')`);

  // Seed Virtual Sample Bag Stock
  await runQuery(`INSERT INTO virtual_sample_bags (mr_id, product_name, item_type, batch_number, allocated_qty, current_qty, low_stock_threshold) VALUES (5, 'Cardia-90 10mg Catch Covers', 'SAMPLE', 'B-2026-08', 30, 4, 5)`);
  await runQuery(`INSERT INTO virtual_sample_bags (mr_id, product_name, item_type, batch_number, allocated_qty, current_qty, low_stock_threshold) VALUES (5, 'Glicla-M SR Starter Packs', 'SAMPLE', 'B-2026-09', 25, 3, 5)`);
  await runQuery(`INSERT INTO virtual_sample_bags (mr_id, product_name, item_type, batch_number, allocated_qty, current_qty, low_stock_threshold) VALUES (5, 'NeuroFlow-SR Visual Aides', 'BRAND_LIT', 'L-2026-01', 15, 12, 5)`);

  // Seed Leave Balances & Sample Requests
  await runQuery(`INSERT INTO leave_balances (user_id, cl_balance, sl_balance, el_balance) VALUES (5, 9, 10, 15)`);
  await runQuery(`INSERT INTO leave_requests (mr_id, leave_type, start_date, end_date, total_days, reason, status, reviewed_by_user_id) VALUES (5, 'CL', '2026-08-10', '2026-08-12', 3, 'Attending family function', 'APPROVED', 4)`);

  // Seed Sales Targets & Actuals
  const currentMonth = new Date().toISOString().substring(0, 7);
  await runQuery(`INSERT INTO sales_targets (mr_id, month, target_amount) VALUES (5, ?, 500000.0)`, [currentMonth]);
  await runQuery(`INSERT INTO sales_actuals (mr_id, month, primary_sales_amount, secondary_sales_amount) VALUES (5, ?, 380000.0, 420000.0)`, [currentMonth]);

  // Seed Academic RoI Data
  await runQuery(`INSERT INTO academic_roi (am_id, doctor_id, activity_type, investment_amount, expected_rx_monthly_val, actual_rx_monthly_val, roi_percentage, status) VALUES (4, 1, 'CME Sponsorship', 45000, 120000, 140000, 211.1, 'APPROVED')`);
  await runQuery(`INSERT INTO academic_roi (am_id, doctor_id, activity_type, investment_amount, expected_rx_monthly_val, actual_rx_monthly_val, roi_percentage, status) VALUES (4, 2, 'Clinical Research', 35000, 90000, 110000, 214.3, 'APPROVED')`);

  // Seed RM Joint DCRs
  await runQuery(`INSERT INTO rm_joint_dcrs (rm_id, mr_id, date, doctor_id, coaching_feedback) VALUES (3, 5, '2026-07-28', 1, 'Joint detailing conducted with Rahul Sharma for Cardia-90 launch at Max Saket.')`);

  console.log("Phase 4 Database Schema Initialization Complete!");
}

module.exports = { db, initDatabase, runQuery };
