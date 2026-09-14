import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: 'Terms · Miscellary' };

export default function TermsPage() {
  return (
    <article className={styles.page}>
      <h1>Terms of use</h1>
      <p className={styles.updated}>Effective September 14, 2026</p>

      <section>
        <h2>Using Miscellary</h2>
        <p>
          Miscellary is a creative collecting service for making card sets, opening packs, keeping
          collections, and trading cards. You must be at least 13 years old to create an account.
          Keep your account details accurate and protect your sign-in information.
        </p>
      </section>

      <section>
        <h2>Your work</h2>
        <p>
          You keep ownership of the text and images you submit. You give Miscellary permission to
          store, process, reproduce, and display that work as needed to operate and promote the
          service. You must have the rights and permissions needed for anything you upload.
        </p>
      </section>

      <section>
        <h2>Content rules</h2>
        <p>Do not submit or use Miscellary for:</p>
        <ul>
          <li>explicit or adult content;</li>
          <li>inappropriate use of a real person’s image or identity;</li>
          <li>stolen photos, writing, designs, or other content;</li>
          <li>harassment, threats, abuse, or hateful conduct;</li>
          <li>spam, fraud, impersonation, or unlawful activity; or</li>
          <li>anything else that could harm people, the service, or its operation.</li>
        </ul>
        <p>
          These categories match the reasons available in the reporting tools. Miscellary may limit
          access to or remove content and accounts when needed to enforce these terms or protect the
          service and its users.
        </p>
      </section>

      <section>
        <h2>Cards have no financial value</h2>
        <p>
          Miscellary cards, points, packs, and trades are creative product features. They are not
          investments, currency, financial assets, or claims on a limited supply, and they cannot be
          redeemed for money through Miscellary.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          The service is provided as available and may change, experience interruptions, or contain
          errors. Features may be changed or retired, and these terms may be updated as the service
          develops. Material changes will be reflected by a new effective date on this page.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{' '}
          <a href="mailto:support@miscellary.com">support@miscellary.com</a>.
        </p>
      </section>
    </article>
  );
}
