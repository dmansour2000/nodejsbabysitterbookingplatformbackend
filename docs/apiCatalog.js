/**
 * CareNest REST API Comprehensive Catalog & Documentation
 * Contains full specification of all routes, parameters, authentication, and examples.
 */

const API_METADATA = {
    title: 'CareNest Babysitter Booking Platform API',
    version: '1.0.0',
    description: 'Complete RESTful API for CareNest — powering parent bookings, caregiver verification, real-time availability, safety reporting, and administrative moderation.',
    baseUrl: 'https://nodejsbabysitterbookingplatformbackend.onrender.com',
    authentication: {
        type: 'JWT (JSON Web Token)',
        header: 'x-auth-token',
        description: 'Include the signed JWT token returned from /api/user/login, /api/user/register, or /api/user/oauth in the x-auth-token HTTP header for all protected endpoints.',
        example: 'x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
};

const API_CATEGORIES = [
    {
        id: 'auth-user',
        name: 'Authentication & User Management',
        basePath: '/api/user',
        description: 'Registration, authentication, Google OAuth, session retrieval, password recovery, and credential updates.',
        endpoints: [
            {
                method: 'POST',
                path: '/api/user/register',
                summary: 'Register Family / Regular Account',
                description: 'Creates a new regular family user account and returns an authenticated session token.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    username: { type: 'string', required: true, description: 'Unique username' },
                    email: { type: 'string', required: true, description: 'Valid email address' },
                    password: { type: 'string', required: true, description: 'Password (minimum 8 characters)' }
                },
                responses: [
                    { status: 201, description: 'Account registered successfully', example: { token: 'jwt_token_string', user: { id: '64a...', role: 'user', isSuperUser: false } } },
                    { status: 400, description: 'Validation error (missing fields or password too short)' },
                    { status: 409, description: 'Username or email already in use' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/register \\
  -H "Content-Type: application/json" \\
  -d '{"username":"family1","email":"family1@example.com","password":"Password123"}'`
            },
            {
                method: 'POST',
                path: '/api/user/login',
                summary: 'Account Login',
                description: 'Authenticate an existing user (family, caregiver, or administrator) using email/username and password.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    email: { type: 'string', required: 'Either email or username', description: 'Registered email address' },
                    username: { type: 'string', required: 'Either email or username', description: 'Registered username' },
                    password: { type: 'string', required: true, description: 'Account password' }
                },
                responses: [
                    { status: 200, description: 'Login successful', example: { token: 'jwt_token_string', user: { id: '64a...', role: 'user', isSuperUser: false } } },
                    { status: 400, description: 'Missing credentials or invalid password' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"family1@example.com","password":"Password123"}'`
            },
            {
                method: 'GET',
                path: '/api/user',
                summary: 'Get Current Authenticated Account',
                description: 'Retrieves profile and role details of the currently signed-in user.',
                auth: 'Authenticated (Any Role)',
                headers: { 'x-auth-token': '<jwt_token>' },
                responses: [
                    { status: 200, description: 'Current user profile', example: { user: { id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user', isSuperUser: false } } },
                    { status: 401, description: 'Missing or expired x-auth-token' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user \\
  -H "x-auth-token: YOUR_JWT_TOKEN"`
            },
            {
                method: 'POST',
                path: '/api/user/oauth/nonce',
                summary: 'Generate Google Sign-In Nonce',
                description: 'Issues a short-lived cryptographic nonce required for Google credential validation.',
                auth: 'Public',
                responses: [
                    { status: 200, description: 'Nonce created', example: { nonce: 'abc123nonceString' } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth/nonce`
            },
            {
                method: 'POST',
                path: '/api/user/oauth',
                summary: 'Google OAuth Sign-In / Register',
                description: 'Validates a Google ID token credential against a verified nonce and logs in or requests account type selection.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    credential: { type: 'string', required: true, description: 'Google OAuth ID token JWT' },
                    nonce: { type: 'string', required: true, description: 'Valid nonce from /oauth/nonce' },
                    flow: { type: 'string', required: false, description: '"login" or "register"' }
                },
                responses: [
                    { status: 200, description: 'Signed in, or pending registration required', example: { token: 'jwt...', user: { id: '64a...', role: 'user' } } },
                    { status: 401, description: 'Invalid Google credential or expired nonce' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth \\
  -H "Content-Type: application/json" \\
  -d '{"credential":"google_jwt_token","nonce":"signed_nonce"}'`
            },
            {
                method: 'POST',
                path: '/api/user/oauth/complete-registration',
                summary: 'Complete Google Registration',
                description: 'Finalizes Google account creation after the user selects their account role.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    registrationToken: { type: 'string', required: true, description: 'Token from pending Google OAuth flow' },
                    role: { type: 'string', required: true, description: '"user" (family) or "babysitter" (caregiver)' }
                },
                responses: [
                    { status: 200, description: 'Account completed and session token returned', example: { token: 'jwt...', user: { id: '64a...', role: 'user' } } },
                    { status: 400, description: 'Invalid role or missing token' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/oauth/complete-registration \\
  -H "Content-Type: application/json" \\
  -d '{"registrationToken":"pending_token","role":"user"}'`
            },
            {
                method: 'POST',
                path: '/api/user/forgot-password',
                summary: 'Request Password Reset Link',
                description: 'Sends a password recovery email containing a secure 15-minute token link.',
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
                description: 'Sets a new account password using the token received in the password reset email.',
                auth: 'Public',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    token: { type: 'string', required: true, description: 'Reset token from the resetUrl query parameter' },
                    newPassword: { type: 'string', required: true, description: 'New password (minimum 8 characters)' }
                },
                responses: [
                    { status: 200, description: 'Password reset successful', example: { msg: 'Password updated successfully' } },
                    { status: 400, description: 'Invalid or expired token, or password too short' }
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
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
                body: {
                    currentPassword: { type: 'string', required: true, description: 'Existing account password' },
                    newPassword: { type: 'string', required: true, description: 'New password (minimum 8 characters)' }
                },
                responses: [
                    { status: 200, description: 'Password changed successfully', example: { msg: 'Password updated successfully' } },
                    { status: 400, description: 'Incorrect current password or new password too short' }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/password \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_JWT_TOKEN" \\
  -d '{"currentPassword":"OldPassword123","newPassword":"NewSecurePassword123"}'`
            },
            {
                method: 'PATCH',
                path: '/api/user/email',
                summary: 'Change Current Email Address',
                description: 'Updates the authenticated user’s email address upon password verification.',
                auth: 'Authenticated (Any Role)',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
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
  -H "x-auth-token: YOUR_JWT_TOKEN" \\
  -d '{"currentPassword":"Password123","newEmail":"newemail@example.com"}'`
            },
            {
                method: 'GET',
                path: '/api/user/users',
                summary: 'Admin: List Users',
                description: 'Lists all users for the admin panel. Superusers see all users including other admins; regular admins see non-admin users.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                responses: [
                    { status: 200, description: 'List of users without password hashes', example: [{ _id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user' }] },
                    { status: 403, description: 'Access denied (non-admin)' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/user/users/:id',
                summary: 'Admin: Get User by ID',
                description: 'Fetches details of a specific user account.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'User profile details', example: { _id: '64a...', username: 'family1', email: 'family1@example.com', role: 'user' } },
                    { status: 404, description: 'User not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users/64a000000000000000000010 \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'DELETE',
                path: '/api/user/users/:id',
                summary: 'Admin: Delete User & Linked Records',
                description: 'Deletes a user, associated caregiver profile, uploaded verification files, and booking appointments.',
                auth: 'Admin (Superuser required to delete another admin)',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID to delete' } },
                responses: [
                    { status: 200, description: 'User removed', example: { msg: 'User removed' } },
                    { status: 403, description: 'Only superuser can remove an admin, or caller is not admin' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/user/users/64a000000000000000000010 \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            }
        ]
    },
    {
        id: 'babysitters',
        name: 'Caregivers & Babysitters',
        basePath: '/api/babysitter',
        description: 'Caregiver directory search, profile registration with verification documents, availability status, and document viewing.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/babysitter',
                summary: 'Search & Filter Caregivers',
                description: 'Public endpoint to discover available, approved caregivers. Never exposes private contact info or national ID cards.',
                auth: 'Public',
                query: {
                    search: { type: 'string', description: 'Filter by caregiver name, bio keywords, or city' },
                    city: { type: 'string', description: 'Exact city match (e.g. Cairo, Alexandria, Giza, Mansoura, Tanta)' },
                    service: { type: 'string', description: 'Required service: "babysitting", "childcare", "cleaning", "cooking"' },
                    minSalary: { type: 'number', description: 'Minimum hourly rate' },
                    maxSalary: { type: 'number', description: 'Maximum hourly rate' },
                    page: { type: 'integer', description: 'Pagination page number (default: 1)' },
                    limit: { type: 'integer', description: 'Results per page (default: 12)' }
                },
                responses: [
                    { status: 200, description: 'List of matching approved caregivers', example: [{ _id: '64a...', name: 'Sarah Ahmed', city: 'Cairo', bio: 'Certified pediatric caregiver...', hourlyRate: 150, currency: 'EGP', services: ['babysitting', 'childcare'], experience: 4, isAvailable: true, averageRating: 4.8, hasProfilePhoto: true }] }
                ],
                exampleCurl: `curl -X GET "https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter?city=Cairo&service=babysitting"`
            },
            {
                method: 'POST',
                path: '/api/babysitter/register',
                summary: 'Register Caregiver Account With Verification',
                description: 'Registers a new caregiver account with required ID proof and criminal record certificate for admin review.',
                auth: 'Public (multipart/form-data)',
                headers: { 'Content-Type': 'multipart/form-data' },
                body: {
                    name: { type: 'string', required: true, description: 'Full legal name' },
                    email: { type: 'string', required: true, description: 'Unique email address' },
                    password: { type: 'string', required: true, description: 'Password (min 8 chars)' },
                    phone: { type: 'string', required: true, description: 'Contact phone number' },
                    nationalId: { type: 'string', required: true, description: 'National Identification Number' },
                    age: { type: 'number', required: true, description: 'Age (must be 18 or older)' },
                    experience: { type: 'number', required: true, description: 'Years of child care experience' },
                    hourlyRate: { type: 'number', required: true, description: 'Requested hourly rate' },
                    currency: { type: 'string', required: true, description: '"EGP", "USD", "EUR", "SAR", "AED"' },
                    city: { type: 'string', required: true, description: 'Primary working city' },
                    services: { type: 'string[]', required: true, description: 'JSON array or comma-separated services' },
                    bio: { type: 'string', required: false, description: 'Personal introduction' },
                    nationalIdCard: { type: 'file (image/pdf)', required: true, description: 'Identity document scan' },
                    criminalRecord: { type: 'file (image/pdf)', required: true, description: 'Criminal background record' },
                    profilePhoto: { type: 'file (image)', required: false, description: 'Public profile picture' }
                },
                responses: [
                    { status: 201, description: 'Caregiver account created and submitted for moderation', example: { token: 'jwt...', user: { id: '64a...', role: 'babysitter' }, babysitter: { id: '64b...', isApproved: false } } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/register \\
  -F "name=Nour Ali" \\
  -F "email=nour@example.com" \\
  -F "password=Password123" \\
  -F "phone=+201001234567" \\
  -F "nationalId=29501011234567" \\
  -F "age=26" \\
  -F "experience=3" \\
  -F "hourlyRate=120" \\
  -F "currency=EGP" \\
  -F "city=Cairo" \\
  -F "services=babysitting,childcare" \\
  -F "nationalIdCard=@/path/to/id.jpg" \\
  -F "criminalRecord=@/path/to/record.pdf"`
            },
            {
                method: 'GET',
                path: '/api/babysitter/profile',
                summary: 'Get Own Caregiver Profile',
                description: 'Retrieves the complete profile of the authenticated caregiver, including approval status and verification indicators.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'x-auth-token': '<jwt_token>' },
                responses: [
                    { status: 200, description: 'Caregiver full profile', example: { profile: { id: '64b...', name: 'Nour Ali', isApproved: true, isAvailable: true, hourlyRate: 120, currency: 'EGP' } } }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile \\
  -H "x-auth-token: YOUR_CAREGIVER_JWT"`
            },
            {
                method: 'PUT',
                path: '/api/babysitter/profile',
                summary: 'Update Caregiver Profile',
                description: 'Updates editable profile fields (hourly rate, bio, services, experience, city).',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
                body: {
                    name: { type: 'string', required: false },
                    bio: { type: 'string', required: false },
                    experience: { type: 'number', required: false },
                    hourlyRate: { type: 'number', required: false },
                    currency: { type: 'string', required: false },
                    city: { type: 'string', required: false },
                    services: { type: 'string[]', required: false }
                },
                responses: [
                    { status: 200, description: 'Profile updated', example: { msg: 'Profile updated successfully' } }
                ],
                exampleCurl: `curl -X PUT https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_CAREGIVER_JWT" \\
  -d '{"hourlyRate":140,"bio":"Updated bio with new certifications"}'`
            },
            {
                method: 'PATCH',
                path: '/api/babysitter/availability',
                summary: 'Toggle Availability Status',
                description: 'Instantly switches the caregiver profile between available (accepting new bookings) and unavailable.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
                body: {
                    isAvailable: { type: 'boolean', required: true, description: 'True to accept bookings, false to pause' }
                },
                responses: [
                    { status: 200, description: 'Availability toggled', example: { isAvailable: false } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/availability \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_CAREGIVER_JWT" \\
  -d '{"isAvailable":true}'`
            },
            {
                method: 'POST',
                path: '/api/babysitter/profile/documents',
                summary: 'Upload/Update Verification Documents',
                description: 'Uploads or replaces ID card, criminal record, or profile photo for verification.',
                auth: 'Authenticated (Caregiver, multipart/form-data)',
                headers: { 'x-auth-token': '<jwt_token>' },
                body: {
                    profilePhoto: { type: 'file (image)', required: false },
                    nationalIdCard: { type: 'file (image/pdf)', required: false },
                    criminalRecord: { type: 'file (image/pdf)', required: false }
                },
                responses: [
                    { status: 200, description: 'Documents uploaded successfully' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/profile/documents \\
  -H "x-auth-token: YOUR_CAREGIVER_JWT" \\
  -F "profilePhoto=@/path/to/new-photo.jpg"`
            },
            {
                method: 'GET',
                path: '/api/babysitter/photo/:id',
                summary: 'Get Public Caregiver Photo',
                description: 'Streams the profile picture of an approved caregiver.',
                auth: 'Public',
                params: { id: { type: 'string', required: true, description: 'Caregiver profile ID' } },
                responses: [
                    { status: 200, description: 'Binary image stream' },
                    { status: 404, description: 'Photo not found' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/photo/64a000000000000000000012`
            },
            {
                method: 'GET',
                path: '/api/babysitter/users/:id',
                summary: 'Get Caregiver Details by ID',
                description: 'Retrieves public caregiver profile. Private contact details are included only if the caller has an active confirmed booking with them.',
                auth: 'Authenticated (Any Role)',
                headers: { 'x-auth-token': '<jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver profile ID' } },
                responses: [
                    { status: 200, description: 'Caregiver profile details', example: { babysitter: { _id: '64a...', name: 'Sarah Ahmed', city: 'Cairo', bio: '...' } } },
                    { status: 404, description: 'Caregiver not found or unapproved' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/users/64a000000000000000000012 \\
  -H "x-auth-token: YOUR_JWT_TOKEN"`
            },
            {
                method: 'PUT',
                path: '/api/babysitter/accept/:id',
                summary: 'Accept Booking Request',
                description: 'Allows a caregiver to accept an assigned booking request.',
                auth: 'Authenticated (Caregiver)',
                headers: { 'x-auth-token': '<jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Booking ID' } },
                responses: [
                    { status: 200, description: 'Booking confirmed', example: { msg: 'Booking accepted successfully', booking: { id: '64c...', status: 'confirmed' } } }
                ],
                exampleCurl: `curl -X PUT https://nodejsbabysitterbookingplatformbackend.onrender.com/api/babysitter/accept/64c000000000000000000020 \\
  -H "x-auth-token: YOUR_CAREGIVER_JWT"`
            }
        ]
    },
    {
        id: 'bookings',
        name: 'Bookings & Scheduling',
        basePath: '/api/bookings',
        description: 'Create appointments, view booking histories, update status (confirm, complete, cancel), and manage sessions.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/bookings',
                summary: 'List Account Bookings',
                description: 'Returns all bookings for the authenticated user. Families see bookings they initiated; caregivers see requests assigned to them.',
                auth: 'Authenticated (Family or Caregiver)',
                headers: { 'x-auth-token': '<jwt_token>' },
                query: {
                    status: { type: 'string', required: false, description: 'Filter by "pending", "confirmed", "completed", "cancelled"' }
                },
                responses: [
                    { status: 200, description: 'List of booking records', example: [{ _id: '64c...', startTime: '2026-11-01T14:00:00Z', endTime: '2026-11-01T18:00:00Z', service: 'babysitting', status: 'confirmed', totalCost: 600, address: '5 El-Gezira St, Zamalek' }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings \\
  -H "x-auth-token: YOUR_JWT_TOKEN"`
            },
            {
                method: 'POST',
                path: '/api/bookings',
                summary: 'Create New Booking',
                description: 'Schedules a booking request with a specified caregiver.',
                auth: 'Authenticated (Family / Regular User Only)',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
                body: {
                    babysitterId: { type: 'string', required: true, description: 'Caregiver profile ID' },
                    startTime: { type: 'string (ISO 8601)', required: true, description: 'Session start timestamp' },
                    endTime: { type: 'string (ISO 8601)', required: true, description: 'Session end timestamp' },
                    service: { type: 'string', required: true, description: '"babysitting", "childcare", "cleaning", "cooking"' },
                    address: { type: 'string', required: true, description: 'Physical service location' },
                    notes: { type: 'string', required: false, description: 'Instructions, child ages, or dietary notes' }
                },
                responses: [
                    { status: 201, description: 'Booking created', example: { msg: 'Booking created successfully', booking: { _id: '64c...', status: 'pending' } } },
                    { status: 400, description: 'Validation error (invalid times or unsupported service)' }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_FAMILY_JWT" \\
  -d '{"babysitterId":"64a000000000000000000012","startTime":"2026-11-01T14:00:00Z","endTime":"2026-11-01T18:00:00Z","service":"babysitting","address":"Zamalek, Cairo"}'`
            },
            {
                method: 'PATCH',
                path: '/api/bookings/:id/status',
                summary: 'Update Booking Status',
                description: 'Transitions booking lifecycle state (confirm, complete, or cancel with optional reason).',
                auth: 'Authenticated (Family or Caregiver involved in booking)',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Booking ID' } },
                body: {
                    status: { type: 'string', required: true, description: '"confirmed", "completed", "cancelled"' },
                    cancellationReason: { type: 'string', required: false, description: 'Required when status is "cancelled"' }
                },
                responses: [
                    { status: 200, description: 'Status updated', example: { msg: 'Status updated successfully', booking: { _id: '64c...', status: 'cancelled' } } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings/64c000000000000000000020/status \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_JWT_TOKEN" \\
  -d '{"status":"cancelled","cancellationReason":"Schedule conflict"}'`
            },
            {
                method: 'DELETE',
                path: '/api/bookings/:id',
                summary: 'Cancel Booking',
                description: 'Cancels an existing booking while preserving the audit record.',
                auth: 'Authenticated (Participant User or Admin)',
                headers: { 'x-auth-token': '<jwt_token>' },
                params: { id: { type: 'string', required: true, description: 'Booking ID' } },
                responses: [
                    { status: 200, description: 'Booking cancelled', example: { msg: 'Booking cancelled successfully' } }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/bookings/64c000000000000000000020 \\
  -H "x-auth-token: YOUR_JWT_TOKEN"`
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
                description: 'Retrieves publicly approved incident warnings. Protects the submitter identity and omits private legal files.',
                auth: 'Public',
                query: {
                    search: { type: 'string', required: false, description: 'Search by reported person name, phone, or ID' }
                },
                responses: [
                    { status: 200, description: 'Approved warnings', example: [{ _id: '64d...', name: 'Reported Caregiver', incidentDescription: 'Brief description...', incidentDate: '2026-09-15', hasPhoto: true }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist`
            },
            {
                method: 'GET',
                path: '/api/blacklist/mine',
                summary: 'List User Submitted Reports',
                description: 'Returns reports submitted by the logged-in family user with current moderation status.',
                auth: 'Authenticated (Regular Family User)',
                headers: { 'x-auth-token': '<jwt_token>' },
                responses: [
                    { status: 200, description: 'User submissions', example: [{ _id: '64d...', name: 'Reported Person', status: 'pending', incidentDate: '2026-09-15' }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/mine \\
  -H "x-auth-token: YOUR_FAMILY_JWT"`
            },
            {
                method: 'POST',
                path: '/api/blacklist',
                summary: 'Submit Incident Report',
                description: 'Files a safety misconduct report with incident details and optional proof documents for admin review.',
                auth: 'Authenticated (Regular Family User, multipart/form-data)',
                headers: { 'x-auth-token': '<jwt_token>' },
                body: {
                    name: { type: 'string', required: true, description: 'Reported person name' },
                    nationalId: { type: 'string', required: true, description: 'National ID number' },
                    incidentDescription: { type: 'string', required: true, description: 'Detailed factual description of incident' },
                    incidentDate: { type: 'string (YYYY-MM-DD)', required: true, description: 'Date incident occurred' },
                    phone: { type: 'string', required: false, description: 'Phone number' },
                    photo: { type: 'file (image)', required: false, description: 'Photograph of reported person' },
                    documents: { type: 'file[] (up to 5)', required: false, description: 'Evidence files (police reports, messages, receipts)' }
                },
                responses: [
                    { status: 201, description: 'Report submitted and queued for review', example: { msg: 'Report submitted successfully and is pending administrative review', report: { _id: '64d...', status: 'pending' } } }
                ],
                exampleCurl: `curl -X POST https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist \\
  -H "x-auth-token: YOUR_FAMILY_JWT" \\
  -F "name=Jane Doe" \\
  -F "nationalId=29001011234567" \\
  -F "incidentDescription=Caregiver abandoned child unattended for 3 hours." \\
  -F "incidentDate=2026-10-01"`
            },
            {
                method: 'GET',
                path: '/api/blacklist/:id/photo',
                summary: 'View Approved Report Photo',
                description: 'Public endpoint to view the photo attached to an approved warning.',
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
                headers: { 'x-auth-token': '<admin_jwt>' },
                responses: [
                    { status: 200, description: 'Pending reports list', example: [{ _id: '64d...', name: 'Jane Doe', nationalId: '2900...', status: 'pending', submitter: { id: '...', username: '...' } }] }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/review \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'PATCH',
                path: '/api/blacklist/admin/:id/review',
                summary: 'Admin: Approve / Reject Report',
                description: 'Updates a report status to approved (making it public) or rejected with internal notes.',
                auth: 'Admin Only',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                body: {
                    status: { type: 'string', required: true, description: '"approved" or "rejected"' },
                    reviewNotes: { type: 'string', required: false, description: 'Administrative justification notes' }
                },
                responses: [
                    { status: 200, description: 'Review status saved', example: { msg: 'Report status updated', report: { _id: '64d...', status: 'approved' } } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030/review \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_ADMIN_JWT" \\
  -d '{"status":"approved","reviewNotes":"Police report verified"}'`
            },
            {
                method: 'DELETE',
                path: '/api/blacklist/admin/:id',
                summary: 'Admin: Delete Report',
                description: 'Permanently deletes an incident report and purges all attached evidence files.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Report ID' } },
                responses: [
                    { status: 200, description: 'Report deleted', example: { msg: 'Report deleted successfully' } }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030 \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/blacklist/admin/:id/documents/:index',
                summary: 'Admin: View Report Evidence Document',
                description: 'Streams the uploaded evidence document (police complaint, photo, etc.) for administrative verification.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: {
                    id: { type: 'string', required: true, description: 'Report ID' },
                    index: { type: 'integer', required: true, description: '0-based index of document' }
                },
                responses: [
                    { status: 200, description: 'Binary file stream' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/blacklist/admin/64d000000000000000000030/documents/0 \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            }
        ]
    },
    {
        id: 'admin',
        name: 'Platform Administration & Moderation',
        basePath: '/api/admin',
        description: 'Comprehensive administrative oversight: user management, caregiver document verification, account deletion, and platform analytics.',
        endpoints: [
            {
                method: 'GET',
                path: '/api/admin/users',
                summary: 'List All Registered Users',
                description: 'Administrative listing of all users across regular, caregiver, and admin roles with search and pagination.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
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
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/users/:id/details',
                summary: 'Get Detailed Account Dossier',
                description: 'Returns deep profile data for a specific user, including associated bookings, caregiver profiles, and moderation flags.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'Comprehensive account details', example: { user: { _id: '64a...', username: 'family1' }, bookings: [{ _id: '64c...', status: 'confirmed' }] } }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/users/64a000000000000000000010/details \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'DELETE',
                path: '/api/admin/users/:id',
                summary: 'Superadmin: Delete User Account',
                description: 'Permanently deletes a user account and associated profile records. Restricted to the superadmin.',
                auth: 'Superadmin Only',
                headers: { 'x-auth-token': '<superadmin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'User ID' } },
                responses: [
                    { status: 200, description: 'Account deleted', example: { msg: 'User account deleted successfully' } },
                    { status: 403, description: 'Forbidden (regular admins cannot delete accounts)' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/users/64a000000000000000000010 \\
  -H "x-auth-token: YOUR_SUPERADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters',
                summary: 'List Caregivers For Moderation',
                description: 'Lists all registered caregivers with verification status and indicators for attached legal documents.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                query: {
                    status: { type: 'string', required: false, description: '"pending", "approved", or "rejected"' },
                    search: { type: 'string', required: false, description: 'Search by caregiver name, city, or email' }
                },
                responses: [
                    { status: 200, description: 'Caregiver moderation list', example: [{ _id: '64b...', name: 'Sarah Ahmed', city: 'Cairo', isApproved: false, documents: { nationalIdCard: true, criminalRecord: true } }] }
                ],
                exampleCurl: `curl -X GET "https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters?status=pending" \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'PATCH',
                path: '/api/admin/babysitters/:id/moderation',
                summary: 'Moderate Caregiver Profile',
                description: 'Approve or reject a caregiver profile, enabling them to appear in public searches and accept bookings.',
                auth: 'Admin Only',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                body: {
                    isApproved: { type: 'boolean', required: true, description: 'True to approve, false to reject' },
                    notes: { type: 'string', required: false, description: 'Moderator notes or rejection reason' }
                },
                responses: [
                    { status: 200, description: 'Moderation status updated', example: { msg: 'Caregiver moderation status updated', babysitter: { _id: '64b...', isApproved: true } } }
                ],
                exampleCurl: `curl -X PATCH https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/moderation \\
  -H "Content-Type: application/json" \\
  -H "x-auth-token: YOUR_ADMIN_JWT" \\
  -d '{"isApproved":true,"notes":"Verified against official records"}'`
            },
            {
                method: 'DELETE',
                path: '/api/admin/babysitters/:id',
                summary: 'Superadmin: Delete Caregiver Profile',
                description: 'Permanently removes a caregiver profile and associated files from the platform.',
                auth: 'Superadmin Only',
                headers: { 'x-auth-token': '<superadmin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'Profile removed', example: { msg: 'Caregiver profile deleted successfully' } },
                    { status: 403, description: 'Forbidden (regular admins cannot delete profiles)' }
                ],
                exampleCurl: `curl -X DELETE https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012 \\
  -H "x-auth-token: YOUR_SUPERADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters/:id/documents/:kind',
                summary: 'Admin: View Caregiver Legal Document',
                description: 'Securely downloads or views confidential verification documents (national ID card or criminal background certificate).',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: {
                    id: { type: 'string', required: true, description: 'Caregiver Profile ID' },
                    kind: { type: 'string', required: true, description: '"nationalIdCard" or "criminalRecord"' }
                },
                responses: [
                    { status: 200, description: 'Binary file stream' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/documents/nationalIdCard \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
            },
            {
                method: 'GET',
                path: '/api/admin/babysitters/:id/photo',
                summary: 'Admin: View Caregiver Profile Photo',
                description: 'Retrieves the profile picture of any caregiver during moderation.',
                auth: 'Admin Only',
                headers: { 'x-auth-token': '<admin_jwt>' },
                params: { id: { type: 'string', required: true, description: 'Caregiver Profile ID' } },
                responses: [
                    { status: 200, description: 'Binary image stream' }
                ],
                exampleCurl: `curl -X GET https://nodejsbabysitterbookingplatformbackend.onrender.com/api/admin/babysitters/64b000000000000000000012/photo \\
  -H "x-auth-token: YOUR_ADMIN_JWT"`
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
