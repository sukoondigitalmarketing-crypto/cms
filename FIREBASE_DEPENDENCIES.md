# Firebase Dependencies in CMS Application

## 📦 NPM Packages (package.json)
```json
"firebase": "^12.11.0",
"firebase-admin": "^13.7.0"
```

---

## 🔥 Firebase Modules Currently in Use

### 1. **Authentication (Firebase Auth)**
- **Location**: `src/firebase.ts`, `src/components/FirebaseProvider.tsx`
- **Imports**:
  ```typescript
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, 
           signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
  ```
- **Usage**:
  - User login (Email/Password)
  - User registration
  - Google Sign-In
  - Session management
  - Auth state tracking (`onAuthStateChanged`)

### 2. **Firestore Database**
- **Location**: `src/App.tsx`, `src/firebase.ts`, `src/services/authService.ts`
- **Imports**:
  ```typescript
  import { getFirestore, collection, doc, getDoc, getDocs, setDoc, 
           updateDoc, onSnapshot, query, where, addDoc, serverTimestamp, 
           deleteDoc, getDocFromServer } from 'firebase/firestore';
  ```

---

## 📊 Data Collections Still Using Firestore

### ✅ **Migrated to SQL** (No longer using Firestore):
1. ✅ **Projects** - Migrated to MySQL `projects` table
2. ✅ **Inventory** - Migrated to MySQL `inventory` table
3. ✅ **Material Issues** - Migrated to MySQL `material_issues` table

### ❌ **Still Using Firestore** (Need Migration):

#### 1. **Users Collection** (`users`)
- **Location**: `src/App.tsx` (lines 60-120)
- **Operations**:
  - `getDoc(doc(db, 'users', user.uid))` - Fetch user role on login
  - `setDoc(doc(db, 'users', user.uid), newUser)` - Create new user
  - `onSnapshot(collection(db, 'users'))` - Real-time user list (CEO dashboard)
- **Used By**: 
  - Login system (role verification)
  - CEO User Management module
  - Auth service (`src/services/authService.ts`)

#### 2. **Approvals Collection** (`approvals`)
- **Location**: `src/App.tsx` (ApprovalsDashboard component, lines 910-1100)
- **Operations**:
  - `onSnapshot(query(collection(db, 'approvals')))` - Real-time approval tracking
  - `addDoc(collection(db, 'approvals'), newApproval)` - Create approval request
  - `updateDoc(doc(db, 'approvals', id))` - Approve/Reject requests
- **Used By**:
  - Executive (raise approval requests)
  - Store Keeper (raise approval requests)
  - General Manager (approve/reject pending requests)
  - CEO (view all approvals)

#### 3. **Customers Collection** (`customers`)
- **Location**: `src/App.tsx` (SalesDashboard component, lines 1100-1400)
- **Operations**:
  - `onSnapshot(query(collection(db, 'customers')))` - Real-time customer tracking
  - `addDoc(collection(db, 'customers'), newCustomer)` - Add new customer
  - `updateDoc(doc(db, 'customers', id))` - Update payment received
  - `getDocs(query(collection(db, 'customers')))` - Fetch for finance dashboard
- **Used By**:
  - Sales Manager (customer management)
  - CEO (view customers)
  - General Manager (view customers & finance dashboard)

#### 4. **Ledger Entries Collection** (`ledgerEntries`)
- **Location**: `src/App.tsx` (SalesDashboard component, lines 1100-1400)
- **Operations**:
  - `onSnapshot(query(collection(db, 'ledgerEntries')))` - Real-time payment tracking
  - `addDoc(collection(db, 'ledgerEntries'), newEntry)` - Record payment
  - `getDocs(query(collection(db, 'ledgerEntries')))` - Fetch for finance dashboard
- **Used By**:
  - Sales Manager (record payments)
  - CEO (view ledger)
  - General Manager (view ledger & finance dashboard)

---

## 🔧 Firebase Configuration Files

1. **firebase-applet-config.json** - Firebase project credentials
2. **firebase-blueprint.json** - Firebase project blueprint
3. **firestore.rules** - Firestore security rules
4. **src/firebase.ts** - Firebase initialization
5. **src/components/FirebaseProvider.tsx** - Auth context provider

---

## 🛠️ Supporting Files Using Firebase

1. **src/lib/firestore-errors.ts** - Error handling for Firestore operations
2. **src/services/authService.ts** - User role verification from Firestore
3. **src/services/validation.ts** - Form validation (no direct Firebase dependency)
4. **src/services/errorHandler.ts** - Error formatting (no direct Firebase dependency)

---

## 📋 Migration Priority (Recommended Order)

### High Priority (Core Authentication):
1. **Users Collection** → SQL `users` table
   - Critical for login and role management
   - Blocks complete Firebase removal

### Medium Priority (Business Logic):
2. **Approvals Collection** → SQL `approvals` table
   - Used by Executive, Store Keeper, General Manager, CEO
   - Important for workflow management

3. **Customers Collection** → SQL `customers` table
   - Used by Sales Manager, CEO, General Manager
   - Important for revenue tracking

4. **Ledger Entries Collection** → SQL `ledger_entries` table
   - Used by Sales Manager, CEO, General Manager
   - Linked to customers table

---

## 🎯 Complete Firebase Removal Checklist

- [ ] Migrate `users` collection to SQL
- [ ] Migrate `approvals` collection to SQL
- [ ] Migrate `customers` collection to SQL
- [ ] Migrate `ledgerEntries` collection to SQL
- [ ] Replace Firebase Auth with custom JWT auth or alternative
- [ ] Remove `firebase` and `firebase-admin` from package.json
- [ ] Delete `src/firebase.ts`
- [ ] Delete `src/components/FirebaseProvider.tsx`
- [ ] Delete `src/lib/firestore-errors.ts`
- [ ] Update `src/services/authService.ts` to use SQL
- [ ] Remove Firebase config files
- [ ] Update all `onSnapshot` listeners to SQL polling
- [ ] Test all user roles and features

---

## ⚠️ Important Notes

1. **Authentication**: Firebase Auth is deeply integrated. Replacing it requires:
   - Custom JWT token system
   - Session management
   - Password hashing (bcrypt)
   - Email verification system

2. **Real-time Updates**: Firestore's `onSnapshot` provides real-time data. SQL alternative:
   - Polling (current approach - every 5 seconds)
   - WebSockets (better performance)
   - Server-Sent Events (SSE)

3. **Security**: Firestore Rules need to be replaced with:
   - Backend API authentication middleware
   - Role-based access control (RBAC) in Express
   - Input validation and sanitization

---

## 📊 Current Status Summary

| Module | Data Source | Status |
|--------|-------------|--------|
| Projects | SQL | ✅ Migrated |
| Inventory | SQL | ✅ Migrated |
| Material Issues | SQL | ✅ Migrated |
| Users | Firestore | ❌ Pending |
| Approvals | Firestore | ❌ Pending |
| Customers | Firestore | ❌ Pending |
| Ledger Entries | Firestore | ❌ Pending |
| Authentication | Firebase Auth | ❌ Pending |

**Progress**: 3/8 modules migrated (37.5%)
