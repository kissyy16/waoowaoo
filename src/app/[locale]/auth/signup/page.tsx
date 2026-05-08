'use client'

import { useTranslations } from 'next-intl'
import Navbar from "@/components/Navbar"
import { Link } from '@/i18n/navigation'

export default function SignUp() {
  const t = useTranslations('auth')

  return (
    <div className="glass-page min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="glass-surface-modal p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-[var(--glass-text-primary)] mb-2">
                {t('signupClosedTitle')}
              </h1>
              <p className="text-[var(--glass-text-secondary)]">{t('signupClosedDescription')}</p>
            </div>

            <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--glass-tone-warning-fg)_22%,transparent)] bg-[var(--glass-tone-warning-bg)] px-4 py-3 text-sm text-[var(--glass-tone-warning-fg)]">
              {t('signupClosedHint')}
            </div>

            <div className="mt-6 text-center">
              <Link href={{ pathname: '/auth/signin' }} className="glass-btn-base glass-btn-primary inline-flex px-5 py-2.5 text-sm font-medium">
                {t('signinNow')}
              </Link>
            </div>

            <div className="mt-6 text-center">
              <Link href={{ pathname: '/' }} className="text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] text-sm">
                {t('backToHome')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
