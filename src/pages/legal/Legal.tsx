import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { site } from "../../config/site";
import { ChatBubble, Footer, Header } from "../../components/ui";

type Page = "terms" | "privacy" | "refund" | "contact";

const UPDATED = "October 15, 2026";
const TERMS_UPDATED = "November 4, 2026";
const N = site.name;
const mail = <a href={`mailto:${site.supportEmail}`} className="font-semibold text-brand-magenta hover:underline">{site.supportEmail}</a>;

function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-xl font-bold text-ink sm:text-2xl">{n}. {title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
const UL = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>;

function Terms() {
  return (
    <>
      <p className="text-[17px] leading-relaxed text-gray-700">
        These Terms of Service ("Terms") govern your use of the {N} website, tools and subscriptions (the "Service"). By using the Service
        you agree to these Terms. If you don't agree, please don't use the Service.
      </p>
      <div className="mt-9">
        <S n={1} title="Eligibility">
          <p>You must be at least 18 years old to use {N}. By using the Service you confirm that:</p>
          <UL>
            <li>you are 18 or older and able to enter into a binding agreement;</li>
            <li>you will use the Service only for lawful, personal, non-commercial purposes;</li>
            <li>you will not use the Service to harass, stalk, threaten or intimidate anyone, or to violate anyone's privacy.</li>
          </UL>
        </S>
        <S n={2} title="What the Service does">
          <p>
            {N} shows information that Instagram accounts have made publicly available, such as public profiles and public following and
            follower lists, organized to make recent activity easier to read. We do not access private accounts, private messages or any
            content that requires logging in, and we never ask for your Instagram password.
          </p>
          <p>
            Public data can change at any time and may be temporarily cached. We work to keep results accurate, but we can't guarantee that
            every list is complete, current or in the exact order events happened.
          </p>
        </S>
        <S n={3} title="No affiliation with Instagram or Meta">
          <p>{N} is an independent service. It is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc.</p>
        </S>
        <S n={4} title="Acceptable use">
          <p>You agree not to:</p>
          <UL>
            <li>use the Service to stalk, harass, threaten, dox or monitor a person in a way that violates their rights or the law;</li>
            <li>use information from the Service to contact, track or locate someone who has asked not to be contacted;</li>
            <li>resell, redistribute or build a competing product from data obtained through the Service;</li>
            <li>scrape the Service, bypass usage limits, or interfere with its security or normal operation;</li>
            <li>share your account or let others use your subscription.</li>
          </UL>
          <p>We may suspend or close accounts that violate these Terms, without a refund where the violation is serious.</p>
        </S>
        <S n={5} title="Fair-use limits">
          <p>Every new profile we look up costs us real money to collect, so we limit how many new profiles each person can look up. This keeps the Service available and fairly priced for everyone.</p>
          <UL>
            <li><strong>Without a subscription:</strong> a small number of new profiles per day (currently 5). Free lookups can also pause for everyone on a very busy day.</li>
            <li><strong>With a subscription:</strong> up to 10 new profiles per day, and a weekly limit that depends on your plan (currently 27 on Starter and 40 on Premium).</li>
            <li>A "new profile" is a username you haven't already looked up that same day. Looking up the same profile again that day doesn't count, and profiles we checked recently may open without counting.</li>
            <li>Daily counts reset at 00:00 UTC. Weekly counts reset every Monday at 00:00 UTC.</li>
            <li>A lookup that fails on our side or on our data provider's side isn't counted.</li>
          </UL>
          <p>We may change these limits. Changes are announced as described under "Changes to these Terms", and this page always shows the current limits.</p>
        </S>
        <S n={6} title="Your account">
          <p>You are responsible for keeping your login details secure and for all activity under your account. Tell us right away at {mail} if you suspect unauthorized use.</p>
        </S>
        <S n={7} title="Subscriptions, renewals and cancellation">
          <UL>
            <li>Paid plans are subscriptions billed in advance, weekly or quarterly, depending on the plan you choose. The price and billing period are shown before you pay.</li>
            <li>Subscriptions renew automatically at the end of each billing period at the then-current price until you cancel.</li>
            <li>You can cancel at any time from your account or by emailing {mail}. Cancellation stops future renewals; you keep access until the end of the period you already paid for.</li>
            <li>We'll notify you in advance of any price change, and it will only apply from your next billing period.</li>
          </UL>
        </S>
        <S n={8} title="Refunds">
          <p>New purchases are covered by a 7-day full refund guarantee. The full details are in our <Link to="/refund-policy" className="font-semibold text-brand-magenta hover:underline">Refund Policy</Link>, which is part of these Terms.</p>
        </S>
        <S n={9} title="Intellectual property">
          <p>The {N} name, logo, software and site content belong to us. You may not copy, modify or distribute them without our permission. Instagram content shown through the Service remains the property of its owners.</p>
        </S>
        <S n={10} title="Disclaimers">
          <p>The Service is provided "as is" and "as available". To the fullest extent allowed by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We don't guarantee the Service will be uninterrupted or error-free, or that any third-party data source will remain available.</p>
        </S>
        <S n={11} title="Limitation of liability">
          <p>To the fullest extent allowed by law, {N} will not be liable for indirect, incidental, special or consequential damages, and our total liability for any claim related to the Service is limited to the amount you paid us in the 3 months before the claim.</p>
        </S>
        <S n={12} title="Changes to these Terms">
          <p>We may update these Terms from time to time. When we do, we'll change the "Last updated" date above, and for material changes we'll notify subscribers by email. Continuing to use the Service after an update means you accept the new Terms.</p>
        </S>
        <S n={13} title="Contact">
          <p>Questions about these Terms? Email us at {mail}.</p>
        </S>
      </div>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p className="text-[17px] leading-relaxed text-gray-700">
        This Privacy Policy explains what information {N} collects, how we use it and the choices you have. We collect as little as we need to
        run the Service.
      </p>
      <div className="mt-9">
        <S n={1} title="Information we collect">
          <UL>
            <li><strong>Account information:</strong> your email address and login details when you create an account.</li>
            <li><strong>Payment information:</strong> payments are handled by our payment processor. We receive confirmation of the payment and limited details (such as the card brand and last four digits), never your full card number.</li>
            <li><strong>Searches:</strong> the Instagram usernames you look up, so we can show results, keep your history and apply fair-use limits.</li>
            <li><strong>Technical data:</strong> IP address, browser and device type, and basic usage events, used for security, abuse prevention and improving the Service.</li>
            <li><strong>Support messages:</strong> anything you send us by email.</li>
          </UL>
        </S>
        <S n={2} title="Public Instagram data">
          <p>To provide results, we collect information that Instagram accounts have made public, such as usernames, display names, profile photos and public follower and following lists. We store it temporarily to keep the Service fast and don't use it for any other purpose.</p>
          <p>If you own an Instagram account and want your public data removed from our cache and excluded from future results, email {mail} from an address we can verify or with proof of ownership, and we'll handle it promptly.</p>
        </S>
        <S n={3} title="How we use information">
          <UL>
            <li>to provide, maintain and secure the Service;</li>
            <li>to process payments, manage subscriptions and send service emails such as receipts and renewal notices;</li>
            <li>to answer support requests;</li>
            <li>to prevent fraud, abuse and violations of our Terms;</li>
            <li>to understand how the Service is used and improve it.</li>
          </UL>
        </S>
        <S n={4} title="Your searches are private">
          <p>We never tell an Instagram account that someone searched for it, and we don't share your searches with the accounts you look up.</p>
        </S>
        <S n={5} title="Sharing">
          <p>We do not sell your personal information. We share it only with service providers that help us run {N} (hosting, payments, email, analytics and data providers), under contracts that limit their use of it, or when required by law.</p>
        </S>
        <S n={6} title="Cookies and analytics">
          <p>We use cookies and similar technologies to keep you logged in, remember preferences and measure how the site is used. You can control cookies in your browser settings; blocking some of them may affect how the Service works.</p>
        </S>
        <S n={7} title="Data retention">
          <p>We keep account information while your account is active and for as long as needed to meet legal, tax and accounting obligations. Cached public Instagram data is refreshed or deleted regularly.</p>
        </S>
        <S n={8} title="Your rights">
          <p>Depending on where you live (including California under the CCPA/CPRA), you may have the right to access, correct or delete your personal information and to opt out of certain processing. To make a request, email {mail}. We won't discriminate against you for exercising these rights.</p>
        </S>
        <S n={9} title="Security">
          <p>We use reasonable technical and organizational safeguards to protect your information. No method of transmission or storage is 100% secure, so we can't guarantee absolute security.</p>
        </S>
        <S n={10} title="Children">
          <p>{N} is only for people 18 and older. We don't knowingly collect personal information from anyone under 18. If you believe a minor has given us information, contact us and we'll delete it.</p>
        </S>
        <S n={11} title="Changes and contact">
          <p>We'll post any changes to this policy on this page and update the date above. Questions? Email {mail}.</p>
        </S>
      </div>
    </>
  );
}

function Refund() {
  return (
    <>
      <p className="text-[17px] leading-relaxed text-gray-700">
        We want you to be happy with {N}. This is our only refund policy, and it applies to every plan.
      </p>
      <div className="mt-9">
        <S n={1} title="7-day full refund on new purchases">
          <p>If you're not satisfied, you can request a full refund within 7 days of your first purchase of any plan. No questions asked, and it doesn't matter how much you used the Service.</p>
        </S>
        <S n={2} title="How to request a refund">
          <p>Email {mail} from the address on your account (or include it in your message) within the 7-day window. We'll confirm by email and process the refund to your original payment method within 5 business days. Your bank may take a few extra days to show it.</p>
        </S>
        <S n={3} title="Renewals">
          <p>Automatic renewals are not covered by the 7-day guarantee, except where the law requires otherwise. If you were charged for a renewal you didn't intend, contact us and we'll look into it.</p>
        </S>
        <S n={4} title="Cancelling">
          <p>You can cancel at any time from your account or by emailing us. Cancelling stops future charges, and you keep access until the end of the period you already paid for. We don't give partial refunds for unused time outside the 7-day window.</p>
        </S>
        <S n={5} title="Before disputing a charge">
          <p>Please contact us first. We can almost always resolve billing issues faster than a bank dispute, and we answer every email.</p>
        </S>
      </div>
    </>
  );
}

function Contact() {
  const cards = [
    {
      icon: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6",
      title: "Email Support",
      text: "Help with your account, searches or technical issues.",
      action: <a href={`mailto:${site.supportEmail}`} className="block break-all rounded-xl bg-cta px-4 py-3 text-sm font-semibold text-white shadow">{site.supportEmail}</a>,
    },
    {
      icon: "M3 10h18M7 15h2m-4 5h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z",
      title: "Billing & Refunds",
      text: "New purchases have a 7-day full refund guarantee.",
      action: <Link to="/refund-policy" className="block rounded-xl border-2 border-brand-magenta px-4 py-2.5 text-sm font-semibold text-brand-magenta">Read the Refund Policy</Link>,
    },
    {
      icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v4l3 2",
      title: "Response Time",
      text: "We answer every email, usually within 1 to 2 business days.",
      action: <span className="block rounded-xl bg-pink-50 px-4 py-3 text-sm font-semibold text-ink">Mon to Fri, US hours</span>,
    },
  ];
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.title} className="rounded-card border border-pink-100 bg-white p-6 text-center shadow-[0_12px_32px_-18px_rgba(225,48,108,0.45)]">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cta text-white shadow-lg">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
          </span>
          <h3 className="mt-4 text-lg font-bold text-ink">{c.title}</h3>
          <p className="mt-2 text-[15px] text-gray-600">{c.text}</p>
          <div className="mt-5">{c.action}</div>
        </div>
      ))}
    </div>
  );
}

const meta: Record<Page, { badge: string; title: string; sub?: string }> = {
  terms: { badge: "Legal Information", title: "Terms of Service" },
  privacy: { badge: "Legal Information", title: "Privacy Policy" },
  refund: { badge: "Legal Information", title: "Refund Policy" },
  contact: { badge: "Get in Touch", title: "Contact Us", sub: "Questions, feedback or billing help? We're here for you." },
};

export default function Legal({ page }: { page: Page | string }) {
  const p = (page in meta ? page : "terms") as Page;
  const m = meta[p];
  useEffect(() => {
    document.title = `${m.title} | ${N}`;
    window.scrollTo(0, 0);
  }, [m.title]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffafa]">
      <Header />
      <main className="bg-gradient-to-b from-[#fff1f4] via-[#fdf7fa] to-[#fffafa] px-4 pb-16 pt-10 sm:pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-brand-magenta">
            {p === "contact" ? "✉️" : "📄"} {m.badge}
          </span>
          <h1 className="mt-5 text-[32px] font-extrabold tracking-tight text-ink sm:text-[40px]">{m.title}</h1>
          {m.sub && <p className="mt-2 text-gray-600">{m.sub}</p>}
          <p className={m.sub ? "mt-1 text-sm text-gray-500" : "mt-2 text-gray-600"}>Last updated: {p === "terms" ? TERMS_UPDATED : UPDATED}</p>
        </div>
        {p === "contact" ? (
          <div className="mx-auto mt-10 max-w-4xl">
            <Contact />
          </div>
        ) : (
          <article className="mx-auto mt-10 max-w-3xl rounded-[20px] border border-line bg-white p-6 shadow-[0_12px_40px_-24px_rgba(17,24,39,0.35)] sm:p-12">
            {p === "terms" && <Terms />}
            {p === "privacy" && <Privacy />}
            {p === "refund" && <Refund />}
          </article>
        )}
      </main>
      <Footer />
      <ChatBubble />
    </div>
  );
}
