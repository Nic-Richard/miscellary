import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: 'Privacy · Miscellary' };

export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <h1>Privacy</h1>
      <p className={styles.updated}>Effective October 8, 2026</p>
      <p>Miscellary is operated by Nic Richard in New Brunswick, Canada.</p>

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
        <h2>Google sign-in</h2>
        <p>
          Google sign-in is optional. If you use it, Google sends us a signed identity credential,
          including your account identifier, email address and verification status. We keep the
          identifier to connect Google to your Miscellary account. We do not request access to your
          Gmail, contacts, Drive files or other Google content, and we do not copy your Google name
          or photo into your profile.
        </p>
        <p>
          The website loads Google’s sign-in service on login and sign-up screens and when you
          choose to connect or confirm Google in account settings. Google processes those
          interactions under its <a href="https://policies.google.com/privacy">privacy policy</a>. A
          short-lived website cookie helps secure the sign-in attempt. You can disconnect Google in
          account settings after setting a password; closing your account removes the connection.
        </p>
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
        <h2>Cookies and analytics</h2>
        <p>
          The website uses a secure cookie to keep you signed in, and the Android app stores your
          sign-in in the device’s secure storage. These are needed for your account to work.
        </p>
        <p>
          We use TraceTray to understand how people use the website. It records things like cursor
          movement, clicks, scrolling, and which pages are visited, and stores a random visitor ID
          in your browser so visits can be grouped together. It doesn’t record what you type, form
          entries, passwords, or payment details, and it isn’t used for advertising. See{' '}
          <a href="https://tracetray.com/privacy.html">TraceTray’s privacy policy</a> for details.
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
          leave archived cards in collectors’ inventories as described by the product. You can
          delete your account at any time from your account settings on the website or in the app.
          You can also ask about access, correction, or deletion of your personal information by
          contacting us.
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
