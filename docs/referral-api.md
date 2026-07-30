# Referral API

All referral endpoints are additive and reuse the existing authentication, admin authorization, loyalty ledger, and commerce module architecture.

## Customer Endpoints

### `GET /api/v1/referrals/me`
- Auth: `CUSTOMER`
- Purpose: Returns the current user's referral profile, shareable code/link, summary stats, direct referrals, earnings history, and subtree.
- Response highlights:
  - `profile.referralCode`
  - `profile.referralLinkPath`
  - `summary.directReferralCount`
  - `summary.networkReferralCount`
  - `summary.pointsReceived`
  - `summary.pointsPending`
  - `earningsHistory[]`
  - `tree[]`

## Admin Endpoints

### `GET /api/v1/admin/referrals`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Returns the referral dashboard payload used by the admin panel.
- Response highlights:
  - `summary`
  - `referralGrowth`
  - `topReferrers`
  - `rules[]`
  - `relationships[]`
  - `rewards[]`

### `POST /api/v1/admin/referrals/rules`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Creates a referral rule.
- Body:
  - `name`
  - `description?`
  - `trigger`
  - `levelNumber`
  - `rewardType`
  - `rewardValue`
  - `minOrderAmount?`
  - `maxRewardPoints?`
  - `maxReferralCount?`
  - `expiresInDays?`
  - `conditions?`
  - `startsAt?`
  - `endsAt?`
  - `isActive?`
  - `sortOrder?`

### `PATCH /api/v1/admin/referrals/rules/:id`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Updates any subset of a referral rule.

### `DELETE /api/v1/admin/referrals/rules/:id`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Deletes a rule that has not generated rewards yet.

### `POST /api/v1/admin/referrals/relationships`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Creates a direct referral relationship.
- Body:
  - `referrerUserId`
  - `referredUserId`
  - `notes?`
- Validation:
  - Prevents self-referral
  - Prevents loops
  - Prevents duplicate direct referrer assignment

### `PATCH /api/v1/admin/referrals/relationships/:id`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Changes the direct referrer, notes, or status of an existing relationship.
- Body:
  - `referrerUserId`
  - `notes?`
  - `status?`

### `DELETE /api/v1/admin/referrals/relationships/:id`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Removes a direct referral relationship and rebuilds the closure tree.

### `PATCH /api/v1/admin/referrals/users/:id/code`
- Auth: `ADMIN`, `SUPER_ADMIN`
- Purpose: Updates a customer's referral code.
- Body:
  - `referralCode`

## Reward Lifecycle

Referral rewards reuse the existing loyalty ledger instead of creating a separate point balance system.

- `SIGNUP` rewards are evaluated immediately after a referred customer registers.
- `FIRST_ORDER` and `REPEAT_ORDER` rewards are evaluated from the existing order lifecycle.
- Pending order-based rewards are awarded only when the order reaches the existing completed loyalty state.
- Cancelled or refunded orders reverse or cancel the matching referral reward and write the correction into loyalty history.

## Security Guarantees

- Self-referral is rejected.
- Referral loops are rejected.
- Duplicate direct relationships are rejected.
- Customer visibility is limited to their own subtree.
- Admin mutations are audit logged.
