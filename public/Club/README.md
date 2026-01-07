Overview

This folder contains the Club API and helper scripts.

Endpoints

- GET /api/clubs — list clubs (optional ?q=search)
- GET /api/clubs/:id — club details (members populated)
- POST /api/clubs — create club (requires auth token) body: { name, short, description }
- POST /api/clubs/:id/join — join club (requires auth)
- POST /api/clubs/:id/leave — leave club (requires auth)

Migration

If your DB has users with the old `club` string field, run the migration script once:

  node public/modules/migrate_clubs.js

This creates Club docs and updates users' `clubs` arrays.

Manual Test Steps

1. Start server: npm start (or node server.js)
2. Register/login a test user (POST /api/users/register and POST /api/auth/login)
3. Use the web UI: open /ApplyClub/Clublist.html and try joining a club; verify the "Joined" button is shown.
4. Check DB: club documents should have the user in `members` and user doc should have club id in `clubs`.
5. Open /ClubPortalFeed/ClubPortalFeed.html while logged in — the empty-state message should disappear if you're a member.

Notes

- The migration script is additive and is safe to run multiple times; it avoids duplicates.
- The current join flow immediately adds the user to the club; an approval workflow can be added later.
