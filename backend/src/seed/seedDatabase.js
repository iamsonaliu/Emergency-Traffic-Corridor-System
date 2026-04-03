const seedHospitals = require("./seedHospitals");
const seedAmbulances = require("./seedAmbulances");

const seedDatabase = async () => {
  try {
    console.log("[SEED] Starting database seeding...");

    await seedHospitals();
    console.log("[SEED] Hospitals seeded successfully");

    await seedAmbulances();
    console.log("[SEED] Ambulances seeded successfully");

    console.log("[SEED] Database seeding completed successfully!");
  } catch (error) {
    console.error("[SEED] Error during database seeding:", error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;