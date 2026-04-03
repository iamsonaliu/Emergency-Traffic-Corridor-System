const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const Ambulance = require("../models/Ambulance");
const connectDB = require("../config/db");

const seedAmbulances = async () => {
  try {
    await connectDB();
    console.log("[SEED] Connected to database");

    // Clear existing ambulances
    await Ambulance.deleteMany({});
    console.log("[SEED] Cleared existing ambulances");

    // Read ambulance seed data
    const ambulanceData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../database/ambulanceSeed.json"), "utf-8")
    );

    // Insert ambulances
    const ambulances = await Ambulance.insertMany(ambulanceData);
    console.log(`[SEED] Successfully seeded ${ambulances.length} ambulances`);

    // Log seeded ambulances
    ambulances.forEach(ambulance => {
      console.log(`  - ${ambulance.ambulanceId}: ${ambulance.driverName} (${ambulance.status})`);
    });

  } catch (error) {
    console.error("[SEED] Error seeding ambulances:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("[SEED] Database connection closed");
  }
};

// Run if called directly
if (require.main === module) {
  seedAmbulances();
}

module.exports = seedAmbulances;