import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: 'Terms · Miscellary' };

export default function TermsPage() {
  return (
    <article className={styles.page}>
      <h1>Terms of use</h1>
      <p className={styles.updated}>Effective October 10, 2026</p>
      <p>Miscellary is operated by Nic Richard in New Brunswick, Canada.</p>

      <section>
        <h2>Using Miscellary</h2>
        <p>
          Miscellary is a creative collecting service for making card sets, opening packs, keeping
          collections, and trading cards. You must be at least 13 years old to create an account. If
          you are under the age of majority where you live, you need a parent or guardian’s
          permission before buying anything. Keep your account details accurate and protect your
          sign-in information.
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
        <h2>Community and the Lounge</h2>
        <p>
          You agree to these rules when you create an account, and again before you post in the
          Lounge. Comments, Lounge posts and replies are public. You can report any post, reply,
          comment, card, set or collector from inside the app or website, and reports are reviewed
          by a person. You can also block another collector at any time: blocked collectors can’t
          follow you, trade with you or reply to you, and you won’t see their posts, comments or
          notifications. Content that breaks these rules may be removed and accounts may be
          suspended or closed.
        </p>
      </section>

      <section>
        <h2>Copyright complaints</h2>
        <p>
          If you believe something on Miscellary uses your photo, writing, or other work without
          permission, report it with the reporting tools or email{' '}
          <a href="mailto:support@miscellary.com">support@miscellary.com</a> with a link to the
          content and a description of your work. Content found to infringe will be removed, and
          accounts that repeatedly upload others’ work may be closed.
        </p>
      </section>

      <section>
        <h2>Cards and tickets have no financial value</h2>
        <p>
          Miscellary cards, tickets, points, packs, and trades are creative product features. They
          are not investments, currency, financial assets, or claims on a limited supply. They
          cannot be sold, transferred outside Miscellary, or redeemed for money.
        </p>
      </section>

      <section>
        <h2>Tickets, packs and memberships</h2>
        <p>
          Tickets are a limited licence to open extra packs in Miscellary. You can buy them on the
          website or, in the Android app, through Google Play. They don’t expire while your account
          is open, and any you still hold when you close your account are lost.
        </p>
        <p>
          Packs contain randomly chosen cards. The odds for each rarity are shown before you open a
          paid pack. When tickets are spent on a set, its creator receives 20% of them as tickets.
        </p>
        <p>
          A membership costs the price shown when you join, charged every month until you cancel.
          You can cancel at any time and keep the benefits until the end of the month you paid for.
          Memberships started on the website are managed in your account settings; ones started in
          the Android app are managed in Google Play.
        </p>
        <p>
          Buying tickets and memberships isn’t available in Belgium or Brazil, where paid random
          packs are restricted. Purchases made from those countries are refunded and not added.
        </p>
      </section>

      <section>
        <h2>Refunds</h2>
        <p>
          Purchases are final except where the law or the store you bought from says otherwise.
          Google Play purchases follow Google Play’s refund policies. If a purchase is refunded or
          charged back, the tickets or membership month it paid for are taken back, even if they
          were already spent, so your ticket balance can go below zero. While it is below zero you
          can’t trade until new tickets bring it back up. Cards you already own are not taken back.
          Contact <a href="mailto:support@miscellary.com">support@miscellary.com</a> with any
          problem with a purchase.
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
        <h2>Limitation of liability</h2>
        <p>
          Miscellary is provided as is. To the fullest extent allowed by law, Miscellary is not
          responsible for indirect, incidental, or consequential losses, lost data, lost cards or
          collections, or service interruptions. Some laws give you rights that these terms cannot
          limit.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of New Brunswick and Canada.</p>
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
