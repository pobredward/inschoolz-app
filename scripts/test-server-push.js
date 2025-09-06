#!/usr/bin/env node
/**
 * 서버에서 직접 푸시 알림을 보내는 테스트 스크립트
 * Node.js 환경에서 실행됩니다.
 */

// 실제 서비스에서는 이 함수를 서버 코드에 포함시키세요
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  const message = {
    to: expoPushToken, // 알림을 받을 대상 토큰
    sound: 'default',  // 알림 도착 시 소리
    title: title,      // 알림 제목
    body: body,        // 알림 본문
    data: data,        // 앱에서 추가적으로 사용할 데이터
    priority: 'high',  // 높은 우선순위
    // Android 특화 설정
    android: {
      channelId: 'default',
      sound: true,
      priority: 'high',
      vibrate: true,
      color: '#FF231F7C', // 인스쿨즈 브랜드 컬러
    },
    // iOS 특화 설정
    ios: {
      sound: true,
      _displayInForeground: true,
    },
  };

  try {
    console.log('📤 푸시 알림 발송 중...');
    console.log('📱 대상 토큰:', expoPushToken.substring(0, 30) + '...');
    console.log('📋 메시지:', { title, body, data });
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer YOUR_EXPO_ACCESS_TOKEN` // Access Token 방식 사용 시
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 푸시 알림 발송 성공!');
      console.log('📊 결과:', result);
      
      // 발송 영수증 확인 (선택사항)
      if (result.data && result.data.id) {
        console.log('🧾 영수증 ID:', result.data.id);
        // 실제 서비스에서는 이 ID로 발송 상태를 확인할 수 있습니다
      }
      
      return { success: true, result };
    } else {
      console.error('❌ 푸시 알림 발송 실패!');
      console.error('📄 오류 응답:', result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('🚨 네트워크 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 여러 사용자에게 동시 발송하는 함수
async function sendBatchPushNotification(expoPushTokens, title, body, data = {}) {
  const message = {
    to: expoPushTokens, // 토큰 배열
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
    android: {
      channelId: 'default',
      sound: true,
      priority: 'high',
      vibrate: true,
      color: '#FF231F7C',
    },
    ios: {
      sound: true,
      _displayInForeground: true,
    },
  };

  try {
    console.log('📤 배치 푸시 알림 발송 중...');
    console.log('👥 대상 사용자 수:', expoPushTokens.length);
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('✅ 배치 발송 완료!');
    console.log('📊 결과:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('🚨 배치 발송 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// 테스트 실행 함수
async function runTest() {
  console.log('🧪 서버 푸시 알림 테스트 시작');
  console.log('=' .repeat(50));
  
  // 실제 Expo Push Token을 여기에 입력하세요
  // 앱에서 로그인한 후 콘솔에서 토큰을 확인할 수 있습니다
  const testToken = process.argv[2];
  
  if (!testToken) {
    console.log('❗ 사용법: node test-server-push.js [EXPO_PUSH_TOKEN]');
    console.log('');
    console.log('📝 Expo Push Token은 다음 위치에서 확인할 수 있습니다:');
    console.log('   1. 앱 로그인 후 콘솔 로그 확인');
    console.log('   2. Firebase 사용자 문서의 pushTokens 필드');
    console.log('   3. https://expo.dev/notifications 에서 테스트한 토큰');
    console.log('');
    console.log('📱 예시 토큰 형식: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    return;
  }
  
  // 개별 발송 테스트
  console.log('🎯 테스트 1: 개별 푸시 알림 발송');
  await sendPushNotification(
    testToken,
    '🚀 서버 테스트 알림',
    '서버에서 직접 보내는 푸시 알림이 성공적으로 작동합니다!',
    { 
      testType: 'server-direct',
      timestamp: Date.now(),
      messageId: Math.random().toString(36).substr(2, 9)
    }
  );
  
  console.log('');
  console.log('⏳ 3초 후 다음 테스트...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 화면 꺼짐 상태 테스트
  console.log('🎯 테스트 2: 화면 꺼짐 상태 테스트');
  await sendPushNotification(
    testToken,
    '🔔 화면 꺼짐 테스트',
    '화면이 꺼져있어도 소리가 나고 미리보기가 보여야 합니다',
    { 
      testType: 'screen-off-test',
      timestamp: Date.now()
    }
  );
  
  console.log('');
  console.log('✨ 테스트 완료! 기기에서 알림을 확인해보세요.');
  console.log('📱 화면을 끄고 알림이 오는지도 테스트해보세요!');
}

// 명령줄에서 직접 실행된 경우에만 테스트 실행
if (require.main === module) {
  runTest().catch(console.error);
}

// 함수들을 모듈로 내보내기 (다른 파일에서 import 가능)
module.exports = {
  sendPushNotification,
  sendBatchPushNotification
};
