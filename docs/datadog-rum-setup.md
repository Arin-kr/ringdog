## Datadog RUM 설정 방법

1. FE 환경에 RUM Package 설치
    npm install @datadog/browser-rum

2. FE Application에 Package 삽입 및 초기화하여 FE 서비스 재배포
    import { datadogRum } from '@datadog/browser-rum';

    datadogRum.init({
        applicationId: '<RUM_APP_ID>',
        clientToken: '<RUM_CLIENT_TOKEN>',
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
        // defaultPrivacyLevel: 'allow',	// 'mask-user-input' | 'allow' | 'mask'
    });