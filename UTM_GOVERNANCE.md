# UTM Governance (to reduce GA4 Unassigned)

## Required fields (always set all 3)
- `utm_source`
- `utm_medium`
- `utm_campaign`

## Naming conventions
- source: `reddit`, `youtube`, `chatgpt`, `community`, `github`
- medium: `referral`, `social`, `cpc`, `email`
- campaign: `kwl_YYYYMM_topic`

## Rules
1. Never ship partial UTM links.
2. Keep values lowercase.
3. No spaces; use `_`.
4. One canonical shortlink generator per campaign.

## Example
`https://chromewebstore.google.com/detail/<EXT_ID>?utm_source=reddit&utm_medium=social&utm_campaign=kwl_202602_launch`

## QA checklist
- [ ] All campaign links contain source/medium/campaign
- [ ] medium values map to GA channel rules
- [ ] No `(not set)` spike after launch
- [ ] Unassigned share trend reviewed weekly
