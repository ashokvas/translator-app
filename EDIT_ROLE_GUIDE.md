# How to Set Yourself as Admin in Convex Dashboard

## Step-by-Step Instructions

### Step 1: Find Your User Record

1. In the Convex Dashboard, you should see the **users** table
2. Look for your user record - you can identify it by:
   - Your email address (in the `email` column)
   - Your Clerk ID (in the `clerkId` column)

### Step 2: Edit the Record

**Method A: Click on the Row**
1. **Click directly on your user's row** in the table
2. This should open an edit panel or modal on the right side
3. Look for the `role` field

**Method B: Use the Edit Button**
1. Find your user row
2. Look for an **Edit** button or **pencil icon** (usually at the end of the row)
3. Click it to open the edit view

**Method C: Double-Click the Role Field**
1. Find the `role` column in your user's row
2. **Double-click** on the `role` value (which should say `"user"`)
3. This should make it editable

### Step 3: Change the Role Value

1. Once you can edit the `role` field, you'll see it's currently set to `"user"`
2. **Change it to `"admin"`** (make sure to include the quotes if it's a string field)
3. The exact format depends on how Convex displays it:
   - If it shows: `user` → change to: `admin`
   - If it shows: `"user"` → change to: `"admin"`
   - If it's a dropdown → select `admin` from the dropdown

### Step 4: Save the Changes

1. Look for a **Save** button (usually at the bottom of the edit panel)
2. Or press **Enter** if you're editing inline
3. The changes should be saved automatically

### Step 5: Verify

1. Check that the `role` field now shows `admin` (or `"admin"`)
2. Refresh your Next.js app browser tab
3. You should be redirected to `/admin` dashboard

## Visual Guide

```
Convex Dashboard → Data → Tables → users

┌─────────────────────────────────────────────────┐
│ users table                                      │
├─────────────┬──────────────┬─────────┬──────────┤
│ clerkId     │ email        │ role    │ name     │
├─────────────┼──────────────┼─────────┼──────────┤
│ user_xxx    │ your@email   │ "user"  │ YourName │ ← Click here
└─────────────┴──────────────┴─────────┴──────────┘
                    ↑
              Double-click or click to edit
```

## Alternative: Using the Functions Tab

If editing directly doesn't work, you can use the mutation function:

1. Go to **Functions** tab in Convex Dashboard
2. Find `adminSetup:makeAdminByEmail`
3. Click **Run** or **Test**
4. Enter your email in the arguments:
   ```json
   {
     "email": "your-email@example.com"
   }
   ```
5. Click **Run**
6. You should see a success message

## Troubleshooting

### Can't find the edit button?
- Try clicking directly on the row
- Look for a pencil icon (✏️) or edit icon
- Some views show an "Edit" button when you hover over the row

### Role field is not editable?
- Make sure you're clicking on the correct field
- Try double-clicking the `role` value
- Check if there's a lock icon - you might need admin access (chicken and egg problem!)

### If you can't edit at all:
Use the **Functions** method instead:
1. Go to **Functions** → `adminSetup:makeAdminByEmail`
2. Run it with your email

### Still having issues?
You can also manually insert/update via the Convex dashboard's data editor:
1. Look for an "Add" or "Insert" button
2. Or use the query editor to run:
   ```javascript
   // This is just an example - actual syntax may vary
   db.users.update({email: "your@email.com"}, {role: "admin"})
   ```

## Quick Checklist

- [ ] Found your user record in the users table
- [ ] Clicked on the row or edit button
- [ ] Changed `role` from `"user"` to `"admin"`
- [ ] Saved the changes
- [ ] Refreshed your Next.js app
- [ ] Verified you're redirected to `/admin`

