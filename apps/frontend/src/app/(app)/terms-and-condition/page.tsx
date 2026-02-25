import { Metadata } from 'next';
import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms and Conditions - Letstok Social',
  description: 'Terms and Conditions for Letstok Social social media scheduling platform',
};

export default function TermsAndConditionPage() {
  return (
    <div className="min-h-screen bg-[var(--new-bgColor)] text-[var(--new-btn-text)] p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-[var(--new-textItemBlur)] hover:text-[var(--new-btn-text)] mb-8"
        >
          ← Back to Sign In
        </Link>
        <div className="mb-8">
          <LogoTextComponent />
        </div>

        <h1 className="text-2xl font-semibold mb-6">Terms and Conditions</h1>

        <p className="text-sm text-[var(--new-textItemBlur)] mb-8">
          PLEASE NOTE THAT YOUR USE OF AND ACCESS TO OUR WEBSITE ARE SUBJECT TO
          THE FOLLOWING TERMS. YOU SHOULD READ THROUGH ALL THE TERMS CAREFULLY AS
          THEY CONSTITUTE A LEGALLY BINDING AGREEMENT BETWEEN YOU AND US. IF YOU
          DO NOT AGREE TO ALL OF THE FOLLOWING, YOU MAY NOT USE OR ACCESS THE
          WEBSITE IN ANY MANNER.
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm">
          <p>
            These Terms of Use (the &quot;Terms&quot;) are a binding contract
            between you and Letstok Technologies Ltd. (the &quot;Company&quot;,
            &quot;we&quot;, &quot;us&quot; or &quot;our&quot;). By accessing or
            using the Website (https://social.letstok.com/), you acknowledge
            that you have read and understood and agree to comply with the terms
            and conditions below, and these Terms will remain in effect at all
            times while you use the Website.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            1. Definitions
          </h2>
          <p>
            In these Terms the following terms have the meanings ascribed next
            to them:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>User Data</strong> means any Personal Data and/or
              Non-Personal Data, as such terms are defined in our{' '}
              <Link
                href="/privacy-terms"
                className="underline hover:font-bold text-[var(--new-table-text-focused)]"
              >
                Privacy Policy
              </Link>
              , or other information relating to the User which is collected,
              processed or accessed while a User browses or uses the Website.
            </li>
            <li>
              <strong>User</strong> means any natural person visiting and using
              our Website.
            </li>
            <li>
              <strong>Content</strong> means visual, audio, numeric, graphical,
              text or other data or content, which is displayed or made
              available through the Website or otherwise by us.
            </li>
            <li>
              <strong>Website</strong> means our website available at
              https://social.letstok.com/ providing social media scheduling and
              management services; for clarity, the term &quot;Website&quot;
              includes all Content on the Website.
            </li>
          </ul>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            2. Permitted Use
          </h2>
          <p>
            The Website may only be used in compliance with all applicable laws
            and for legitimate purposes. You may use the Website only for your
            own purposes and in accordance with these Terms.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            3. User Responsibility
          </h2>
          <p>
            User represents and warrants that: (i) the User Data and all other
            data you provide is accurate and complete, lawful and
            non-infringing. (ii) your use or access of the Website will not: (a)
            infringe on the intellectual property rights of any third party or
            any rights of publicity or privacy; (b) violate any law, statute, or
            ordinance or regulation; (c) create or cause any viruses, Trojan
            horses, worms, time bombs, cancelbots or other computer programming
            routines that are intended to damage, detrimentally interfere with,
            surreptitiously intercept or expropriate any system, data or
            personal information; (d) create or cause any damages, corruption,
            loss, interferences, security intrusions or any failure of any
            systems.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            4. Restrictions
          </h2>
          <p>
            Except as expressly permitted in these Terms, you may not, and shall
            not allow any third party to: (i) give, sell, rent, lease,
            timeshare, sublicense, disclose, publish, assign, market, sell,
            display, transmit, broadcast, transfer or distribute any portion of
            the Website or Content to any third party; (ii) circumvent, disable
            or otherwise interfere with security-related features of the
            Website; (iii) reverse engineer, decompile or disassemble the
            Website, or any components thereof; (iv) copy, modify, translate,
            patch, improve, alter, change or create any derivative works of the
            Website; (v) use any robot, spider, scraper or other automated
            means to access or monitor the Website; (vi) take any action that
            imposes an unreasonable or disproportionately large load on our
            infrastructure; (vii) interfere with the integrity or proper
            working of the Website; (viii) use the Website in any unlawful
            manner or for any harmful, irresponsible or inappropriate purpose.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">5. Security</h2>
          <p>
            The Company agrees during the provision of the Website to implement
            reasonable security measures to protect User Data and will, at a
            minimum, utilize industry standard security procedures, as described
            in our{' '}
            <Link
              href="/privacy-terms"
              className="underline hover:font-bold text-[var(--new-table-text-focused)]"
            >
              Privacy Policy
            </Link>
            . However, because of the nature of the Internet, the Company cannot
            ensure and we shall not be held liable for any wrongdoings,
            malfunctions, unlawful interceptions or access, or other kinds of
            abuse and misuse.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            6. Technological Tools for Collection of Information
          </h2>
          <p>
            Depending on your computer settings, you may be allowed to refuse
            the use of cookies and similar tools. However, this may affect your
            ability to use the Website. We may use analytics tools to help us
            understand user behavior on our Website. We may use Google
            Analytics; further information is available at{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:font-bold text-[var(--new-table-text-focused)]"
            >
              https://policies.google.com/privacy
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            7. Links to Other Websites
          </h2>
          <p>
            The Website may provide links to third-party websites or services.
            Links to such third-party sites do not constitute any endorsement by
            the Company. We are not responsible for the quality, suitability or
            accuracy of the products, content, materials or information
            presented by such sites.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            8. Intellectual Property
          </h2>
          <p>
            User Data remains your exclusive property. The Website and Content,
            including all related intellectual property rights, are the exclusive
            property of the Company. You do not obtain any rights in our
            technology or intellectual property.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">9. Privacy Policy</h2>
          <p>
            You acknowledge and agree that we will use any Personal Data that
            we may collect or obtain in accordance with our{' '}
            <Link
              href="/privacy-terms"
              className="underline hover:font-bold text-[var(--new-table-text-focused)]"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            10. Warranty and Disclaimer
          </h2>
          <p>
            THE WEBSITE AND CONTENT ARE PROVIDED ON AN &quot;AS IS&quot; AND
            &quot;AS AVAILABLE&quot; BASIS, AND WITHOUT WARRANTIES OF ANY KIND
            EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE WEBSITE AND
            CONTENT WILL MEET USER&apos;S REQUIREMENTS. YOU ASSUME ALL
            RESPONSIBILITY FOR ACCESSING AND USING THE WEBSITE AND CONTENT. THE
            COMPANY HEREBY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            11. Limitation of Liability
          </h2>
          <p>
            IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, SPECIAL,
            INCIDENTAL, CONSEQUENTIAL OR PUNITIVE CLAIMS, LOSSES, OR DAMAGES
            RELATED TO OR IN CONNECTION WITH THE WEBSITE OR CONTENT. YOUR SOLE
            REMEDY FOR ANY CLAIMS IN CONNECTION WITH THE WEBSITE IS TO
            DISCONTINUE USING THE WEBSITE.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            12. Indemnification
          </h2>
          <p>
            User shall indemnify, defend and hold harmless the Company, its
            affiliates and its and their respective officers, directors and
            employees from and against any and all claims, damages, actions and
            causes of action in connection with the Website, or in connection
            with any misuse or misconduct by User.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            13. Modifications
          </h2>
          <p>
            The Company reserves the right to change, modify, amend, suspend or
            discontinue any aspect of the Website or Content at any time. If you
            do not agree to the new or different terms, you should discontinue
            using the Website.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">14. Termination</h2>
          <p>
            The Company may terminate your use of the Website at any time and
            without prior written notice if you have breached these Terms.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">15. Severability</h2>
          <p>
            If any provision of these Terms is held to be invalid or
            unenforceable, the remainder of these Terms shall continue in full
            force and effect.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">16. Governing Law</h2>
          <p>
            This Agreement shall be governed by and interpreted in accordance
            with the laws of the State of Israel. The exclusive jurisdiction
            shall vest with the competent courts in the city of Tel Aviv-Yafo,
            Israel.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">17. General</h2>
          <p>
            These Terms and the Privacy Policy represent the complete agreement
            concerning the Website between you and the Company. The failure of
            the Company to exercise or enforce any right or provision will not
            be deemed a waiver of such right or provision.
          </p>
        </div>

        <p className="mt-12 pt-8 border-t border-[var(--new-sep)] text-sm text-[var(--new-textItemBlur)]">
          Copyright © 2023, Letstok Technologies Ltd. All rights reserved.
          <br />
          Last Updated: January 2024
        </p>

        <Link
          href="/auth"
          className="inline-block mt-8 text-sm underline hover:font-bold text-[var(--new-table-text-focused)]"
        >
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}
