# Emergency Corridor — MongoDB Schema

## Collections

### `hospitals`
| Field | Type | Notes |
|---|---|---|
| hospitalId | String (unique) | e.g. `HOSP_DOON` |
| name | String | Full hospital name |
| address | String | Street address |
| location.lat | Number | GPS latitude |
| location.lng | Number | GPS longitude |
| emergencyBeds.total | Number | Total ER beds |
| emergencyBeds.available | Number | Currently free |
| status | `available \| full \| no_response` | Live status |
| contactNumber | String | Phone |
| specialties | String[] | Medical specialties |
| pendingRequests | Array | Ambulance requests queued |

### `ambulances`
| Field | Type | Notes |
|---|---|---|
| ambulanceId | String (unique) | e.g. `AMB-DDN-001` |
| driverName | String | |
| contactNumber | String | |
| status | `idle \| active \| completed` | |
| activeSession.gps | { lat, lng } | Live GPS (session-only) |
| activeSession.timestamp | Date | Last GPS update |
| activeSession.emergencyType | String | e.g. `cardiac` |
| activeSession.assignedHospitalId | String | FK → hospitals |
| activeSession.routeId | String | FK → corridors |
| activeSession.eta | Number | Minutes to hospital |

### `corridors`
| Field | Type | Notes |
|---|---|---|
| routeId | String (unique) | e.g. `ROUTE-AMB-DDN-001-...` |
| ambulanceId | String | FK → ambulances |
| hospitalId | String | FK → hospitals |
| hospitalName | String | Denormalized for speed |
| status | `active \| completed \| cancelled` | |
| signals | SignalState[] | Ordered signal list |
| passedCount | Number | How many signals cleared |
| totalSignals | Number | |
| totalTimeMin | Number | Estimated total minutes |
| startedAt | Date | |
| completedAt | Date | |

#### SignalState (embedded in corridor)
| Field | Type | Notes |
|---|---|---|
| signalId | String | Node ID from roadNetwork |
| name | String | Human-readable name |
| location | { lat, lng } | GPS coordinates |
| status | `normal \| preparing \| green \| restored` | |
| etaMinutes | Number | Minutes from dispatch |
| etaTimestamp | Date | Absolute activation time |
| activatedAt | Date | When turned green |
| restoredAt | Date | When returned to normal |

## Indexes
- `hospitals`: `location` (2dsphere for geospatial), `status`
- `ambulances`: `ambulanceId` (unique), `status`
- `corridors`: `routeId` (unique), `ambulanceId`, `status`

## Relationships
```
Ambulance ──activeSession.assignedHospitalId──► Hospital
Ambulance ──activeSession.routeId──────────────► Corridor
Corridor  ──hospitalId─────────────────────────► Hospital
```