import { Metadata } from 'next';
import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Policy - Letstok Social',
  description: 'Privacy Policy for Letstok Social social media scheduling platform',
};

export default function PrivacyTermsPage() {
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

        <h1 className="text-2xl font-semibold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none space-y-6 text-sm">
          <h2 className="text-lg font-semibold mt-8 mb-3">1. Introduction</h2>
          <p>
            Welcome to Letstok Social (social.letstok.com). We value your privacy and
            are committed to protecting your personal data. This Privacy Policy
            outlines how we collect, use, and safeguard your information when you
            visit our website and use our social media scheduling services.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            2. Information We Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Cookies:</strong> Our website uses cookies to enhance
              user experience, track user activity, and improve our services.
              You can control cookie settings through your browser.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect information automatically
              about your interaction with our website, such as IP addresses,
              browser type, device information, and pages visited.
            </li>
            <li>
              <strong>Personal Data:</strong> We collect personal data that you
              voluntarily provide when you register, fill out a form, or
              communicate with us. This includes your name, email address, phone
              number, and other contact information.
            </li>
          </ul>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            3. How We Use Your Information
          </h2>
          <p>We use the information we collect for various purposes, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Providing and maintaining our services</li>
            <li>Communicating with you about updates, offers, and promotional content</li>
            <li>Improving our website and services through analysis of user behavior</li>
            <li>Complying with legal obligations and protecting our rights</li>
          </ul>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            4. Sharing Your Information
          </h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal data to
            outside parties except:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To comply with legal requirements, enforce our policies, or protect our rights</li>
            <li>For processing by our service providers who assist us in operating our website</li>
            <li>When we have your consent</li>
          </ul>

          <h2 className="text-lg font-semibold mt-8 mb-3">5. Data Security</h2>
          <p>
            We implement a variety of security measures to maintain the safety
            of your personal data. However, no method of transmission over the
            internet or electronic storage is completely secure, and we cannot
            guarantee absolute security.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            6. Your Data Protection Rights
          </h2>
          <p>
            Depending on your location, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The right to access – You can request copies of your personal data.</li>
            <li>The right to rectification – You can request correction of inaccurate or incomplete data.</li>
            <li>The right to erasure – You can request deletion of your personal data, under certain conditions.</li>
            <li>The right to restrict processing – You can request limitation of data processing, under certain conditions.</li>
            <li>The right to object to processing – You can object to our processing of your personal data, under certain conditions.</li>
            <li>The right to data portability – You can request transfer of your data to another organization, or directly to you, under certain conditions.</li>
          </ul>
          <p>
            To exercise these rights, please contact us at{' '}
            <a
              href="mailto:info@letstok.com"
              className="underline hover:font-bold text-[var(--new-table-text-focused)]"
            >
              info@letstok.com
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">7. Third-Party Links</h2>
          <p>
            Our website may contain links to third-party websites, including
            social media platforms that we integrate with. We are not
            responsible for the privacy practices or content of these external
            sites.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">
            8. Changes to This Privacy Policy
          </h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the effective date.
          </p>

          <h2 className="text-lg font-semibold mt-8 mb-3">9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <p>
            Email: info@letstok.com
            <br />
            Address: Haoman 10, Hadera, Israel, 388501
          </p>
        </div>

        <p className="mt-12 pt-8 border-t border-[var(--new-sep)] text-sm text-[var(--new-textItemBlur)]">
          Copyright © 2023, Letstok Technologies Ltd. All rights reserved.
          <br />
          Last Updated: January 01, 2024
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/terms-and-condition"
            className="text-sm underline hover:font-bold text-[var(--new-table-text-focused)]"
          >
            Terms and Conditions
          </Link>
          <Link
            href="/auth"
            className="text-sm underline hover:font-bold text-[var(--new-table-text-focused)]"
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
