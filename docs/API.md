# RidePro API Reference

## Base URL

Development: `http://localhost:3001`

## Interactive Documentation

Swagger UI is available at `/api/docs` for interactive API exploration.

## Authentication

All endpoints (except validation endpoints) require a Clerk JWT token in the Authorization header:

```
Authorization: Bearer <clerk_jwt_token>
```

---

## Users API

### Get Current User
```http
GET /api/users/me
```
Returns the authenticated user's profile with their coaching relationships.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "ftp": 280,
  "avatarUrl": "https://...",
  "coachingRelationships": [],
  "athleteRelationships": []
}
```

### Update Current User
```http
PUT /api/users/me
```
**Body:**
```json
{
  "fullName": "John Doe",
  "ftp": 285
}
```

### Get User by ID
```http
GET /api/users/:id
```

### Get User by Clerk ID
```http
GET /api/users/clerk/:clerkUserId
```

### Create User
```http
POST /api/users
```
**Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "ftp": 280
}
```

### Update User
```http
PUT /api/users/:id
```

### Delete User
```http
DELETE /api/users/:id
```

---

## Relationships API

Manages coach-athlete relationships with a many-to-many model.

### Create Relationship (Invitation)
```http
POST /relationships
```
Creates a new relationship in PENDING status.

**Body:**
```json
{
  "coachId": "coach-uuid",
  "athleteId": "athlete-uuid",
  "notes": "Optional private notes"
}
```

**Response:** `201 Created`
```json
{
  "id": "relationship-uuid",
  "coachId": "coach-uuid",
  "athleteId": "athlete-uuid",
  "status": "PENDING",
  "notes": null,
  "startedAt": null,
  "endedAt": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "coach": { "id": "...", "fullName": "Coach Name", "email": "..." },
  "athlete": { "id": "...", "fullName": "Athlete Name", "email": "...", "ftp": 280 }
}
```

### Get Relationship
```http
GET /relationships/:id
```

### Update Relationship
```http
PATCH /relationships/:id
```
**Body:**
```json
{
  "status": "ACTIVE",
  "notes": "Updated notes"
}
```

### Accept Invitation
```http
POST /relationships/:id/accept
```
Accepts a PENDING invitation, setting status to ACTIVE.

### Decline Invitation
```http
POST /relationships/:id/decline
```
Declines and deletes a PENDING invitation.

### End Relationship
```http
POST /relationships/:id/end
```
Ends a relationship, setting status to ENDED.

### Pause Relationship
```http
POST /relationships/:id/pause
```
Temporarily pauses a relationship.

### Resume Relationship
```http
POST /relationships/:id/resume
```
Resumes a PAUSED relationship.

### Get Coach's Athletes
```http
GET /relationships/coach/:coachId/athletes?status=ACTIVE
```
Returns all athletes for a coach, optionally filtered by status.

**Response:**
```json
[
  {
    "id": "relationship-uuid",
    "status": "ACTIVE",
    "notes": "...",
    "startedAt": "2024-01-15T00:00:00.000Z",
    "athlete": {
      "id": "...",
      "fullName": "Athlete Name",
      "email": "...",
      "ftp": 280,
      "avatarUrl": "..."
    }
  }
]
```

### Get Athlete's Coaches
```http
GET /relationships/athlete/:athleteId/coaches?status=ACTIVE
```
Returns all coaches for an athlete, optionally filtered by status.

### Get Pending Invitations (Athlete)
```http
GET /relationships/athlete/:athleteId/pending
```

### Get Pending Invitations (Coach)
```http
GET /relationships/coach/:coachId/pending
```

### Delete Relationship
```http
DELETE /relationships/:id
```

---

## Invite Codes API

Manages coach invitation codes for easy athlete onboarding.

### Create Invite Code
```http
POST /invite-codes
```
**Body:**
```json
{
  "coachId": "coach-uuid",
  "maxUses": 10,
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Response:** `201 Created`
```json
{
  "id": "invite-uuid",
  "code": "COACH-ABC123",
  "coachId": "coach-uuid",
  "maxUses": 10,
  "usedCount": 0,
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "coach": { "id": "...", "fullName": "Coach Name", "email": "..." }
}
```

### Get Invite Code by ID
```http
GET /invite-codes/:id
```

### Get Invite Code by Code String
```http
GET /invite-codes/code/:code
```

### Validate Invite Code
```http
GET /invite-codes/validate/:code
```
Checks if a code is valid without redeeming it.

**Response:**
```json
{
  "valid": true,
  "coach": {
    "id": "coach-uuid",
    "fullName": "Coach Name",
    "email": "coach@example.com"
  }
}
```

Or if invalid:
```json
{
  "valid": false,
  "error": "Code has expired"
}
```

### Redeem Invite Code
```http
POST /invite-codes/redeem
```
Redeems a code to create a coach-athlete relationship.

**Body:**
```json
{
  "code": "COACH-ABC123",
  "athleteId": "athlete-uuid"
}
```

**Response:** `201 Created` - Returns the created relationship

### Get Coach's Codes
```http
GET /invite-codes/coach/:coachId?activeOnly=true
```

### Deactivate Code
```http
POST /invite-codes/:id/deactivate
```

### Reactivate Code
```http
POST /invite-codes/:id/reactivate
```

### Delete Code
```http
DELETE /invite-codes/:id
```

---

## Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input or business rule violation |
| `401` | Unauthorized - Missing or invalid authentication |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Duplicate resource |

---

## Relationship Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Invitation sent, awaiting acceptance |
| `ACTIVE` | Active coaching relationship |
| `PAUSED` | Temporarily paused (e.g., off-season) |
| `ENDED` | Relationship ended |

---

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

Validation errors include field-level details:
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```
