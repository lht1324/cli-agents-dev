// 법률 문서 본문. 마크다운 상수로 관리 — 문단 사이 빈 줄 유지(react-markdown 단락 파싱).
// 영어 문구 규칙: em dash 금지, 간결한 명령/명사형.

export const TERMS_OF_SERVICE = `
These Terms of Service ("Terms") govern your use of LocalAgents, the desktop sync daemon, and the web inbox at localagents.link (the "Service"). By creating an account or connecting a device, you agree to these Terms.

## 1. Eligibility & Accounts
You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service.
You are responsible for activity under your account and for keeping your credentials and device tokens confidential.
One account per person. Device tokens grant access to your data; treat them like passwords. You can revoke any device from the Devices page.

## 2. The Service
LocalAgents syncs your OpenCode sessions between your own computers and shows them in a web inbox.
The desktop daemon runs locally on your machine. Your sessions stay on your devices; a mirror copy is stored in our cloud so the inbox and cross-device transfer work.
The Service requires an active subscription after the trial period ends (see Section 5).

## 3. Acceptable Use
You agree to use the Service only for lawful purposes. You will not:
- Store or transmit unlawful, malicious, or infringing content, including malware or stolen code.
- Share your account with others or resell access to the Service.
- Abuse our APIs, exceed reasonable storage use, or attempt to circumvent access controls.
- Reverse engineer the Service beyond what the license permits, or probe our infrastructure without permission.

We may suspend or terminate accounts that violate these rules, without prior notice.

## 4. Your Content
**Your sessions:** You retain ownership of everything you create with OpenCode, including conversation content.
**Our license:** You grant us a non-exclusive license to store, replicate, and process your synced content solely to operate, support, debug, and protect the Service.
**Retention:** Your synced data is not deleted when a trial or subscription ends. When you subscribe again, your inbox is restored as it was. You may request full deletion at any time (see the Privacy Policy).

## 5. Trial, Subscriptions & Billing
- **Trial:** 30 days from your first activity, no card required. On day 31, the Service locks until you subscribe. Your data is kept.
- **Plan:** Pro costs USD 9 per month or USD 90 per year (2 months free). Prices are shown at checkout.
- **Renewal:** Plans renew automatically until canceled.
- **Cancellation:** You may cancel anytime from your Profile page. Cancellation takes effect at the end of the current billing period. You keep access until then. Unused days are handled under the Refund Policy (/legal/refunds).
- **Payments:** Payments are processed by Dodo Payments as merchant of record. We do not store card details.
- **Price changes:** We may change prices. Existing subscribers are notified in advance.

## 6. Refunds
Refunds are governed by our Refund Policy (/legal/refunds).

## 7. Disclaimer of Warranties
The Service is provided "AS IS" without warranties of any kind. We do not guarantee uninterrupted sync, data integrity beyond reasonable care, or fitness for any particular purpose. We may modify, limit, or discontinue features at any time.

## 8. Limitation of Liability & Indemnification
**Limitation:** To the maximum extent permitted by law, LocalAgents shall not be liable for any indirect, incidental, or consequential damages, including loss of data or profits.
**Indemnification:** You agree to indemnify and hold harmless LocalAgents and its operators from claims, damages, or legal fees arising from your content, your use of the Service, or your violation of these Terms.

## 9. Termination
We may suspend or terminate your account and access immediately, without prior notice or liability, for breach of these Terms, fraud, abuse, or legal requirement. Upon termination, your right to use the Service ceases. Refunds for paid cycles follow the Refund Policy.

## 10. Modifications to the Service
We may modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice.

## 11. Force Majeure
We are not responsible for delays or failures caused by events beyond our reasonable control, including natural disasters, war, strikes, or infrastructure and upstream service outages.

## 12. Governing Law & Jurisdiction
These Terms are governed by the laws of the **Republic of Korea**, without regard to conflict of law principles. Suits arising from these Terms or the Service shall be brought exclusively in the **Seoul Central District Court**. Mandatory consumer protections of your country of residence, where applicable, remain unaffected.
`;

export const PRIVACY_POLICY = `
This Privacy Policy explains how LocalAgents collects, uses, and safeguards your information when you use the sync daemon and the web inbox at localagents.link.

## 1. Information We Collect
- **Account data:** Email address, name, and profile picture via Google or GitHub OAuth.
- **Device data:** Hostname, platform, and the label you assign when pairing a device.
- **Session content:** Titles, messages, and usage statistics (tokens, timestamps) of the OpenCode sessions you choose to sync. This is required for the inbox and cross-device transfer to work.
- **Usage data:** Sync activity, device presence, and technical data such as IP address and browser type.
- **Payment data:** We do not store card details. Payments are processed by our merchant of record, Dodo Payments.

## 2. How We Use Your Information
- To provide the Service (sync, inbox, cross-device transfer).
- To manage devices, subscriptions, trials, and billing status.
- To detect and prevent fraud or abuse.
- To communicate about updates, billing, and support.

## 3. Data Sharing & Sub-processors
- **Database & authentication:** Neon (hosted Postgres and user accounts).
- **Hosting:** Cloudflare.
- **Payments:** Dodo Payments (name and email for checkout). Card data never touches our servers.
- **Sign-in:** Google or GitHub OAuth (account email, name, profile picture).

Your session content is shared with no one other than the processors above acting on your instruction.

## 4. International Transfers
By using the Service, you acknowledge your data may be transferred to and processed in the United States and other countries where our providers operate. We rely on standard contractual clauses or adequacy decisions where applicable.

## 5. Cookies
We use cookies to keep you signed in. You can instruct your browser to refuse cookies, but parts of the Service may stop working.

## 6. Data Security
We use industry-standard measures: TLS in transit, encryption at rest in Neon, HMAC-verified webhooks, and per-device tokens you can revoke. No method of Internet transmission is 100% secure.

## 7. Retention & Deletion
Your synced data is retained while your account exists, including after a trial or subscription ends (this is why an inbox is restorable on resubscribe). You may request deletion of your personal data and session content anytime by emailing **support@localagents.link**; we complete deletion within 30 days, except where retention is required by law, such as tax records.

## 8. User Rights (GDPR & CCPA)
Depending on your location, you may have rights to access, rectify, or delete your personal data. Email **support@localagents.link** to exercise them. We respond within 30 days.

## 9. Children's Privacy
The Service is not intended for children under 16. We do not knowingly collect their personal information. Accounts found to belong to children are removed.

## 10. Changes to This Policy
We may update this policy by posting a new version on this page. Material changes are announced in advance where required by law.

## 11. Contact
Questions about this policy: **support@localagents.link**
`;

export const REFUND_POLICY = `
## 1. Trial First
Every account gets a 30-day trial with no card required. You only pay if you subscribe after the trial, so most purchase questions never arise.

## 2. Cancel Anytime
You may cancel your subscription anytime from your Profile page. Cancellation takes effect at the end of the current billing period. You keep full access until then, and your data is kept across the gap.

## 3. Paid Unused Days (Pro Rata Refund, 14 Days)
Within 14 days of any recurring charge, you may request a refund of the unused whole days of that cycle:
- **Refund amount** = cycle price x (unstarted whole days / cycle length in days).
- Example: monthly Pro, charged on the 1st, cancel with refund request on the 3rd: 27 unused days of 30 remain, so 27/30 x $9 = **$8.10** is refunded.
- **Annual plans:** the unused portion of the yearly cycle is the refund base. Months already refunded within the same year are excluded.
- Requests after 14 days from the charge are handled case by case, usually as cancellation effective immediately without refund.

## 4. Effect of a Refund
A refund ends the current billing cycle immediately. Your plan locks on day 31 after your last paid period unless you subscribe again. Your data is never deleted by a refund.

## 5. Method & Timing
Refunds go back to the original payment method via Dodo Payments and can take up to 10 business days to appear on your statement.

## 6. How to Request
Email **support@localagents.link** from your account email with the subject "Refund request". Include the charge date if you have it. We process valid requests within 5 business days.

## 7. Chargebacks & Abuse
Contact us first; most billing issues resolve faster that way. Chargebacks filed while a valid refund request is pending, or repeated refund patterns, may lead to account suspension.

## 8. Statutory Rights
Nothing in this policy limits consumer rights granted by applicable law.
`;
