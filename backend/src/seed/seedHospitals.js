const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const Hospital = require("../models/Hospital");
const connectDB = require("../config/db");

const seedHospitals = async () => {
  try {
    await connectDB();
    console.log("[SEED] Connected to database");

    // Clear existing hospitals
    await Hospital.deleteMany({});
    console.log("[SEED] Cleared existing hospitals");

    // Read hospital seed data
    const hospitalData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../database/hospitalSeed.json"), "utf-8")
    );

    // Transform data to match schema
    const transformedData = hospitalData.map(hospital => ({
      hospitalId: hospital.hospitalId,
      name: hospital.name,
      address: hospital.address,
      location: {
        type: "Point",
        coordinates: [hospital.location.lng, hospital.location.lat] // GeoJSON: [lng, lat]
      },
      lat: hospital.location.lat,
      lng: hospital.location.lng,
      emergencyBeds: hospital.emergencyBeds,
      status: hospital.status,
      contactNumber: hospital.contactNumber,
      specialties: hospital.specialties,
      pendingRequests: hospital.pendingRequests,
      source: "seed"
    }));

    // Insert hospitals
    const hospitals = await Hospital.insertMany(transformedData);
    console.log(`[SEED] Successfully seeded ${hospitals.length} hospitals`);

    // Log seeded hospitals
    hospitals.forEach(hospital => {
      console.log(`  - ${hospital.name} (${hospital.hospitalId})`);
    });

  } catch (error) {
    console.error("[SEED] Error seeding hospitals:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("[SEED] Database connection closed");
  }
};

// Run if called directly
if (require.main === module) {
  seedHospitals();
}

module.exports = seedHospitals;