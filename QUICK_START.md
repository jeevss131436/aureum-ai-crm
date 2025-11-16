# Quick Start: Email Briefing Scheduling

## What's New

Your AI assistant can now send **automated email briefings** on a schedule! Users can configure:
- **Daily or Weekly** briefings
- **Custom time** in their local timezone
- **Specific day** for weekly briefings (e.g., every Monday)

## Quick Setup (3 Steps)

### 1. Run Database Migration

Open [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) and run:

```sql
-- Copy and paste contents from: sql/add_briefing_preferences.sql
```

This creates the `briefing_logs` table and user preference structure.

### 2. Add Environment Variable

Your `.env.local` file has been updated with:
```
CRON_SECRET=dev-secret-change-in-production
```

**For production**, generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this to your Vercel environment variables.

### 3. Deploy

```bash
git add .
git commit -m "Add scheduled email briefing feature"
git push
```

Vercel will automatically set up the hourly cron job from `vercel.json`.

## How Users Use It

1. **Open Chat Page**: Users navigate to the chat interface
2. **See Scheduler**: At the top of new chats, the "Email Briefing Schedule" component appears
3. **Configure Settings**:
   - Toggle email briefings ON
   - Choose Daily or Weekly
   - Select time (e.g., 9:00 AM)
   - Select timezone (e.g., Eastern Time)
   - For weekly: choose day (e.g., Monday)
4. **Save**: Click "Save Schedule"

Done! Users will receive briefings at their scheduled time.

## What Gets Sent

Email briefings include:
- ✅ **AI-generated summary** of the day ahead
- ⚠️ **Overdue tasks** (if any)
- 🎯 **Today's priorities**
- 📅 **Tomorrow's tasks**
- 📊 **Quick stats** (active deals, task counts)

## Testing Locally

### Test the UI:
```bash
npm run dev
# Navigate to http://localhost:3000/chat
```

### Test Manual Send:
```bash
curl -X POST http://localhost:3000/api/send-briefing \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user-id"}'
```

### Test Cron Job:
```bash
curl -X POST http://localhost:3000/api/cron/send-scheduled-briefings \
  -H "Authorization: Bearer dev-secret-change-in-production"
```

## Files Created/Modified

### New Files:
- `src/components/BriefingScheduler.jsx` - UI component for scheduling
- `src/app/api/briefing-preferences/route.js` - API for saving preferences
- `src/app/api/cron/send-scheduled-briefings/route.js` - Cron job handler
- `src/utils/timezoneUtils.js` - Timezone conversion helpers
- `sql/add_briefing_preferences.sql` - Database migration
- `vercel.json` - Cron configuration
- `.env.example` - Environment variable template
- `BRIEFING_SETUP.md` - Full documentation

### Modified Files:
- `src/app/chat/page.jsx` - Added BriefingScheduler component
- `.env.local` - Added CRON_SECRET

## Architecture

```
User sets schedule → Saved to Supabase user_metadata
                ↓
Vercel Cron (hourly) → Checks all users
                ↓
Matches time/timezone → Sends email via Resend
                ↓
Logs result → Stored in briefing_logs table
```

## Support

For detailed setup and troubleshooting, see [BRIEFING_SETUP.md](./BRIEFING_SETUP.md)

## Next Steps

- [ ] Run the SQL migration in Supabase
- [ ] Test the UI locally
- [ ] Deploy to Vercel
- [ ] Add CRON_SECRET to Vercel environment variables
- [ ] Test with a real user account
