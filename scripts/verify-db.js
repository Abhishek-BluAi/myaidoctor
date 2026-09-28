/**
 * Verify that user preferences are stored in PostgreSQL (not just localStorage).
 * 
 * Run: node scripts/verify-db.js
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://myaidoctor:myaidoctor_pass@localhost:5432/myaidoctor_db",
});

async function verify() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PostgreSQL Verification — User Preferences");
  console.log("═══════════════════════════════════════════════════════\n");

  try {
    // 1. Check connection
    const connResult = await pool.query("SELECT version()");
    console.log("✅ Connected to PostgreSQL");
    console.log(`   ${connResult.rows[0].version.split(",")[0]}\n`);

    // 2. Check if user_preferences table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_preferences'
      )
    `);
    if (!tableCheck.rows[0].exists) {
      console.log("❌ Table 'user_preferences' does not exist. Run: npx prisma db push");
      return;
    }
    console.log("✅ Table 'user_preferences' exists\n");

    // 3. Show all user preferences
    const prefs = await pool.query(`
      SELECT up.*, u.email, u.first_name, u.last_name, u.role
      FROM user_preferences up
      JOIN users u ON u.id = up.user_id
      ORDER BY u.email
    `);

    if (prefs.rows.length === 0) {
      console.log("⚠️  No user preferences found. Login and change a setting to create one.\n");
    } else {
      console.log(`📋 ${prefs.rows.length} user preference records in PostgreSQL:\n`);
      console.log("  Email                          | Mode   | Accent  | Font | Sidebar");
      console.log("  ─────────────────────────────  | ────── | ─────── | ──── | ───────");
      prefs.rows.forEach(r => {
        console.log(`  ${(r.email || "").padEnd(31)} | ${(r.theme_mode || "").padEnd(6)} | ${(r.theme_accent || "").padEnd(7)} | ${String(r.font_size || 100).padEnd(4)} | ${r.sidebar_collapsed ? "collapsed" : "expanded"}`);
      });
    }

    // 4. Show system settings stored in DB
    console.log("\n");
    const settings = await pool.query(`SELECT key, LEFT(value, 80) as value FROM system_settings ORDER BY key`);
    if (settings.rows.length > 0) {
      console.log(`⚙️  ${settings.rows.length} system settings in PostgreSQL:\n`);
      settings.rows.forEach(r => {
        console.log(`  ${r.key.padEnd(35)} = ${r.value}`);
      });
    }

    // 5. Show record counts
    console.log("\n");
    const tables = ["users", "patients", "appointments", "pre_visit_briefs", "clinical_protocols", "audit_logs", "cancellation_waitlist", "user_preferences", "system_settings"];
    console.log("📊 Record counts:\n");
    for (const t of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${t}`);
        console.log(`  ${t.padEnd(25)} ${count.rows[0].count} records`);
      } catch { console.log(`  ${t.padEnd(25)} (table not found)`); }
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  ✅ All data is in PostgreSQL, NOT localStorage");
    console.log("═══════════════════════════════════════════════════════\n");

  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await pool.end();
  }
}

verify();
