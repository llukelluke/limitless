# Limitless API Contract

## User Interface Module

---

## GET /api/users
Returns all users.

**Response 200 OK:**
```json
[
  {
    "id": 3,
    "username": "jlawson0926",
    "first_name": "Jason",
    "status": "ACTIVATED"
  }
]
```

**Error Responses**\
**Response 401 Unauthorized:**\
*Returned when a request is made from a user who lacks valid authentication credentials.*
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**\
*Returned when the server understands the request but refuses to authorize it. Only administrators can list all users.*
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```

---

## GET /api/users/{id}
Returns the full details for a specified user.

**URL Parameters**
* `id` (integer, required): The unique identifier of the user

**Response 200 OK:**
```json
{
  "id": 3,
  "created_by": 1,
  "created_at": "2026-09-15T00:00:00Z",
  "username": "jlawson0926",
  "first_name": "Jason",
  "last_name": "Lawson",
  "home_address": "3212 Example St SW, Atlanta, GA 30033",
  "birth_date": "2000-01-01"
}
```

**Error Responses**\
**Response 401 Unauthorized:**\
*Returned when a request is made from a user who lacks valid authentication credentials.*
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**\
*Returned when the server understands the request but refuses to authorize it.*
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**\
*Returned when the specified user is not found in the database*
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## POST /api/users
Creates a new user and assigns a role. Administrator only. *(Sprint item 2)*

**Request Body:**
```json
{
  "first_name": "Jason",
  "last_name": "Lawson",
  "home_address": "3212 Example St SW, Atlanta, GA 30033",
  "birth_date": "2000-01-01",
  "email_address": "jlawson@example.com",
  "role": "ACCOUNTANT"
}
```

**Response 201 Created:**\
*Username is system-generated as first-initial + last name + two-digit month + two-digit year of account creation.*
```json
{
  "id": 7,
  "username": "jlawson0926",
  "status": "PENDING",
  "role": "ACCOUNTANT"
}
```

**Error Responses**\
**Response 400 Bad Request:**\
*Returned when required fields are missing or malformed.*
```json
{
  "error": "Bad Request",
  "message": "First name, last name, and email address are required."
}
```
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 409 Conflict:**\
*Returned when the email address is already registered to another user.*
```json
{
  "error": "Conflict",
  "message": "A user with this email address already exists."
}
```

---

## PUT /api/users/{id}
Updates information for an existing user. Administrator only. *(Sprint item 3)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the user

**Request Body:**
```json
{
  "first_name": "Jason",
  "last_name": "Lawson",
  "home_address": "3212 Example St SW, Atlanta, GA 30033",
  "email_address": "jlawson@example.com",
  "role": "MANAGER"
}
```

**Response 200 OK:**
```json
{
  "id": 7,
  "username": "jlawson0926",
  "first_name": "Jason",
  "last_name": "Lawson",
  "role": "MANAGER"
}
```

**Error Responses**\
**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "One or more fields are invalid."
}
```
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## PUT /api/users/{id}/activate
Activates a user account. Administrator only. *(Sprint item 4)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the user

**Response 200 OK:**
```json
{
  "id": 7,
  "status": "ACTIVATED"
}
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## PUT /api/users/{id}/deactivate
Deactivates a user account. Administrator only. *(Sprint item 4)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the user

**Response 200 OK:**
```json
{
  "id": 7,
  "status": "DEACTIVATED"
}
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## PUT /api/users/{id}/suspend
Suspends a user for a specified date range, e.g. for extended leave. Administrator only. *(Sprint item 17)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the user

**Request Body:**
```json
{
  "suspension_start": "2026-10-01",
  "suspension_end": "2026-10-15"
}
```

**Response 200 OK:**
```json
{
  "id": 7,
  "status": "SUSPENDED",
  "suspension_start": "2026-10-01",
  "suspension_end": "2026-10-15"
}
```

**Error Responses**\
**Response 400 Bad Request:**\
*Returned when suspension_end is before suspension_start, or dates are missing.*
```json
{
  "error": "Bad Request",
  "message": "Suspension end date must be after the start date."
}
```
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## POST /api/auth/login
Authenticates a user with username and password. *(Sprint items 1, 5, 13)*

**Request Body:**
```json
{
  "username": "jlawson0926",
  "password": "ExamplePass1!"
}
```

**Response 200 OK:**
```json
{
  "id": 7,
  "username": "jlawson0926",
  "picture": "/images/users/7.png",
  "role": "ACCOUNTANT"
}
```

**Error Responses**\
**Response 401 Unauthorized:**\
*Returned for an invalid username/password combination. The same message is used whether the username exists or not, so attackers can't tell which usernames are valid.*
```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password."
}
```
**Response 403 Forbidden:**\
*Returned when the account is suspended or deactivated.*
```json
{
  "error": "Forbidden",
  "message": "This account is suspended."
}
```
**Response 429 Too Many Requests:**\
*Returned on the attempt that pushes the user over the 3 failed-login limit; the account is suspended as a result.*
```json
{
  "error": "Too Many Requests",
  "message": "Account suspended after 3 failed login attempts."
}
```

---

## POST /api/auth/access-requests
Submits a request for first-time system access. *(Sprint item 8)*

**Request Body:**
```json
{
  "first_name": "Jason",
  "last_name": "Lawson",
  "home_address": "3212 Example St SW, Atlanta, GA 30033",
  "birth_date": "2000-01-01",
  "email_address": "jlawson@example.com"
}
```

**Response 201 Created:**\
*Triggers an email notification to the administrator for review.*
```json
{
  "id": 12,
  "status": "PENDING"
}
```

**Error Responses**\
**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "First name, last name, and email address are required."
}
```
**Response 409 Conflict:**
```json
{
  "error": "Conflict",
  "message": "A user with this email address already exists."
}
```

---

## PUT /api/auth/access-requests/{id}/approve
Approves a pending access request and emails the new user a login link. Administrator only. *(Sprint item 8)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the pending user

**Response 200 OK:**
```json
{
  "id": 12,
  "username": "jlawson0926",
  "status": "ACTIVATED"
}
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Access request doesn't exist"
}
```

---

## PUT /api/auth/access-requests/{id}/reject
Rejects a pending access request. Administrator only. *(Sprint item 8)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the pending user

**Response 200 OK:**
```json
{
  "id": 12,
  "status": "DEACTIVATED"
}
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Access request doesn't exist"
}
```

---

## POST /api/auth/forgot-password
Initiates a password reset by verifying email, username, and security question answers. *(Sprint item 9)*

**Request Body:**
```json
{
  "username": "jlawson0926",
  "email_address": "jlawson@example.com",
  "security_answer1": "Buddy",
  "security_answer2": "Springfield",
  "security_answer3": "Mustang"
}
```

**Response 200 OK:**\
*Returned when all answers match; a reset token is issued for use with POST /api/auth/reset-password.*
```json
{
  "reset_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Responses**\
**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Username and email address are required."
}
```
**Response 401 Unauthorized:**\
*Returned when the security answers don't match. The same message is used for an unrecognized username/email, so attackers can't tell which accounts exist.*
```json
{
  "error": "Unauthorized",
  "message": "The information provided does not match our records."
}
```

---

## POST /api/auth/reset-password
Sets a new password using a valid reset token. *(Sprint items 10, 11, 12)*

**Request Body:**
```json
{
  "reset_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "new_password": "NewPass1!"
}
```

**Response 200 OK:**
```json
{
  "message": "Password successfully reset."
}
```

**Error Responses**\
**Response 400 Bad Request:**\
*Returned when the password doesn't meet complexity requirements (min. 8 characters, starts with a letter, contains a letter, number, and special character).*
```json
{
  "error": "Bad Request",
  "message": "Password must be at least 8 characters, start with a letter, and include a letter, number, and special character."
}
```
**Response 401 Unauthorized:**\
*Returned when the reset token is invalid or expired.*
```json
{
  "error": "Unauthorized",
  "message": "This reset link is invalid or has expired."
}
```
**Response 409 Conflict:**\
*Returned when the new password matches one of the user's previous passwords.*
```json
{
  "error": "Conflict",
  "message": "This password has been used before. Please choose a different password."
}
```

---

## GET /api/users/reports/all
Returns a formatted report of all users in the system. Administrator only. *(Sprint item 16)*

**Response 200 OK:**
```json
[
  {
    "id": 7,
    "username": "jlawson0926",
    "first_name": "Jason",
    "last_name": "Lawson",
    "role": "ACCOUNTANT",
    "status": "ACTIVATED"
  }
]
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```

---

## GET /api/users/reports/expired-passwords
Returns a report of all users with expired passwords. Administrator only. *(Sprint item 18)*

**Response 200 OK:**
```json
[
  {
    "id": 9,
    "username": "mbailey0512",
    "password_expiry": "2026-09-01"
  }
]
```

**Error Responses**\
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```

---

## POST /api/users/{id}/send-email
Sends an email to the specified user from within the system. Administrator only. *(Sprint item 19)*

**URL Parameters**
* `id` (integer, required): The unique identifier of the recipient user

**Request Body:**
```json
{
  "subject": "Account Notice",
  "body": "Your account has been reactivated."
}
```

**Response 200 OK:**
```json
{
  "message": "Email sent successfully."
}
```

**Error Responses**\
**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Subject and body are required."
}
```
**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "You are unauthorized to make this request."
}
```
**Response 403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "The user is authenticated but lacks the required role."
}
```
**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User doesn't exist"
}
```

---

## Chart of Accounts Module

**Access:** every logged-in role (ADMINISTRATOR, MANAGER, ACCOUNTANT) can use the GET endpoints. Only ADMINISTRATOR can add, edit, or deactivate. All requests need `Authorization: Bearer <token>`.

**Account object** (used in requests and responses; snake_case):

| Field | Type | Notes |
|---|---|---|
| `id` | integer | response only |
| `name` | string | required, unique (case-insensitive) |
| `account_number` | string | required, digits only, unique. Must start with 1 (Asset), 2 (Liability), 3 (Equity), 4 (Revenue) or 5 (Expense) to match `category` |
| `description` | string | optional |
| `normal_side` | string | required: `LEFT` (debit) or `RIGHT` (credit). `DEBIT`/`CREDIT` also accepted on input |
| `category` | string | required: Asset, Liability, Equity, Revenue, Expense |
| `subcategory` | string | required, e.g. "Current Assets" |
| `initial_balance` | number | optional, default 0.00, not negative |
| `debit`, `credit` | number | optional, default 0.00, not negative |
| `balance` | number | optional, defaults to `initial_balance`, not negative |
| `added_at` | datetime | response only, set by server |
| `user_id` | integer | response only, the admin who created it |
| `account_order` | integer | optional, e.g. 1 for Cash |
| `statement` | string | required: `IS`, `BS`, `RE`, `TB` on input. Responses return `INCOME_STATEMENT`, `BALANCE_SHEET`, `RETAINED_EARNINGS`, `TRIAL_BALANCE` |
| `comment` | string | optional |
| `active` | boolean | response only |

*Money values are stored with exactly two decimal places. Thousands-separator commas are a display concern for the frontend (e.g. `toLocaleString`).*

---

## GET /api/accounts
Returns the chart of accounts (report of all accounts), ordered by `account_order` then `account_number`. All query parameters are optional and can be combined.

| Query param | Meaning |
|---|---|
| `search` | matches account name (contains) OR account number (contains) |
| `name` | name contains |
| `number` | number starts with |
| `category`, `subcategory` | exact match, case-insensitive |
| `statement` | `IS`, `BS`, `RE`, `TB` or full name |
| `active` | `true` or `false` |
| `min_balance`, `max_balance` | balance range, inclusive |

**Response 200 OK:** an array of Account objects.
```json
[
  {
    "id": 1,
    "name": "Cash",
    "account_number": "1010",
    "description": "Cash on hand and in checking",
    "normal_side": "LEFT",
    "category": "Asset",
    "subcategory": "Current Assets",
    "initial_balance": 5000.50,
    "debit": 0.00,
    "credit": 0.00,
    "balance": 5000.50,
    "added_at": "2026-10-18T03:15:22",
    "user_id": 3,
    "account_order": 1,
    "statement": "BALANCE_SHEET",
    "comment": "Opening balance",
    "active": true
  }
]
```

**Error Responses**\
**Response 403 Forbidden:** missing, invalid, or expired token.

---

## GET /api/accounts/{id}
Returns one account. The frontend's ledger page can use this until the ledger endpoint exists.

**Response 200 OK:** a single Account object.

**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Account doesn't exist."
}
```

---

## POST /api/accounts
Adds an account. Administrator only. The event log records an `ADD`.

**Request body:**
```json
{
  "name": "Cash",
  "account_number": "1010",
  "description": "Cash on hand and in checking",
  "normal_side": "LEFT",
  "category": "Asset",
  "subcategory": "Current Assets",
  "initial_balance": 5000.50,
  "account_order": 1,
  "statement": "BS",
  "comment": "Opening balance"
}
```

**Response 201 Created:** the new Account object.

**Error Responses**\
**Response 400 Bad Request:** missing required field, non-digit account number, number not starting with the right digit for the category, negative money value, or bad normal side / statement / category. Examples:
```json
{
  "error": "Bad Request",
  "message": "Account numbers can only contain digits (no decimals, letters, or symbols)."
}
```
```json
{
  "error": "Bad Request",
  "message": "Account number must start with 1 for Asset accounts."
}
```
**Response 409 Conflict:**
```json
{
  "error": "Conflict",
  "message": "An account with this name already exists."
}
```
*(or* `"An account with this number already exists."` *)*\
**Response 403 Forbidden:** caller is not an administrator.

---

## PUT /api/accounts/{id}
Edits an account. Administrator only. Send the full set of editable fields (same body as POST). The event log records a `MODIFY` with before and after images.

**Response 200 OK:** the updated Account object.

**Errors:** same 400 and 409 responses as POST (a name or number is only a duplicate if it belongs to a *different* account), 404 if the account doesn't exist, 403 if not an administrator.

---

## PUT /api/accounts/{id}/deactivate
Deactivates an account. Administrator only. The event log records a `DEACTIVATE`.

**Response 200 OK:** the Account object with `"active": false`.

**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Accounts with a balance greater than zero cannot be deactivated."
}
```
*(or* `"This account is already deactivated."` *)*\
**Response 404 Not Found / 403 Forbidden:** as above.

---

## GET /api/event-logs
Returns the event log, newest first. Available to all logged-in roles. Optional query params: `table` and `record_id` (use both together, e.g. `?table=accounts&record_id=1`).

**Response 200 OK:**
```json
[
  {
    "id": 12,
    "user_id": 3,
    "table_name": "accounts",
    "record_id": 1,
    "action": "MODIFY",
    "before_image": "{\"id\":1,\"name\":\"Cash\",\"description\":\"Cash on hand\", ...}",
    "after_image": "{\"id\":1,\"name\":\"Cash\",\"description\":\"Cash on hand and in checking\", ...}",
    "changed_at": "2026-10-18T03:20:10"
  }
]
```
*`action` is `ADD`, `MODIFY`, or `DEACTIVATE`. `before_image` is `null` for `ADD`. Images are JSON stored as text, so the frontend should `JSON.parse` them to display a before/after comparison.*

---

## Journal Entries Module

**Access:** every logged-in role can view (GET). MANAGER and ACCOUNTANT can create, edit, cancel, submit, and attach. Only MANAGER can approve or reject. ADMINISTRATOR cannot journalize.

**Life cycle:** `DRAFT` → `SUBMITTED` (shown in the UI as *pending approval*) → `APPROVED` or `REJECTED`. Only a draft can be edited or cancelled, and only by the person who created it. Other users cannot see someone else's draft. Approving an entry posts it to the ledger and updates each account's `debit`, `credit` and `balance`. A rejected entry stays rejected; the accountant prepares a new one.

**Journal entry object:**

| Field | Notes |
|---|---|
| `id` | |
| `entry_date` | `yyyy-MM-dd` |
| `entry_type` | `REGULAR` (default) or `ADJUSTING` |
| `status` | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` |
| `description` | optional, max 255 chars. Shown in the ledger's description column |
| `comment` | the manager's reason when rejected |
| `created_by`, `created_by_name`, `reviewed_by`, `reviewed_by_name`, `reviewed_at`, `created_at` | response only |
| `total_debits`, `total_credits` | response only, two decimals |
| `lines` | array of `{ id, account_id, account_name, account_number, side, amount }`. `side` is `DEBIT` or `CREDIT`. **Debit lines always come first.** |
| `attachments` | array of `{ id, original_name, file_type, uploaded_at }` |

**Request body for create/edit/validate:**
```json
{
  "entry_date": "2026-10-20",
  "entry_type": "REGULAR",
  "description": "Office supplies",
  "lines": [
    { "account_id": 7, "side": "DEBIT",  "amount": 250.00 },
    { "account_id": 2, "side": "CREDIT", "amount": 250.00 }
  ]
}
```
Any number of debit lines and credit lines is allowed. Accounts must exist in the chart of accounts and be active.

**Validation errors (400).** Every error message comes from the `error_messages` table. A response lists *all* problems at once so the user can fix them together. Show each `message` in red; clear the list once a re-validate or re-submit succeeds.
```json
{
  "error": "Bad Request",
  "message": "Total debits (250.00) must equal total credits (200.00). The difference is 50.00.",
  "errors": [
    { "code": "JRN_005", "message": "Total debits (250.00) must equal total credits (200.00). The difference is 50.00." }
  ]
}
```
Possible codes: JRN_001 date required · JRN_002 bad entry type · JRN_003 no debit · JRN_004 no credit · JRN_005 debits ≠ credits · JRN_006 account missing on a line · JRN_007 account not in chart · JRN_008 account deactivated · JRN_009 bad side · JRN_010 amount missing · JRN_011 amount ≤ 0 · JRN_012 more than 2 decimals · JRN_018 no lines · JRN_019 description too long.
*Saving a draft only enforces the line-level rules (006 to 012). The accounting rules (001, 003, 004, 005, 018) are enforced on submit and by `/validate`.*

Other errors use the usual `{ "error", "message" }` shape: **404** `JRN_013` entry doesn't exist · **403** `JRN_015` not your draft · **409** `JRN_014` entry isn't a draft · **409** `JRN_016` entry isn't pending · **400** `JRN_017` reject without a reason.

---

## GET /api/journal-entries
Lists journal entries, newest first. All params optional.

| Query param | Meaning |
|---|---|
| `status` | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED` (your own drafts only) |
| `type` | `REGULAR` or `ADJUSTING`. Use `type=ADJUSTING` for the Adjusting Entries pages. Anything else is a 400. |
| `from`, `to` | entry date range, `yyyy-MM-dd`, inclusive |
| `search` | matches an account name on any line, **or** an amount on any line, **or** an exact entry date (`yyyy-MM-dd`) |

Without `status`, it returns every non-draft entry plus your own drafts. **Response 200:** an array of journal entry objects.

## GET /api/journal-entries/pending-count
Optional query param `type=ADJUSTING` (or `REGULAR`) counts only that type.
**Response 200:** `{ "count": 3 }`. Use it for the manager's "waiting for approval" badge.

## GET /api/journal-entries/{id}
**Response 200:** one journal entry object. **404** if it doesn't exist or is someone else's draft.

## POST /api/journal-entries
Creates a **draft**. **Response 201:** the entry. **400:** validation errors (above).

## POST /api/journal-entries/validate
Checks an entry without saving it. Run it as the user types to show and clear errors live.
**Response 200:** `{ "valid": false, "errors": [ { "code": "...", "message": "..." } ] }`

## PUT /api/journal-entries/{id}
Replaces a draft's date, type, description and lines (same body as POST). Creator only. **Response 200:** the entry.

## DELETE /api/journal-entries/{id}
Cancels (deletes) a draft and its files. **Response 200:** `{ "message": "Journal entry cancelled." }`. A submitted entry returns **409**.

## POST /api/journal-entries/{id}/submit
Validates fully, then moves the entry to `SUBMITTED` and emails every active manager. **400** with the error list if anything is wrong, and the entry stays a draft.

## PUT /api/journal-entries/{id}/approve
Manager only. Posts the entry to the ledger. **Response 200:** the entry with `status: "APPROVED"`.

## PUT /api/journal-entries/{id}/reject
Manager only. **Body:** `{ "comment": "Reason is required" }`. **Response 200:** the entry with `status: "REJECTED"` and the comment saved. The creator is emailed the reason.

---

## Attachments (source documents)
Allowed types: **pdf, doc, docx, xls, xlsx, csv, jpg, jpeg, png**, up to 10 MB each. Only on a draft, by its creator.

* `POST /api/journal-entries/{id}/attachments` with `multipart/form-data`, field name **`file`**. **201:** `{ id, original_name, file_type, uploaded_at }`. **400** `ATT_001` wrong type / `ATT_002` empty file · **413** `ATT_003` too large.
* `GET /api/journal-entries/{id}/attachments/{attachmentId}` downloads the file. It needs the `Authorization` header, so fetch it as a blob in the frontend. A plain `<a href>` will not send the token.
* `DELETE /api/journal-entries/{id}/attachments/{attachmentId}` removes a file from a draft.

---

## GET /api/accounts/{id}/ledger
The account's ledger: every **approved** journal entry line for that account, with a running balance. All roles.

| Query param | Meaning |
|---|---|
| `from`, `to` | date range, `yyyy-MM-dd`. The balances stay correct even when earlier rows are hidden |
| `search` | matches an amount, a description, or a post reference |

**Response 200:**
```json
{
  "account_id": 2,
  "account_name": "Cash",
  "account_number": "1010",
  "normal_side": "LEFT",
  "initial_balance": 1000.00,
  "opening_balance": 1000.00,
  "rows": [
    {
      "entry_date": "2026-10-20",
      "description": "Office supplies",
      "post_reference": 12,
      "debit": null,
      "credit": 250.00,
      "balance": 750.00
    }
  ],
  "ending_balance": 750.00
}
```
`post_reference` is the journal entry id. Make it a link to `GET /api/journal-entries/{id}`. `debit` or `credit` is `null` for the empty cell. `opening_balance` is the balance just before the first row shown. Balance rule: for a normal-debit (`LEFT`) account, debits increase it and credits decrease it; for a normal-credit (`RIGHT`) account it's the reverse.

---

## Email from the account pages

* `GET /api/email/recipients` returns `[ { id, name, role } ]`, the people the logged-in user may email. Administrator → managers and accountants. Accountant → managers and administrators. Manager → administrators and accountants.
* `POST /api/email` with `{ "recipient_user_id": 4, "subject": "...", "body": "..." }`. **200:** `{ "message": "Email sent." }`. **400** `EML_001` missing field · **404** `EML_003` unknown recipient · **403** `EML_002` not an allowed recipient.

*(The older admin-only `POST /api/users/{id}/send-email` still exists.)*

---

## Event logs for accounts
Already available from Sprint 2: `GET /api/event-logs?table=accounts&record_id={accountId}`. Approving a journal entry also writes a `MODIFY` event for each account whose balance changed, with before and after images, the approving manager's `user_id`, and the time. Journal entries are logged too, under `table=journal_entries`.

---

## Adjusting Entries (Sprint 4)
Adjusting entries are journal entries with `"entry_type": "ADJUSTING"`. They use the same endpoints, rules and workflow as every other entry (create or edit as a draft, attach source documents, cancel before submitting, submit, manager approves or rejects, errors come from the `error_messages` table). Nothing new to build on the backend except the `type` filter above.

| Page / feature | Call |
|---|---|
| Manager: adjusting entries waiting for approval | `GET /api/journal-entries?type=ADJUSTING&status=PENDING` |
| Manager: approved adjusting entries | `GET /api/journal-entries?type=ADJUSTING&status=APPROVED` |
| Manager: rejected adjusting entries | `GET /api/journal-entries?type=ADJUSTING&status=REJECTED` |
| Accountant: status of everything they submitted | the same three calls (every non-draft entry is visible to every role) |
| Filter by date | add `&from=yyyy-MM-dd&to=yyyy-MM-dd` |
| Search by account name, amount, or date | add `&search=...` |
| Badge for the manager | `GET /api/journal-entries/pending-count?type=ADJUSTING` |
| Approve | `PUT /api/journal-entries/{id}/approve` (manager only) |
| Reject | `PUT /api/journal-entries/{id}/reject` with `{ "comment": "reason" }`. The reason is required (**400**, `JRN_017`, if it is blank). The accountant sees it in the entry's `comment`. |

Once approved, the entry shows in the account ledgers right away, and in the financial statements, because the statements are built live from approved entries.

**Clickable links (frontend):** account name or number → `GET /api/accounts/{id}/ledger` (each statement row carries `account_id` and `account_number`). A ledger row's `post_reference` → `GET /api/journal-entries/{post_reference}`.

---

## Statements Module (Sprint 4, manager only)
All statements are built from **approved** journal entries only, so drafts, pending and rejected entries never appear. Every call below needs the manager's token (**403** for the administrator and accountants).

`{type}` is one of: `trial-balance`, `income-statement`, `balance-sheet`, `retained-earnings`.

**Choosing the date.** Pass one of:
* `date=2026-04-30`, everything up to and including that day, from the start of the books.
* `from=2026-04-01&to=2026-04-30`, a date range.

With no dates it uses today. `from` without `to` is a **400** (`STM_001`), and `from` after `to` is a **400** (`STM_002`). An unknown `{type}` is a **400** (`STM_003`).

How each statement uses the dates:
* **Trial balance** and **balance sheet** are "as of" the end date (`date`, or `to` of a range).
* **Income statement** and **retained earnings statement** cover the period. With only `date`, they cover everything up to that day (`from` comes back `null`).
* Accounts with a zero balance (or zero activity) are left out.

### GET /api/statements/{type}
Returns the statement as JSON for the frontend to render.
```json
{
  "type": "income-statement",
  "title": "Income Statement",
  "from": "2026-04-01",
  "to": "2026-04-30",
  "sections": [
    { "title": "Revenues", "total": 13425.00, "rows": [
        { "account_id": 14, "account_number": "4010", "name": "Service Revenue", "subcategory": "Operating Revenue",
          "debit": null, "credit": null, "amount": 13425.00 } ] },
    { "title": "Expenses", "total": 8900.00, "rows": [ ... ] }
  ],
  "totals": { "total_revenues": 13425.00, "total_expenses": 8900.00, "net_income": 4525.00 },
  "balanced": true,
  "generated_at": "2026-11-10T18:30:00"
}
```
What is in `sections` and `totals` for each type:

| type | sections | totals keys |
|---|---|---|
| `trial-balance` | one section, "Accounts"; each row has `debit` **or** `credit` (the other is `null`) | `total_debits`, `total_credits` |
| `income-statement` | "Revenues", "Expenses"; rows use `amount` | `total_revenues`, `total_expenses`, `net_income` |
| `balance-sheet` | "Assets", "Liabilities", "Stockholders' Equity"; rows use `amount` and carry a `subcategory` to group by. Contra accounts such as accumulated depreciation are **negative**. Retained Earnings is added to equity: its account balance + net income to date − dividends. | `total_assets`, `total_liabilities`, `total_equity`, `total_liabilities_and_equity` |
| `retained-earnings` | one section; rows have `name` and `amount` and no `account_id`: Beginning, Add: Net income, Less: Dividends, (Other changes, only if non-zero), Ending | `beginning_retained_earnings`, `net_income`, `dividends`, `other_changes`, `ending_retained_earnings` |

`balanced` is `false` when the statement does not tie out (trial balance: debits ≠ credits; balance sheet: assets ≠ liabilities + equity). Show a warning in red when that happens. It is always `true` for the other two.

### GET /api/statements/{type}/html (print)
Same parameters. Returns a clean, self-contained HTML page (`text/html`) with print styling. For **Print**, open this URL in a new tab and call `window.print()`, or fetch it with the token and write it into a new window. The frontend can also just style the JSON itself and print that.

### POST /api/statements/{type}/save
Same parameters. Saves the statement exactly as it is now (as an HTML file on the server) and records who saved it and when. **201:**
```json
{ "id": 3, "statement_type": "BALANCE_SHEET", "period_start": null, "period_end": "2026-04-30",
  "generated_by": 4, "generated_by_name": "Jaina Proudmoore", "generated_at": "2026-11-10T18:31:02" }
```

### GET /api/statements/saved
Saved statements, newest first (array of the object above).

### GET /api/statements/saved/{id}/html
The saved statement as an HTML page. **404** `STM_005` if the id doesn't exist, `STM_006` if the file is missing.

### POST /api/statements/{type}/email
Same date parameters in the query string. Body:
```json
{ "recipient_user_id": 5, "subject": "optional", "message": "optional note shown above the statement" }
```
The recipient must be an active user (**400/404** `STM_004` otherwise). Sends the formatted statement in the email body. **200:** `{ "message": "Email sent." }`. Like the other emails it is only logged to the console if no Resend key is set. The recipient list for the dropdown is `GET /api/email/recipients`.

**Migration:** `V10__statements.sql` (saved statement type becomes a plain text column so the retained earnings statement can be stored; adds the `STM_001`–`STM_006` messages).

*Closing entries are not part of this sprint. If you post them later, the income statement for a period that includes the closing date will show the closing amounts.*
