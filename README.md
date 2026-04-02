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

## 📦 Core Entities (For MongoDB Schema Design)

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
