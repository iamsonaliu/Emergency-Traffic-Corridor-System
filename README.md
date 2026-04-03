# 🚑 Backend Structure – Emergency Traffic Corridor System

## 📁 Directory Overview

```
backend/
└── src/
    ├── config/
    │   ├── db.js                # MongoDB connection setup
    │   └── constants.js
    │
    ├── controllers/
    │   ├── ambulanceController.js
    │   ├── hospitalController.js
    │   └── trafficController.js
    │
    ├── models/
    │   ├── Ambulance.js
    │   ├── Traffic.js
    │   └── Hospital.js
    │
    ├── routes/
    │   ├── ambulanceRoutes.js
    │   ├── hospitalRoutes.js
    │   └── trafficRoutes.js
    │
    ├── services/
    │   ├── hospitalService.js
    │   ├── routeService.js
    │   └── trafficService.js
    │
    ├── sockets/
    │   └── socketHandler.js     # Real-time communication (WebSockets)
    │
    ├── utils/                  # Helper utilities
    │
    ├── app.js                  # Express app configuration
    └── server.js               # Entry point
```

---

## 🧠 Architecture Overview

* **Routes → Controllers → Services → Models**
* Clean separation of concerns:

  * Routes: API endpoints
  * Controllers: Request handling
  * Services: Business logic
  * Models: MongoDB schemas (to be defined)

---

## �️ Database Setup

### Prerequisites
- MongoDB Atlas account or local MongoDB instance
- Node.js installed

### Environment Configuration
Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/emergency_corridor
CLIENT_ORIGIN=http://localhost:3000
```

### Seeding the Database

The system includes mock data for Dehradun region with hospitals and ambulances.

#### Available Commands:
```bash
# Seed all data (hospitals + ambulances)
npm run seed

# Seed only hospitals
npm run seed:hospitals

# Seed only ambulances
npm run seed:ambulances

# Verify database contents
npm run verify
```

#### Current Seed Data:

**🏥 Hospitals (4 locations in Dehradun):**
- Doon Government Hospital
- Max Super Speciality Hospital Dehradun
- Shri Mahant Indiresh Hospital
- Synergy Institute of Medical Sciences

**🚑 Ambulances (8 vehicles):**
- 7 idle ambulances positioned across Dehradun
- 1 ambulance in maintenance
- Realistic GPS coordinates and driver information

#### Data Files:
- `database/hospitalSeed.json` - Hospital data with coordinates
- `database/ambulanceSeed.json` - Ambulance mock data

---

## �📦 Core Entities (For MongoDB Schema Design)

### 🚑 Ambulance

Represents an emergency vehicle in the system.

**Suggested fields:**

* `vehicleNumber` (String)
* `driverName` (String)
* `currentLocation` (Object → lat, lng)
* `status` (String → idle / en-route / emergency)
* `destinationHospital` (Reference → Hospital)
* `speed` (Number)
* `lastUpdated` (Date)

---

### 🏥 Hospital

Represents hospitals receiving emergency cases.

**Suggested fields:**

* `name` (String)
* `location` (Object → lat, lng)
* `capacity` (Number)
* `availableBeds` (Number)
* `contactNumber` (String)
* `specialties` (Array)

---

### 🚦 Traffic

Handles traffic data for route optimization.

**Suggested fields:**

* `roadName` (String)
* `congestionLevel` (String → low / medium / high)
* `averageSpeed` (Number)
* `signals` (Array of signal states)
* `lastUpdated` (Date)

---

## 🔌 Real-Time (Sockets)

Handled via:

```
src/sockets/socketHandler.js
```

Used for:

* Live ambulance tracking
* Traffic updates
* Real-time alerts

---

## 🔗 API Base Routes

```
/api/ambulance
/api/hospital
/api/traffic
```

---

## 🧩 Notes for MongoDB Integration

* Use **Mongoose** for schema definition
* Maintain relationships:

  * Ambulance → Hospital (reference)
* Consider indexing:

  * `location` (for geospatial queries)
* Use timestamps for tracking updates

---

## 🚀 Next Steps

* Define Mongoose schemas inside `/models`
* Connect DB via `config/db.js`
* Integrate controllers with actual DB operations

---
