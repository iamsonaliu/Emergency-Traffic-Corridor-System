const mongoose = require("mongoose");
const Hospital = require("../models/Hospital");
const Ambulance = require("../models/Ambulance");
require("dotenv").config();

const connectDB = require("../config/db");

const verifyDatabase = async () => {
  try {
    await connectDB();
    console.log("🔍 Database Verification");
    console.log("========================");

    // Count hospitals
    const hospitalCount = await Hospital.countDocuments();
    console.log(`🏥 Hospitals: ${hospitalCount}`);

    // Count ambulances by status
    const ambulanceStats = await Ambulance.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    console.log("🚑 Ambulances:");
    ambulanceStats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count}`);
    });

    // Show sample hospital
    const sampleHospital = await Hospital.findOne().select("name location lat lng emergencyBeds");
    if (sampleHospital) {
      console.log("\n📍 Sample Hospital:");
      console.log(`  Name: ${sampleHospital.name}`);
      console.log(`  Location: ${sampleHospital.lat}, ${sampleHospital.lng}`);
      console.log(`  Beds: ${sampleHospital.emergencyBeds.available}/${sampleHospital.emergencyBeds.total}`);
    }

    // Show sample ambulance
    const sampleAmbulance = await Ambulance.findOne({ status: "idle" }).select("ambulanceId driverName lastKnownGps");
    if (sampleAmbulance) {
      console.log("\n🚑 Sample Ambulance:");
      console.log(`  ID: ${sampleAmbulance.ambulanceId}`);
      console.log(`  Driver: ${sampleAmbulance.driverName}`);
      console.log(`  Location: ${sampleAmbulance.lastKnownGps.lat}, ${sampleAmbulance.lastKnownGps.lng}`);
    }

    console.log("\n✅ Database verification completed successfully!");

  } catch (error) {
    console.error("❌ Database verification failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Run if called directly
if (require.main === module) {
  verifyDatabase();
}

module.exports = verifyDatabase;