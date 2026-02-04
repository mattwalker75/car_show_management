# Car Show Manager - User Roles and Workflows

This document explains the five user roles and their workflows within the Car Show Manager application.

---

## Role Overview

| Role | Purpose | Key Capabilities |
|------|---------|------------------|
| **Admin** | Full system control | All capabilities, user management, configuration |
| **Registrar** | Check-in and registration | Register vehicles, manage check-ins, view all cars |
| **Judge** | Score vehicles | View assigned vehicles, submit scores |
| **Vendor** | Sell products/services | Manage business profile, list products |
| **User** | Attendee/Contestant | Register vehicles, view results, participate in specialty votes |

---

## Admin Role

Admins have complete control over the system and can access all features.

### Capabilities
- **User Management**: Create, edit, delete users; assign roles
- **Vehicle Management**: View, edit, delete all registered vehicles
- **Class Management**: Create and manage vehicle classes
- **Voting Configuration**: Open/close judge and specialty voting
- **Judge Questions**: Create scoring criteria for judges
- **Specialty Votes**: Create custom votes (People's Choice, Best Paint, etc.)
- **Results Management**: View scores, publish results
- **Vendor Management**: Enable/disable vendor accounts and products
- **Chat Management**: Enable chat for users, block/unblock users from chat
- **System Configuration**: App title, backgrounds, scoring ranges

### Navigation
- Dashboard (summary view)
- Vehicles (manage all vehicles)
- Classes (manage vehicle classes)
- Users (manage all users)
- Voting (judge questions, specialty votes, results)
- Vendors (manage vendor accounts)
- Config (system settings)
- Chat (group chat, if enabled)

---

## Registrar Role

Registrars handle vehicle check-in and registration at the event.

### Capabilities
- **Vehicle Registration**: Register new vehicles on behalf of attendees
- **Check-In**: Mark vehicles as checked in when they arrive
- **Vehicle Lookup**: Search and view all registered vehicles
- **Print Materials**: Access registration receipts and vehicle cards
- **Browse Vendors**: View active vendor listings

### Typical Workflow

1. **Pre-Event Setup**
   - Review registered vehicles
   - Prepare check-in station

2. **Day of Event - Check-In**
   - Attendee arrives with their vehicle
   - Search for pre-registered vehicle OR register new vehicle
   - Verify vehicle information
   - Collect registration fee (if applicable)
   - Mark vehicle as "Checked In"
   - Provide any printed materials (number card, receipt)

3. **During Event**
   - Handle late registrations
   - Assist with vehicle information updates
   - Direct attendees to appropriate areas

### Navigation
- Dashboard
- Vehicles (register, search, check-in)
- Vendors (browse vendor listings)
- Chat (if enabled)

---

## Judge Role

Judges score vehicles based on configured criteria.

### Capabilities
- **View Assigned Vehicles**: See vehicles assigned for scoring
- **Submit Scores**: Rate vehicles on each judging question
- **View Criteria**: See scoring questions and score ranges
- **Browse Vendors**: View active vendor listings

### Typical Workflow

1. **Pre-Judging**
   - Log in and review assigned vehicles
   - Review scoring criteria and point ranges
   - Wait for Admin to open judge voting

2. **Active Judging**
   - Select a vehicle from the assigned list
   - Walk to the physical vehicle location
   - Evaluate the vehicle based on criteria
   - Submit scores for each question
   - Move to next vehicle
   - Repeat until all vehicles scored

3. **Post-Judging**
   - Verify all assigned vehicles have been scored
   - Notify Admin when complete

### Scoring Interface
- Each vehicle shows all judging questions
- Judges enter a score for each question (within configured min/max range)
- Scores are saved immediately
- Progress indicator shows completion status

### Navigation
- Dashboard
- Scoring (view and score assigned vehicles)
- Vendors (browse vendor listings)
- Chat (if enabled)

---

## Vendor Role

Vendors are businesses that sell products/services or provide information at the event.

### Capabilities
- **Business Profile**: Create and edit business information
- **Product Listings**: Add, edit, deactivate products
- **View Other Vendors**: Browse other vendor listings
- **Pricing Options**: Set regular and discount prices

### Typical Workflow

1. **Initial Setup**
   - Log in to vendor account
   - Complete business profile (name, description, contact info)
   - Upload business logo/image
   - Add products/services with descriptions and pricing

2. **Day of Event**
   - Verify business profile is accurate
   - Ensure products are marked as active
   - Check discount pricing if running specials

3. **Post-Event**
   - Deactivate sold-out products
   - Update inventory/availability

### Business Profile Fields
- Business Name
- Description
- Contact Information
- Logo/Image
- Location at Event

### Product Fields
- Product Name
- Description
- Regular Price
- Discount Price (optional)
- Product Image
- Active/Inactive Status

### Navigation
- Dashboard
- My Business (edit profile)
- My Products (manage listings)
- Browse Vendors (view other vendors)
- Chat (if enabled)

---

## User Role

Users are event attendees or car show contestants.

### Capabilities
- **Vehicle Registration**: Register their own vehicles
- **View Results**: See published scoring results
- **Specialty Voting**: Participate in allowed specialty votes
- **Browse Vendors**: View active vendor listings
- **Profile Management**: Update personal information

### Typical Workflow

#### Pre-Event (Vehicle Registration)

1. **Create Account**
   - Register on the website with email and password
   - Complete profile information

2. **Register Vehicle(s)**
   - Click "Register Vehicle"
   - Select vehicle type (if multiple types configured)
   - Enter vehicle details:
     - Year, Make, Model
     - Color
     - Any special features or notes
   - Upload vehicle photo
   - Select vehicle class (if applicable)
   - Submit registration
   - Pay registration fee (if applicable)

3. **Pre-Event Confirmation**
   - Review registered vehicles
   - Make any corrections before cutoff

#### Day of Event

1. **Check-In**
   - Arrive at event with vehicle
   - Proceed to registration/check-in area
   - Registrar marks vehicle as checked in

2. **Participate**
   - Display vehicle in assigned location
   - Browse other vehicles
   - Browse vendor booths

3. **Specialty Voting** (if enabled)
   - View available specialty votes
   - Cast votes for favorite vehicles
   - Examples:
     - **People's Choice**: Vote for your favorite car overall
     - **Best Paint**: Vote for best paint job
     - **Ugliest Car**: Vote for the "lovably ugly" vehicle
     - **Best Interior**: Vote for best interior design

4. **View Results** (when published)
   - Check dashboard for published results
   - View class winners
   - View specialty vote winners

### Vehicle Classes
Vehicles are organized into classes for fair judging:
- Classes are defined by Admin (e.g., "Classic", "Muscle", "Import", "Truck")
- Each vehicle is assigned to one class
- Scoring and awards are typically per-class

### Navigation
- Dashboard (overview, quick actions)
- My Vehicles (register, view, edit)
- Results (view published results)
- Vendors (browse vendor listings)
- Chat (if enabled)

---

## Group Chat

All roles can access group chat if:
1. Chat is enabled globally by Admin (`chatEnabled: true`)
2. User has chat enabled on their account

### Chat Features
- Real-time messaging via Socket.io
- Online user presence (active/away status)
- Message history with pagination
- Admin moderation (block/unblock users)
- Rate limiting (500ms between messages)
- 250 character message limit
- Profanity filtering

### Chat Moderation (Admin Only)
- View blocked status of users
- Block users from posting (read-only mode)
- Unblock users to restore posting ability
- Blocked users can still read messages

---

## Role Assignment

### Initial Setup
- The first user to register becomes Admin
- Subsequent users register as "User" role by default

### Changing Roles
- Only Admins can change user roles
- Navigate to Admin → Users
- Select user and change role
- Changes take effect on user's next login

### Role Recommendations

| Person | Recommended Role |
|--------|------------------|
| Event Organizer | Admin |
| Registration Staff | Registrar |
| Scoring Panel Members | Judge |
| Booth/Product Sellers | Vendor |
| Car Owners / Attendees | User |
