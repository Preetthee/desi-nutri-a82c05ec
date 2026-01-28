

## Authentication Settings Section

### Overview
Adding a new "Authentication" section to the Settings page with Google sign-in integration. This will allow users who signed up with email to link their Google account, and show connected accounts status.

**Important Note**: Currently, only **Google** OAuth is supported by the backend. Facebook, GitHub, and other social providers are not yet available.

### What You'll Get

1. **New "Authentication" section in Settings** - A dedicated card showing:
   - Current sign-in method (Email or Google)
   - Google account linking option for email users
   - Connected accounts status with visual indicators

2. **Google Account Linking** - Email users can:
   - Click "Link Google Account" to connect their Google identity
   - See their linked Google account with ability to unlink
   - Use Google for faster sign-in after linking

3. **Visual Design** - Consistent with existing settings:
   - Clean card layout with icons
   - Green checkmark for linked accounts
   - Clear "Link" / "Linked" status buttons

---

### Technical Implementation

#### Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add `signInWithGoogle` and `linkGoogleAccount` methods |
| `src/pages/Settings.tsx` | Add new "Authentication" section with Google linking UI |
| `src/contexts/LanguageContext.tsx` | Add translation keys for authentication section |
| `src/pages/Auth.tsx` | Add optional "Sign in with Google" button |

#### 1. Update AuthContext (`src/contexts/AuthContext.tsx`)

Add new methods to the context:

```typescript
interface AuthContextType {
  // ... existing
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  linkGoogleAccount: () => Promise<{ error: Error | null }>;
  getLinkedIdentities: () => { provider: string; identity_id: string }[];
}
```

Implementation:
```typescript
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  return { error: error as Error | null };
};

const linkGoogleAccount = async () => {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/settings`,
    },
  });
  return { error: error as Error | null };
};

const getLinkedIdentities = () => {
  return user?.identities || [];
};
```

#### 2. Add Authentication Section to Settings (`src/pages/Settings.tsx`)

New component section between "AI Configuration" and "Logout":

```text
+------------------------------------------+
|  Authentication                          |
+------------------------------------------+
|  🔗 Sign-in Method                       |
|     Email (your@email.com)               |
|                                          |
|  [Google icon] Google          [Link]    |
|                                          |
|  Note: Link your Google account for      |
|  faster sign-in options                  |
+------------------------------------------+
```

Features:
- Show current authentication method (email or Google)
- Display Google linking button for email users
- Show "Linked" status with checkmark if already connected
- Handle OAuth redirect back to settings page

#### 3. Add Translations (`src/contexts/LanguageContext.tsx`)

New translation keys:

```typescript
// English
'settings.authentication': 'Authentication',
'settings.signInMethod': 'Sign-in Method',
'settings.linkedAccounts': 'Linked Accounts',
'settings.linkGoogle': 'Link Google',
'settings.linked': 'Linked',
'settings.linkAccount': 'Link your accounts for faster sign-in',
'settings.unlinkGoogle': 'Unlink',

// Bengali
'settings.authentication': 'প্রমাণীকরণ',
'settings.signInMethod': 'সাইন-ইন পদ্ধতি',
'settings.linkedAccounts': 'সংযুক্ত অ্যাকাউন্ট',
'settings.linkGoogle': 'গুগল সংযুক্ত করুন',
'settings.linked': 'সংযুক্ত',
'settings.linkAccount': 'দ্রুত সাইন-ইনের জন্য আপনার অ্যাকাউন্ট সংযুক্ত করুন',
'settings.unlinkGoogle': 'সংযোগ বিচ্ছিন্ন',
```

#### 4. Optional: Add Google Sign-in to Auth Page (`src/pages/Auth.tsx`)

Add a "Continue with Google" button as an alternative sign-in method:

```text
+------------------------------------------+
|  [Email & Password Form]                 |
|                                          |
|  ─────────── or ───────────              |
|                                          |
|  [G] Continue with Google                |
+------------------------------------------+
```

---

### User Experience Flow

**For Email Users Linking Google:**
1. User goes to Settings
2. Sees "Authentication" section
3. Clicks "Link Google" button
4. Redirected to Google OAuth consent
5. Returns to Settings with Google linked
6. Sees green checkmark next to Google

**For New Users:**
1. On Auth page, can choose "Continue with Google"
2. Or use traditional email/password signup
3. Either way, can link other methods later in Settings

---

### Backend Configuration Required

Before the Google OAuth will work, you need to configure it in Lovable Cloud:

1. Create OAuth credentials in Google Cloud Console
2. Add authorized redirect URLs
3. Configure in Lovable Cloud dashboard (Authentication Settings)

When you approve this plan, I'll provide a button to open the backend configuration.

---

### Future Expansion

When additional OAuth providers become available (Facebook, GitHub, etc.), the architecture will be ready to support them with minimal changes - just add new provider buttons to the Authentication section.

