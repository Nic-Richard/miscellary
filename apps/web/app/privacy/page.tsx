import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: 'Privacy · Miscellary' };

export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <h1>Privacy</h1>
      <p className={styles.updated}>Effective September 14, 2026</p>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account information, including your email address, username, and password hash.</li>
          <li>Profile details, card sets, images, comments, collections, trades, and reports.</li>
          <li>
            Technical information such as request logs, IP addresses, device details, and errors.
          </li>
          <li>Records needed for email verification, password resets, security, and moderation.</li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>
          We use this information to provide accounts and collections, process uploads and trades,
          deliver service email, prevent abuse, respond to reports, troubleshoot errors, and improve
          the reliability of Miscellary. We do not sell personal information.
        </p>
      </section>

      <section>
        <h2>What is public</h2>
        <p>
          Usernames, display names, biographies, avatars, published sets and cards, public binders,
          follows, likes, and comments may be visible to anyone. Email addresses, password details,
          draft sets, and report details are not public through the product.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>
          Miscellary uses service providers to host the website, API, database, uploaded media,
          logs, and transactional email. Those providers process information only to supply their
          services to Miscellary and may operate in countries other than your own.
        </p>
      </section>

      <section>
        <h2>Storage and retention</h2>
        <p>
          Information is retained while an account is active and as reasonably needed for security,
          backups, moderation, legal obligations, and service operation. Published-set deletion may
          leave archived cards in collectors’ inventories as described by the product. You can ask
          about access, correction, or deletion of your personal information by contacting us.
        </p>
      </section>

      <section>
        <h2>Security and children</h2>
        <p>
          We use reasonable technical safeguards, but no online service can guarantee absolute
          security. Miscellary is not directed to children under 13. Contact us if you believe a
          child under 13 has provided personal information.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions and requests can be sent to{' '}
          <a href="mailto:privacy@miscellary.com">privacy@miscellary.com</a>.
        </p>
      </section>
    </article>
  );
}
