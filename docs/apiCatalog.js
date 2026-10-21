/**
 * CareNest REST API Comprehensive Catalog & Documentation
 * Contains full specification of all routes, parameters, authentication, and examples.
 */

const API_METADATA = {
    title: 'CareNest Babysitter Booking Platform API',
    version: '1.2.0',
    description: 'Complete RESTful API for CareNest — powering parent bookings, caregiver verification, real-time availability, ratings & reviews, push notifications, safety blacklist reporting, and administrative moderation.',
    baseUrl: 'https://nodejsbabysitterbookingplatformbackend.onrender.com',
    authentication: {
        type: 'JWT (JSON Web Token)',
        headers: ['Authorization: Bearer <token>', 'x-auth-token: <token>'],
        description: 'Include the signed JWT token returned from /api/user/login, /api/user/register, /api/babysitter/register, or /api/user/oauth in either the "Authorization: Bearer <token>" or "x-auth-token: <token>" HTTP header for all protected endpoints. Protected media streaming endpoints (such as caregiver photos and document previews embedded in HTML <img> or React Native <Image> tags) also support authentication via the "?token=<token>" URL query parameter. Note: Administrative accounts are strictly restricted to the web dashboard and cannot log into mobile clients (identified via "x-client-platform: mobile" header or "platform: mobile" body parameter).',
        example: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
};

const API_CATEGORIES = [
    {
        id: 'auth-user',
        name: 'Authentication & User Management',
        basePath: '/api/user',
        description: 'Registration, credential-based and Google OAuth authentication, session validation, password recovery, display name updates, and profile security.',
        endpoints: [
            {
                method: 'POST',
                path: '/api/user/register',
                summary: 'Register Family / Regular Account',
                description: 'Creates a new regular family user account and returns an authenticated JWT session token.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    username: { type: 'string', required: true, description: 'Unique username' },
                    email: { type: 'string', required: true, description: 'Valid, unique email address' },
                    password: { type: 'string', required: true, description: 'Password (minimum 8 characters)' }
                },
                responses: [
                    { status: 201, description: 'Account registered successfully', example: { token: 'jwt_token_string', user: { id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user', isSuperUser: false } } },
                    { status: 400, description: 'Validation error (missing fields or password under 8 characters)' },
                    { status: 409, description: 'Username or email is already registered to another account' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/register \\
  -H "Content-Type: application/json" \\
  -d '{"username":"family1","email":"family1@example.com","password":"Password123"}'`
            },
            {
                method: 'POST',
                path: '/api/user/login',
                summary: 'Account Login',
                description: 'Authenticate an existing user (family, caregiver, or administrator) using email/username and password. Administrator logins from mobile clients (x-client-platform: mobile or platform: mobile) are strictly prohibited.',
                auth: 'Public',
                headers: {
                    'Content-Type': 'application/json',
                    'x-client-platform': 'Optional ("mobile" or "web")'
                },
                body: {
                    identifier: { type: 'string', required: 'identifier, email, or username', description: 'Registered email address or username' },
                    email: { type: 'string', required: 'identifier, email, or username', description: 'Registered email address' },
                    username: { type: 'string', required: 'identifier, email, or username', description: 'Registered username' },
                    password: { type: 'string', required: true, description: 'Account password' },
                    platform: { type: 'string', required: false, description: 'Client platform indicator ("mobile" or "web")' }
                },
                responses: [
                    { status: 200, description: 'Login successful', example: { token: 'jwt_token_string', user: { id: '64a...', username: 'caregiver1', email: 'caregiver1@example.com', role: 'babysitter', isSuperUser: false, name: 'Sara Ahmed', photoUrl: '/api/babysitter/photo/64b...' } } },
                    { status: 400, description: 'Missing credentials or invalid password' },
                    { status: 403, description: 'Admin accounts can only be accessed through the web admin dashboard' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/login \\
  -H "Content-Type: application/json" \\
  -d '{"identifier":"family1@example.com","password":"Password123"}'`
            },
            {
                method: 'GET',
                path: '/api/user',
                summary: 'Get Current Authenticated Account',
                description: 'Retrieves current user identity, role, and profile details from the JWT session. Rejects mobile clients if the authenticated user is an administrator.',
                auth: 'Authenticated (Bearer token or x-auth-token)',
                headers: {
                    'Authorization': 'Bearer <jwt_token>',
                    'x-auth-token': '<jwt_token>',
                    'x-client-platform': 'Optional ("mobile")'
                },
                responses: [
                    { status: 200, description: 'Current user profile', example: { user: { id: '64a...', username: 'caregiver1', email: 'caregiver1@example.com', role: 'babysitter', isSuperUser: false, name: 'Sara Ahmed', photoUrl: '/api/babysitter/photo/64b...' } } },
                    { status: 401, description: 'Missing or expired session token' },
                    { status: 403, description: 'Admin accounts can only be accessed through the web admin dashboard' },
                    { status: 404, description: 'User account no longer exists' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            },
            {
                method: 'PATCH',
                path: '/api/user/profile',
                summary: 'Update User Profile Name',
                description: 'Updates the display name of the authenticated user. If the account is a caregiver, synchronizes the name on the caregiver profile as well.',
                auth: 'Authenticated (Any Role)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    name: { type: 'string', required: true, description: 'Updated display name' }
                },
                responses: [
                    { status: 200, description: 'Profile updated successfully', example: { msg: 'Profile updated successfully', user: { id: '64a...', name: 'Sara Mansour', username: 'sara_1234' } } },
                    { status: 401, description: 'Unauthorized' },
                    { status: 404, description: 'User not found' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"name":"Sara Mansour"}'`
            },
            {
                method: 'POST',
                path: '/api/user/oauth/nonce',
                summary: 'Generate Google Sign-In Nonce',
                description: 'Issues a short-lived cryptographic nonce required for Google ID token credential validation.',
                auth: 'Public',
                responses: [
                    { status: 200, description: 'Nonce generated', example: { nonce: 'abc123nonceString' } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth/nonce`
            },
            {
                method: 'POST',
                path: '/api/user/oauth',
                summary: 'Google OAuth Sign-In / Register',
                description: 'Validates a Google ID token credential against a verified nonce. In registration flow, rejects accounts whose email is already registered with a 409 error.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    credential: { type: 'string', required: true, description: 'Google OAuth ID token JWT' },
                    nonce: { type: 'string', required: true, description: 'Valid nonce from /oauth/nonce' },
                    flow: { type: 'string', required: false, description: '"login" or "register"' }
                },
                responses: [
                    { status: 200, description: 'Signed in, or pending registration token returned', example: { token: 'jwt...', user: { id: '64a...', role: 'user' } } },
                    { status: 401, description: 'Invalid Google credential or expired nonce' },
                    { status: 409, description: 'An account with this email already exists. Please sign in instead.' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth \\
  -H "Content-Type: application/json" \\
  -d '{"credential":"google_jwt_token","nonce":"signed_nonce","flow":"register"}'`
            },
            {
                method: 'POST',
                path: '/api/user/oauth/complete-registration',
                summary: 'Complete Google Registration',
                description: 'Finalizes Google account creation after the user selects their account role ("user" for family or "babysitter" for caregiver).',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    registrationToken: { type: 'string', required: true, description: 'Pending registration token from Google OAuth flow' },
                    role: { type: 'string', required: true, description: '"user" (family) or "babysitter" (caregiver)' }
                },
                responses: [
                    { status: 200, description: 'Account completed and session token returned', example: { token: 'jwt...', user: { id: '64a...', role: 'user' } } },
                    { status: 400, description: 'Invalid role or missing/expired registration token' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth/complete-registration \\
  -H "Content-Type: application/json" \\
  -d '{"registrationToken":"pending_token","role":"user"}'`
            },
            {
                method: 'POST',
                path: '/api/user/forgot-password',
                summary: 'Request Password Reset Link',
                description: 'Sends a branded CareNest password recovery email containing a secure 15-minute token link pointing to https://dmansour2000.github.io/#/reset-password?token=...',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    email: { type: 'string', required: true, description: 'Registered account email address' }
                },
                responses: [
                    { status: 200, description: 'Recovery request accepted (does not leak email existence)', example: { msg: 'If an account exists for that email, a password reset link has been sent.' } },
                    { status: 400, description: 'Invalid email address syntax' },
                    { status: 503, description: 'Email delivery provider is temporarily unconfigured' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/forgot-password \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your-email@example.com"}'`
            },
            {
                method: 'POST',
                path: '/api/user/reset-password',
                summary: 'Reset Password With Token',
                description: 'Sets a new account password using the token received in the password reset email URL parameter.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    token: { type: 'string', required: true, description: 'Reset token from the resetUrl query parameter' },
                    newPassword: { type: 'string', required: true, description: 'New password (minimum 8 characters)' }
                },
                responses: [
                    { status: 200, description: 'Password reset successful', example: { msg: 'Password updated successfully' } },
                    { status: 400, description: 'Invalid or expired token, or password under 8 characters' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/reset-password \\
  -H "Content-Type: application/json" \\
  -d '{"token":"reset_token_from_email","newPassword":"NewSecurePassword123"}'`
            },
            {
                method: 'PATCH',
                path: '/api/user/password',
                summary: 'Change Current Password',
                description: 'Allows an authenticated user to update their password by confirming their current password.',
                auth: 'Authenticated (Any Role)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    currentPassword: { type: 'string', required: true, description: 'Existing account password' },
                    newPassword: { type: 'string', required: true, description: 'New password (minimum 8 characters)' }
                },
                responses: [
                    { status: 200, description: 'Password changed successfully', example: { msg: 'Password updated successfully' } },
                    { status: 400, description: 'Incorrect current password or new password under 8 characters' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/password \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"currentPassword":"OldPassword123","newPassword":"NewSecurePassword123"}'`
            },
            {
                method: 'PATCH',
                path: '/api/user/email',
                summary: 'Change Current Email Address',
                description: 'Updates the authenticated user’s email address upon password verification.',
                auth: 'Authenticated (Any Role)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    currentPassword: { type: 'string', required: true, description: 'Current password for identity confirmation' },
                    newEmail: { type: 'string', required: true, description: 'New unique email address' }
                },
                responses: [
                    { status: 200, description: 'Email updated successfully', example: { msg: 'Email updated successfully', email: 'newemail@example.com' } },
                    { status: 400, description: 'Incorrect password or invalid email format' },
                    { status: 409, description: 'Email address is already in use by another account' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/email \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"currentPassword":"Password123","newEmail":"newemail@example.com"}'`
            },
            {
                method: 'GET',
                path: '/api/user/users',
                summary: 'Admin: List Users',
                description: 'Lists users for the admin panel. Superusers see all users including other admins; regular admins see non-admin users.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                responses: [
                    { status: 200, description: 'List of users without password hashes', example: [{ _id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user' }] },
                    { status: 403, description: 'Access denied (non-admin)' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/user/users/:id',
                summary: 'Admin: Get User by ID',
                description: 'Fetches details of a specific user account.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'User profile details', example: { _id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user' } },
                    { status: 404, description: 'User not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users/64a000000000000000000010 \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'DELETE',
                path: '/api/user/users/:id',
                summary: 'Admin: Delete User & Linked Records',
                description: 'Deletes a user, associated caregiver profile, uploaded verification files, and booking records.',
                auth: 'Admin (Superuser required to delete another admin)',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID to delete' } },
                responses: [
                    { status: 200, description: 'User removed', example: { msg: 'User removed' } },
                    { status: 403, description: 'Only superuser can remove an admin, or caller is not admin' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users/64a000000000000000000010 \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            }
        ]
    },
    {
        id: 'babysitters',
        name: 'Caregivers & Babysitters',
        basePath: '/api/babysitter',
        description: 'Caregiver directory search, profile registration, verification document uploads, profile updates, star ratings & reviews, and real-time availability.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/babysitter',
                summary: 'Search & Filter Approved Caregivers',
                description: 'Public endpoint to discover available, approved caregivers. Never exposes private contact info or national ID cards. Includes real-time booking availability and rating aggregation.',
                auth: 'Public',
                query: {
                    search: { type: 'string', description: 'Filter by caregiver name, bio keywords, or nationality' },
                    service: { type: 'string', description: 'Filter by service: "cleaning", "babysitting", "cooking", "elderlyCare"' }
                },
                responses: [
                    { status: 200, description: 'List of matching approved caregivers', example: [{ _id: '64a...', name: 'Sara Ahmed', city: 'Cairo', nationality: 'Egyptian', monthlySalary: 5000, currency: 'EGP', services: ['babysitting', 'cooking'], bio: 'Certified pediatric caregiver...', photoUrl: '/api/babysitter/photo/64a...', hasAcceptedBooking: false, isAvailable: true, available: true, averageRating: 4.9, ratingsCount: 12 }] }
                ],
                exampleCurl: `curl -X GET "https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter?service=babysitting"`
            },
            {
                method: 'POST',
                path: '/api/babysitter/register',
                summary: 'Register Caregiver Account',
                description: 'Creates a caregiver user account and linked babysitter profile in JSON format. Automatically generates a unique username if omitted and returns a signed session token. Account starts with moderationStatus "pending"/"unapproved".',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    name: { type: 'string', required: true, description: 'Full legal name' },
                    email: { type: 'string', required: true, description: 'Unique email address' },
                    password: { type: 'string', required: true, description: 'Password (minimum 8 characters)' },
                    username: { type: 'string', required: false, description: 'Optional custom username (auto-generated from name if omitted)' },
                    phone: { type: 'string', required: false, description: 'Contact phone number' },
                    age: { type: 'number', required: false, description: 'Caregiver age' },
                    nationality: { type: 'string', required: false, description: 'Country of nationality (e.g. "Egyptian", "Filipino")' },
                    services: { type: 'string[]', required: false, description: 'List of services: "cleaning", "babysitting", "cooking", "elderlyCare"' },
                    city: { type: 'string', required: false, description: 'Primary working city/governorate' },
                    bio: { type: 'string', required: false, description: 'Personal biography and background' },
                    monthlySalary: { type: 'number', required: false, description: 'Expected monthly salary' },
                    currency: { type: 'string', required: false, description: 'Salary currency ("EGP", "USD", default: "EGP")' }
                },
                responses: [
                    { status: 200, description: 'Caregiver account created and logged in', example: { token: 'jwt...', user: { id: '64a...', username: 'sara_4821', email: 'sara@example.com', role: 'babysitter', name: 'Sara Ahmed', photoUrl: null } } },
                    { status: 400, description: 'Validation error (name, email, or password under 8 characters)' },
                    { status: 409, description: 'Email is already registered to another account' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Sara Ahmed","email":"sara@example.com","password":"Password123","nationality":"Egyptian","city":"Cairo","monthlySalary":6000,"currency":"EGP","services":["babysitting","cooking"]}'`
            },
            {
                method: 'GET',
                path: '/api/babysitter/profile',
                summary: 'Get Own Caregiver Profile',
                description: 'Retrieves the complete profile of the authenticated caregiver, including approval status, verification indicators, and document flags.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                responses: [
                    { status: 200, description: 'Caregiver full profile', example: { _id: '64b...', name: 'Sara Ahmed', moderationStatus: 'approved', available: true, monthlySalary: 6000, currency: 'EGP', nationality: 'Egyptian', photoUrl: '/api/babysitter/profile/photo', verificationDocuments: { photo: true, nationalId: true, passport: false, residency: false } } }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT"`
            },
            {
                method: 'PUT',
                path: '/api/babysitter/profile',
                summary: 'Update Caregiver Profile',
                description: 'Updates caregiver editable details including name, phone, age, nationality, nationalityType, city, bio, monthlySalary, currency, and services.',
                auth: 'Authenticated (Caregiver)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    name: { type: 'string', required: false, description: 'Full legal name (also updates user account)' },
                    phone: { type: 'string', required: false, description: 'Phone number' },
                    age: { type: 'number', required: false, description: 'Caregiver age' },
                    nationality: { type: 'string', required: false, description: 'Nationality name' },
                    nationalityType: { type: 'string', required: false, description: '"egyptian" or "other"' },
                    city: { type: 'string', required: false, description: 'City/district' },
                    bio: { type: 'string', required: false, description: 'Bio (max 1500 characters)' },
                    monthlySalary: { type: 'number', required: false, description: 'Expected monthly salary' },
                    currency: { type: 'string', required: false, description: '"EGP" or "USD"' },
                    services: { type: 'string[]', required: false, description: 'Array of services ("cleaning", "babysitting", "cooking", "elderlyCare")' }
                },
                responses: [
                    { status: 200, description: 'Profile updated successfully', example: { msg: 'Profile updated successfully', babysitter: { _id: '64b...', monthlySalary: 7000, currency: 'EGP' } } },
                    { status: 400, description: 'Validation error (unsupported currency, invalid salary, or unknown services)' }
                ],
                exampleCurl: `curl -X PUT https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT" \\
  -d '{"monthlySalary":7000,"currency":"EGP","nationality":"Egyptian","city":"Alexandria"}'`
            },
            {
                method: 'PATCH',
                path: '/api/babysitter/availability',
                summary: 'Toggle Availability Status',
                description: 'Instantly switches the caregiver profile between available (accepting new booking requests) and unavailable.',
                auth: 'Authenticated (Caregiver)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    available: { type: 'boolean', required: true, description: 'True to accept bookings, false to pause' }
                },
                responses: [
                    { status: 200, description: 'Availability toggled', example: { available: false, hasAcceptedBooking: false } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/availability \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT" \\
  -d '{"available":true}'`
            },
            {
                method: 'GET',
                path: '/api/babysitter/profile/photo',
                summary: 'Get Own Caregiver Photo',
                description: 'Streams the profile image of the currently logged-in caregiver. Supports authentication via Authorization header or ?token=<jwt> query parameter for direct <img> or <Image> embedding.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Authorization': 'Bearer <jwt_token> (or ?token=<jwt> query param)' },
                query: {
                    token: { type: 'string', required: false, description: 'Optional JWT token alternative to Authorization header for direct media streaming' }
                },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'No photo uploaded' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile/photo \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT"`
            },
            {
                method: 'GET',
                path: '/api/babysitter/profile/documents/:kind',
                summary: 'Get Own Verification Document',
                description: 'Streams the caregiver’s own uploaded legal document ("nationalId", "passport", "residency", or document index 0 or 1). Supports ?token=<jwt> query parameter.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Authorization': 'Bearer <jwt_token> (or ?token=<jwt> query param)' },
                params: { kind: { type: 'string', required: true, description: '"nationalId", "passport", "residency", "0", or "1"' } },
                query: {
                    token: { type: 'string', required: false, description: 'Optional JWT token alternative for direct browser/webview document viewing' }
                },
                responses: [
                    { status: 200, description: 'Binary file stream' },
                    { status: 404, description: 'Document not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile/documents/nationalId \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT"`
            },
            {
                method: 'POST',
                path: '/api/babysitter/profile/documents',
                summary: 'Upload Verification Documents',
                description: 'Uploads verification documents and/or profile photo in multipart/form-data. Resets profile moderationStatus to "pending" for admin review.',
                auth: 'Authenticated (Caregiver, multipart/form-data)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                body: {
                    photo: { type: 'file (image)', required: false, description: 'Profile picture (JPG, PNG, WebP)' },
                    nationalId: { type: 'file (image/pdf)', required: false, description: 'National ID card' },
                    passport: { type: 'file (image/pdf)', required: false, description: 'Passport document' },
                    residency: { type: 'file (image/pdf)', required: false, description: 'Residency visa / permit' },
                    documents: { type: 'file[] (up to 2)', required: false, description: 'Generic verification documents / certificates' }
                },
                responses: [
                    { status: 200, description: 'Documents uploaded and submitted for moderation', example: { msg: 'Documents uploaded for review', moderationStatus: 'pending', photoUrl: '/api/babysitter/profile/photo', documentsCount: 2 } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile/documents \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT" \\
  -F "photo=@/path/to/photo.jpg" \\
  -F "nationalId=@/path/to/id.jpg"`
            },
            {
                method: 'GET',
                path: '/api/babysitter/photo/:id',
                summary: 'Get Caregiver Photo (Public / Authenticated Owner)',
                description: 'Streams the profile picture of an approved caregiver. If the caregiver profile is still pending moderation, the authenticated caregiver who owns the profile can stream their own photo by providing their session token via "?token=<jwt>" query parameter or Authorization header.',
                auth: 'Public (Approved) / Authenticated Caregiver Owner (Pending)',
                params: { id: { type: 'string', required: true, description: 'Caregiver profile ID' } },
                query: {
                    token: { type: 'string', required: false, description: 'JWT authentication token allowing caregivers to stream their own photo during pending moderation' }
                },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'Photo not found or profile pending approval without owner authentication' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/photo/64a000000000000000000012`
            },
            {
                method: 'GET',
                path: '/api/babysitter/users/:id',
                summary: 'Get Caregiver Public Details & Reviews',
                description: 'Retrieves public caregiver profile details, star rating aggregation, and recent customer reviews.',
                auth: 'Public',
                params: { id: { type: 'string', required: true, description: 'Caregiver profile ID or linked User ID' } },
                responses: [
                    { status: 200, description: 'Caregiver profile with rating stats and reviews', example: { _id: '64a...', name: 'Sara Ahmed', city: 'Cairo', monthlySalary: 6000, currency: 'EGP', averageRating: 4.8, ratingsCount: 15, reviews: [{ rating: 5, title: 'Excellent caregiver!', description: 'Very attentive with our daughter.' }] } },
                    { status: 404, description: 'Caregiver not found or unapproved' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/users/64a000000000000000000012`
            },
            {
                method: 'POST',
                path: '/api/babysitter/:id/reviews',
                summary: 'Submit Rating & Review',
                description: 'Allows a verified family account to leave a 1-to-5 star rating and review for a caregiver. Dispatches a real-time push notification to the caregiver.',
                auth: 'Authenticated (Family / Regular User Only)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                body: {
                    rating: { type: 'integer (1-5)', required: true, description: 'Star rating from 1 to 5' },
                    title: { type: 'string', required: true, description: 'Review summary title (max 120 chars)' },
                    description: { type: 'string', required: true, description: 'Detailed review feedback (max 1000 chars)' }
                },
                responses: [
                    { status: 201, description: 'Review submitted successfully', example: { msg: 'Review submitted successfully', review: { rating: 5, title: 'Punctual and kind' }, stats: { averageRating: 4.9, ratingsCount: 16 } } },
                    { status: 400, description: 'Invalid rating number or missing fields / self-review attempt' },
                    { status: 403, description: 'Only registered family accounts can submit ratings and reviews' },
                    { status: 404, description: 'Caregiver profile not found' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/64a000000000000000000012/reviews \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_FAMILY_JWT" \\
  -d '{"rating":5,"title":"Wonderful care!","description":"Our toddler loved spending time with Sara. Very responsible."}'`
            },
            {
                method: 'GET',
                path: '/api/babysitter/:id/reviews',
                summary: 'Get Caregiver Reviews',
                description: 'Public endpoint to view up to 50 reviews, average rating, and ratings count for a specific caregiver.',
                auth: 'Public',
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'List of reviews with rating summary', example: { reviews: [{ _id: '...', rating: 5, title: 'Great experience', userName: 'Dina' }], averageRating: 4.8, ratingsCount: 12 } }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/64a000000000000000000012/reviews`
            },
            {
                method: 'PUT',
                path: '/api/babysitter/accept/:id',
                summary: 'Accept Work Request (Caregiver)',
                description: 'Allows a caregiver to mark their profile as busy upon taking an assignment.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'Profile availability set to busy', example: { _id: '64b...', available: false } }
                ],
                exampleCurl: `curl -X PUT https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/accept/64b000000000000000000012 \\
  -H "Authorization: Bearer YOUR_CAREGIVER_JWT"`
            }
        ]
    },
    {
        id: 'bookings',
        name: 'Bookings & Scheduling',
        basePath: '/api/bookings',
        description: 'Create care requests, view booking histories, update lifecycle status ("pending", "accepted", "declined", "cancelled"), and manage active sessions.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/bookings',
                summary: 'List Account Bookings',
                description: 'Returns all bookings for the authenticated user. Families see bookings they requested; caregivers see bookings assigned to them. Includes counterpart contact and photo information.',
                auth: 'Authenticated (Family or Caregiver)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                responses: [
                    { status: 200, description: 'List of booking records', example: [{ _id: '64c...', startAt: '2026-11-01T00:00:00.000Z', endAt: '2026-11-05T23:59:59.999Z', service: 'babysitting', status: 'accepted', childrenCount: 2, babysitterId: { name: 'Sara Ahmed', phone: '+20100...', photoUrl: '/api/babysitter/photo/64b...' } }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            },
            {
                method: 'POST',
                path: '/api/bookings',
                summary: 'Create New Booking Request',
                description: 'Creates a booking request with a specified caregiver for a future date range. Dispatches a push notification to the caregiver.',
                auth: 'Authenticated (Family / Regular User Only)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    babysitterId: { type: 'string', required: true, description: 'Caregiver profile ObjectId' },
                    service: { type: 'string', required: true, description: '"cleaning", "babysitting", "cooking", "elderlyCare"' },
                    startAt: { type: 'string (YYYY-MM-DD)', required: true, description: 'Future start date' },
                    endAt: { type: 'string (YYYY-MM-DD)', required: true, description: 'End date (on or after start date)' },
                    childrenCount: { type: 'integer (1-10)', required: true, description: 'Number of children (1 to 10)' },
                    notes: { type: 'string', required: false, description: 'Special instructions or notes (max 1000 chars)' }
                },
                responses: [
                    { status: 201, description: 'Booking created successfully', example: { _id: '64c...', status: 'pending', service: 'babysitting' } },
                    { status: 400, description: 'Validation error (past date, end before start, or invalid service)' },
                    { status: 403, description: 'Only parent accounts can request a booking' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_FAMILY_JWT" \\
  -d '{"babysitterId":"64a000000000000000000012","service":"babysitting","startAt":"2026-11-10","endAt":"2026-11-12","childrenCount":1,"notes":"Evening babysitting."}'`
            },
            {
                method: 'PATCH',
                path: '/api/bookings/:id/status',
                summary: 'Update Booking Status',
                description: 'Transitions booking lifecycle state: "accepted", "declined", "cancelled", or "pending". Families can cancel or reactivate; caregivers can accept or decline. Dispatches push notifications and updates caregiver availability.',
                auth: 'Authenticated (Family or Caregiver involved in booking)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                params: { id: { type: 'string', required: true, description: 'Booking ID' } },
                body: {
                    status: { type: 'string', required: true, description: '"accepted", "declined", "cancelled", or "pending"' }
                },
                responses: [
                    { status: 200, description: 'Status updated successfully', example: { _id: '64c...', status: 'accepted' } },
                    { status: 400, description: 'Unsupported booking status' },
                    { status: 403, description: 'Unauthorized to change this booking' },
                    { status: 409, description: 'State conflict (e.g. conflicting active booking or expired date)' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings/64c000000000000000000020/status \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"status":"accepted"}'`
            },
            {
                method: 'DELETE',
                path: '/api/bookings/:id',
                summary: 'Cancel Booking',
                description: 'Cancels an existing booking while preserving the booking record.',
                auth: 'Authenticated (Family or Caregiver involved in booking)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Booking ID' } },
                responses: [
                    { status: 200, description: 'Booking cancelled successfully', example: { msg: 'Booking cancelled successfully' } }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings/64c000000000000000000020 \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            }
        ]
    },
    {
        id: 'blacklist',
        name: 'Safety & Blacklist Incident Reports',
        basePath: '/api/blacklist',
        description: 'Community safety system allowing verified families to file incident reports with documentation, and public viewing of approved warnings.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/blacklist',
                summary: 'List Public Approved Safety Warnings',
                description: 'Retrieves publicly approved incident warnings. Protects submitter identity and omits private legal files.',
                auth: 'Public',
                query: {
                    search: { type: 'string', required: false, description: 'Search by reported person name, phone, or ID' }
                },
                responses: [
                    { status: 200, description: 'Approved warnings', example: [{ _id: '64d...', name: 'Reported Individual', incidentDescription: 'Brief description...', incidentDate: '2026-09-15', hasPhoto: true }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist`
            },
            {
                method: 'GET',
                path: '/api/blacklist/mine',
                summary: 'List User Submitted Reports',
                description: 'Returns reports submitted by the logged-in family user along with current moderation status.',
                auth: 'Authenticated (Regular Family User)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                responses: [
                    { status: 200, description: 'User submissions', example: [{ _id: '64d...', name: 'Reported Individual', status: 'pending', incidentDate: '2026-09-15' }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/mine \\
  -H "Authorization: Bearer YOUR_FAMILY_JWT"`
            },
            {
                method: 'POST',
                path: '/api/blacklist',
                summary: 'Submit Incident Report',
                description: 'Files a safety misconduct report with incident details and optional proof documents for admin review.',
                auth: 'Authenticated (Regular Family User, multipart/form-data)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                body: {
                    name: { type: 'string', required: true, description: 'Reported person name' },
                    nationalId: { type: 'string', required: true, description: 'National ID number' },
                    incidentDescription: { type: 'string', required: true, description: 'Detailed factual description of incident' },
                    incidentDate: { type: 'string (YYYY-MM-DD)', required: true, description: 'Date incident occurred' },
                    phone: { type: 'string', required: false, description: 'Contact phone number' },
                    photo: { type: 'file (image)', required: false, description: 'Photograph of reported person' },
                    documents: { type: 'file[] (up to 5)', required: false, description: 'Evidence files (police complaints, messages, receipts)' }
                },
                responses: [
                    { status: 201, description: 'Report submitted and queued for review', example: { msg: 'Report submitted successfully and is pending administrative review', report: { _id: '64d...', status: 'pending' } } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist \\
  -H "Authorization: Bearer YOUR_FAMILY_JWT" \\
  -F "name=Jane Doe" \\
  -F "nationalId=29001011234567" \\
  -F "incidentDescription=Caregiver abandoned child unattended." \\
  -F "incidentDate=2026-10-01"`
            },
            {
                method: 'GET',
                path: '/api/blacklist/:id/photo',
                summary: 'View Approved Report Photo',
                description: 'Public endpoint to view the photo attached to an approved safety warning.',
                auth: 'Public',
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'Report or photo not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/64d000000000000000000030/photo`
            },
            {
                method: 'GET',
                path: '/api/blacklist/admin/review',
                summary: 'Admin: List Pending Reports',
                description: 'Retrieves all submitted safety reports awaiting administrator approval.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                responses: [
                    { status: 200, description: 'Pending reports list', example: [{ _id: '64d...', name: 'Jane Doe', nationalId: '2900...', status: 'pending', submitter: { id: '...', username: '...' } }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/review \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'PATCH',
                path: '/api/blacklist/admin/:id/review',
                summary: 'Admin: Approve / Reject Report',
                description: 'Updates a report status to "approved" (making it publicly visible) or "rejected" with review notes.',
                auth: 'Admin Only',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <admin_jwt>'
                },
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                body: {
                    status: { type: 'string', required: true, description: '"approved" or "rejected"' },
                    reviewNotes: { type: 'string', required: false, description: 'Administrative verification notes' }
                },
                responses: [
                    { status: 200, description: 'Review status saved', example: { msg: 'Report status updated', report: { _id: '64d...', status: 'approved' } } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030/review \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \\
  -d '{"status":"approved","reviewNotes":"Police complaint verified"}'`
            },
            {
                method: 'DELETE',
                path: '/api/blacklist/admin/:id',
                summary: 'Admin: Delete Report',
                description: 'Permanently deletes an incident report and cleans up all attached evidence files.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                responses: [
                    { status: 200, description: 'Report deleted', example: { msg: 'Report deleted successfully' } }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030 \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/blacklist/admin/:id/photo',
                summary: 'Admin: View Report Photo',
                description: 'Admin endpoint to view the photo attached to any submitted report during review.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'Photo not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030/photo \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/blacklist/admin/:id/documents/:index',
                summary: 'Admin: View Evidence Document',
                description: 'Streams the uploaded evidence file (police report, photo, etc.) for administrative verification.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: {
                    id: { type: 'string', required: true, description: 'Report ID' },
                    index: { type: 'integer', required: true, description: '0-based index of document' }
                },
                responses: [
                    { status: 200, description: 'Binary file stream' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030/documents/0 \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            }
        ]
    },
    {
        id: 'admin',
        name: 'Platform Administration & Moderation',
        basePath: '/api/admin',
        description: 'Comprehensive administrative oversight: user management, caregiver document verification, moderation approval, account deletion, and platform dossiers.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/admin/users',
                summary: 'List All Registered Users',
                description: 'Administrative listing of all users across regular, caregiver, and admin roles with search and pagination.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                query: {
                    role: { type: 'string', required: false, description: 'Filter by "user", "babysitter", "admin"' },
                    search: { type: 'string', required: false, description: 'Search by username or email' },
                    page: { type: 'integer', required: false, description: 'Page number' },
                    limit: { type: 'integer', required: false, description: 'Page size' }
                },
                responses: [
                    { status: 200, description: 'User accounts list', example: [{ _id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user', isSuperUser: false, createdAt: '2026-10-01' }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/users \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/users/:id/details',
                summary: 'Get Detailed Account Dossier',
                description: 'Returns deep account data for a specific user, including associated bookings, caregiver profiles, and document verification flags.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'Comprehensive account details', example: { user: { _id: '64a...', username: 'family1' }, bookings: [{ _id: '64c...', status: 'accepted' }] } }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/users/64a000000000000000000010/details \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'DELETE',
                path: '/api/admin/users/:id',
                summary: 'Superadmin: Delete User Account',
                description: 'Permanently deletes a user account and associated profile records. Restricted to superadmin.',
                auth: 'Superadmin Only',
                headers: { 'Authorization': 'Bearer <superadmin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'Account deleted', example: { msg: 'User account deleted successfully' } },
                    { status: 403, description: 'Forbidden (regular admins cannot delete accounts)' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/users/64a000000000000000000010 \\
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters',
                summary: 'List Caregivers For Moderation',
                description: 'Lists all registered caregivers with verification status and flags for attached legal documents (photo, nationalId, passport, residency).',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                responses: [
                    { status: 200, description: 'Caregiver moderation list', example: [{ _id: '64b...', name: 'Sara Ahmed', moderationStatus: 'pending', verificationDocuments: { photo: true, nationalId: true, passport: false, residency: false } }] }
                ],
                exampleCurl: `curl -X GET "https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters" \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'PATCH',
                path: '/api/admin/babysitters/:id/moderation',
                summary: 'Moderate Caregiver Profile',
                description: 'Updates a caregiver profile status to "approved", "unapproved", or "blacklisted". Requires required identity documents before approval.',
                auth: 'Admin Only',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <admin_jwt>'
                },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                body: {
                    status: { type: 'string', required: true, description: '"approved", "unapproved", or "blacklisted"' }
                },
                responses: [
                    { status: 200, description: 'Moderation status updated', example: { msg: 'Moderation status updated', moderationStatus: 'approved' } },
                    { status: 400, description: 'Missing required national ID or documents before approval' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/moderation \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \\
  -d '{"status":"approved"}'`
            },
            {
                method: 'DELETE',
                path: '/api/admin/babysitters/:id',
                summary: 'Superadmin: Delete Caregiver Profile',
                description: 'Permanently removes a caregiver profile and associated files from the platform.',
                auth: 'Superadmin Only',
                headers: { 'Authorization': 'Bearer <superadmin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'Profile removed', example: { msg: 'Caregiver profile deleted successfully' } },
                    { status: 403, description: 'Forbidden (regular admins cannot delete profiles)' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012 \\
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters/:id/documents/:kind',
                summary: 'Admin: View Caregiver Legal Document',
                description: 'Securely downloads or views confidential verification documents ("photo", "nationalId", "passport", "residency").',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: {
                    id: { type: 'string', required: true, description: 'Caregiver Profile ID' },
                    kind: { type: 'string', required: true, description: '"photo", "nationalId", "passport", or "residency"' }
                },
                responses: [
                    { status: 200, description: 'Binary file stream' },
                    { status: 404, description: 'No document on file' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/documents/nationalId \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters/:id/photo',
                summary: 'Admin: View Caregiver Profile Photo',
                description: 'Retrieves the profile picture of any caregiver during moderation.',
                auth: 'Admin Only',
                headers: { 'Authorization': 'Bearer <admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'Photo not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/photo \\
  -H "Authorization: Bearer YOUR_ADMIN_JWT"`
            }
        ]
    },
    {
        id: 'notifications',
        name: 'Push Notifications & Device Tokens',
        basePath: '/api/notifications',
        description: 'In-app notification history, unread counters, read receipts, and Firebase Cloud Messaging (FCM) device push token registration.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/notifications',
                summary: 'List User Notifications & Unread Count',
                description: 'Retrieves up to 50 recent notifications for the authenticated user and the total unread count.',
                auth: 'Authenticated (Any Role)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                responses: [
                    { status: 200, description: 'Notifications and unread count', example: { notifications: [{ _id: '64e...', title: 'New Booking Request 📅', message: 'Dina requested babysitting for Nov 10.', read: false, createdAt: '2026-10-21T18:00:00Z' }], unreadCount: 1 } },
                    { status: 401, description: 'Authentication required' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/notifications \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            },
            {
                method: 'PATCH',
                path: '/api/notifications/:id/read',
                summary: 'Mark Notification as Read',
                description: 'Marks a specific user notification as read.',
                auth: 'Authenticated (Notification Recipient)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Notification ID' } },
                responses: [
                    { status: 200, description: 'Notification marked as read', example: { _id: '64e...', read: true } },
                    { status: 404, description: 'Notification not found' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/notifications/64e000000000000000000040/read \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            },
            {
                method: 'PATCH',
                path: '/api/notifications/read-all',
                summary: 'Mark All Notifications as Read',
                description: 'Marks all unread notifications for the authenticated user as read in bulk.',
                auth: 'Authenticated (Any Role)',
                headers: { 'Authorization': 'Bearer <jwt_token>' },
                responses: [
                    { status: 200, description: 'All notifications marked as read', example: { msg: 'All notifications marked as read' } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/notifications/read-all \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
            },
            {
                method: 'POST',
                path: '/api/notifications/register-token',
                summary: 'Register FCM Device Push Token',
                description: 'Registers an Expo / Firebase Cloud Messaging device push token for the authenticated user to receive native push notifications.',
                auth: 'Authenticated (Any Role)',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer <jwt_token>'
                },
                body: {
                    token: { type: 'string', required: true, description: 'FCM / Expo push notification device token string' }
                },
                responses: [
                    { status: 200, description: 'Push token registered successfully', example: { msg: 'FCM push token registered successfully' } },
                    { status: 400, description: 'Valid FCM token required' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/notifications/register-token \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"}'`
            }
        ]
    }
];

function getApiCatalog() {
    let totalEndpoints = 0;
    API_CATEGORIES.forEach(cat => {
        totalEndpoints += cat.endpoints.length;
    });

    return {
        ...API_METADATA,
        totalEndpoints,
        categories: API_CATEGORIES
    };
}

module.exports = {
    getApiCatalog,
    API_METADATA,
    API_CATEGORIES
};
