# Feedback Feature Implementation

## Overview

Anonymous feedback system for the pilot app, allowing users to submit feedback directly from the application. Feedback is stored securely and email notifications are sent when feedback is received.

## Architecture

### Backend (Modular Approach)

**Location:** `core/src/services/feedback/`

- **feedbackService.js**: Handles feedback storage, validation, and rate limiting
  - File-based JSON storage (can be migrated to SQLite later)
  - Rate limiting: 10 submissions per IP per hour
  - Input sanitization and validation
  - GDPR-compliant (no PII storage)

- **emailService.js**: Handles email notifications
  - Supports multiple providers: SendGrid, AWS SES, SMTP, or console logging
  - Configurable via environment variables
  - Graceful fallback to console logging if no provider configured

**API Endpoint:** `POST /api/pilot/feedback`
- Added to `core/src/api/pilot-api.js`
- Validates input, calls feedbackService, returns response
- Rate limiting enforced
- Error handling with appropriate HTTP status codes

### Frontend

**Components:**
- **FeedbackButton.tsx**: Floating button (bottom-right corner)
- **FeedbackDialog.tsx**: Modal dialog using Radix UI
- **FeedbackForm.tsx**: Form with type selection and message input

**API Integration:**
- Added `submitFeedback()` method to `src/services/api.ts`
- Uses existing API error handling patterns

**Integration:**
- Added to `PilotDashboard.tsx`
- Passes app version and airport context automatically

## Data Model

```typescript
interface Feedback {
  id: string;                    // UUID
  type: 'positive' | 'issue' | 'suggestion' | 'question';
  message: string;               // Sanitized, max 2000 chars
  appVersion?: string;
  airportContext?: string;
  timestamp: string;             // ISO timestamp
  userAgent?: string;            // Anonymized
  metadata?: {
    screenWidth?: number;
    screenHeight?: number;
  };
  createdAt: string;             // ISO timestamp
}
```

## GDPR Compliance

- **No PII stored**: No email addresses, no IP addresses (only for rate limiting, not stored)
- **Anonymous by default**: All feedback is anonymous
- **Data minimization**: Only necessary metadata collected
- **User communication**: Clear messaging that feedback is anonymous
- **Storage**: JSON file-based (can migrate to encrypted database)

## Email Configuration

### Environment Variables (Backend)

```bash
# Required
FEEDBACK_NOTIFICATION_EMAIL=feedback@ayryx.com

# Optional - Email Provider Selection
EMAIL_SERVICE_PROVIDER=console  # Options: 'console', 'sendgrid', 'ses', or use SMTP

# SendGrid
SENDGRID_API_KEY=your-key
SENDGRID_FROM_EMAIL=noreply@ayryx.com

# AWS SES
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
SES_FROM_EMAIL=noreply@ayryx.com

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@ayryx.com
```

### Default Behavior

If no email provider is configured, feedback notifications are logged to console. This allows the feature to work immediately without email setup.

## Storage

**Location:** `core/data/feedback/feedback.json`

- JSON file-based storage
- Easy to migrate to SQLite or PostgreSQL later
- Automatic directory creation
- Simple backup strategy (just copy the JSON file)

## Rate Limiting

- **Limit**: 10 submissions per IP address per hour
- **Window**: 1 hour rolling window
- **Response**: HTTP 429 (Too Many Requests) if exceeded
- **Storage**: In-memory Map (resets on server restart)

## Security

- **Input sanitization**: XSS prevention, HTML tag removal
- **Message length limits**: 3-2000 characters
- **Type validation**: Enum validation for feedback types
- **Rate limiting**: Prevents spam/abuse
- **No PII**: No personal information stored

## User Experience

1. User clicks floating "Feedback" button (bottom-right)
2. Dialog opens with 4 feedback type options
3. User selects type (Positive/Issue/Suggestion/Question)
4. User enters feedback message (with character counter)
5. Context shown (app version, airport) - read-only
6. User submits
7. Success toast notification
8. Dialog closes automatically

## Testing

### Manual Testing Checklist

- [ ] Feedback button appears in bottom-right corner
- [ ] Dialog opens when button clicked
- [ ] All 4 feedback types selectable
- [ ] Form validation works (min 3 chars, max 2000)
- [ ] Character counter updates correctly
- [ ] Submission works and shows success message
- [ ] Error handling works (network errors, validation errors)
- [ ] Rate limiting works (try submitting 11 times quickly)
- [ ] Email notification received (if configured)
- [ ] Feedback stored in JSON file
- [ ] Context (airport, app version) included correctly

### Test Email Configuration

For testing, use `EMAIL_SERVICE_PROVIDER=console` to see notifications in server logs without setting up email.

## Future Enhancements

1. **Database Migration**: Move from JSON to SQLite/PostgreSQL
2. **Admin Dashboard**: View and manage feedback
3. **Feedback Analytics**: Track feedback types, trends
4. **Response System**: Allow admins to respond to feedback (if user provides contact)
5. **Feedback Categories**: More granular categorization
6. **Search/Filter**: Admin tools to search feedback
7. **Export**: Export feedback to CSV/JSON

## Files Created/Modified

### Backend
- `core/src/services/feedback/feedbackService.js` (new)
- `core/src/services/feedback/emailService.js` (new)
- `core/src/api/pilot-api.js` (modified - added feedback endpoint)

### Frontend
- `pilot-app/src/components/FeedbackButton.tsx` (new)
- `pilot-app/src/components/FeedbackDialog.tsx` (new)
- `pilot-app/src/components/FeedbackForm.tsx` (new)
- `pilot-app/src/types/index.ts` (modified - added feedback types)
- `pilot-app/src/services/api.ts` (modified - added submitFeedback method)
- `pilot-app/src/components/PilotDashboard.tsx` (modified - integrated FeedbackButton)

## Dependencies

### Backend
- No new dependencies required (uses built-in Node.js modules)
- Optional: `nodemailer` if using SMTP (install if needed)
- Optional: `@aws-sdk/client-ses` if using AWS SES (already installed)

### Frontend
- Uses existing dependencies (Radix UI Dialog, Toast)
- No new dependencies required

## Deployment Notes

1. **Create data directory**: `core/data/feedback/` (created automatically)
2. **Set environment variables**: At minimum, set `FEEDBACK_NOTIFICATION_EMAIL`
3. **Configure email provider**: Choose provider and set credentials
4. **Test**: Submit test feedback to verify email notifications
5. **Monitor**: Check `core/data/feedback/feedback.json` for stored feedback

## Troubleshooting

### Email Not Sending
- Check `FEEDBACK_NOTIFICATION_EMAIL` is set
- Verify email provider credentials
- Check server logs for email errors
- Use `EMAIL_SERVICE_PROVIDER=console` for testing

### Feedback Not Storing
- Check `core/data/feedback/` directory exists and is writable
- Check server logs for file system errors
- Verify disk space available

### Rate Limiting Issues
- Rate limit resets on server restart
- Check server logs for rate limit messages
- Adjust `MAX_SUBMISSIONS_PER_WINDOW` in feedbackService.js if needed

### Frontend Errors
- Check browser console for API errors
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check CORS settings if accessing from different domain
