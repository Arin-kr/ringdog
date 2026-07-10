## Datadog RUM 설정 방법

1. FE 환경에 RUM Package 설치
    npm install @datadog/browser-rum @datadog/browser-rum-nextjs

2. FE Application에 Package 삽입 및 초기화하여 FE 서비스 재배포
    import { datadogRum } from '@datadog/browser-rum';
    import { nextjsPlugin } from '@datadog/browser-rum-nextjs';

    datadogRum.init({
        applicationId: '<app_id>',
        clientToken: '<client_token>',
        site: 'datadoghq.com',
        service: 'ringdog-fe',
        env: 'demo',				// e.g. 'prod', 'staging-1', 'dev'
        version: '1.0.0',	// e.g. '1.0.0'
        sessionSampleRate: 100,			// capture 100% of sessions
        sessionReplaySampleRate: 20,	// capture 20% of sessions with replay
        trackResources: true,			// Enable Resource tracking
        trackUserInteractions: true,	// Enable Action tracking
        trackLongTasks: true,			// Enable Long Tasks tracking

        // ----- Recommended Options -----
        // allowedTracingUrls: '<BACKEND_URL>',		// Enable distributed tracing
        // defaultPrivacyLevel: 'mask-user-input',	// 'mask-user-input' | 'allow' | 'mask'
        plugins: [nextjsPlugin()],
    });
    export { onRouterTransitionStart } from '@datadog/browser-rum-nextjs';

3. Add Datadog Component (Add the Datadog router component to your root layout or custom App. This enables automatic route change tracking and view name normalization for dynamic routes.)

    // app/layout.tsx
    import { DatadogAppRouter } from '@datadog/browser-rum-nextjs';

    export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
            <html lang="en">
                <body>
                    <DatadogAppRouter />
                    {children}
                </body>
            </html>
        );
    }

    // pages/_app.tsx
    import { DatadogPagesRouter } from '@datadog/browser-rum-nextjs';
    import type { AppProps } from 'next/app';

    export default function App({ Component, pageProps }: AppProps) {
        return (
            <>
                <DatadogPagesRouter />
                <Component {...pageProps} />
            </>
        );
    }

4. Add Error Tracking (Optional - Report errors from error boundaries to Datadog RUM.)

    // app/error.tsx
    'use client';

    import { useEffect } from 'react';
    import { addNextjsError } from '@datadog/browser-rum-nextjs';

    export default function Error(
        { error, reset }: { error: Error & { digest?: string }; reset: () => void }
    ) {
        useEffect(() => {
            addNextjsError(error);
        }, [error])

        return <button onClick={reset}>Try again</button>
    }

    // app/global-error.tsx
    'use client'

    import { useEffect } from 'react'
    import { addNextjsError } from '@datadog/browser-rum-nextjs'

    export default function GlobalError(
        { error, reset }: { error: Error & { digest?: string }; reset: () => void }
    ) {
        useEffect(() => {
            addNextjsError(error);
        }, [error])

        return (
            <html>
                <body>
                    <button onClick={reset}>Try again</button>
                </body>
            </html>
        );
    }

    // pages/_app.tsx
    import type { AppProps } from 'next/app';
    import { DatadogPagesRouter, ErrorBoundary } from '@datadog/browser-rum-nextjs';

    export default function MyApp({ Component, pageProps }: AppProps) {
        return (
            <>
                <DatadogPagesRouter />
                <ErrorBoundary
                    fallback={({ resetError }) => (
                        <div>
                            <p>Something went wrong</p>
                            <button onClick={resetError}>Try again</button>
                        </div>
                    )}
                >
                    <Component {...pageProps} />
                </ErrorBoundary>
            </>
        );
    }