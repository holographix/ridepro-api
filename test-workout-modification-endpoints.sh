#!/bin/bash

# Test script for Feature 3: Edit Scheduled Workout Duration
# This script documents how to test the workout modification API endpoints
#
# PREREQUISITES:
# 1. Backend server running on http://localhost:3001
# 2. Valid JWT token from Clerk authentication
# 3. Existing scheduled workout ID in the database
#
# HOW TO GET AUTH TOKEN:
# - Login to the frontend app
# - Open browser DevTools > Application > Local Storage
# - Copy the value of the Clerk session token
# OR
# - Use the __session cookie value from the browser

# Configuration
API_BASE="http://localhost:3001"
AUTH_TOKEN="YOUR_CLERK_JWT_TOKEN_HERE"  # Replace with actual token
SCHEDULED_WORKOUT_ID="YOUR_SCHEDULED_WORKOUT_ID"  # Replace with actual ID

echo "========================================"
echo "Workout Modification API Tests"
echo "========================================"
echo ""

# Test 1: Modify scheduled workout structure
echo "Test 1: PUT /api/calendar/scheduled/:id/structure"
echo "-------------------------------------------"
echo "Modifies the workout structure for a specific scheduled workout"
echo "Expected: 200 OK with updated workout data"
echo ""

# Example workout structure (simplified)
MODIFIED_STRUCTURE='{
  "structure": {
    "steps": [
      {
        "type": "warmUp",
        "length": {
          "value": 10,
          "unit": "minute"
        },
        "targets": [
          {
            "zone": 2,
            "minValue": 55,
            "maxValue": 75
          }
        ]
      },
      {
        "type": "active",
        "length": {
          "value": 20,
          "unit": "minute"
        },
        "targets": [
          {
            "zone": 4,
            "minValue": 90,
            "maxValue": 105
          }
        ]
      },
      {
        "type": "coolDown",
        "length": {
          "value": 10,
          "unit": "minute"
        },
        "targets": [
          {
            "zone": 2,
            "minValue": 55,
            "maxValue": 75
          }
        ]
      }
    ]
  }
}'

curl -X PUT \
  "$API_BASE/api/calendar/scheduled/$SCHEDULED_WORKOUT_ID/structure" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$MODIFIED_STRUCTURE" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response (raw):"

echo ""
echo ""

# Test 2: Get scheduled workout to verify modification
echo "Test 2: GET /api/calendar/week/:athleteId (verify modification)"
echo "-------------------------------------------"
echo "Fetches the training week to verify workout was modified"
echo "Expected: 200 OK with isModified=true and override fields populated"
echo ""
echo "curl -X GET \\"
echo "  \"$API_BASE/api/calendar/week/ATHLETE_ID?weekStart=2024-01-01\" \\"
echo "  -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
echo "  -s | jq '.scheduledWorkouts[] | select(.id==\"$SCHEDULED_WORKOUT_ID\")'"
echo ""
echo ""

# Test 3: Reset workout to original structure
echo "Test 3: DELETE /api/calendar/scheduled/:id/structure"
echo "-------------------------------------------"
echo "Resets the workout to its original structure"
echo "Expected: 200 OK with isModified=false and override fields null"
echo ""

curl -X DELETE \
  "$API_BASE/api/calendar/scheduled/$SCHEDULED_WORKOUT_ID/structure" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response (raw):"

echo ""
echo ""

# Test 4: Verify reset
echo "Test 4: Verify workout was reset"
echo "-------------------------------------------"
echo "Fetches the workout again to verify reset"
echo "Expected: isModified=false, all override fields should be null"
echo ""
echo "curl -X GET \\"
echo "  \"$API_BASE/api/calendar/week/ATHLETE_ID?weekStart=2024-01-01\" \\"
echo "  -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
echo "  -s | jq '.scheduledWorkouts[] | select(.id==\"$SCHEDULED_WORKOUT_ID\")'"
echo ""
echo ""

# Test 5: Error handling - Invalid structure
echo "Test 5: PUT with invalid structure (error handling)"
echo "-------------------------------------------"
echo "Sends invalid structure to test error handling"
echo "Expected: 400 Bad Request with error message"
echo ""

INVALID_STRUCTURE='{
  "structure": "invalid_string_instead_of_object"
}'

curl -X PUT \
  "$API_BASE/api/calendar/scheduled/$SCHEDULED_WORKOUT_ID/structure" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$INVALID_STRUCTURE" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response (raw):"

echo ""
echo ""

# Test 6: Error handling - Non-existent workout
echo "Test 6: PUT to non-existent workout (error handling)"
echo "-------------------------------------------"
echo "Tries to modify a workout that doesn't exist"
echo "Expected: 404 Not Found"
echo ""

curl -X PUT \
  "$API_BASE/api/calendar/scheduled/00000000-0000-0000-0000-000000000000/structure" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$MODIFIED_STRUCTURE" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response (raw):"

echo ""
echo ""

echo "========================================"
echo "MANUAL TESTING INSTRUCTIONS"
echo "========================================"
echo ""
echo "To run these tests manually:"
echo ""
echo "1. Start the backend server:"
echo "   cd ridepro-api && npm run start:dev"
echo ""
echo "2. Get a valid auth token:"
echo "   - Login to http://localhost:5173"
echo "   - Open DevTools > Application > Cookies"
echo "   - Copy __session cookie value"
echo ""
echo "3. Get a scheduled workout ID:"
echo "   - Navigate to coach calendar in the app"
echo "   - Open DevTools > Network tab"
echo "   - Look for /api/calendar/week requests"
echo "   - Copy a scheduledWorkout.id from the response"
echo ""
echo "4. Update this script:"
echo "   AUTH_TOKEN=\"your_token_here\""
echo "   SCHEDULED_WORKOUT_ID=\"your_workout_id_here\""
echo ""
echo "5. Run the script:"
echo "   bash test-workout-modification-endpoints.sh"
echo ""
echo "========================================"
echo "EXPECTED RESPONSES"
echo "========================================"
echo ""
echo "Successful modification (PUT):"
echo "{"
echo "  \"id\": \"uuid\","
echo "  \"workoutId\": \"uuid\","
echo "  \"structureOverride\": { ... },"
echo "  \"durationOverride\": 2400,"
echo "  \"tssOverride\": 65.5,"
echo "  \"ifOverride\": 0.88,"
echo "  \"isModified\": true,"
echo "  ..."
echo "}"
echo ""
echo "Successful reset (DELETE):"
echo "{"
echo "  \"id\": \"uuid\","
echo "  \"workoutId\": \"uuid\","
echo "  \"structureOverride\": null,"
echo "  \"durationOverride\": null,"
echo "  \"tssOverride\": null,"
echo "  \"ifOverride\": null,"
echo "  \"isModified\": false,"
echo "  ..."
echo "}"
echo ""
