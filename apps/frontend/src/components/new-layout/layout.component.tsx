'use client';

import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { usePlan } from '@gitroom/frontend/components/layout/use-plan.hook';

const planColorByName: Record<string, string> = {
  Free: '#6b7280',
  Basic: '#2196f3',
  Starter: '#2196f3',
  Premium: '#e91e63',
  Growth: '#10B981',
  Grow: '#4caf50',
  'Video Creator': '#8B5CF6',
  'Agency Pro': '#10B981',
};

const PlanBadge = () => {
  const { data: plan } = usePlan();
  const { studioToolsUrl, isGeneral } = useVariables();
  const planName = plan?.planName || 'Free';
  const color = planColorByName[planName] || '#6b7280';
  const pricingUrl = studioToolsUrl
    ? `${studioToolsUrl}/pricing`
    : isGeneral
      ? 'https://studio-tools.letstok.com/pricing'
      : '/billing';

  return (
    <a
      href={pricingUrl}
      target={studioToolsUrl || isGeneral ? '_blank' : undefined}
      rel={studioToolsUrl || isGeneral ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-[5px] rounded-md px-[8px] py-[3px] text-[12px] font-medium text-white transition-opacity hover:opacity-80"
      style={{ backgroundColor: color }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
      {planName} Plan
    </a>
  );
};

const UpgradeBadge = () => {
  const { data: plan } = usePlan();
  const { studioToolsUrl, isGeneral } = useVariables();
  const planName = plan?.planName || 'Free';

  if (planName !== 'Free') return null;

  const pricingUrl = studioToolsUrl
    ? `${studioToolsUrl}/pricing`
    : isGeneral
      ? 'https://studio-tools.letstok.com/pricing'
      : '/billing';

  return (
    <a
      href={pricingUrl}
      target={studioToolsUrl || isGeneral ? '_blank' : undefined}
      rel={studioToolsUrl || isGeneral ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[6px] text-[12px] font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-95"
      style={{
        backgroundImage:
          'linear-gradient(135deg, #f24462, #f1335f 49%, #ffc444)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z" />
      </svg>
      Upgrade
    </a>
  );
};

const TutorialVideoButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        data-tooltip-id="tooltip"
        data-tooltip-content="Tutorial Video"
        className="relative cursor-pointer select-none"
        onClick={() => setOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hover:text-newTextColor"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-[900px] mx-[24px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -top-[40px] end-0 text-white/80 hover:text-white transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
              >
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="relative w-full pt-[56.25%] rounded-[12px] overflow-hidden bg-black">
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube-nocookie.com/embed/L7UxTYtEZq4?rel=0&modestbranding=1"
                title="Tutorial Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MobileWarning = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('mobile-warning-dismissed');
    if (!dismissed && window.innerWidth < 768) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleContinue = () => {
    sessionStorage.setItem('mobile-warning-dismissed', '1');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-newBgColorInner p-8 text-center shadow-2xl max-w-[340px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-textItemBlur"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <div>
          <h2 className="text-[18px] font-[700] text-newTextColor mb-2">
            Desktop Recommended
          </h2>
          <p className="text-[14px] text-textItemBlur leading-relaxed">
            This app is optimized for desktop screens. For the best experience,
            please switch to a computer.
          </p>
        </div>
        <button
          onClick={handleContinue}
          className="w-full rounded-lg border border-newColColor px-4 py-2.5 text-[14px] font-[500] text-newTextColor transition-colors hover:bg-newBgColorInner/80"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
};

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral, studioToolsUrl } = useVariables();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <MobileWarning />
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px]',
                jakartaSans.className
              )}
            >
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && !isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <div className="flex-1 flex gap-[8px]">
                  <Support />
                  <div className="flex flex-col bg-newBgColorInner w-[80px] rounded-[12px]">
                    <div
                      className={clsx(
                        'fixed h-full w-[64px] start-[17px] flex flex-1 top-0',
                        user?.admin && 'pt-[60px] max-h-[1000px]:w-[500px]'
                      )}
                    >
                      <div className="flex flex-col h-full gap-[32px] flex-1 py-[12px]">
                        <Logo />
                        <TopMenu />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                    <div className="flex bg-newBgColorInner h-[80px] px-[20px] items-center">
                      <div className="text-[24px] font-[600] flex flex-1">
                        <Title />
                      </div>
                      <div className="flex gap-[20px] text-textItemBlur">
                        {studioToolsUrl && isGeneral && (
                          <>
                            <a
                              href={studioToolsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-full border border-[#f24462]/20 bg-gradient-to-r from-[#f24462]/10 via-[#f1335f]/8 to-[#ffc444]/10 px-[14px] py-[5px] text-sm font-semibold text-[#f24462] transition-all duration-300 ease-in-out hover:from-[#f24462]/20 hover:via-[#f1335f]/15 hover:to-[#ffc444]/20 hover:border-[#f24462]/40 hover:shadow-[0_0_12px_rgba(242,68,98,0.15)] hover:scale-105"
                              title="Create AI-powered video ads & content"
                            >
                              <img
                                src="/icons/letstok-favicon.svg"
                                alt="Letstok AI"
                                width={20}
                                height={20}
                                className="rounded-sm drop-shadow-sm"
                              />
                              <span>Letstok AI</span>
                            </a>
                            <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          </>
                        )}
                        <UpgradeBadge />
                        <PlanBadge />
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <StreakComponent />
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <OrganizationSelector />
                        <div className="hover:text-newTextColor">
                          <ModeComponent />
                        </div>
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <LanguageComponent />
                        <ChromeExtensionComponent />
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <TutorialVideoButton />
                        <AttachToFeedbackIcon />
                        <NotificationComponent />
                      </div>
                    </div>
                    <div className="flex flex-1 gap-[1px]">{children}</div>
                  </div>
                </div>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
