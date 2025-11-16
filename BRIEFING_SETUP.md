# Email Briefing Scheduling Setup Guide

This guide explains how to set up automated email briefings that users can schedule through the chat interface.

## Features

- **Flexible Scheduling**: Users can choose daily or weekly briefings
- **Timezone Support**: Briefings are sent in the user's local timezone
- **User-Friendly UI**: Schedule settings available in the chat page
- **Automated Delivery**: Vercel Cron handles automatic execution

## Setup Steps

### 1. Database Setup

Run the SQL migration in your Supabase SQL Editor:

```bash
# File location: sql/add_briefing_preferences.sql
```

This creates:
- User metadata structure for storing briefing preferences
- `briefing_logs` table for tracking sent briefings
- Row-level security policies

### 2. Environment Variables

Add the following to your `.env.local`:

```env
# Cron Secret (generate a random string)
CRON_SECRET=your-random-secret-key-here

# App URL (use your production URL when deployed)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

To generate a secure CRON_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy to Vercel

The `vercel.json` file is already configured to run the cron job every hour:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled-briefings",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Important**: After deploying to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add `CRON_SECRET` with the same value from your `.env.local`
4. Vercel Cron automatically authenticates using this header

### 4. Testing

#### Test the Scheduler UI:
1. Navigate to the chat page
2. You should see the "Email Briefing Schedule" component at the top
3. Configure your preferences and save

#### Test the Cron Endpoint Manually:
```bash
curl -X POST http://localhost:3000/api/cron/send-scheduled-briefings \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json"
```

#### Test a Single Briefing:
```bash
curl -X POST http://localhost:3000/api/send-briefing \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id-here"}'
```

## How It Works

### User Flow:
1. User opens chat page
2. Sees the BriefingScheduler component
3. Enables briefings and sets preferences:
   - Frequency (daily or weekly)
   - Day of week (for weekly)
   - Time (in their local time)
   - Timezone
4. Preferences are saved to user metadata

### Backend Flow:
1. **Every Hour**: Vercel Cron calls `/api/cron/send-scheduled-briefings`
2. **Check Users**: The cron job fetches all users with enabled briefings
3. **Time Matching**: For each user, it checks if current UTC time matches their scheduled time
4. **Send Email**: If matched, calls `/api/send-briefing` for that user
5. **Logging**: Records the result in `briefing_logs` table

### Timezone Conversion:
- User selects their local timezone (e.g., "America/New_York")
- User selects their local time (e.g., "9:00 AM")
- Cron job converts this to UTC for comparison
- Email is sent when current UTC time matches converted time

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── briefing-preferences/
│   │   │   └── route.js          # Save/load user preferences
│   │   ├── cron/
│   │   │   └── send-scheduled-briefings/
│   │   │       └── route.js      # Hourly cron job
│   │   └── send-briefing/
│   │       └── route.js          # Actual email sending
│   └── chat/
│       └── page.jsx               # Chat page with scheduler UI
├── components/
│   └── BriefingScheduler.jsx     # Scheduling UI component
└── utils/
    └── timezoneUtils.js          # Timezone helper functions

sql/
└── add_briefing_preferences.sql  # Database migration

vercel.json                       # Vercel Cron configuration
```

## User Preference Schema

User metadata stored in Supabase Auth:

```json
{
  "briefing_preferences": {
    "email_enabled": true,
    "email_frequency": "weekly",
    "email_day": 1,
    "email_time": "09:00",
    "timezone": "America/New_York"
  }
}
```

Fields:
- `email_enabled`: Boolean - whether briefings are active
- `email_frequency`: "daily" or "weekly"
- `email_day`: 0-6 (Sunday=0, Monday=1, etc.) - only for weekly
- `email_time`: "HH:MM" format in local time
- `timezone`: IANA timezone string

## Troubleshooting

### Briefings Not Sending

1. **Check Vercel Cron Logs**:
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on latest deployment → Functions tab
   - Look for `/api/cron/send-scheduled-briefings` logs

2. **Verify CRON_SECRET**:
   - Ensure it matches in both local `.env.local` and Vercel environment variables

3. **Check User Preferences**:
   ```sql
   SELECT id, email, raw_user_meta_data->'briefing_preferences'
   FROM auth.users
   WHERE id = 'your-user-id';
   ```

4. **Check Briefing Logs**:
   ```sql
   SELECT * FROM briefing_logs
   WHERE user_id = 'your-user-id'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### Timezone Issues

If briefings are sent at the wrong time:
1. Verify the user's timezone is correct in preferences
2. Check the timezone conversion in the cron job
3. Note: The simple timezone conversion doesn't account for DST (Daylight Saving Time)
4. For production, consider using a library like `date-fns-tz` for accurate DST handling

### Testing Specific Times

To test without waiting for the cron:
1. Temporarily modify the cron job to always return `true` for `shouldSend`
2. Or manually call the cron endpoint with curl
3. Or manually call `/api/send-briefing` with a specific userId

## Alternative Cron Services

If not using Vercel, you can use:

### GitHub Actions:
```yaml
# .github/workflows/cron.yml
name: Scheduled Briefings
on:
  schedule:
    - cron: '0 * * * *'
jobs:
  send-briefings:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cron Endpoint
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/send-scheduled-briefings \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### External Cron Service (cron-job.org):
1. Create account at cron-job.org
2. Add new cron job
3. URL: `https://your-app.vercel.app/api/cron/send-scheduled-briefings`
4. Schedule: Every hour (`0 * * * *`)
5. Add header: `Authorization: Bearer your-cron-secret`

## Future Enhancements

- [ ] SMS briefing scheduling
- [ ] Custom briefing templates
- [ ] Digest mode (summary of multiple days)
- [ ] Per-transaction notifications
- [ ] Snooze/pause functionality
- [ ] Better DST handling with date-fns-tz
- [ ] Retry logic for failed sends
- [ ] User notification preferences (what to include)

## Support

For issues or questions:
1. Check the logs in Vercel dashboard
2. Verify environment variables are set correctly
3. Test the API endpoints manually
4. Check Supabase table data
